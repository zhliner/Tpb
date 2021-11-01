# 模板渲染

用于模板渲染的语法/属性有 `9` 个（`tpb-[for|each|if|else|with|var|switch|case|last]`），渲染属性的值是一个JS表达式，表达式运算的结果成为该语法结构的数据。表达式会被封装为函数调用，有一个名称为 `$` 的形参，用于引用所传递的实参数据。

正常的元素属性前置一个下划线是一种赋值语法，表示相应的属性会被赋值为其表达式运算的结果，如：`<a _href="$.url">`，表示 `$.url` 将赋值到 `href` 属性。


## 语法优先级

```js
1: 'tpb-each'
2: 'tpb-with'
3: 'tpb-var'
4: 'tpb-if|else'
5: 'tpb-switch|case|last'
6: 'tpb-for'
7: '_[attr]'
```


## 父域链

模板中对数据的引用通过一个特殊名称 `$` 来完成。在初始传入数据的模板根上，它指代了传入的数据，对它属性成员的引用即是对数据成员的引用。如：

```js
{
    student: {
        name: '王小朋',
        age: 14,
    },
    language: `chinese`,
}
```

当数据初始传入时，该对象被赋值到一个 `$` 变量上，`$.language` 即是对值 `chinese` 的获取，`$.student.age` 即是对年龄 `14` 的获取。

有时候，我们想要对目标数据的引用更简短一些，比如已经递进到表示学生信息的DOM下层，应当用 `$.name` 就引用 `王小朋`。这是可以的，此时只需要导入一个子域 `tpb-with=$.student` 即可，这样就在当前模板元素上创建了一个新的数据域，之后的数据引用中的 `$` 就表示 `student` 对象本身了。

上面的子域创建是手动的。`With` 语法只是为了方便用户引用深层数据，在另外的两种循环结构（`For|Each`）中，子域是自动创建的。

为了在子域中引用上级域的数据成员，在子域对象上会有一个特殊成员，名称也是 `$`，它引用了父域对象。对它的子数据可通过 `$.$.xxx` 的形式获取，如上面在student子域中，可通过 `$.$.language` 引用语言信息。

每一级子域上都会被设置一个对父域的引用，这就是 **父域链**，引用形式形如：`$.$.$...`。


## tpb-for

定义子元素的迭代循环。格式：`tpb-for="data"`，其中 `data` 为循环取值的数组（**注**：可用 `.slice()` 截取子集）。每一个数组成员都会成为其所在循环的当前域（子域）。

`data` 配置可选，如果当前数据本身就是一个数组，就无法配置取值表达式，此时 `data` 处应当为一个空串，或者仅设置 `tpb-for` 属性名即可。

循环内支持2个临时变量：

- `$.INDEX` 当前条目下标（`Index` 从0开始）。
- `$.SIZE` 循环集大小（`Size`）。

> **注意：**
> 这2个名称不能作为循环数据源中的键名，它们的值会被覆盖。

每个循环中的当区域的父域引用 `$` 是数组所在的域，即 `data-for` 定义所处的域（不一定是数组的父对象）。如果数组本身就是域对象（如顶层或多维数组里的子循环），该父域引用（`.$`）就是数组本身。


### 示例1

```html
<!--父域包含一个news数组
    news: [{topic, about, summary}, ...] -->
<dl tpb-for="$.news">
    <!-- 子域中的$被赋值为news[i] -->
    <dt _text="$.topic"></dt>       <!-- news[i].topic -->
    <dd>
        <h4 _text="$.about"></h4>     <!-- news[i].about -->
        <p _html="$.summary"></p>   <!-- news[i].summary -->
    </dd>
    <!-- 子域的父域 $.$ 为上级的 $（news所属的对象） -->
</dl>
```


### 示例2

如果当前域对象就是一个数组，且全部输出，可仅简单设置 `tpb-for` 属性名。

```html
<!-- $: [
    ['c++', 'print("hello, world!");'],
    ['golang', 'fmt.Println("hello, world!")'],
    ['javascript', 'console.info("hello, world!")']
] -->
<dl tpb-for>
    <!-- 全部子元素循环 $: [i] -->
    <dt _text="$[0]">[c++]</dt> <!-- [0][0] -->
    <dd>
        <b _="$.INDEX + 1">[1]</b><code _text="$[1]">[print("hello, world!");]</code> <!-- [0][1] -->
    </dd>
</dl>

<!-- 同上 -->
<dl tpb-for="$"> ... </dl>
```


### 示例3

数组的单元是一个基本数据类型，值会被转换为 `Object`（不影响显示）。

```html
<!-- $: [ 'Java', 'C/C++', 'JavaScript' ] -->
<ol tpb-for>
    <!-- $: 成员值本身 -->
    <li><code _text="$"></code></li>
    <!-- $.$ 引用数组本身 -->
</ol>
```

输出：

```html
<!-- 渲染属性会被自动清除 -->
<ol>
    <li><code>Java</code></li>
    <li><code>C/C++</code></li>
    <li><code>JavaScript</code></li>
</ol>
```


## tpb-each

当前元素自我迭代循环（含子元素）。格式：`tpb-each="data"`，参数和父域说明参考 `tpb-for` 语法。


### 示例

```html
<dl>
    <dt>请在如下选项中勾选</dt>
    <!-- list: [{sn, label, value}, ...] -->
    <dd tpb-each="$.list" _data-sn="$.sn">
        <label>
            <input name="books" type="checkbox" _value="$.value" />
            <span _text="$.label"></span>
        </label>
    </dd>
    <!--注：<dd>元素自身被克隆，数据条目逐个应用。-->
</dl>
```

或者：

```html
<dl>
    <dt>请在如下选项中勾选</dt>
    <!-- list: [{sn, label, value}, ...] -->
    <dd tpb-each="$.list" _data-sn="$.sn">
        <!-- id: 使用模板字符串（撇字符包围） -->
        <input name="books" _id="`book_${$.sn}`" type="checkbox" _value="$.value" />
        <!-- 文本说明 -->
        <label _for="`book_${$.sn}`" _text="$.label"></label>
    </dd>
</dl>
```


## tpb-if / tpb-else

存在性测试，取属性值的运算结果决定当前元素是否显示（**注记**：隐藏方式为临时 `<template>`）。

注意 `tpb-else` 需要与 `tpb-if` 匹配使用，并且仅限于同级元素的范围。语法词所在元素之间可以插入其它兄弟元素，它们与 `if/else` 的逻辑无关，即：`if-else` 的测试显示逻辑仅限于元素自身。
在同一个DOM层级上（同级兄弟元素），多个的 `if` 是平级关系，没有嵌套的逻辑，一个 `if` 的开始就是前一个 `if | if/else` 的结束，因此 `else` 对 `if` 的配对是就近匹配的逻辑。

> **注：**<br>
> 与普通语言中的语法稍有不同，这里的 `else` 依然可以携带条件，如果属性有值，则为 `elseif` 的逻辑。


### 示例

```html
<div tpb-with="$.student">
    <!-- 如果 tpb-if 为假，段落不会显示 -->
    <p tpb-if="$.age < 7">
        欢迎 <strong _text="$.name">[孩子]</strong> 小朋友！
    </p>
    <!-- 中间段：可插入任意内容 -->
    <p tpb-else>
        <!-- 中括号内的文字为模板友好提示（会被替换） -->
        欢迎 <strong _text="$.name">[男/女]</strong> 同学！
    </p>
</div>
```


## tpb-switch / tpb-case / tpb-last

`switch{}` 语法结构，表达多个子元素的分支判断。

与 `tpb-if/else` 类似，`tpb-case/last` 仅对元素自身进行匹配测试，匹配则显示，否则隐藏（临时 `<template>`）。各个 `case` 位于平级的兄弟元素上（即DOM树的相同层级），无需 `break`。随着元素的封闭，`switch` 逻辑自然结束。

`tpl-case` 的属性值为条件表达式，`tpb-last` 是最后一个Case，它充当两种角色：

1. Default: 如果没有任何一个 Case 匹配，且 `tpb-last` 无属性值，则为无条件匹配。
2. Case: 最后一个普通分支，但有一个特殊功能：如果条件不匹配，作为容器元素的 `switch` 会隐藏（简单 `display:none`）。
3. 注意 `tpb-last` 只能有一个且位于 Case 列表的最后。

> **注：**<br>
> `case/last` 和 `if/else` 不应该同时存在于同一个元素上，但 `switch` 可以（包括上级 `switch` 的 `case/last`）。


### 示例

```html
<div tpb-with="$.student" tpb-switch="true">
    <p tpb-case="$.age > 7">
        欢迎 <strong _text="$.name">[孩子]</strong> 小朋友！
    </p>
    <!-- 中间段：任意内容 -->
    <p tpb-case="$.age <= 18">
        你好，<strong _text="$.name">[青少年]</strong>！
    </p>
    <!-- 中间段：任意内容 -->
    <p tpb-last>
        嗨，<strong _text="$.name">[其他]</strong>！
    </p>
</div>
```


## tpb-with

用目标对象创建一个新的当前域（子域）。这会改变当前元素及子元素上渲染变量的当前域定义，主要用于缩短子孙级成员变量引用。

该语法词的优先级在 `tpb-each` 之后、其它语法词之前，因此会影响大部分渲染结构（`tpb-var`、`tpb-if`、`tpb-switch`、`tpb-for` 等）。

> **友好：**
> 对父域成员的引用可通过普通的父域链完成，但如果父域和当前域都是普通的Object对象，父域会成为该子域的原型，因此也可以简单地直接引用。


### 示例

```html
<!-- info: { time, ... } -->
<em tpb-with="$.info" tpb-if="(Date.now() - $.time) LE 86400">（今日更新）</em>
```

域声明支持任意JS表达式，因此实际上可以组合创建一个新的对象用于之后的域环境。

```html
<!-- info: { time, ... } -->
<p tpb-with="{topic: $.info.title, time: $.info.time, tips: '更新'}">
    <span _text="$.topic"></span>
    更新时间：<strong _text="$.time|date('yyyy-MM-dd')"></strong>
    <em tpb-if="$.time < 86400" _text="$.tips">[最新提示]</em>
</p>
```


## tpb-var

在当前域中新建变量来存储数据，供同域中其它渲染结构使用，可用于提取某些深层数据成员或简单计算，然后其它地方直接引用。新的变量用赋值的方式明确设置到当前域中，即如：`$.desc = $.from.value` 的形式。

赋值表达式实际上是合法的JS语法，因此支持ES6中新的赋值语法，如解构赋值。


### 示例

```html
<!-- 没啥道理哈 -->
<p tpb-var="$.schoolName = '(^,^)' + $.student.school.name">
    毕业学校：<strong _text="$.schoolName"><strong>
</p>
```


## _[attrName]

对元素的特性（`attribute`）进行赋值定义，采用特性名前置一个下划线（`_`）表达。支持两个特殊名称：`text` 和 `html` 插入元素内容，分别表示插入文本和源码（填充方式）。默认地，`_text` 可以用一个单纯的 `_` 字符来表达。

赋值表达式支持 **过滤器** 语法，即在表达式运算结果之后附加过滤指令用来进一步处理前阶的结果。形式如：`expr|text|cut(40)`，其中 `expr` 表示赋值表达式，管道（`|`）分隔符之后的 `text` 和 `cut(...)` 为过滤器指令。过滤器可以串联，前一指令的结果作为后一指令的待处理数据，最终的结果被赋值到目标特性。

> **注意：**
> 如果赋值表达式本身包含有位或（`|`）运算符，则必须将表达式包含在一对小括号（`(...)`）内。


### 示例

```html
<header class="summary">
    <p class="info" _title="$.tips">
        <!-- 限制文本长度 -->
        文章来源：<a _href="url" _text="$.label|cut(40, '...')"></a>
        <!-- 输出全名，text -->
        作者：<em _=" `${$.firstName} ${$.lastName}` "></em>
    </p>
    <hr />
    <!-- 内容为html填充，用text转义 -->
    <p _html="$.summary|text('br')">[摘要为纯文本，允许换行标签]</p>
</header>
```


## 关于当前域

当前域是模板变量取值的当前环境，它在模板导入数据的初始阶段形成，这一初始的当前域也称为顶层域。

随着元素节点树的深入，在 `for/each` 循环结构中会创建新的子域，这个子域就会成为当前迭代的当前域。另外，还可以通过专用的 `tpb-with` 手动创建一个子域，以便于更简单地引用目标数据。

在 `tpb-each` 中，循环针对的是当前元素自身，因此 `tpb-with` 的优先级被设计在 `tpb-each` 之后（与元素中的先后顺序无关）。在 `tpb-for` 中，因为循环的是子元素，所以 `tpb-with` 并不能取到子域中的值，故其优先级在 `tpb-for` 之前。


### 示例

示例数据：

```js
$: {
    list: [{ about: { author, cite }, text: 'some-value' }, ...],
    title: '...'
}
```

普通Each子域引用（`tpb-each`）。

```html
<section>
    <h3 _text="$.title"></h3>
    <ul>
        <!-- 未用 tpb-with -->
        <li tpb-each="$.list">
            <label _text="$.text"></label> <!-- 子域成员引用 -->

            作者：<strong _text="$.about.author"></strong>
            来源：<em _text="$.about.cite"></em>
        </li>
    </ul>
</section>
```

Each子域中增加新的子域（`tpb-with`）。

```html
<section>
    <h3 _text="$.title"></h3>
    <ul>
        <!-- each先执行，with引用 list[i].about -->
        <li tpb-each="$.list" tpb-with="$.about">
            <label _text="$.text"></label> <!-- 通过父域链引用，同 $.$.text -->

            作者：<strong _text="$.author"></strong>
            来源：<em _text="$.cite"></em>
        </li>
    </ul>
</section>
```
