# useTransition

和之前一样我们分为mount和update来看

## mountTransition
```typescript
function mountTransition(): [boolean, (callback: () => void) => void] {
    const [isPending, setPending] = mountState(false);
    const hook = mountWorkInProgressHook();
    const start = startTransition.bind(null, setPending);
    hook.memorizedState = start;
    return [isPending, start];
}
```
可以看到本质通过state来记录状态
再来看**startTransition**
currentBatchConfig是一个全局对象，用于在整个react更新开始时，判断是否为transition环境，获取优先级的标记。
```javascript
const currentBatchConfig = {
  transition: null
};
```
```typescript
function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
    setPending(true);
    const prevTransition = currentBatchConfig.transition;
    currentBatchConfig.transition = 1;

    callback();
    setPending(false);

    currentBatchConfig.transition = prevTransition;
}
```
可以看到其核心就是改变currentBatchConfig然后再执行回调函数
```javascript
currentBatchConfig.transition = prevTransition;
```
最后这个可以理解为一个回溯
## updateTransition
```typescript
function updateTransition(): [boolean, (callback: () => void) => void] {
    const [isPending] = updateState();
    const hook = updateWorkInProgressHook();
    const start = hook.memorizedState;
    return [isPending as boolean, start];
}
```
核心其实就是重用之前的start的和pending

值得注意的是Transition的hook的memorizedState存的就是一个函数

## 优先级
TransitionLane的优先级仅比空闲优先级高，可以随时被打断。
接下来在初始化/更新的入口处，我们需要判断**currentBatchConfig.transition**是否有值？如果有值，需要强制将他的优先级变更为**TransitionLane**。
首先看一下初始化和更新的流程入口，无论是初始化还是更新，首先要根据不同的触发环境获取对应的优先级：

```javascript
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
在获取优先级时我们就会看是否有Transition从而接入了更新逻辑
