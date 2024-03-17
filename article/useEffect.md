useEffec与useState类似同样是在数据共享层被react暴露
在react-reconciler真正实现
![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1710676144662-05cada9b-33e2-4baf-b580-f9fd071c37b1.png#averageHue=%23141414&clientId=u52eb8c94-c77f-4&from=paste&height=547&id=uc2a7e5be&originHeight=821&originWidth=1120&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=135880&status=done&style=none&taskId=u6aeb2e3b-08c5-40c7-bae4-990d440738b&title=&width=746.6666666666666)![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1710676155433-220d42d2-c1f4-41f8-9bbb-2d736a9d73f5.png#averageHue=%23151515&clientId=u52eb8c94-c77f-4&from=paste&height=457&id=ua41e4207&originHeight=685&originWidth=1217&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=111726&status=done&style=none&taskId=ubeff07f7-8765-4cf6-976b-f7cb9295be6&title=&width=811.3333333333334)
同样useEffect也有mount和update两个函数
##  mountEffect
```typescript
function mountEffect(
    create: EffectCallBack | void,
    deps: HookDeps | undefined
) {
    //建立hook间的链表关系
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;

    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memorizedState = pushEffect(
        Passive | HookHasEffect,
        create,
        undefined,
        nextDeps
    );
}
```
mount首先关联起各hook在mountWorkInProgressHooK()里
然后处理依赖如果没有传依赖就是null
同时给该fiber加上PassiveEffect flag
同时我们来看pushEffect这个核心就是创建effect的环形链表或者加入原有的环形链表
注意由于是环形链表该fiber的上**updateQueue.lastEffect**会保留最后一个effect
然后给这个的hook.memorizedState 加上这个effect

### commit执行effect
我们首先要收集要执行的函数，commitMutationEffectsOnFiber在这个函数中
```typescript
if ((flags & PassiveEffect) !== NoFlags) {
        //收集回调
        commitPassiveEffect(finishedWork, root, 'update');
        finishedWork.flags &= ~PassiveEffect;
    }
```
收集'update'，我们上文说了，updateQueue的lastEffect存了effect我们这里直接将其推入 root.pendingPassiveEffects
```typescript
function commitPassiveEffect(
    fiber: FiberNode,
    root: FiberRootNode,
    type: keyof PendingPassiveEffects
) {
    // update unmount
    if (
        fiber.tag !== FunctionComponent ||
        (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
    ) {
        return;
    }
    const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
    if (updateQueue !== null) {
        if (updateQueue.lastEffect === null && __DEV__) {
            console.error('当FC存在PassiveEffect flag时，不应该不存在effect');
        }
        root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
    }
}
```
然后真正执行在这里属于宏任务范畴
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
核心执行effect的就是这段代码就是由schedule调度执行的
```typescript
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
    let didFlushPassiveEffect = false;
    pendingPassiveEffects.unmount.forEach((effect) => {
        didFlushPassiveEffect = true;
        commitHookEffectListUnmount(Passive, effect);
    });

    pendingPassiveEffects.unmount = [];

    pendingPassiveEffects.update.forEach((effect) => {
        didFlushPassiveEffect = true;
        commitHookEffectListDestroy(Passive | HookHasEffect, effect);
    });

    pendingPassiveEffects.update.forEach((effect) => {
        didFlushPassiveEffect = true;
        commitHookEffectListCreate(Passive | HookHasEffect, effect);
    });

    pendingPassiveEffects.update = [];
    flushSyncCallbacks();

    return didFlushPassiveEffect;
}
```
在执行时我们会将返回的destory函数保存在effect中
```typescript
export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
    commitHookEffectList(flags, lastEffect, (effect) => {
        const create = effect.create;
        if (typeof create === 'function') {
            effect.destroy = create();
        }
    });
}
```
我们再来看看更新
## updateEffect
```typescript
function updateEffect(
    create: EffectCallBack | void,
    deps: HookDeps | undefined
) {
    //找到当前useState对应的hook数据
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    let destroy: EffectCallBack | void;
    if (currentHooK !== null) {
        const prevEffect = currentHooK.memorizedState as Effect;
        destroy = prevEffect.destroy;

        if (nextDeps !== null) {
            //浅比较依赖
            const prevDeps = prevEffect.deps;
            if (areHookInputsEqual(nextDeps, prevDeps)) {
                //不相等依赖
                hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
                return;
            }
        }

        //不相等依赖
        (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
        hook.memorizedState = pushEffect(
            Passive | HookHasEffect,
            create,
            destroy,
            nextDeps
        );
    }
}
```
和mountEffect一样都要用updateWorkInProgressHook();获取到之前的hook
然后拿到新的依赖进行和之前的比对，是一个浅层比较
```typescript
function areHookInputsEqual(nextDeps: HookDeps, prevDeps: HookDeps) {
    if (prevDeps === null || nextDeps === null) {
        return false;
    }
    for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
        if (Object.is(prevDeps[i], nextDeps[i])) {
            continue;
        }
        return false;
    }
    return true;
}
```
如果是相同依赖只会加入Passive（也就不会重新执行更新）而不同的话会加入Passive | HookHasEffect
在执行时会比对flag
```typescript
pendingPassiveEffects.update.forEach((effect) => {
        didFlushPassiveEffect = true;
        commitHookEffectListDestroy(Passive | HookHasEffect, effect);
    });

    pendingPassiveEffects.update.forEach((effect) => {
        didFlushPassiveEffect = true;
        commitHookEffectListCreate(Passive | HookHasEffect, effect);
    });
```
我们再来看看delete时如何处理effect的
```typescript
function commitDelete(childDeletion: FiberNode, root: FiberRootNode) {
    const rootChildrenToDelete: FiberNode[] = [];

    //递归子树
    commitNestedComponent(childDeletion, (unmountFiber) => {
        switch (unmountFiber.tag) {
            case HostComponent:
                recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
                safelyAttachRef(unmountFiber);
                break;
            case HostText:
                recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
                //TODO 解绑ref
                break;
            case FunctionComponent:
                //TODO 解绑ref
                commitPassiveEffect(unmountFiber, root, 'unmount');
                break;
```
在commit里我们传入'unmount'的lasteffect
同时我们在flushEffect时unmount的flag是Passive这样就保证了卸载时的执行
```typescript
    pendingPassiveEffects.unmount.forEach((effect) => {
        didFlushPassiveEffect = true;
        commitHookEffectListUnmount(Passive, effect);
    });
```
## flag
最后补充一下其中的flag
为了在fiber节点中标记副作用，增加**PassiveEffect**代表具有effect副作用的fiber节点。
**Passive**标记useEffect对象，**HookHasEffect**表示当前effect本次更新存在副作用。

```typescript
// effect对象的标记
export const Passive = 0b0010;
export const HookHasEffect = 0b0001;
// fiber节点的标记
export const PassiveEffect = 0b0001000;
```

![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1710679535108-45bc7c5b-2773-422f-afa5-042876fd215a.png#averageHue=%23161616&clientId=u0c0ccffc-45f9-4&from=paste&height=394&id=udebd5f49&originHeight=591&originWidth=1219&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=151030&status=done&style=none&taskId=u737e5939-9289-4a69-ac39-24ca1621f97&title=&width=812.6666666666666)
