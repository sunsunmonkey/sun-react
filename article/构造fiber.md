- scheduleUpdateOnFiber开始
- 进入ensureRootIsScheduled(root);
- 双缓存

## lane
### 更新中的lane

- 如果同步更新返回 SyncLane
- 如果并发从scheduler获取最高优先级，然后在通过优先级转化为lane
- 特殊情况下(处于 suspense 过程中), 会优先选择TransitionLanes通道中的空闲通道(如果所有TransitionLanes通道都被占用, 就取最高优先级. [源码](https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberLane.js#L548-L563)).

![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1709467789632-8fbe67fa-5f6f-48cd-8e9f-b2982d5159bd.png#averageHue=%23fefcfc&clientId=u3c3163db-ee99-4&from=paste&height=109&id=u074c445f&originHeight=163&originWidth=1117&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=30180&status=done&style=none&taskId=u02fee0f1-fa4f-498b-b986-bcd7d555975&title=&width=744.6666666666666)

### 渲染中的lane

- getNextLanes会根据fiberRoot对象上的属性(expiredLanes, suspendedLanes, pingedLanes等), 确定出当前最紧急的lanes.
- 此处返回的lanes会作为全局渲染的优先级, 用于fiber树构造过程中. 针对fiber对象或update对象, 只要它们的优先级(如: fiber.lanes和update.lane)比渲染优先级低, 都将会被忽略.

### fiber的优先级

- 如果全局的渲染优先级renderLanes不包括fiber.lanes, 证明该fiber节点没有更新, 可以复用.

### bailout

lanes会向上传递 markUpdateLaneFromFiberToRoot
!includesSomeLane(renderLanes, updateLanes)这个判断分支, 包含了渲染优先级和update优先级的比较(详情可以回顾[fiber 树构造(基础准备)](https://7km.top/main/fibertree-prepare#%E4%BC%98%E5%85%88%E7%BA%A7)中优先级相关解读), 如果当前节点无需更新, 则会进入bailout逻辑.

提取有足够优先级的update对象, 计算出最终的状态 workInProgress.memoizedState
 processUpdateQueue

