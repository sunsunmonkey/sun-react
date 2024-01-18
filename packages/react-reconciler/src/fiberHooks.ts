import { FiberNode } from './fiber';

export function renderWithHooks(wip: FiberNode) {
	const Component = wip.type;
	const props = wip.pendingProps;
	const child = Component(props);

	return child;
}
