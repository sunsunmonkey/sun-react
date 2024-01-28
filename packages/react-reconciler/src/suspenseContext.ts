import { FiberNode } from './fiber';

const suspenseHandleStack: FiberNode[] = [];

export function getSuspenseHandler() {
	return suspenseHandleStack[suspenseHandleStack.length - 1];
}

export function pushSuspenseHandler(handler: FiberNode) {
	suspenseHandleStack.push(handler);
}

export function popSuspenseHandler() {
	suspenseHandleStack.pop();
}
