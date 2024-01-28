import { FiberNode } from 'react-reconciler/src/fiber';
import { REACT_MEMO } from 'shared/ReactSymbols';
import { Props } from 'shared/ReactTypes';

export function memo(
	type: FiberNode['type'],
	compare?: (oldProps: Props, newProps: Props) => boolean
) {
	const fiberType = {
		$$typeof: REACT_MEMO,
		type,
		compare: compare === undefined ? null : compare
	};

	return fiberType;
}
