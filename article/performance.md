# 性能优化
性能优化的一般思路：将**「变化的部分」**与**「不变的部分」**分离
什么是**「变化的部分」**？

- **State**
- **Props**
- **Context**

命中**「性能优化」**的组件可以不通过**reconcile**生成**wip.child**，而是直接复用上次更新生成的**wip.child**。
总结起来有两点：

- 性能优化的思路是将**「变化的部分」**与**「不变的部分」**分离

命中性能优化的组件的子组件（而不是他本身）不需要render

## bailout
已经触发更新，在更新过程中极大复用之前的fiber
bailout四要素：

1. props不变

比较props变化是通过「全等比较」，使用React.memo后会变为「浅比较」

2. state不变

两种情况可能造成state不变：
不存在update
存在update，但计算得出的state没变化

3. context不变
4. type不变
### fiber.lanes工作流程
作用：保存一个fiberNode中「所有未执行更新对应的lane」
延伸功能：fiber.childLanes，保存一个fiberNode子树中「所有未执行更新对应的lane」

- 产生：enqueueUpdate
- 消费：beginWork
- 未消费时的重置：processUpdateQueue
## eagerState策略
状态更新前后没有变化，那么没有必要触发**更新**，为此需要做：

- 计算更新后的状态
- 与更新前的状态做比较

通常情况下，「根据update计算state」发生在beginWork，而我们需要在「触发更新时」计算状态
只有满足「当前fiberNode没有其他更新」才尝试进入eagerState策略。
## 实现React.memo
demo：performance/memo.tsx
作用：让「props的全等比较」变为「props的浅比较」
本质：在子组件与父组件之间增加一个MemoComponent，MemoComponent通过「props的浅比较」命中bailout策略
![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1711247649422-33d61eea-8ed0-45f9-a1f7-898076f0d1ef.png#averageHue=%23271d1c&clientId=u1be3155c-cd9c-4&from=paste&height=547&id=ub7f6bb14&originHeight=821&originWidth=1609&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=1425722&status=done&style=none&taskId=u18d41c88-70a6-442d-ba04-82f575d5672&title=&width=1072.6666666666667)
## 实现useMemo、useCallback
demo：performance/Hook.tsx
demo：performance/useMemo.tsx

- useCallback：缓存函数
- useMemo：缓存变量（特殊用法：手动bailout）
