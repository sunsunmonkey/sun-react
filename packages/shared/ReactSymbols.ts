const supportSymbol = typeof Symbol == 'function' && Symbol.for;
export const REACT_ELEMENT = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;

export const REACT_FRAGMENT = supportSymbol
	? Symbol.for('react.fragment')
	: 0xeacb;

export const REACT_CONTEXT = supportSymbol
	? Symbol.for('react.context')
	: 0xeacc;

export const REACT_PROVIDER = supportSymbol
	? Symbol.for('react.provider')
	: 0xeac2;

export const REACT_SUSPENSE = supportSymbol
	? Symbol.for('react.suspense')
	: 0xeac3;
