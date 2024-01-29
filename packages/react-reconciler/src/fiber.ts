import { Key, Props, ReactElementType, Ref, Wakeable } from 'shared/ReactTypes';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	MemoComponent,
	OffscreenComponent,
	SuspenseComponent,
	workTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';
import {
	REACT_MEMO,
	REACT_PROVIDER,
	REACT_SUSPENSE
} from 'shared/ReactSymbols';
import { ContextItem } from './fiberContext';

interface FiberDependencies<Value> {
	firstContext: ContextItem<Value> | null;
	lanes: Lanes;
}
export class FiberNode {
	type: any;
	tag: workTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	ref: Ref | null;

	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	lanes: Lanes;
	childLanes: Lanes;

	dependencies: FiberDependencies<any> | null;

	constructor(tag: workTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key || null;
		this.stateNode = null;
		this.type = null;

		//构成树状结构
		//指向父fiberNode
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;
		this.ref = null;

		//作为工作单元
		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null;
		this.alternate = null;

		//副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;

		this.lanes = NoLanes;
		this.childLanes = NoLanes;

		this.dependencies = null;
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

export interface OffscreenProps {
	mode: 'visible' | 'hidden';
	children: any;
}

export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;
	pendingLanes: Lanes;
	finishedLane: Lane;
	pendingPassiveEffects: PendingPassiveEffects;
	callbackNode: CallbackNode | null;
	callbackPriority: Lane;
	pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null;
	suspendedLane: Lanes;
	pingLane: Lanes;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
		this.suspendedLane = NoLane;
		this.pingLane = NoLane;

		this.callbackNode = null;
		this.callbackPriority = NoLane;

		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};

		this.pingCache = null;
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		//mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		//update
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	wip.ref = current.ref;

	wip.lanes = current.lanes;
	wip.childLanes = current.childLanes;

	const currentDeps = current.dependencies;
	wip.dependencies =
		currentDeps === null
			? null
			: {
					lanes: current.lanes,
					firstContext: currentDeps.firstContext
			  };

	return wip;
};

export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props, ref } = element;
	let fiberTag: workTag = FunctionComponent;

	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type === 'object') {
		switch (type.$$typeof) {
			case REACT_PROVIDER:
				fiberTag = ContextProvider;
				break;
			case REACT_MEMO:
				fiberTag = MemoComponent;
				break;
			default:
				console.warn('未定义的type类型', element);
				break;
		}
	} else if (type === REACT_SUSPENSE) {
		fiberTag = SuspenseComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	fiber.ref = ref;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}

export function createFiberFromOffscreen(
	pendingProps: OffscreenProps
): FiberNode {
	const fiber = new FiberNode(OffscreenComponent, pendingProps, null);
	return fiber;
}
