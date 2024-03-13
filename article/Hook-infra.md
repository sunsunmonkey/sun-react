# Hook架构

hook由react包中导出
```typescript
export const useState: Dispatcher['useState'] = (initialState) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useState(initialState);
};
```
核心由resolveDispatcher();提供
这块读取currentDispatcher.current
```typescript
const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hook 只能在函数组件中执行');
	}

	return dispatcher;
};
export default currentDispatcher;
```
而这个currentDispatcher也会在renderHook中被赋值 核心由current来判断两个hook状态
一个是mount时一个是更新时的

```typescript
if (current !== null) {
        //update
        currentDispatcher.current = HooksDispatcherOnUpdate;
    } else {
        //mount
        currentDispatcher.current = HooksDispatcherOnMount;
    }
```
```typescript
const HooksDispatcherOnMount: Dispatcher = {
    useState: mountState,
    useEffect: mountEffect,
    useTransition: mountTransition,
    useRef: mountRef,
    useContext: readContext,
    use,
    useMemo: mountMemo,
    useCallback: mountCallback
};

const HooksDispatcherOnUpdate: Dispatcher = {
    useState: updateState,
    useEffect: updateEffect,
    useTransition: updateTransition,
    useRef: updateRef,
    useContext: readContext,
    use,
    useMemo: updateMemo,
    useCallback: updateCallback
};
```
所以可以看出来核心的实现还是在react-reconcile里
![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1710075794702-3d5321dd-e3bf-440e-9e5c-58542b987283.png#averageHue=%23141414&clientId=u47d810fb-dc88-4&from=paste&height=363&id=uaa7c9d95&originHeight=545&originWidth=724&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=69930&status=done&style=none&taskId=u9150c561-a525-481e-a3cb-0048cc81b05&title=&width=482.6666666666667)
就这样建立起来了hook和react包以及react-recolier的
