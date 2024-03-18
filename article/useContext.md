# useContext

useContext用于在函数式组件中访问上下文（Context）的值。
Context是一种在react不同组件（跨层级，例如父子组件，父孙组件）之间共享，传递数据的机制。
useContext 的参数是由 createContext 创建，或者是父级上下文 context传递的，通过 Context.Provider 包裹的组件，才能通过 useContext 获取对应的值。可以理解为 useContext 代替之前 Context.Consumer 来获取 Provider 中保存的 value 值。

useContext和其他钩子不同只是读取内容罢了无需区分mount和update
```typescript
function readContext<Value>(context: ReactContext<Value>): Value {
    const consumer = currentlyRenderingFiber;
    return readContextOrigin(consumer, context);
}
```
然后再看看readContextOrigin
```typescript
export function readContext<T>(
    consumer: FiberNode | null,
    context: ReactContext<T>
): T {
    if (consumer === null) {
        throw new Error('只能在函数组件中调用useContext');
    }
    const value = context._currentValue;
    return value;
}
```
可以看出来他接受一个context
我们来看createContext类似于reactElement的对象
返回一个ReactContext和一个Provider
```typescript
import { REACT_CONTEXT, REACT_PROVIDER } from 'shared/ReactSymbols';
import { ReactContext } from 'shared/ReactTypes';

export function createContext<T>(defaultValue: T): ReactContext<T> {
    const context: ReactContext<T> = {
        $$typeof: REACT_CONTEXT,
        Provider: null,
        _currentValue: defaultValue
    };

    context.Provider = {
        $$typeof: REACT_PROVIDER,
        _context: context
    };

    return context;
}
```
同时针对相应的$$typeof这个节点标记为fiber节点生成不同的tag：
然后beginwork也会加入
```typescript
case ContextProvider:
            return updateContextProvider(wip, renderLane);
```
```typescript
function updateContextProvider(wip: FiberNode, renderLane: Lane) {
    const providerType = wip.type;
    const context = providerType._context;
    const newProps = wip.pendingProps;
    const oldProps = wip.memoizedProps;
    const newValue = newProps.value;

    pushProvider(context, newProps.value);

    if (oldProps !== null) {
        const oldValue = oldProps.value;
        if (
            Object.is(oldValue, newValue) &&
            oldProps.children === newProps.children
        ) {
            return bailOnAlreadyFinishedWork(wip, renderLane);
        } else {
            propagateContextChange(wip, context, renderLane);
        }
    }
    const nextChildren = newProps.children;
    reconcileChildren(wip, nextChildren);
    return wip.child;
}
```
其实就是一个入栈，然后completework出栈
```typescript
export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
    prevContextStack.push(prevContextValue);
    prevContextValue = context._currentValue;
    context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
    context._currentValue = prevContextValue;
    prevContextValue = prevContextStack.pop();
}
```
