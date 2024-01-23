import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	createWorkInProgress,
	PendingPassiveEffects
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import { HostRoot } from './workTags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as normalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoseHasPassiveEffects: boolean = false;

type RootExistStatus = number;
const RootInComplete: RootExistStatus = 1;
const RootCompleted: RootExistStatus = 2;
//TODO 执行过程中报错

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	//TODO 调度功能
	const root = markUpdateFromToRoot(fiber);
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
}

//调度执行
function ensureRootIsScheduled(root: FiberRootNode) {
	//找到最高优先级的
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}

		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;

	if (curPriority === prevPriority) {
		return;
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	if (updateLane === SyncLane) {
		//同步用微任务调度
		if (__DEV__) {
			console.log('在微任务调度', updateLane);
		}
		//数组
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		//其他优先级，用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);

		newCallbackNode = scheduleCallback(
			schedulerPriority,
			//@ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}
//获取FiberRoot
function markUpdateFromToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

export function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 保证useEffect执行回调
	const curCallback = root.callbackNode;
	const didFlushPassiveEffects = flushPassiveEffects(
		root.pendingPassiveEffects
	);

	if (didFlushPassiveEffects) {
		//有更高优先级的调度
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}

	const lane = getHighestPriorityLane(root.pendingLanes);
	const curCallbackNode = root.callbackNode;

	if (lane === NoLane) {
		return null;
	}
	const needSync = lane === SyncLane || didTimeout;
	//render阶段
	const existStatus = renderRoot(root, lane, !needSync);
	ensureRootIsScheduled(root);

	if (existStatus === RootInComplete) {
		// 中断
		//有更高优先级存在不要在执行了，让步给其他
		if (root.callbackNode !== curCallbackNode) {
			return null;
		}

		return performConcurrentWorkOnRoot.bind(null, root);
	}

	if (existStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootRenderLane = NoLane;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现并发更新结束状态');
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		//其他较低优先级
		//NoLane
		ensureRootIsScheduled(root);
		return;
	}

	if (__DEV__) {
		console.warn('render阶段开始');
	}

	const existStatus = renderRoot(root, nextLane, false);
	if (existStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = nextLane;
		wipRootRenderLane = NoLane;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现同步更新结束状态');
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
	}

	//不等于才要重新初始化
	if (wipRootRenderLane !== lane) {
		prepareFreshStack(root, lane);
	}

	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}

			workInProgress = null;
		}
	} while (true);

	//中断执行
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}
	//render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('render结束不应该不为null');
	}

	return RootCompleted;
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finished不应该是NoLanes');
	}

	//重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	markRootFinished(root, lane);

	if (
		(finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags ||
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags
	) {
		if (!rootDoseHasPassiveEffects) {
			rootDoseHasPassiveEffects = true;
			//调度副作用
			scheduleCallback(normalPriority, () => {
				flushPassiveEffects(root.pendingPassiveEffects);
				//执行副作用
				return;
			});
		}
	}

	//三个子阶段是否存在是否存在需要执行的
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
	const rootHasEffect =
		(finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;
	if (subtreeHasEffect || rootHasEffect) {
		//beforeMutation
		//mutation Placement
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork;
		//layout
	} else {
		root.current = finishedWork;
	}

	rootDoseHasPassiveEffects = false;
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});

	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update = [];
	flushSyncCallbacks();

	return didFlushPassiveEffect;
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

//主要递归过程
function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRootRenderLane);
	fiber.memoizedProps = fiber.pendingProps;
	if (next == null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);
		const sibling = node.sibling;

		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}

		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
