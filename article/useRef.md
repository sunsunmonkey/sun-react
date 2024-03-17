# useRef

实现的重点就是在 react 渲染的流程中获取dom实例，但是由于fiber节点只是抽象出来的对象，并不是真正的dom。所以纵观整个渲染流程，根据各个阶段的不同职责，在render阶段标记 ref 标记， commit阶段挂载dom节点时通过标记获取 dom 节点。主要实现流程如下；
### 1. 标记Ref
标记Ref需要满足：

- mount时：存在ref
- update时：ref引用变化

标记的时机包括：

- beginWork
### 2. 执行Ref操作
包括两类操作：

1. 对于正常的绑定操作：
   - 解绑之前的ref（mutation阶段）
   - 绑定新的ref（layout阶段）
2. 对于组件卸载：
- 解绑之前的ref

和这些hook一样我们要看mount和update
## mountRef
```typescript
function mountRef<T>(initialValue: T): { current: T } {
    const hook = mountWorkInProgressHook();
    const ref = { current: initialValue };
    hook.memorizedState = ref;
    return ref;
}
```
mountWorkInProgressHook() 初始化hook同时接入之前的链表
同时该 hook.memorizedState = ref; memorizedState就保存了这个对象
### 
## updateRef
```typescript
function updateRef<T>(): { current: T } {
    const hook = updateWorkInProgressHook();
    return hook.memorizedState;
}
```
主要核心就是复用之前存在的 hook.memorizedState
