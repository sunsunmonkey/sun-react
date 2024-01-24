import { REACT_CONTEXT, REACT_PROVIDER } from 'shared/ReactSymbols';
import { ReactContext } from 'shared/ReactTypes';

export function createContext<T>(defaultValue: T): ReactContext<T> {
	const context: ReactContext<T> = {
		$$typeof: REACT_CONTEXT,
		Provider: null,
		_currentValue: defaultValue
	};

	context.Provider = {
		$$typeof: REACT_PROVIDER,
		_context: context
	};

	return context;
}
