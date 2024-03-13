# useState

我们知道其实每个hook本身其实对应了两个阶段的函数，一个mount和一个update
让我来先看
**mountState**
```typescript
function mountState<State>(
    initialState: (() => State) | State
): [State, Dispatch<State>] {
    //找到当前useState对应的hook数据
    const hook = mountWorkInProgressHook();
    let memorizedState;
    if (initialState instanceof Function) {
        memorizedState = initialState();
    } else {
        memorizedState = initialState;
    }
    const queue = createFCUpdateQueue<State>();
    hook.updateQueue = queue;
    hook.memorizedState = memorizedState;
    hook.baseState = memorizedState;

    //@ts-ignore
    const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
    queue.dispatch = dispatch;
    queue.lastRenderedState = memorizedState;

    return [memorizedState, dispatch];
}
```
我们首先会进入
**mountWorkInProgressHook**
```typescript
function mountWorkInProgressHook() {
    const hook: Hook = {
        memorizedState: null,
        updateQueue: null,
        next: null,
        baseState: null,
        baseQueue: null
    };
    if (workInProgressHooK === null) {
        //mount 第一个hook
        if (currentlyRenderingFiber === null) {
            throw new Error('请在函数组件内执行hook');
        } else {
            workInProgressHooK = hook;
            currentlyRenderingFiber.memoizedState = workInProgressHooK;
        }
    } else {
        //mount 时后续hook
        workInProgressHooK.next = hook;
        workInProgressHooK = hook;
    }
    return workInProgressHooK;
}
```
这个操作本身是初始化hook同时，建立起当前**fiber.memoizedState**和hook的关系
然后和后续的hook建立一个链表的关系
之后继续执行**mountState**
将initalState赋值给hook.memoizedState,同时返回return [memorizedState, dispatch];
我们来看看dispatch
**dispatchSetState**
```typescript
function dispatchSetState<State>(
    fiber: FiberNode,
    updateQueue: FCUpdateQueue<State>,
    action: Action<State>
) {
    const lane = requestUpdateLanes();
    const update = createUpdate(action, lane);

    const current = fiber.alternate;
    //eager策略
    if (
        fiber.lanes === NoLane &&
        (current === null || current.lanes === NoLane)
    ) {
        //当前产生的update是这个fiber的第一个update
        const currentState = updateQueue.lastRenderedState;
        const eagerState = basicStateReducer(currentState, action);
        update.hasEagerState = true;
        update.eagerState = eagerState;
        if (Object.is(currentState, eagerState)) {
            enqueueUpdate(updateQueue, update, fiber, NoLane);
            // 命中eagerState
            if (__DEV__) {
                console.warn('命中eagerState', fiber);
            }
            return;
        }
    }

    enqueueUpdate(updateQueue, update, fiber, lane);
    scheduleUpdateOnFiber(fiber, lane);
}
```
首先就是获取当前任务的优先级，然后再创建一个update，然后把update推入updateQueue中
最后再通过**scheduleUpdateOnFiber**开始调度更新流程就是update的流程了

**updateState**
我们再来看看updateState

```typescript
function updateState<State>(): [State, Dispatch<State>] {
    //找到当前useState对应的hook数据
    const hook = updateWorkInProgressHook();

    //计算新的state的逻辑
    const queue = hook.updateQueue as FCUpdateQueue<State>;
    const baseState = hook.baseState;

    const pending = queue.shared.pending;
    const current = currentHooK as Hook;
    //取出之前保存的baseQueue
    let baseQueue = current.baseQueue;

    if (pending !== null) {
        //pending baseQueue update保存在current中
        if (baseQueue !== null) {
            //让baseFirst在后面接上pending并形成环形链表
            const baseFirst = baseQueue?.next;
            const pendingFirst = pending.next;

            baseQueue.next = pendingFirst;
            pendingFirst!.next = baseFirst;
        }

        //注意从pending为合并后的尾指针保证了顺序
        baseQueue = pending;
        current.baseQueue = pending;
        queue.shared.pending = null;
    }

    if (baseQueue !== null) {
        const prevState = hook.memorizedState;
        const {
            memoizedState,
            baseQueue: newBaseQueue,
            baseState: newBaseState
        } = processUpdateQueue(baseState, baseQueue, renderLane, (update) => {
            const skippedLane = update.lane;
            const fiber = currentlyRenderingFiber as FiberNode;
            fiber.lanes = mergeLanes(fiber.lanes, skippedLane);
        });

        if (!Object.is(prevState, memoizedState)) {
            markWipReceiveUpdate();
        }

        hook.memorizedState = memoizedState;
        hook.baseState = newBaseState;
        hook.baseQueue = newBaseQueue;

        queue.lastRenderedState = memoizedState;
    }

    return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}
```

类似于mount同样一开始会去寻找hook

**updateWorkInProgressHook**
```typescript
function updateWorkInProgressHook(): Hook {
    // TODO render阶段触发的更新
    let nextCurrentHook: Hook | null;

    if (currentHooK === null) {
        // 这是这个FC update时的第一个hook
        const current = currentlyRenderingFiber?.alternate;
        if (current !== null) {
            nextCurrentHook = current?.memoizedState;
        } else {
            nextCurrentHook = null;
        }
    } else {
        //这个FC update 后续的hook
        nextCurrentHook = currentHooK.next;
    }

    if (nextCurrentHook === null) {
        //出现问题
        throw new Error(
            `组件${currentlyRenderingFiber?.type}本次执行的hook比上次多`
        );
    }

    currentHooK = nextCurrentHook as Hook;

    const newHook: Hook = {
        memorizedState: currentHooK.memorizedState,
        updateQueue: currentHooK.updateQueue,
        next: null,
        baseQueue: currentHooK.baseQueue,
        baseState: currentHooK.baseState
    };

    if (workInProgressHooK === null) {
        if (currentlyRenderingFiber === null) {
            throw new Error('请在函数组件内执行hook');
        } else {
            workInProgressHooK = newHook;
            currentlyRenderingFiber.memoizedState = workInProgressHooK;
        }
    } else {
        //后续hook
        workInProgressHooK.next = newHook;
        workInProgressHooK = newHook;
    }

    return workInProgressHooK;
}
```
其实上面代码核心就是通过之前的创建的hook来再创建一个新的hook，同时更新hook链表，和fiber上的memorizedState。

其实本身更新的逻辑很简单就是根据如果不是函数就直接替换如果是就执行这个函数同时传入hook上的memorizedState

但是为了兼容不同优先级的更新就会复杂一些

新增baseState、baseQueue字段：

- baseState是本次更新参与计算的初始state，memoizedState是上次更新计算的最终state
- 如果本次更新没有update被跳过，则下次更新开始时baseState === memoizedState
- 如果本次更新有update被跳过，则本次更新计算出的memoizedState为 **「考虑优先级」** 情况下计算的结果，baseState为 **「最后一个没被跳过的update计算后的结果」** ，下次更新开始时baseState !== memoizedState
- 本次更新 **「被跳过的update及其后面的所有update」** 都会被保存在baseQueue中参与下次state计算

