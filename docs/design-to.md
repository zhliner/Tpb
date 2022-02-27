## Tpb: To

用流程传递来的内容数据对检索（`Query`）的目标进行修改/更新（`Update`），并支持后续联动的事件触发或衔接（`Next-Stage`）。

`to = "Query | Update | Next-Stage"`

如果目标检索为一个集合，当内容数据也为一个数组时，可能为分别一一对应赋值的逻辑（tQuery方法自身逻辑）。三个部分中任意段皆可为空（或占位符 `-`），但分隔符竖线（`|`）不可省略。

> **注：**<br>
> 与前面 `On/By` 阶段的称谓不同，`To` 阶段的目标指 `Query` 的结果，而流程数据被称为内容。


### Query

定义目标元素（集）的查询表达式。因为值本身被视为字符串，所以无需再用引号包围。如：`to="#here|replace"` 而不是 `to="'#here'|replace"`（其中 `here` 为某元素的id）。


#### 起点元素

查询表达式的起点元素为事件绑定/委托元素（`evo.delegate`），但也可以通过向暂存区赋值（如 `pop`）来指定查询的起点元素。此时查询表达式有两种情况：

1. **选择器为空**：起点元素自身即为查询的结果。如果是由前阶提供，它实际上可以是一个集合。
2. **选择器非空**：按二阶检索法检索目标元素（集）。如果是检索一个集合，可以在选择器之后包含过滤表达式（见下）。

> **注记：**<br>
> 允许前阶指令指定起点元素或目标集，可以提供一种动态性，不受模板明文的局限。


#### 括号语法

如果是查询多个元素，查询串需要包含在一对小括号（`(selector)`）中。如果要对查询结果进行进一步过滤，有如下规则：

- `()` 指定不匹配（排除）选择器，格式：`(...)(selector)`，选择器无引号包围。不同于 `:not(...)` 只能用于简单测试，这里可以是复杂的复合选择器（`!$.is(...)`）。
- `[]` 指定下标范围或特定的位置，格式：`(...)[beg:end]`，冒号分隔起止范围（两值皆可省略，beg默认为0，end默认为集合大小），或 `(...)[x, y, z]`，逗号分隔特定位置。注意两者不可混用。
- `{}` 用一个表达式实现过滤，接口：`function(v:Value, i:Number, c:Collector): Boolean`，参数名固定，表达式无需 `return`。如：`(...){ i%2 && i<=10}`，返回集合中前5个偶数位置成员。

查询的起点可由前阶指定（On|By 末尾的 `pop` 取出），如果这本身就是一个集合，则查询无法执行。通常，用户可能是想要在此基础上过滤（如果不是直接采用的话），此时查询部分应当为空，但需要一个空括号 `()` 来占位查询结果，如：`()[10:]` 取集合中第10个成员及之后的部分。


#### 特殊字符

有两个单独的特殊字符（`~` 和 `=`）指代两个特别的目标。

- `~` 事件起点元素（`event.target|elo.target`）。**注**：`~` 也是 `tQuery` 中匹配事件起点元素的标识字符。
- `=` 委托选择器匹配的事件当前元素（`elo.current`）。如：`to="=|append"`，在事件当前元素内插入内容。

**另外：**

短横线（`-`）是一个占位符，表示查询串为空，查询结果会是起点元素自身。因为默认的起点元素就是事件委托元素，所以 `-` 隐含地也指代了 `elo.delegate`（即：`event.currentTarget`）。

通常，占位符无需书写，如 `|append` 等同于 `-|append`。但如果前方指令指定了起点元素（`pop` 的结果），而此时查询串为空，则作为一种约定习惯，此处可前置 `-` 占位符以示分别。如：`<p on="click|... pop" to="-|append">`，或可理解为前阶“衔接”之意。


```js
xxxx   // 单元素检索，$.get(): Element | null
(xxx)  // 多元素检索，$(...): Collector
// 例：
// [class]   => $.get('[class]')
// ([class]) => $('[class]')
// strong    => $.get('strong')
// (strong)  => $('strong')


// 进阶过滤/局部提取。

(xxx)[beg : end]
// 范围选取：Collector
// beg 为起点下标，可选。默认值0
// end 为终点下标（不包含），可选。默认值集合大小
// 下标支持负数从末尾算起。
// 例：
// ([class])[10:] 取集合第11个之后全部成员。

(xxx)[x, y, z...]
// 定点选取：[Element]
// x, y, z 为具体的目标位置（从0开始）。
// 例：
// ([class])[1,3,5] 取集合内第 2/4/6 个成员。

(xxx){filter}
// 回调过滤：Collector
// {} 内为过滤表达式，参数名固定：(v:Value|Element, i:Number, c:Collector): Boolean。
// 注：即 filter 的逻辑。
// 例：
// ([class]){ v.id }   取集合内id值非空的元素。
// ([class]){ i < 10 } 取集合内前10个成员（0-9）。
```


### Update

以 Query 的检索目标为操作对象。

更新区可定义多个方法，每个方法均操作 Query 检索的结果或上一个 Update 方法的有效返回值（非 `undefined`）。
更新的值数据从暂存区或栈顶逐一取出（仅 **1项**），即先定义的方法先从栈顶或暂存区取值。

> **注：**
> 不存在检索集合的不同成员对应不同更新方法的逻辑。

```js
//
// 节点类赋值。
/////////////////////////////////////////////////
before( clone, event, eventdeep:Boolean ): Collector|Node|[Node]
after( clone, event, eventdeep:Boolean ): Collector|Node|[Node]
prepend( clone, event, eventdeep:Boolean ): Collector|Node|[Node]
append( clone, event, eventdeep:Boolean ): Collector|Node|[Node]
fill( clone, event, eventdeep:Boolean ): Collector|Node|[Node]
replace( clone, event, eventdeep:Boolean ): Collector|Node|[Node]

wrap( clone, event, eventdeep:Boolean ): Element|[Element]
wrapInner( clone, event, eventdeep:Boolean ): Element|[Element]

wrapAll( clone, event, eventdeep:Boolean ): Collector

html( where:String|Number, sep:String): Collector|Node|[Node]
text( where:String|Number, sep:String): Collector|Node|[Node]

empty( clean:Boolean ): [Element]|Collector
unwrap( clean:Boolean ): [Element]|Collector
remove( slr:String ): Collector

// 上面方法的动态版。
nodex( meth, ...rest ): Collector|Node|[Node]

//
// 逆向插入。
// 流程数据为目标，Query检索目标为内容。
//-----------------------------------------------
beforeWith( clone, event, eventdeep:Boolean ): Collector
afterWith( clone, event, eventdeep:Boolean ): Collector
prependWith( clone, event, eventdeep:Boolean ): Collector
appendWith( clone, event, eventdeep:Boolean ): Collector
replaceWith( clone, event, eventdeep:Boolean ): Collector
fillWith( clone, event, eventdeep:Boolean ): Collector


//
// 简单设置。
// 注释内为内容类型。
/////////////////////////////////////////////////
height( inc:Boolean ): Collector|void          // {Number}
width( inc:Boolean ): Collector|void           // {Number}
scroll(): Collector|void                        // {top:Number, left:Number}
scrollTop( inc:Boolean ): Collector|void       // {Number}
scrollLeft( inc:Boolean ): Collector|void      // {Number}
addClass(): Collector|void                      // {String|Function}
removeClass(): Collector|void                   // {String|Function}
toggleClass( force:Boolean ): Collector|void   // {String|Function|Boolean}
removeAttr(): Collector|void                    // {String|Function}
val(): Collector|void                           // {Value|[Value]|Function}
offset(): Collector|void                        // {top:Number, left:Number}


//
// 特性/属性/样式设置。
/////////////////////////////////////////////////
attr( name:String ): Collector|void
attribute( names:String ): Collector|void
toggleAttr( name:String, i:Boolean ): Collector|void
prop( name:String ): Collector|void
property( names:String ): Collector|void
css( name:String ): Collector|void
cssSets( names:String ): Collector|void
toggleStyle( name:String, equal:Boolean ): Collector|void


//
// 事件处理。
/////////////////////////////////////////////////
bind( evnid:String, slr:String ): void
// 绑定预定义调用链。

once( evnid:String, slr:String ): void
// 绑定预定义调用链单次处理。

on( evn:String, slr:String ): Collector|void
one( evn:String, slr:String ): Collector|void
off( evn:String, slr:String ): Collector|void
// 事件绑定/解绑。

trigger( name:String, bubble, cancelable:Boolean ): void
// 发送事件到目标。

triggers( name:String, bubble, cancelable:Boolean ): void
// 发送事件到目标（元素与发送值分别对应版）。

cloneEvents( evns:String|Function ):void
// 事件处理器克隆。


//
// 其它赋值。
/////////////////////////////////////////////////

render(): void
// 渲染目标元素。

set( name ): void
// 设置对象成员值。

add(): void
// 添加成员值。

adds(): void
// 添加多个成员值。

apply( meth, ...rest ): void
// 应用目标的方法。

applies( meth ): void
// 多次应用目标的方法。

tips( long, msg ): void
// 发送提示消息。

only( name:String ): void
// 类名独占设置。

data( name:String ): void
// 存储关联数据。

chain( evnid:String ): void
// 存储调用链（单个）。

chains(): void
// 存储调用链集。

pba(): void
// PB参数设置。

pbo(): void
// PB选项设置。

hide( v:Number|Boolean ): void
lose( v:Number|Boolean ): void
disable( v:Number|Boolean ): void
fold( v:Number|Boolean ): void
truncate( v:Number|Boolean ): void
full( v:Number|Boolean ): void
// 目标状态变化。


//
// 简洁形式。
// 采用前置特殊字符来简化实现。
// 与增强版不同，这里仅支持单个名称。
/////////////////////////////////////////////////

[attribute]
- @[name]
// 特性设置（.attr(name, ...)）
// 内容：{String|Number|Boolean|Function|null}
// 例：
// @style： 设置元素的style特性值（cssText）。
// @class： 设置元素的class特性值。实参为null时删除特性值。

[property]
- $[name]
// 属性设置（.prop(name, ...)）
// 内容：{String|Number|Boolean|Function|null}
// 例：
// $value   设置元素的value属性值。
// $-val：  设置元素的data-val属性值（dataset.val），同 $data-val。

[style]
- %[name]
// 样式设置（.css(name, ...)）
// 内容：{String|Number|Function|null}
// 例：
// %font-size 设置元素的font-size内联样式。
// %fontSize  效果同上。

[attribute:toggle]
- ^[name]
// 元素特性切换（.toggleAttr(name, ...)）
// 内容：{Value|[Value]|Function}
// 单值比较有无切换，双值（数组）比较交换切换。
```


#### 扩展

支持多方法定义，空格分隔，用于多数据同时设置的情况。各方法依然是独立的指令，依次从栈顶取内容数据用于更新操作。


例：

```js
#test|$value, @-val|...
// 对id为test的目标元素同时设置其value属性和data-val特性。

(.test)|@title, $value|...
// 对class为test的元素集设置其title特性和value属性。
// 它们的内容可以是一个数组，这会与元素一一对应赋值。
```



### Next-Stage

执行下一阶的准备工作，比如目标元素获取焦点或文本选取、通知状态改变或发送下一阶事件（附带必要的数据）。

此阶段指令操作的目标是 `evo.updated` 而非流程数据，因此与数据栈和暂存区无关，但发送事件通常需要携带必要的前期数据，所以取值类指令在这里也可用。

> **注：**
> 取值指令与On段的相同，它们操作的依然流程数据（数据栈/暂存区），因此如果要取目标元素上的属性，需先将之入栈（`target`）。


```js
target( n?:Number ): Element|[Element]|Collector
// 获取To目标。

goto( name, extra ): void
// 跳转到目标事件。

fire( rid, name, delay, bubble, cancelable ): void
// 延迟激发事件。

change( rid, much ): void
// 触发改变事件。

changes( rid, much ): void
// 表单控件值已改变通知。

normalize( rid, much ): void
// 元素规范化。

clear( rid, much ): void
// 清理表单控件。

intoView( y, x, rid ): void
// 滚动到当前视口。

click()
blur()
focus()
load()
play()
pause()
reset()
select()
submit()
finisht()
cancel()
// 在目标元素上触发。
```
