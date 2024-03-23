## 事件接入
我们对于不同的事件会有不同的优先级所以我们使用schedule的runWithPriority将计入schedule的一个变量中去
```typescript
unstable_runWithPriority(eventTypeToSchedulerPriority(se.type), () => {
            callback.call(null, se);
        });
```
![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1711193360676-11755659-9fc4-4d04-a84e-6d9660d26c72.png#averageHue=%231e1e1e&clientId=u272a9e45-b193-4&from=paste&height=663&id=u49a5b52b&originHeight=994&originWidth=1206&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=109504&status=done&style=none&taskId=uc6b6a9ea-ea29-4d4a-a28f-2c7de078d6a&title=&width=804)
然后在getCurrentPriorityLevel就可以拿到该优先级
```javascript
function unstable_getCurrentPriorityLevel() {
    return currentPriorityLevel;
  }
```
初步实现的事件对应优先级
```typescript
export function eventTypeToSchedulerPriority(eventType: string) {
    switch (eventType) {
        case 'click':
        case 'keydown':
        case 'keyup':
            return unstable_ImmediatePriority;
        case 'scroll':
            return unstable_UserBlockingPriority;
        default:
            return unstable_NormalPriority;
    }
}
```
我们所有的update都要使用requestUpdateLanes来获取当前lane所以我们继续在此基础上处理
```typescript
export function requestUpdateLanes() {
	const isTransition = currentBatchConfig.transition !== null;
	if (isTransition) {
		return TransitionLane;
	}

	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
}
```
我们之前说过unstable_getCurrentPriorityLevel可以获取到当前环境的优先级，但我们还要将该优先级转化为lane，由此才能完全实现接入react

## 策略模式
在我们lane不为synclane时，我们就会进入宏任务的调度
```typescript
if (updateLane === SyncLane) {
        //同步用微任务调度
        //数组
        scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
        scheduleMicroTask(flushSyncCallbacks);
    } else {
        //其他优先级，用宏任务调度
        const schedulerPriority = lanesToSchedulerPriority(updateLane);

        newCallbackNode = scheduleCallback(
            schedulerPriority,
            //@ts-ignore
            performConcurrentWorkOnRoot.bind(null, root)
        );
    }
```
就是由scheduler管理的
然后再看performConcurrentWorkOnRoot
我们的didTimeout由scheduler传入主要为了解决饥饿问题
同时再renderRoot中我们进行区分是否需要进行时间切片
我们然后处理existStatus就是renderRoot的状态，我们还要给root加入字段callbackNode，callbackPriority。
如果当前是没有执行完就是RootInComplete。
我们在开始的时候保存一下 const curCallback = root.callbackNode;
然后进行调度如果root.callbackNode和之前不一样说明产生了更高优先级的调度，所以直接返回null结束此次调度，否则说明还是此次任务所以返回return performConcurrentWorkOnRoot.bind(null, root);继续调度，scheduler也会根据此来继续调度，这是个优化路径

同时需要注意的我们的useEffect可能会产生更高优先级的更新所以我们在并发更新时要执行一下之前的useEffect
```typescript
export function performConcurrentWorkOnRoot(
    root: FiberRootNode,
    didTimeout: boolean
): any {
    // 保证useEffect执行回调
    const curCallback = root.callbackNode;
    const didFlushPassiveEffects = flushPassiveEffects(
        root.pendingPassiveEffects
    );

    if (didFlushPassiveEffects) {
        //有更高优先级的调度
        if (root.callbackNode !== curCallback) {
            return null;
        }
    }

    const lane = getNextLane(root);
    const curCallbackNode = root.callbackNode;

    if (lane === NoLane) {
        return null;
    }
    const needSync = lane === SyncLane || didTimeout;
    //render阶段
    const existStatus = renderRoot(root, lane, !needSync);

    switch (existStatus) {
        case RootInComplete:
            // 中断
            //有更高优先级存在不要在执行了，让步给其他
            if (root.callbackNode !== curCallbackNode) {
                return null;
            }

            return performConcurrentWorkOnRoot.bind(null, root);
        case RootCompleted:
            const finishedWork = root.current.alternate;
            root.finishedWork = finishedWork;
            root.finishedLane = lane;
            wipRootRenderLane = NoLane;

            commitRoot(root);
            break;
        case RootDidNotComplete:
            wipRootRenderLane = NoLane;
            markRootSuspended(root, lane);
            ensureRootIsScheduled(root);
            break;
        default:
            if (__DEV__) {
                console.error('还未实现的并发更新结束状态');
            }
            break;
    }
}
```
如果两次lane不一样的时候才需要prepareFreshStack进行初始化，同时我们会返回一个结束状态，然后交给performConcurrentWorkOnRoot处理。
```typescript
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
    if (__DEV__) {
        console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
    }

    //不等于才要重新初始化
    if (wipRootRenderLane !== lane) {
        prepareFreshStack(root, lane);
    }

    do {
        try {
            if (wipSuspendedReason !== NotSuspended && workInProgress !== null) {
                const throwValue = wipThrownValue;
                wipSuspendedReason = NotSuspended;
                wipThrownValue = null;
                //unwind
                throwAndUnwindWorkLoop(root, workInProgress, throwValue, lane);
            }
            shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
            break;
        } catch (e) {
            if (__DEV__) {
                console.warn('workLoop发生错误', e);
            }
            handleThrow(root, e);
        }
    } while (true);

    if (wipRootExitStatus !== RootInProgress) {
        return wipRootExitStatus;
    }
    //中断执行
    if (shouldTimeSlice && workInProgress !== null) {
        return RootInComplete;
    }
    //render阶段执行完
    if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
        console.error('render结束不应该不为null');
    }

    return RootCompleted;
}
```
然后在workLoopConcurrent中加入时间是否到期的一个判断从而实现可中断
```typescript
function workLoopConcurrent() {
    while (workInProgress !== null && !unstable_shouldYield()) {
        performUnitOfWork(workInProgress);
    }
}
```
ensureRootIsScheduled里我们要记录当前的callback，同时判断优先级
```typescript
const curPriority = updateLane;
const prevPriority = root.callbackPriority;
```
```typescript
if (curPriority === prevPriority) {
        return;
}
```
如果优先级相同直接返回也就回到performConcurrentWorkOnRoot直接将该函数返回继续进行调度，如果走入下面流程只可能是高优先级打断所以，直接取消掉之前的existingCallback任务
```typescript
if (existingCallback !== null) {
        unstable_cancelCallback(existingCallback);
    }
```
同时我们执行该函数如果有新的任务也会赋值更新root的callbackNode和callbackPriority
```typescript
newCallbackNode = scheduleCallback(
            schedulerPriority,
            //@ts-ignore
            performConcurrentWorkOnRoot.bind(null, root)
        );
    }

    root.callbackNode = newCallbackNode;
    root.callbackPriority = curPriority;
```
## 典型场景
### 时间切片
时间切片核心就是scheduler打断正在执行的任务，然后返回状态时rootInCompleted然后判断有无更高优先级，如果没有返回null在ensureRootIsScheduled在performConcurrentWorkOnRoot中直接将函数返回，交由scheduler调度，同时prefreshStack也不会刷新，保留当前的workInprogress，所以下一次循环继续更新操作
### 高优先级打断低优先级
当高优先级出现时，在ensureRootIsScheduled会获取到更新的更高级别的lane从而比对之前的lane发现不同进而cancel低优先级的任务，从而低先级的任务停止
```typescript
if (existingCallback !== null) {
        unstable_cancelCallback(existingCallback);
}
```
同时判断lane发现lane不相同会触发初始化prefreshStack创建新的FiberRootNode，由此就达到了执行高优先级的效果，同时较低lane也会存在，在执行完高优先级任务后仍会执行该任务
## update
如何同时兼顾「update的连续性」与「update的优先级」？
新增baseState、baseQueue字段：
baseState是本次更新参与计算的初始state，memoizedState是上次更新计算的最终state
如果本次更新没有update被跳过，则下次更新开始时baseState === memoizedState
如果本次更新有update被跳过，则本次更新计算出的memoizedState为「考虑优先级」情况下计算的结果，baseState为「最后一个没被跳过的update计算后的结果」，下次更新开始时baseState !== memoizedState
本次更新「被跳过的update及其后面的所有update」都会被保存在baseQueue中参与下次state计算
本次更新「参与计算但保存在baseQueue中的update」，优先级会降低到NoLane

在同步更新情况下，我们无法完全兼顾连续性，我们只能分多次计算满足优先级，从而从全局来看兼顾了连续性
