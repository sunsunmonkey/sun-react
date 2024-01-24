import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	Update,
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action, ReactContext } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';
import currentBatchConfig from 'react/src/currentBatchConfig';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHooK: Hook | null = null;
let currentHooK: Hook | null = null;
let renderLane: Lane = NoLane;

interface Hook {
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
	baseState: any;
	baseQueue: Update<any> | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallBack | void;
	destroy: EffectCallBack | void;
	deps: EffectDeps;
	next: Effect | null;
}
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

type EffectCallBack = () => void;
type EffectDeps = any[] | null;

const { currentDispatcher } = internals;
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	//赋值
	currentlyRenderingFiber = wip;
	//重置 hooks链表
	wip.memoizedState = null;
	renderLane = lane;
	//重置effect链表
	wip.updateQueue = null;

	const current = wip.alternate;
	if (current !== null) {
		//update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		//mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	currentlyRenderingFiber = null;
	workInProgressHooK = null;
	currentHooK = null;
	renderLane = NoLane;

	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef,
	useContext: readContext
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef,
	useContext: readContext
};

function mountEffect(create: EffectCallBack | void, deps: EffectDeps) {
	//建立hook间的链表关系
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(create: EffectCallBack | void, deps: EffectDeps) {
	//找到当前useState对应的hook数据
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallBack | void;
	if (currentHooK !== null) {
		const prevEffect = currentHooK.memorizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			//浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				//不相等依赖
				hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}

		//不相等依赖
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		hook.memorizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps)) {
			continue;
		}
		return false;
	}
	return true;
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallBack | void,
	destroy: EffectCallBack | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};
	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		//插入effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
	//找到当前useState对应的hook数据
	const hook = updateWorkInProgressHook();

	//计算新的state的逻辑
	const queue = hook.updateQueue as UpdateQueue<State>;
	const baseState = hook.baseState;

	const pending = queue.shared.pending;
	const current = currentHooK as Hook;
	//取出之前保存的baseQueue
	let baseQueue = current.baseQueue;

	if (pending !== null) {
		//pending baseQueue update保存在current中
		if (baseQueue !== null) {
			//让baseFirst在后面接上pending并形成环形链表
			const baseFirst = baseQueue?.next;
			const pendingFirst = pending.next;

			baseQueue.next = pendingFirst;
			pendingFirst!.next = baseFirst;
		}

		//注意从pending为合并后的尾指针保证了顺序
		baseQueue = pending;
		current.baseQueue = pending;
		queue.shared.pending = null;
	}

	if (baseQueue !== null) {
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane);

		hook.memorizedState = memoizedState;
		hook.baseState = newBaseState;
		hook.baseQueue = newBaseQueue;
	}

	return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgressHook(): Hook {
	// TODO render阶段触发的更新
	let nextCurrentHook: Hook | null;

	if (currentHooK === null) {
		// 这是这个FC update时的第一个hook
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			nextCurrentHook = current?.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	} else {
		//这个FC update 后续的hook
		nextCurrentHook = currentHooK.next;
	}

	if (nextCurrentHook === null) {
		//出现问题
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行的hook比上次多`
		);
	}

	currentHooK = nextCurrentHook as Hook;

	const newHook: Hook = {
		memorizedState: currentHooK.memorizedState,
		updateQueue: currentHooK.updateQueue,
		next: null,
		baseQueue: currentHooK.baseQueue,
		baseState: currentHooK.baseState
	};

	if (workInProgressHooK === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内执行hook');
		} else {
			workInProgressHooK = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHooK;
		}
	} else {
		//后续hook
		workInProgressHooK.next = newHook;
		workInProgressHooK = newHook;
	}

	return workInProgressHooK;
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	//找到当前useState对应的hook数据
	const hook = mountWorkInProgressHook();
	let memorizedState;
	if (initialState instanceof Function) {
		memorizedState = initialState();
	} else {
		memorizedState = initialState;
	}
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memorizedState = memorizedState;
	hook.baseState = memorizedState;

	//@ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;
	return [memorizedState, dispatch];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook() {
	const hook: Hook = {
		memorizedState: null,
		updateQueue: null,
		next: null,
		baseState: null,
		baseQueue: null
	};
	if (workInProgressHooK === null) {
		//mount 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内执行hook');
		} else {
			workInProgressHooK = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHooK;
		}
	} else {
		//mount 时后续hook
		workInProgressHooK.next = hook;
		workInProgressHooK = hook;
	}
	return workInProgressHooK;
}

function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setPending] = mountState(false);
	const hook = mountWorkInProgressHook();
	const start = startTransition.bind(null, setPending);
	hook.memorizedState = start;
	return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState();
	const hook = updateWorkInProgressHook();
	const start = hook.memorizedState;
	return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true);
	const prevTransition = currentBatchConfig.transition;
	currentBatchConfig.transition = 1;

	callback();
	setPending(false);

	currentBatchConfig.transition = prevTransition;
}

function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgressHook();
	const ref = { current: initialValue };
	hook.memorizedState = ref;
	return ref;
}

function updateRef<T>(): { current: T } {
	const hook = updateWorkInProgressHook();
	return hook.memorizedState;
}

function readContext<T>(context: ReactContext<T>): T {
	const consumer = currentlyRenderingFiber;
	if (consumer === null) {
		throw new Error('只能在函数组件中调用useContext');
	}
	const value = context._currentValue;
	return value;
}
