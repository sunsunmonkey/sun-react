import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHooK: Hook | null = null;

interface Hook {
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}
const { currentDispatcher } = internals;
export function renderWithHooks(wip: FiberNode) {
	//赋值
	currentlyRenderingFiber = wip;
	//重置
	wip.memoizedState = null;
	const current = wip.alternate;
	if (current !== null) {
		//update
	} else {
		//mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);
	currentlyRenderingFiber = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

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
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
}
function mountWorkInProgressHook() {
	const hook: Hook = {
		memorizedState: null,
		updateQueue: null,
		next: null
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
