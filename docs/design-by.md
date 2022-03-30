## Tpb: By

对 `On` 采集的流程数据进行处理。该段是用户各种自定义处理的入口，用户通常应该创建一个首字母大写的私用域，然后再在里面编写自己的处理代码。


### 基础方法集

当前条目（目标）为指令操作的对象。仅包含极少量的几个顶级基础指令。

```js
render( data:Value ): Element
// 模板节点渲染。

script( box:String|Element ): Element|Promise<Element>
// 插入脚本代码或引入URL脚本。

style( next:String|Element ): Element|Promise<Element>
// 插入样式代码或引入样式URL资源。

loadin( data, next, box ): Promise<Element>
// 载入外部资源。

GET( type, url:String ): Promise<[type]>
// 获取远端数据。

POST( url, cfg?:Object ): Promise<Response>
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