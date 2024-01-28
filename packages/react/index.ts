import { Usable } from 'shared/ReactTypes';
import currentBatchConfig from './src/currentBatchConfig';
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher';
import { jsx, isValidElement as isValidElementFn } from './src/jsx';
export { createContext } from './src/context';
export {
	REACT_SUSPENSE as Suspense,
	REACT_FRAGMENT as Fragment
} from 'shared/ReactSymbols';
export { memo } from './src/memo';

export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useTransition();
};

export const useRef: Dispatcher['useRef'] = (initialValue) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useRef(initialValue);
};

export const useContext: Dispatcher['useContext'] = (context) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useContext(context);
};

export const use: Dispatcher['use'] = (useable: Usable<any>) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.use(useable);
};

//内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';

// TODO 根据环境区分使用jsx/jsxDEV
export const createElement = jsx;
export const isValidElement = isValidElementFn;
