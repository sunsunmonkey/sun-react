import { Key, Props, Ref } from 'shared/ReactTypes';
import { workTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

export class FiberNode {
	type: any;
	tag: workTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;

	return: FiberNode | null;
	sibiling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	ref: Ref;

	memoizedProps: Props | null;
	alternate: FiberNode | null;
	flags: Flags;
	constructor(tag: workTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key;
		this.stateNode = null;
		this.type = null;

		//构成树状结构
		//指向父fiberNode
		this.return = null;
		this.sibiling = null;
		this.child = null;
		this.index = 0;
		this.ref = null;

		//作为工作单元
		this.pendingProps = pendingProps;
		this.memoizedProps = null;

		this.alternate = null;

		//副作用
		this.flags = NoFlags;
	}
}
