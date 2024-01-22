import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { Container, Instance } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT, REACT_FRAGMENT } from 'shared/ReactSymbols';
import * as Scheduler from 'scheduler';

let idCounter = 0;

export function createRoot() {
	const container: Container = {
		rootID: idCounter++,
		children: []
	};

	//@ts-ignore
	const root = createContainer(container);
	function getChildren(parent: Container | Instance) {
		if (parent) {
			return parent.children;
		}
		return null;
	}

	function getChildrenAsJSX(root: Container) {
		const children = childrenToJSX(getChildren(root));
		if (Array.isArray(children)) {
			return {
				$$typeof: REACT_ELEMENT,
				type: REACT_FRAGMENT,
				key: null,
				ref: null,
				props: { children },
				__mark: 'sunsunmonkey'
			};
		}
		return children;
	}

	function childrenToJSX(child: any): any {
		if (typeof child === 'string' || typeof child === 'number') {
			return child;
		}

		if (Array.isArray(child)) {
			if (child.length === 0) {
				return null;
			}

			if (child.length === 1) {
				return childrenToJSX(child[0]);
			}
			const children = child.map(childrenToJSX);

			if (
				child.every(
					(child) => typeof child === 'string' || typeof child === 'number'
				)
			) {
				return child.join;
			}
			return children;
		}

		if (Array.isArray(child.children)) {
			const instance: Instance = child;
			const children = childrenToJSX(instance.children);
			const props = instance.props;

			if (children !== null) {
				props.children = children;
			}

			return {
				$$typeof: REACT_ELEMENT,
				type: instance.type,
				key: null,
				ref: null,
				props,
				__mark: 'sunsunmonkey'
			};
		}
		//TextInstance

		return child.text;
	}
	return {
		_Scheduler: Scheduler,
		render(element: ReactElementType) {
			return updateContainer(element, root);
		},
		getChildren() {
			return getChildren(container);
		},
		getChildrenAsJSX() {
			return getChildrenAsJSX(container);
		}
	};
}
