# react的事件模型

react的事件都是由container就是我们挂载的#root上，监听的
传入的事件中e.target 就是真实的事件对象

我们在触发时要先收集冒泡和捕获的事件
## 收集事件
收集的时候由于是从子元素开始收集的
捕获的数组应该从头部开始加
冒泡数组应该从尾部加
然后向上一直收集直到container

```typescript
const paths: Paths = {
        capture: [],
        bubble: []
};
```


## 构造合成事件
合成事件主要就是将syntheticEvent.__stopPropagation = false;
挂载作为停止传播的标志
```typescript
syntheticEvent.stopPropagation = () => {
        syntheticEvent.__stopPropagation = true;
        if (originStopPropagation) {
            originStopPropagation();
        }
    };
```

## 触发事件
先执行捕获，执行的同时会带上相应的优先级，比如srcoll就属于较低的click是较低的
在执行每个函数都会判断


