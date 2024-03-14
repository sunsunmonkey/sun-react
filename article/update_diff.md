# 更新流程和diff算法

我们几乎所有流程都要从**scheduleUpdateOnFiber**开始

其他和流程和mount流程基本一致，值得注意的是
**prepareFreshStack** 会使用之前构建的root.current基础上复用child但是之前已经创建了一个fiber（root.current.alternate）
相当于两个fiber目前的child指向同一块

我们从beginwork开始看
```typescript
switch (wip.tag) {
        case HostRoot:
            return updateHostRoot(wip, renderLane);
        case HostComponent:
            return updateHostComponent(wip);
        case HostText:
            return null;
        case FunctionComponent:
            return updateFunctionComponent(wip, wip.type, renderLane);
        case Fragment:
            return updateFragment(wip);
        case ContextProvider:
            return updateContextProvider(wip, renderLane);
        case SuspenseComponent:
            return updateSuspenseComponent(wip);
        case OffscreenComponent:
            return updateOffscreenComponent(wip);
        case MemoComponent:
            return updateMemoComponent(wip, renderLane);
        default:
            if (__DEV__) {
                console.warn('beginWork未实现的类型');
            }
            break;
    }
```
核心还是不同类型的处理
我们可以主要看看ChildReconciler
在这里会有相应的diff
## 单节点diff
单节点注意指的是最后更新后变为单一节点
```typescript
function reconcileSingleElement(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        element: ReactElementType
    ) {
        const key = element.key;
        while (currentFiber !== null) {
            if (currentFiber.key === key) {
                //key 相同
                if (element.$$typeof === REACT_ELEMENT) {
                    if (currentFiber.type === element.type) {
                        let props = element.props;
                        if (element.type === REACT_FRAGMENT) {
                            props = element.props.children;
                        }
                        //type 相同
                        const existing = useFiber(currentFiber, props);
                        existing.return = returnFiber;
                        // 当前节点可复用，标记剩下的节点删除
                        deleteRemainingChildren(returnFiber, currentFiber.sibling);
                        return existing;
                    }
                    //key 相同 type 不同
                    deleteRemainingChildren(returnFiber, currentFiber);
                    break;
                } else {
                    if (__DEV__) {
                        console.warn('还未实现的react类型');
                        break;
                    }
                }
            } else {
                //key不同 删掉旧的
                deleteChild(returnFiber, currentFiber);
                currentFiber = currentFiber.sibling;
            }
        }
        let fiber;
        if (element.type === REACT_FRAGMENT) {
            fiber = createFiberFromFragment(element.props.children, key);
        } else {
            fiber = createFiberFromElement(element);
        }
        fiber.return = returnFiber;
        return fiber;
    }
```
单节点首先对比传入的key和type（普通元素就是div，p等）如果相同就可以进行复用
调用useFiber
```typescript
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
    //反复更新只有两个fiber
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
}
```
同时如果有兄弟由于更新后是单节点所有会标记删除
如果不同就会一直找其兄弟元素看是否可以复用
如果都没有就会走到createFiberFromElement(通过jsx创建新的fiber) 这样他的孩子节点也都没有了

## 多节点diff
多节点注意指的是最后更新后变为多节点
```typescript
function reconcileChildArray(
        returnFiber: FiberNode,
        currentFirstChild: FiberNode | null,
        newChild: any[]
    ) {
        //最后一个可复用fiber在current的index
        let lastPlacedIndex: number = 0;
        //创建的最后一个fiber
        let lastNewFiber: FiberNode | null = null;
        //第一个fiber
        let firstNewFiber: FiberNode | null = null;

        //1.将current保存在map中
        const existingChildren: ExistingChildren = new Map();
        let current = currentFirstChild;

        while (current !== null) {
            const keyToUse = current.key !== null ? current.key : current.index;
            existingChildren.set(keyToUse, current);
            current = current.sibling;
        }

        for (let i = 0; i < newChild.length; i++) {
            //2.遍历newChild，寻找是否可复用
            const after = newChild[i];
            const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

            if (newFiber === null) {
                continue;
            }
            //3.标记移动还是插入
            newFiber.index = i;
            newFiber.return = returnFiber;
            if (lastNewFiber === null) {
                lastNewFiber = newFiber;
                firstNewFiber = newFiber;
            } else {
                lastNewFiber.sibling = newFiber;
                lastNewFiber = lastNewFiber.sibling;
            }
            if (!shouldTrackEffects) {
                continue;
            }
            const current = newFiber.alternate;
            if (current !== null) {
                const oldIndex = current.index;
                if (oldIndex < lastPlacedIndex) {
                    //移动
                    newFiber.flags |= Placement;
                    continue;
                } else {
                    //不移动
                    lastPlacedIndex = oldIndex;
                }
            } else {
                //mount
                newFiber.flags |= Placement;
            }
        }

        //4.将Map中剩下的标记为删除
        existingChildren.forEach((fiber) => {
            deleteChild(returnFiber, fiber);
        });

        return firstNewFiber;
    }
```
lastPlacedIndex 最后一个可复用fiber在current的index
lastNewFiber 创建的最后一个fiber
firstNewFiber 第一个fiber

```typescript
  const keyToUse = current.key !== null ? current.key : current.index;
```
这里可以看到我们如果没有自动设置key的话就是用fiber的index，这个index其实就是元素array的索引

我们会根据这个keyToUse记录在map里，用来和新的element就是jsx生成的reactElement的对象
我们会走进**updateFromMap**
这个函数核心就是取出与新的key相同的element然后比对type如果一样说明可以直接复用走进**useFiber**
同时删掉map里的该key，如果不可以复用则走进**createFiberFromElement**重新创建fiber
之后核心逻辑就是判断标记移动还是插入
```typescript
           if (lastNewFiber === null) {
                lastNewFiber = newFiber;
                firstNewFiber = newFiber;
            } else {
                lastNewFiber.sibling = newFiber;
                lastNewFiber = lastNewFiber.sibling;
            }
            if (!shouldTrackEffects) {
                continue;
            }
            const current = newFiber.alternate;
            if (current !== null) {
                const oldIndex = current.index;
                if (oldIndex < lastPlacedIndex) {
                    //移动
                    newFiber.flags |= Placement;
                    continue;
                } else {
                    //不移动
                    lastPlacedIndex = oldIndex;
                }
            } else {
                //mount
                newFiber.flags |= Placement;
            }
```
我们会记录最后一个新产生的节点 lastNewFiber和第一个firstNewFiber
如果没有标记shouldTrackEffects直接退出本次循环
同时如果是newFiber.alternate不存在证明该节点为mount阶段直接Placement插入
我们比对改变只要让后面的节点插在前面就好
所以只需记录lastPlacedIndex最后一个不需移动的index
如果之前fiber的index小于lastIndex证明要往前插入所以要标记Placement
移动的判断依据：记录当前遍历到的新节点在旧节点列表中对应的index，当遍历element时， 「当前遍历到的element」 一定是 「所有已遍历的element」 中最靠右那个。

拿着新的fiber寻找新的fiber在旧fiber列表中的位置，以上一次找到的位置为坐标。
所以只需要记录 **「最后一个可复用fiber」** 在current中的index（lastPlacedIndex），在接下来的遍历中：

- 如果接下来遍历到的 **「可复用fiber」** 的index < lastPlacedIndex，则标记Placement
- 否则，不标记

再到最后我们把map里没用的fiber标记删除即可
```typescript
existingChildren.forEach((fiber) => {
            deleteChild(returnFiber, fiber);
 });
```
将 firstNewFiber返回出去

## completeWork
comleteWork就是通过比对props然后标记Update flag
如果ref有变化就标记，同时冒泡lane和flag

## commitWork

主要分为

- beforeMutation
- commitMutationEffects
- commitLayoutEffects
### commitMutationEffects
主要进行更新props
绑定Ref
收集update的useEffect回调函数
对有placement进行一定的插入
同时指行删除操作
删除时要把useEffect的清理函数推入，解绑ref
```typescript
const commitMutationEffectsOnFiber = (
    finishedWork: FiberNode,
    root: FiberRootNode
) => {
    const { flags, tag } = finishedWork;

    if ((flags & Placement) !== NoFlags) {
        commitPlacement(finishedWork);
        finishedWork.flags &= ~Placement;
    }
    //flags Update
    if ((flags & Update) !== NoFlags) {
        commitUpdate(finishedWork);
        finishedWork.flags &= ~Update;
    }
    //flags ChildDeletion
    if ((flags & ChildDeletion) !== NoFlags) {
        const deletions = finishedWork.deletions;

        deletions?.forEach((childToDelete) => {
            commitDelete(childToDelete, root);
        });
        finishedWork.flags &= ~ChildDeletion;
    }

    if ((flags & PassiveEffect) !== NoFlags) {
        //收集回调
        commitPassiveEffect(finishedWork, root, 'update');
        finishedWork.flags &= ~PassiveEffect;
    }

    if ((flags & Ref) !== NoFlags && tag === HostComponent) {
        safelyDetachRef(finishedWork);
    }

    if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
        const isHidden = finishedWork.pendingProps.mode === 'hidden';
        hideOrUnhideAllChildren(finishedWork, isHidden);
        finishedWork.flags &= ~Visibility;
    }
};
```
