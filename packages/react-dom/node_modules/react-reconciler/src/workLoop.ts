import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
}

export function scheduleUpdateOnFiber(fiber: FiberNode) {
	//TODO 调度功能
	const root = markUpdateFromToRoot(fiber);
	renderRoot(root);
}
//获取FiberRoot
function markUpdateFromToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}
export function renderRoot(root: FiberRootNode) {
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}

			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	commitRoot(root);
}
function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	//重置
	root.finishedWork = null;

	//三个子阶段是否存在是否存在需要执行的
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
	if (subtreeHasEffect || rootHasEffect) {
		//beforeMutation
		//mutation Placement
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
		//layout
	} else {
		root.current = finishedWork;
	}
}
function workLoop() {
	while (workInProgress !== null) {
		perfomUnitOfWork(workInProgress);
	}
}

//主要递归过程
function perfomUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;
	if (next == null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);
		const sibiling = node.sibiling;

		if (sibiling !== null) {
			workInProgress = sibiling;
			return;
		}

		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
