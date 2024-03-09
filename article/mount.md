# 首屏渲染 

我们回想一下
```
const root = ReactDOM.createRoot(document.querySelector('#root'));

root.render(<App />);
```
我们都是先创建一个root然后再调用root的render
```typescript
export function createRoot(container: Container) {
    const root = createContainer(container);

    return {
        render(element: ReactElementType) {
            initEvent(container, 'click');
            return updateContainer(element, root);
        }
    };
}
```
## 创建容器

我们通过createContainer 创建一个root就是FiberRootNode
同时创建hostfiberRoot然后
hostRootFiber.stateNode 指向 FiberRootNode
FiberRootNode.current 指向 hostRootFiber 这样两个root就联系了起来
注意FiberRootNode可以理解为一个全局的管理中心，**同时container属性对应document.querySelector('#root') **，而hostRootFiber是一个fiber是第一个fiber


## 触发渲染

```typescript
root.render(<App />);
```
我们会执行render而render会触发updateContainer
其内部创建一个Update内容就是我们的<App />然后再讲其加入updateQueue里
这个updateQueue就是 hostRootFiber上的

## 调度开始
**scheduleUpdateOnFiber **
这是一个很重要的函数
这个函数是这样的
```typescript
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
    //TODO 调度功能
    const root = markUpdateLaneFromToRoot(fiber, lane);
    markRootUpdated(root, lane);
    ensureRootIsScheduled(root);
}
```
 markUpdateLaneFromToRoot 这个函数用来从触发更新的fiber向上找到root 同时一路标记相应的lane给其各级祖先元素挂载在childLanes，这个对后续的bailout很重要

同时在root上挂载上pendingLanes就是本次的优先级

**ensureRootIsScheduled**
正式进入工作流程
首先根据获取最高的优先级
然后核心执行这两函数，开启同步渲染
```typescript
scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
scheduleMicroTask(flushSyncCallbacks);
```
scheduleSyncCallback就是将多个performSyncWorkOnRoot加入一个任务队列里（核心就是为了将多个setState批处理）
scheduleMicroTask(flushSyncCallbacks);就是在微任务中执行相应的任务
最后 root.callbackPriority 相当于保存上一次的优先级

**执行performSyncWorkOnRoot**
在performSyncWorkOnRoot里会执行核心的render和commit的东西
## render开始
render开始需要有个
**prepareFreshStack**
主要就是进行一个初始化的过程
```typescript
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
    root.finishedLane = NoLane;
    root.finishedWork = null;
    workInProgress = createWorkInProgress(root.current, {});
    wipRootRenderLane = lane;
    wipRootExitStatus = RootInProgress;
    wipSuspendedReason = NotSuspended;
    wipThrownValue = null;
}
```

这里需要注意的一点workInProgress 由createWorkInProgress(root.current, {}); 这个创建出来
由此hostRootFiber有了自身的alternate
**workLoopSync**
开始进入workloop流程
```typescript
function workLoopSync() {
    while (workInProgress !== null) {
        performUnitOfWork(workInProgress);
    }
}
```
**performUnitOfWork**
这里执行beginwork和completeWork
通过深度优先遍历
简单说就是beginwork逐层深入
然后当为wip为null时执行completework
然后检查兄弟节点如果兄弟节点还有东西的话继续beginwork
没有的话进行向上执行直到root

**递（beginwork）和归（completework）**
## beginwork
这里是递的阶段
从hostRootFiber开始构建fiber

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
核心就是根据不同的tag执行不同的生成子节点的操作

通过**reconcileChildren**生成子fiber
这里注意的是由于rootfibe有alternate所以会
加上placement，插入操作的flag而其他生成的子fiber则不会有这个过程
在beginwork里我们会涉及到一些diff相关的操作我们之后再聊

## completeWork
该阶段主要是根据props的变化打上update的flag标记
同时如果没有构建dom的话会构建dom不过在初次渲染时该dom为离屏dom
如果有ref的话会标记ref的flag
同时会向上冒泡所有的flag
这样根节点subtreeFlags上的就有所有子元素的所有flag
lane也是相似操作不过是挂载在childLanes中

这些flag也都是二进制的操作

这样我们就完成了render阶段开始commit流程

## commitRoot
```typescript
const finishedWork = root.current.alternate;
            root.finishedWork = finishedWork;
            root.finishedLane = nextLane;
            wipRootRenderLane = NoLane;
```
在执行前我们先将root.finishedWork赋值为构建好的 root.current.alternate
进入commitRoot后保存了finishedWork就重置
```typescript
root.finishedWork = null;
    root.finishedLane = NoLane;
```
然后检查是否有标记的副作用，这里的flushPassiveEffects主要是执行之前的effect队列里相关操作，不过可以看到由schedule在宏任务里执行，不过此时还没有加入副作用的回调在之后commitMutationEffectsOnFiber会加入
```typescript
if (
        (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags ||
        (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags
    ) {
        if (!rootDoseHasPassiveEffects) {
            rootDoseHasPassiveEffects = true;
            //调度副作用
            scheduleCallback(normalPriority, () => {
                flushPassiveEffects(root.pendingPassiveEffects);
                //执行副作用
                return;
            });
        }
    }
```
有关dom操作在下面
```typescript
const subtreeHasEffect =
        (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
    const rootHasEffect =
        (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;
    if (subtreeHasEffect || rootHasEffect) {
        //beforeMutation
        //mutation Placement
        commitMutationEffects(finishedWork, root);
        root.current = finishedWork;
        //layout
        commitLayoutEffects(finishedWork, root);
    } else {
        root.current = finishedWork;
    }
```
这块的核心函数在commitMutationEffectsOnFiber
```typescript
onst commitMutationEffectsOnFiber = (
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
这里就会执行一系列的增删改查以及相应的effect任务的入队
在执行完mutation阶段后也就该执行ayout 这也是为啥useEffectlayout在dom构建之后才执行同时是同步的
至此大体流程就已经结束了

