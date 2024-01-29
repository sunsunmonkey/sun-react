//递归中的递

import { ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	OffscreenProps,
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress
} from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	MemoComponent,
	OffscreenComponent,
	SuspenseComponent
} from './workTags';
import {
	reconcileChildFibers,
	mountChildFibers,
	cloneChildFibers
} from './childFibers';
import { bailoutHook, renderWithHooks } from './fiberHooks';
import { Lane, NoLanes, includeSomeLanes } from './fiberLanes';
import {
	ChildDeletion,
	DidCapture,
	NoFlags,
	Placement,
	Ref
} from './fiberFlags';
import {
	prepareToReadContext,
	propagateContextChange,
	pushProvider
} from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';
import { shallowEqual } from 'shared/shallowEqual';

let didReceiveUpdate = false;

export function markWipReceiveUpdate() {
	didReceiveUpdate = true;
}

export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	didReceiveUpdate = false;
	const current = wip.alternate;

	if (current !== null) {
		const oldProps = current.memoizedProps;
		const newProps = wip.pendingProps;
		if (oldProps !== newProps || current.type !== wip.type) {
			didReceiveUpdate = true;
		} else {
			//state context
			const hasScheduledStateOrContext = checkScheduleUpdateOrContext(
				current,
				renderLane
			);
			if (!hasScheduledStateOrContext) {
				didReceiveUpdate = false;

				switch (wip.tag) {
					case ContextProvider:
						const newValue = wip.memoizedProps.value;
						const context = wip.type._context;
						pushProvider(context, newValue);
				}
				return bailOnAlreadyFinishedWork(wip, renderLane);
			}
		}
	}

	wip.lanes = NoLanes;

	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, wip.type, renderLane);
		case Fragment:
			return updateFragment(wip);
		case ContextProvider:
			return updateContextProvider(wip, renderLane);
		case SuspenseComponent:
			return updateSuspenseComponent(wip);
		case OffscreenComponent:
			return updateOffscreenComponent(wip);
		case MemoComponent:
			return updateMemoComponent(wip, renderLane);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
};

function updateMemoComponent(wip: FiberNode, renderLane: Lane) {
	//bailout四要素
	//props浅比较
	const current = wip.alternate;
	const nextProps = wip.pendingProps;
	const Component = wip.type.type;

	if (current !== null) {
		const preProps = current.memoizedProps;
		if (shallowEqual(preProps, nextProps) && current.ref === wip.ref) {
			didReceiveUpdate = false;
			wip.pendingProps = preProps;
			wip.lanes = current.lanes;
			if (!checkScheduleUpdateOrContext(current, renderLane)) {
				return bailOnAlreadyFinishedWork(wip, renderLane);
			}
		}
	}
	return updateFunctionComponent(wip, Component, renderLane);
}

function bailOnAlreadyFinishedWork(wip: FiberNode, renderLane: Lane) {
	if (!includeSomeLanes(wip.childLanes, renderLane)) {
		if (__DEV__) {
			console.warn('bailout整棵子树', wip);
		}
		return null;
	}
	if (__DEV__) {
		console.warn('bailout一个fiber', wip);
	}
	cloneChildFibers(wip);
	return wip.child;
}

function checkScheduleUpdateOrContext(
	current: FiberNode,
	renderLane: Lane
): boolean {
	const updateLane = current.lanes;

	if (includeSomeLanes(updateLane, renderLane)) {
		return true;
	}
	return false;
}

function updateSuspenseComponent(wip: FiberNode) {
	const current = wip.alternate;
	const newProps = wip.pendingProps;

	let showFallback = false;
	const didSuspend = (wip.flags & DidCapture) !== NoFlags;

	if (didSuspend) {
		showFallback = true;
		wip.flags &= ~DidCapture;
	}

	const nextPrimaryChildren = newProps.children;
	const nextFallbackChildren = newProps.fallback;
	pushSuspenseHandler(wip);

	if (current === null) {
		//mount
		if (showFallback) {
			//挂起
			return mountSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		//update
		if (showFallback) {
			return updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
			//挂起
		} else {
			//正常
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};
	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;

	wip.child = primaryChildFragment;

	if (currentFallbackChildFragment !== null) {
		const deletions = wip.deletions;
		if (deletions === null) {
			wip.deletions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};
	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);

	let fallbackChildFragment;
	if (currentFallbackFragment !== null) {
		fallbackChildFragment = createWorkInProgress(
			currentFallbackFragment,
			fallbackChildren
		);
	} else {
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
		fallbackChildFragment.flags |= Placement;
	}

	fallbackChildFragment.return = wip;
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);

	wip.child = primaryChildFragment;
	primaryChildFragment.return = wip;
	return primaryChildFragment;
}

function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

	fallbackChildFragment.flags |= Placement;

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function updateOffscreenComponent(wip: FiberNode) {
	const newProps = wip.pendingProps;
	const nextChildren = newProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateContextProvider(wip: FiberNode, renderLane: Lane) {
	const providerType = wip.type;
	const context = providerType._context;
	const newProps = wip.pendingProps;
	const oldProps = wip.memoizedProps;
	const newValue = newProps.value;

	pushProvider(context, newProps.value);

	if (oldProps !== null) {
		const oldValue = oldProps.value;
		if (
			Object.is(oldValue, newValue) &&
			oldProps.children === newProps.children
		) {
			return bailOnAlreadyFinishedWork(wip, renderLane);
		} else {
			propagateContextChange(wip, context, renderLane);
		}
	}
	const nextChildren = newProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
function updateFunctionComponent(
	wip: FiberNode,
	Component: FiberNode['type'],
	renderLane: Lane
) {
	prepareToReadContext(wip, renderLane);
	//render
	const nextChildren = renderWithHooks(wip, Component, renderLane);
	const current = wip.alternate;

	if (current !== null && !didReceiveUpdate) {
		bailoutHook(wip, renderLane);
		return bailOnAlreadyFinishedWork(wip, renderLane);
	}
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;

	const prevChildren = wip.memoizedState;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memoizedState = memoizedState;

	const current = wip.alternate;
	if (current !== null) {
		if (!current.memoizedState) {
			current.memoizedState = memoizedState;
		}
	}
	const nextChildren = wip.memoizedState;
	if (prevChildren === nextChildren) {
		return bailOnAlreadyFinishedWork(wip, renderLane);
	}
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	markRef(wip.alternate, wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;
	if (current !== null) {
		//update
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		//mount
		wip.child = mountChildFibers(wip, null, children);
	}
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;

	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
