# jsx

react结合babel将jsx转化为react.createElement()（之前是这样的）或者jsx的函数（react/jsx-runtime）无需再导入React
![image.png](https://cdn.nlark.com/yuque/0/2024/png/33634946/1709822565970-e026e827-4b95-4e4e-8e58-99212db57b78.png#averageHue=%23fcfbfb&clientId=u83a5622a-be0d-4&from=paste&height=159&id=uf7664f79&originHeight=238&originWidth=543&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=4933&status=done&style=none&taskId=u62c267ca-6e5d-4e0b-9647-c501cd4c3a3&title=&width=362)
从而转化为reactElement 是这样一个的结构
```typescript
{
        $$typeof: REACT_ELEMENT,
        type,
        key,
        ref,
        props
}
```
至于为啥的要加个 $$typeof这个而且用symbol是为了防止xss攻击
dan有篇文章就讲到过[https://overreacted.io/why-do-react-elements-have-typeof-property/](https://overreacted.io/why-do-react-elements-have-typeof-property/)
