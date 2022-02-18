# Tpb: On

关联事件，获取各种值。值进入流程数据栈向后传递，数据入栈为 `Array.push` 方式，除了 `undefined` 外，每一个指令（方法）的返回值都会自动入栈。

事件名可以用空格分隔多个名称同时指定，它们被绑定到同一个行为链。事件名可以是委托形式，选择器定义在小括号内，如：`click(p[data-id="xxx"])` 中的 `p[data-id="xxx"]`。选择器串无需引号包围。可选的，我们可以在选择器串末尾附加一个 **捕获** 标记（`!true` 或 `!false`），用于 **明确指示** 后面的行为链绑定到事件流的捕获或冒泡阶段，如 `click(span!true)`。如果没有选择器，括号内可以只是标记本身，如：`click(!true)`。

> **附：**
> 没有明确定义捕获标记时，绑定是智能的：
> - 如果没有选择器，绑定到冒泡阶段。
> - 如果有选择器，不冒泡的事件（如 `focus|blur|mouseenter...`）绑定到捕获阶段，其它则绑定到冒泡阶段。


事件名是一个标识串，首字母为字母，之后可以是字母、数字和 `[._:-]` 字符。另外，可前置一个特殊字符以表达固定的含义：

- `^`：表示该事件为单次绑定。如：`^click` 的绑定将采用 `$.one("click', ...)`，而非 `$.on()`。
- `@`：预定义调用链。该调用链不会被立即使用，实际上它只是一个存储（与当前元素关联），用户可通过在 `To` 段使用 `bind/once` 指令来应用它（提取并绑定）。


## 格式用例

```html
<ul id="test" ...
    on="click|attr('title') debug avoid;
        click(li[data-val='xyz']) contextmenu | ...;
        ^click|$('div/#xxx'), debug(false);
        @mousemove:1 @keydown:1|...;
        "
>
```

**说明：**

- 事件名可用空格分隔多个同时定义。
- 事件名与后续的取值指令序列之间用竖线（`|`）分隔，`|` 两侧的空格是可选的。
- 指令序列是可选，若无指令序列，`|` 可省略。
- 各指令之间用空格（`_`）分隔，多余的空白会被忽略。
- 无实参传递的指令可省略括号。
- 前置 `^` 的事件名表示单次执行绑定（`$.one`）。
- 预存储调用链的事件名前置 `@` 字符，名称之后的冒号 `:` 用于分隔标识ID（可选，不应有空格）。

> **注：**<br>
> 预存储的调用链事件名后需要包含ID标识，是因为相同的事件可以多次绑定到同一个元素上，需要区分。<br>
> 这个ID值是任意的（字母或数字，由 `To:bind|once` 使用），如果一个元素不用同时绑定多个相同的事件名，它就是可选的。<br>


## 取值指令

从流程数据（即目标）中取值，提取的值被自动压入栈顶。`tQuery|Collector` 中的方法仅限于取值，赋值能力被设计在 `To:Update` 中。


### 普通取值

```js
// 基本取值。
//-----------------------------------------------

$( rid:String, ctx:Element|DocumentFragment ): Element | null
// 检索单个元素入栈。

$$( rid:String|Value, ctx:Element|DocumentFragment ): Collector
// 检索元素集入栈。

evo( name:String|Number ): Value
// 从当前evo对象上取值入栈。
// name: {
//      0|'event'     evo.event
//      1|'target'    evo.target
//      2|'current'   evo.current
//      3|'delegate'  evo.delegate
//      4|'selector'  evo.selector
//      6|'data'      evo.data （指令当前流程数据）
//      7|'entry',    evo.entry （中段入口，迭代重入）
//      8|'primary'   evo.primary （To检索结果，初始更新目标）
//      9|'updated'   evo.updated （To更新目标）
// }

ev( name?:String ): Value|[Value]
// 从事件对象上取值入栈。

its( name:String ): Value|[Value]
// 获取对象成员值。

len(): Number
// 获取数据值长度。

size(): Number
// 获取集合大小。

call( meth:String, ...rest:Value ): Value
// 调用目标的方法。

calls( meths:String, ...args:Value ): [Value]
// 调用目标的多个方法。

valo( name:String ): Object{name:value}
// 获取目标名称的控件值集。

value( name:String ): Value | [Value] | null
// 获取控件值。

checked( name:String ): Boolean | [Boolean] | null
// 获取选取按钮状态。

style( name:String ): String | [String] | [[String]]
// 获取元素内联样式。

sRange( loose?:Boolean ): Range | null | false
// 获取当前选取范围（可选嵌套约束）。

wRange( strict?:Boolean ): Range | null | false
// 获取当前选取范围（可选范围限定）。

nodeRange( collapse:Boolean|void ): Range
// 选取目标节点为一个范围（Range）。

edbox(): Element
// 获取可编辑元素。


// 类型转换&构造。
// 目标：暂存区/栈顶1项。
// 返回值而非该类型的对象，基本转换支持数组操作（针对成员）。
//-----------------------------------------------

int( radix ): Number
// 将字符串转为整数，即 parseInt()

float(): Number
// 将字符串转为浮点数，即 parseFloat()

re( flag: String ): RegExp
// 将字符串转为正则表达式。

bool( all:Boolean ): Boolean
// 转换为布尔值（false|true）

str( prefix?, suffix? ): String
// 转换为字符串。

strr( suffix:String ): String
// 转为字符串。

arr( wrap:Boolean ): Array
// 转换/封装为数组。

obj( key:String ): Object
// 将目标转换为普通对象。

objz(): Object
// 转换.entries接口对象。

array( size, ...vals ): Array
// 创建预填充值数组（size大小）。

arr2j( junk ): [Value]
// 用状态数组清理目标数组。

obj2x( target:Object, names?:String ): Object
// 对象属性提取赋值。

elem( tag:String, n:Number ): Element | Collector
// 简单创建元素（集）。

clone( ...args ): Value|Element|Collector
// 单次克隆。

clones( cnt:Number, event?, deep?, eventdeep?:Boolean ): [Element|Collector]
// 元素多次克隆。

item( idx? ): Value | [Value] | null
// 集合成员提取。

handles( evn:String ): Object | [Function|EventListener]
// 获取绑定的处理器集。

json( space, replacer ): String
// JSON 序列化

jsons( space, replacer ): [String]
// 多个 JSON 序列化。

JSON( reviver ): Object | Value
// JSON 解析

URL( base:String ): URL
// 创建URL对象

Date( ...args? ): Date
// 构造日期对象入栈。

Map( n:Number ): Map
// 构造Map实例。

Set( n:Number ): Set
// 构造Set实例。



// 复杂取值。
//-----------------------------------------------

tpl( name, tname?:String ): Promise<Element>
// 获取name模板节点。

tplr( name:String ): Templater
// 获取模板管理器实例

node( name:String, clone?, bound?:Boolean ): Element | [Element|null] | null
// 获取模板节点（集）。

keys(): [Value]
// 获得键数组。

values(): [Value]
// 获取值数组。

func( ...argn: String ): Function
// 创建函数入栈。

data( name: String ): void|Value
// 关联数据取出。

einfo( hasid:Boolean, hascls:Boolean ): String | [String]
// 生成元素基本信息。

hasRange( el:Element|String, strict?:Boolean ): Boolean
// 选区是否在元素之内。

scam( names?:String ): Boolean
// 修饰键{Alt|Ctrl|Shift|Meta}按下检查（排他性）。

SCAM( ...names:String ): Boolean | [String]
// 修饰键{Alt|Ctrl|Shift|Meta}状态检查|封装。

acmsk(): String
// 构建组合键序列：alt+ctrl+shift+meta:[key]。

iskey(...ch:String|Number): Boolean
// 判断是否为目标键位。

chain( evnid:String, clone:Boolean ): Cell
// 预存储调用链提取（单个）。

chains( evnid:String, clone:Boolean ): Map<evnid:Cell>
// 预存储调用链提取。

timeOut( delay:Number|null, ...args ): timeoutID | void
// 创建/清除计时器（单次：setTimeout）。

timeTick( delay:Number|null, ...args ): intervalID | void
// 创建/清除计时器（持续：setInterval）。

ease( name, kind, count? ): Ease
// 创建一个缓动实例。

easing( total?, base? ): Number
// 获取当前缓动值。

animate( kfs, opts ): Animation
// 创建一个动画对象。



// Tpb专有补充。
//-----------------------------------------------

pba(): [String]
// PB参数取值（|=）。

pbo(): [String]
// PB选项取值（~=）。

movementX( v?:null ): Number | void
movementY( v?:null ): Number | void
// 鼠标移动量取值。

scrolledX( v:?null ): Number | void
scrolledY( v:?null ): Number | void
// 内容滚动量取值。
```


### tQuery取值

```js
// tQuery|Collector兼有
// 目标非Collector时为tQuery方法（目标即首个实参）。
//-----------------------------------------------

// 目标：当前条目/栈顶1项。
// 参数固定：1。
attr( name ): String | null
attribute( name ): String | [String] | null
prop( name ): Value | undefined
property( name ): Value | Object | undefined
css( name ): String
cssGets( name ): Object
xattr( names:String|[String] ): String | Object | [String|null] | [Object] | null

// 目标：当前条目/栈顶1项
// 参数固定：0。
height(): Number
width(): Number
scroll(): {top, left}
scrollTop(): Number
scrollLeft(): Number
offset(): {top, left}
val(): Value | [Value] | null
html(): String      // 目标支持文本。
text(): String      // 目标支持HTML源码

// 目标：当前条目/栈顶1项
// 参数不定。
// 注：多余实参无副作用。
innerHeight(): Number
innerWidth(): Number
outerWidth( margin? ): Number
outerHeight( margin? ): Number
next( slr?, until? ): Element | null
nextAll( slr? ): [Element]
nextUntil( slr? ): [Element]
prev( slr?, until? ): Element | null
prevAll( slr? ): [Element]
prevUntil( slr? ): [Element]
children( slr? ): [Element] | Element
contents( idx?, comment? ): [Node] | Node
siblings( slr? ): [Element]
parent( slr? ): Element | null
parents( slr? ): [Element]
parentsUntil( slr ): [Element]
closest( slr ): Element | null
offsetParent(): Element
hasClass( name ): Boolean
classAll(): [String]
position(): {top, left}


// tQuery专有
//-----------------------------------------------

// 目标：当前条目，可选。
// 如果目标有值，合并在实参之后传递。
Element( tag?:String, data?:String|[String]|Object ): Element
svg( tag?:String, opts?:Object ): SVG:Element
Text( text?:String ): Text
create( html?:String ): DocumentFragment
table( rows?, cols?:Number, cap?:String, th0?:Boolean ): $.Table
dataName( attr?:String ): String
tags( code?:String ): String
selector( tag?, attr?, val?, op?:String ): String
range( beg?:Number|String, size?:Number|String, step?:Number ): [Number]|[String]
now( json?:Boolean ): Number|String

// 目标：当前条目/栈顶1项。
// 内容：参考tQuery相关接口首个参数定义。
// 注：多余实参无副作用。
is( slr:String ): Boolean
isXML(): Boolean
controls(): [Element]
serialize( ...names? ): [Array2]
queryURL(): String
isArray(): Boolean
isNumeric(): Boolean
isFunction(): Boolean
isCollector(): Boolean
type(): String
kvsMap( kname?, vname?: String ): [Object2]


// Collector专有
//-----------------------------------------------

// 目标：当前条目/栈顶1项。
// 内容：Value|[Value]|Collector
// 注意：如果目标不是Collector对象，会自动封装为Collector。
first( slr? ): Collector | null
last( slr? ): Collector | null


// 数组处理（兼容Collector）
//-----------------------------------------------

join( chr ): String
// 接数组各成员。
includes(val: Value, beg?: Number): Boolean
// 值包含判断。
indexOf(val: Value, beg?: Number): Number
// 值位置查询。
lastIndexOf(val: Value, beg?: Number): Number
// 值位置查询（逆向）。
```


### 元素自身行为

此部分为元素自身的简单行为或变化，不涉及外部的内容数据，考虑实用性而提供。

```js
// UI表现。
// 目标：当前条目/栈顶1项。
/////////////////////////////////////////////////

hide( sure?:Boolean )       // 元素隐藏，对应CSS visibility:hidden。
lose( sure?:Boolean )       // 元素显示丢失，对应CSS display:none。
disable( sure?:Boolean )    // 元素失活，模拟表单控件的 disabled 外观（灰化）。
fold( sure?:Boolean )       // 元素折叠，除:first-child之外的子元素 display:none。
truncate( sure?:Boolean )   // 截断，即后续兄弟元素 display:none
full( sure?:Boolean )       // 充满容器。需要定义容器元素 position 样式非 static。
// 注：
// 传递 sure 为假值可反向表现，即取消该表现。
// 默认 sure 为真值。


// 自身操作。
// 目标：当前条目/栈顶1项。
/////////////////////////////////////////////////

wrap( box:String ): Element | Collector
wrapinner( box:String ): Element | Collector
wrapAll( box:String ): Element | Collector
// 节点封装。
// 与To中的同名方法不同，这里应当主要用于构建新元素。

remove( slr?:String|Boolean, back?:Boolean ): void | data
empty( back?:Boolean ): void | data
unwrap( back?:Boolean ): void | data
// slr: 选择器或入栈指示。
// back: 被移除的节点是否入栈。
// data: 被移除的节点/集或展开（unwrap）的节点集。

normalize(): void
clear(): void
changes( extra?:Value ): void
intoView( y:Number|String|true|false, x:Number|String): void


// 事件调用/触发。
// 目标：当前条目/栈顶1项。
/////////////////////////////////////////////////

click(): void
blur(): void
focus(): void
load(): void
play(): void
pause(): void
reset(): void
select(): void
submit(): void
finish(): void
cancel(): void

change(): void
```
