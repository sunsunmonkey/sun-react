import { Action } from 'shared/ReactTypes';

export type Dispatch<State> = (action: Action<State>) => void;

export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: (callback: () => void | void, deps: any[]) => void;
	useTransition: () => [boolean, (callback: () => void) => void];
}

const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hook 只能在函数组件中执行');
	}

	return dispatcher;
};
export default currentDispatcher;
