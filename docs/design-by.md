## Tpb: By

对 `On` 采集的流程数据进行处理。该段是用户各种自定义处理的入口，用户通常应该创建一个首字母大写的私用域，然后再在里面编写自己的处理代码。


### 基础方法集

当前条目（目标）为指令操作的对象。仅包含极少量的几个顶级基础指令。

```js
render( data?:Value ): Element
// 模板节点渲染。
// 通常是对tpl指令获取的元素进行渲染，
// 但也适用任意已经存在于DOM中的有渲染配置的元素。
// 目标：当前条目/栈顶1-2项。
// 内容：[Element, data:Value]
// 注：
// 模板实参data是可选的，如果为空则取栈顶2项（或当前条目展开）。
// 注记：
// 在By段定义此方法，是因为模板可能从远端获取，渲染之后需要插入（To）DOM中。

Tpls( reset:Boolean ): Promise<void>
// 载入模板配置。

GET( path?:String ): Promise<json>
// 获取远端数据。

POST( path, enctype:String ): Promise<json>
// 向远端递送信息。
```


### 扩展接口

用户可以通过如下几个接口扩展自己的处理集。

```js
processExtend( name, exts, args, n ): void
// 普通扩展

processProxy( name, getter, n ): void
// 代理扩展

cmvApp( name, conf, meths = [] ): void
// App专用扩展
```