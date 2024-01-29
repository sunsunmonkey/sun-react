import { ReactContext } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import {
	Lane,
	NoLanes,
	includeSomeLanes,
	isSubsetOfLanes,
	mergeLanes
} from './fiberLanes';
import { markWipReceiveUpdate } from './beginWork';
import { ContextProvider } from './workTags';

let lastContextDep: ContextItem<any> | null = null;
export interface ContextItem<Value> {
	context: ReactContext<Value>;
	memorizedState: Value;
	next: ContextItem<Value> | null;
}
let prevContextValue: any = null;
const prevContextStack: any[] = [];

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
	prevContextStack.push(prevContextValue);
	prevContextValue = context._currentValue;
	context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
	context._currentValue = prevContextValue;
	prevContextValue = prevContextStack.pop();
}

export function prepareToReadContext(wip: FiberNode, renderLane: Lane) {
	lastContextDep = null;

	const deps = wip.dependencies;
	if (deps !== null) {
		const firstContext = deps.firstContext;
		if (firstContext !== null) {
			if (includeSomeLanes(deps.lanes, renderLane)) {
				markWipReceiveUpdate();
			}
			deps.firstContext = null;
		}
	}
}

export function readContext<T>(
	consumer: FiberNode | null,
	context: ReactContext<T>
): T {
	if (consumer === null) {
		throw new Error('只能在函数组件中调用useContext');
	}
	const value = context._currentValue;
	const contextItem: ContextItem<T> = {
		context,
		next: null,
		memorizedState: value
	};
	if (lastContextDep === null) {
		lastContextDep = contextItem;
		consumer.dependencies = {
			firstContext: contextItem,
			lanes: NoLanes
		};
	} else {
		lastContextDep = lastContextDep.next = contextItem;
	}
	return value;
}

export function propagateContextChange<T>(
	wip: FiberNode,
	context: ReactContext<T>,
	renderLane: Lane
) {
	let fiber = wip.child;
	if (fiber !== null) {
		fiber.return = wip;
	}

	while (fiber !== null) {
		let nextFiber = null;
		const deps = fiber.dependencies;
		if (deps !== null) {
			nextFiber = fiber.child;

			let contextItem = deps.firstContext;
			while (contextItem !== null) {
				if (contextItem.context === context) {
					fiber.lanes = mergeLanes(fiber.lanes, renderLane);
					const alternate = fiber.alternate;
					if (alternate !== null) {
						alternate.lanes = mergeLanes(alternate.lanes, renderLane);
					}
					scheduleContextWorkOnParentPath(fiber.return, wip, renderLane);
					deps.lanes = mergeLanes(deps.lanes, renderLane);
					break;
				}
				contextItem = contextItem.next;
			}
		} else if (fiber.tag === ContextProvider) {
			nextFiber = fiber.type === wip.type ? null : fiber.child;
		} else {
			nextFiber = fiber.child;
		}

		if (nextFiber !== null) {
			nextFiber.return = fiber;
		} else {
			nextFiber = fiber;
			while (nextFiber !== null) {
				if (nextFiber === wip) {
					nextFiber = null;
					break;
				}
				const sibling = nextFiber.sibling;
				if (sibling !== null) {
					sibling.return = nextFiber.return;
					nextFiber = sibling;
					break;
				}
				nextFiber = nextFiber.return;
			}
		}
		fiber = nextFiber;
	}
}

function scheduleContextWorkOnParentPath(
	from: FiberNode | null,
	to: FiberNode,
	renderLane: Lane
) {
	let node = from;

	while (node !== null) {
		const alternate = node.alternate;

		if (!isSubsetOfLanes(node.childLanes, renderLane)) {
			node.childLanes = mergeLanes(node.childLanes, renderLane);
			if (alternate !== null) {
				alternate.childLanes = mergeLanes(alternate.childLanes, renderLane);
			}
		} else if (
			alternate !== null &&
			!isSubsetOfLanes(alternate.childLanes, renderLane)
		) {
			alternate.childLanes = mergeLanes(alternate.childLanes, renderLane);
		}

		if (node === to) {
			break;
		}
		node = node.return;
	}
}
