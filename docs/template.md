# 模板

模板是由HTML源码、OBT事件定义（`on/by/to`）、渲染配置（`tpb-xxx`）以及模板节点规划（`tpl-name|node`）构成的HTML文件。

**模板的复用** 限于源码文本层面的复用，由 `tpl-name` 命名模板节点，由 `tpl-node` 引入克隆的节点副本。

> **注：**<br>
> 如果需要逻辑上的复用，比如不同位置共享相同的模板节点（获得状态共享），则属于OBT的事件逻辑。


## OBT（On/By/To）

对于指令（方法）的调用，如果实际上没有实参要传递，可以省略调用括号。方法的实参通常是标量值，但也支持正则表达或箭头函数等（**注记**：采用 `new Function()` 实现，取消原 `JSON.parse` 方式）。


### On

```html
<i id="logo" title="系统菜单" on="click|folds, stop"></i>
<menu id="menu-sys" data-pbo="fold" on="off|lose">
<!--单击折叠切换（folds）后续菜单元素，并停止事件冒泡（stop）
    事件与行为链间用竖线“|”分隔。
    多个指令间用空格“ ”分隔。
    此为一组定义。-->
```

```html
<li on="mouseenter|popup; mouseleave|unpop">
    <h6>子菜单标题</h6>
    <menu>...</menu>
</li>
<!--鼠标进入内部子菜单弹出，鼠标移开子菜单消失。
    多组定义间用半角分号“;”隔开。空格仅为视觉友好。 -->
```

支持空格分隔的多个事件名绑定同一个行为链。

```html
<input type="text" on="mouseover focus|select" />
<!-- 鼠标经过或文本框获得焦点时，选取内部文本。 -->
```

事件名可以带选择器参数，成为事件的委派绑定。

```html
<p on="click('img')|$e, attr('src'), zoom('#view')">
    ...（可能包含小图片）
</p>
<!--单击段落中的图片：提取src属性值，在预览框中预览大图。
    $e为获取当前目标元素，attr提取目标属性，zoom载入大图。
    注：zoom 中可将小图url转为大图url。 -->
```

普通事件与代理委派事件可同时定义。

```html
<div on="active click('b')|tabs('_current'), $e('@'), clss('_hot')">
    <b>标签A</b>
    <b>标签B</b>
</div>
<!--单击设置目标<b>元素为“当前状态”，同时获取绑定元素，设置类名为_hot。
    向目标元素发送“active”事件（自定义），执行同一个行为链。
    注：tabs需要<b>子元素目标，active时无效果，会略过。
    $e('@') 获取绑定元素，clss 设置类名。 -->
```


### By

指定由哪个处理器处理业务逻辑。

`By` 承接 `On` 的流程数据，处理后向To传递新的流程数据。

```html
<div on="click('img')|$e, attr('-val')" by="News.photo('#viewtype')">
    <img src="..." data-val="AAA" />
    <img src="..." data-val="BBB" />
</div>
<!--On：单击图片，提取data-val属性中的名称值。
    By：由News板块中的photo成员（方法）处理：
    1. 用上级传递来的图片名称获取详细介绍（纯数据）；
    2. 依照#view-type上展示方式的设定，构造图片展示数据。向后传递。 -->
```


### To

指定数据展示或更新的目标元素、插入方法，以及可能有的附带行为。

属性值格式： `rid[,n] | where | pbs...`

**说明：**

- 各部分以竖线 `|` 分隔，后面两个部分可选。
- `rid` 定位目标元素，置空或设置占位附 `-` 表示触发事件的当前元素。注意目标元素应当已存在（DOM树中）。
- `where` 也可以置空或设置为占位符 `-`，流程数据直接向后传递到 `Next-Stage` 部分。
- 如果需要为后续的 `To` 定义维持顺序（当前仅占位），则应当将整个值设置为一个 `-`。

```html
<input type="image" to="form/#search|val|select" />
<!--1. 向上检索<form>元素为上下文，向内查找ID为search的元素。
    2. 设置value值为前阶传递来的流程数据。
    3. 选取刚刚设置的值（注：调用目标元素的select()方法）。
```


### 多组对应

`On/By/To` 中可以包含多组定义，各组用分号分隔，按位置顺序一一对应。如果 `By/To` 中按位置没有对应项且不是最后一组，需要用占位符 `-` 维持正确的顺序关系。

```html
<ul class="_pluglist" title="插件面板"
    on="click('li'); mouseenter; mouseleave"
    by="Plug.run; Help.index"
    to="-; '#box-msg'|fill; '#box-msg'|hide">
    <li data-val="plugA"> ... <li>
    <li data-val="plugB"> ... <li>
</ul>
<!--1. 单击插件条目<li>执行插件（Plug.run）。
    2. 鼠标移入获取并显示插件提示信息（Help.index）。
    3. 鼠标移开隐藏提示信息。 -->
```


```html
<div
    on="click('i')|$e, attr('-val')"
    by="Help.index('#help-type')"
    to="#box-man|end|scroll,focus('')">
    <img src="..." data-val="plugA" />
    <img src="..." data-val="plugB" />
</div>
<!--To：
    检索 #box-man 元素，用By传递来的数据添加到内部末尾（end/append）；
    滚动到插入内容处，聚焦To目标元素（focus('')），便于键盘操作。 -->
```


## 子模板

共有3个属性名：`tpl-name` 和 `tpl-node` 与 `tpl-source`，前者用于命名模板节点，后两者用于引用模板节点。其中 `tpl-node` 会引入一个克隆的模板节点，而 `tpl-source` 则会引入原始的模板节点。

两个引入节点的语法都支持逗号分隔的节点列表，如：`tpl-node="main:aaa, main:bbb, xyz"` 同时引入3个节点。


### 特殊标识符

对于 `tpl-node` 和 `tpl-source` 两个语法分别支持两个特殊标识符：事件处理克隆标识（`!`）和移出标识（`~`），前者适用于 `tpl-node`，后者适用于 `tpl-source`。

- `!` 克隆模板节点的同时，也克隆其上绑定的事件处理器，包含根节点和内部子元素上全部的绑定。
- `~` 从内部存储中 **抽出** 该模板节点（之后就无法在 `tpl`、`node` 等指令中引用了），通常源于模板节点的分级管理（而非复用），可避免内部存储集的臃肿，如：`tpl-source="~ main:tools, main:body"`。

> **注意：**<br>
> 该标识符只能出现在整个特性值的最前端。如果定义的是一个名称列表且其中某项不应当是抽取，则应当分解开来引入。<br>
> 标识符如果用错了目标语法，只会被简单地忽略而不是出错。<br>

> **注记：**<br>
> 感叹号（`!`）有增强、执行的意味。这里表示克隆的增强（包含事件处理），另外事件处理也表达了行为实施。<br>
> 波浪号（`~`）有流动的象形。这里用来表达取出（流出）、取走原始的目标的意思。<br>


### tpl-name

命名一个元素为模板节点，节点名称需要在程序全局范围内唯一。`tpl-node|source` 引用的名称即时此处的命名。

```html
<!-- 脚本历史清单构造 -->
<ol tpl-name="data:shlist" tpl-for>
    <li><code _="$"></code></li>
</ol>
```

```html
<table> <!-- 表格行封装（注：浏览器不接受单独的<tr>元素。 -->
<tbody>
    <tr tpl-name="prop:clang">
        <th>语言</th>
        <td>
            <select tpl-name="app:clang" name="languages" tpl-for>
                <option _value="$.name" _="$.label"></option>
            </select>
        </td>
    </tr>
    <!--模板节点不必是根元素，嵌套的模板节点也没问题。
        规范的命名通常会前置一个应用域以使得条理清晰。 -->
</tbody>
</table>
```


### tpl-node

在当前位置引入目标模板节点的一个副本。

`tpl-node` 所在的元素仅仅是一种占位，会被引入的目标节点替换掉。也因此，占位的元素类型是任意的，比如可以用一个 `<div>` 标签表示当前位置是一个区块，而 `<span>` 表示当前位置为内联，或者仅仅是用一个 `<hr>` 元素表示简单的空间占位。

值名称支持逗号（`,`）分隔的多个模板节点指定，它们会按顺序作为一个整体替换掉 `tpl-node` 所属的元素。

默认地，克隆不包含源节点上绑定的事件处理器（但无条件包含渲染语法），如果需要同时克隆事件处理器，可在特性值上前置一个标识符（`!`）。

> **注：**<br>
> 占位元素内可以包含模板设计的说明（最终会被替换掉，故无副作用），这在模板设计期间是一种很友好的特性。

```html
<aside>
    <div tpl-node="!tools:option">
        [这里是选项区，克隆包含事件处理器]
    </div>
    <div>
        <!-- 其它内容 -->
    </div>
    <hr tpl-node="inputs:submit"> <!-- 引用提交区，因简单而无需说明 -->
</aside>
```


### tpl-source

在当前位置引入目标模板节点本身。如果该节点不再需要在OBT指令中引用，可以前置一个移出标识符（`~`），以减轻内部存储的负担。

这通常用在模板节点的分级管理中，比如把一大块代码拆分成几个小的部分，此时模板并不需要复用（最好移出）。或者，该模板节点只会在一个地方反复出现（如UI切换），这会要求节点在 OBT 指令中可用。
