//! $ID: pbs.get.js 2019.08.19 Tpb.Base $
// ++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  OBT:On 方法集。
//
//  一些基础取值操作和 tQuery/Collector 中取值方法的封装。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import $, { DataStore, TplsPool, ChainStore, DEBUG, TplrName, evnidDlmt, HEADCELL } from "./config.js";
import { Util } from "./tools/util.js";
import { Ease } from "./tools/ease.js";
import { bindMethod } from "./base.js";
import { Process } from "./pbs.base.js";
import { chainClone } from "./core.js";


const
    // evo成员名/值键。
    evoIndex = {
        0: 'chain',     // 调用链自身（链头Cell）
        1: 'target',    // 事件起点元素（event.target）
        2: 'current',   // 触发事件的当前元素（event.currentTarget|matched）
        3: 'delegate',  // 委托绑定的元素（event.currentTarget）
        4: 'selector',  // 委托匹配选择器（for match）]
        6: 'data',      // 自动获取的流程数据
        7: 'entry',     // 中段入口（迭代重入）
        10: 'primary',  // To检索结果
        11: 'updated',  // To更新目标/集（动态变化）
        // event:       // 当前事件对象（内部使用，不提供数字索引）
    },

    // 归类键区。
    // 用于 iskey 方法判断键位（Event.key）。
    // 键值大于键盘可输入的最大数字键。
    __keyArea = {
        10: /^[0-9]$/,                  // 纯数字
        11: /^[a-zA-Z]$/,               // 纯字母
        12: /^[0-9a-zA-Z]$/,            // 纯字母&数字
        13: /^F[0-9]+$/i,               // F1-F10
        14: /^(?:F[0-9]+|Escape)$/i,    // F1-F10, ESC
        15: /^(?:Home|End|PgUp|PgDn)$/,
        16: /^(?:Arrow(?:Up|Left|Down|Right))$/,
        17: /^(?:Enter|Delete|Backspace)$/,

        // 浏览器编辑快捷键目标（<b><i><u>）
        20: /^(?:b|i|u)$/i,
    },

    // 修饰键属性名。
    // 注：按名称有序排列。
    __modKeys = [
        'altKey',
        'ctrlKey',
        'metaKey',
        'shiftKey',
    ],

    // 空白匹配。
    __reSpace = /\s+/,

    // 鼠标移动存储键（横向）。
    __movementX = Symbol('mouse-movementX'),

    // 鼠标移动存储键（纵向）。
    __movementY = Symbol('mouse-movementY'),

    // 内容滚动值存储键（横向）。
    __scrolledX = Symbol('scroll-horizontal'),

    // 内容滚动值存储键（垂直）。
    __scrolledY = Symbol('scroll-vertical');


// 几个出错中断提示信息。
const
    dataUnfound = 'data-store is undefined.',
    chainUnfound = 'err:chain-store is undefined or chain unfound.';



//
// 取值类。
// 适用于 On/To:Next 两个域。
//
const _Gets = {

    // 基本取值。
    //-----------------------------------------------

    /**
     * 单元素检索入栈。
     * 目标：暂存区1项可选。
     * 如果目标有值，视为起点元素，否则起点为事件绑定元素。
     * 例：
     * 1. $('/p')  // 检索事件绑定元素内的首个<p>子元素
     * 2. evo(1) pop $('/a')  // 检索事件起始元素内的首个<a>元素
     * 4. push('/p') $(_1)    // rid从流程获取，效果同1
     * 5. push('/a') evo(1) pop $(_1)  // 效果同2
     * 6. $         // 起点元素自身
     * 7. $('/')    // 同上
     * 注意：
     * 若以起点元素为上下文，选择器必需包含二阶分隔符（/）。
     * 否则视为全局选择器（document为上下文）。
     * @param  {Object} evo 事件关联对象
     * @param  {String} rid 相对ID，可选
     * @param  {Element|DocumentFragment} ctx 全局上下文，可选
     * @return {Element|null}
     */
    $( evo, rid, ctx ) {
        return Util.find( rid, evo.data || evo.delegate, true, ctx );
    },

    __$: -1,


    /**
     * 多元素检索入栈。
     * 目标：暂存区1项可选。
     * 如果目标有值，视为起点元素，否则起点为事件绑定元素。
     * 如果rid非字符串，则返回简单的Collector封装。
     * 例：
     * 1. push(['a','b','c']) $$(_1) // 从流程取1个实参：封装数组 $(['a','b','c'])
     * 2. push('abc') $$(_1)  // 从流程取相对ID，rid为'abc'
     * 2. push('abc') $$(_)   // 从流程取不定数量实参，'abc'会被展开传递，实际上rid仅为'a'
     * @param  {Object} evo 事件关联对象
     * @param  {String|Value} rid 相对ID或待封装值
     * @param  {Element|DocumentFragment} ctx 全局上下文，可选
     * @return {Collector}
     */
    $$( evo, rid, ctx ) {
        if ( typeof rid !== 'string' ) {
            return $( rid );
        }
        return Util.find( rid, evo.data || evo.delegate, false, ctx );
    },

    __$$: -1,


    /**
     * 元素匹配查找。
     * 目标：暂存区/栈顶1项。
     * 目标为查找的上下文限定元素或集合。
     * @data: Element|Document|Collector|[Element]
     * @param  {String} slr 选择器
     * @param  {Boolean} andOwn 包含上下文元素自身测试
     * @return {[Element]|Collector} 元素集
     */
    find( evo, slr, andOwn ) {
        let x = evo.data;

        if ( $.isArray(x) ) {
            return $(x).find( slr, andOwn );
        }
        return $.find( slr, x, andOwn );
    },

    __find: 1,


    /**
     * evo成员取值入栈。
     * 目标：无。
     * 特权：是，判断取值。
     * 如果name未定义或为null，取evo自身入栈。
     * 提示：
     * - chain  获取链头，可用于解绑当前调用链。
     * - data   会取出暂存区全部成员。
     * @param  {Stack} stack 数据栈
     * @param  {String|Number} name 成员名称或代码
     * @return {Element|Value|[Value]}
     */
    evo( evo, stack, name ) {
        if ( name == null ) {
            return evo;
        }
        name = evoIndex[name] || name;

        return name == 'data' ? stack.data(0) : evo[name];
    },

    __evo_x: true,


    /**
     * 从事件对象上取值。
     * 目标：无。
     * 无实参调用取事件对象自身入栈。
     * 支持空格分隔的多个名称指定，返回一个值数组。
     * @param  {String} names 事件属性名（序列）
     * @return {Value|[Value]|Event} 值或值集
     */
    ev( evo, names ) {
        return names == null ?
            evo.event : namesValue( names, evo.event );
    },

    __ev: null,


    /**
     * 获取数据长度。
     * 目标：暂存区/栈顶1项。
     * 目标可能是数组、字符串或类数组。
     */
    len( evo ) {
        return evo.data.length;
    },

    __len: 1,


    /**
     * 获取集合大小。
     * 目标：暂存区/栈顶1项。
     * 目标通常是 Set、Map 等实例。
     */
    size( evo ) {
        return evo.data.size;
    },

    __size: 1,


    /**
     * 调用目标的方法。
     * 目标：暂存区/栈顶1项。
     * 目标是调用方法的一个宿主。
     * 注意：数组作为单个对象看待（特例）。
     * @data: Object
     * @param  {String} meth 方法名
     * @param  {...Value} rest 实参序列
     * @return {Value} 方法调用的返回值
     */
    call( evo, meth, ...rest ) {
        return evo.data[meth]( ...rest );
    },

    __call: 1,


    /**
     * 调用多个目标的方法。
     * 目标：暂存区/栈顶1项。
     * 目标需要是一个数组或支持.map方法的对象。
     * @data: [Object]
     * @param  {String} meth 方法名
     * @param  {...Value} rest 实参序列
     * @return {[Value]} 全部调用的返回值集
     */
    calls( evo, meth, ...rest ) {
        return evo.data.map( o => o[meth](...rest) );
    },

    __calls: 1,


    /**
     * 获取表单控件值集。
     * 目标：暂存区/栈顶1项。
     * 行为与 $.val() 类似，但用控件名定位元素，且返回一个对象。
     * @data: <form>
     * @param  {String} names 控件名序列
     * @return {Object} 名:值对对象
     */
    valobj( evo, names ) {
        return $.values( evo.data, names, null );
    },

    __valobj: 1,


    /**
     * 获取表单控件选取状态。
     * 目标：暂存区/栈顶1项。
     * 单个名称返回单值，否则返回一个值数组。
     * 注意名称应当有效（有name或id属性），否则无法取值。
     * 注意：
     * 应当仅用于复选框（checkbox）控件，重名复选框仅认可首个。
     * 如果复选框为不确定态，返回的值为null而非布尔类型。
     * @data: <form>
     * @param  {String} names 控件名序列
     * @param  {Boolean} strict 严格对应模式（null成员保留），可选
     * @return {Boolean|null|[Boolean|null]}
     */
    checked( evo, names, strict ) {
        let _vs = $.controls(
                evo.data,
                names,
                !strict
            ).map( el => el && (el.indeterminate ? null : el.checked) );

        return _vs.length === 1 ? _vs[0] : _vs;
    },

    __checked: 1,


    /**
     * 获取元素内联样式。
     * 样式名支持空格分隔的多个名称，返回一个值数组。
     * @data: Element|[Element]
     * @param  {String} name 样式名
     * @return {String|[String]|[[String]]}
     */
    style( evo, name ) {
        return mapCall(
            evo.data,
            el => namesValue( name, el.style )
        );
    },

    __style: 1,


    /**
     * 获取当前选取范围。
     * 目标：无。
     * 即获取用户在窗口中的划选部分。
     * collapse:
     * - true   选区需是折叠的（无内容），否则返回 false。
     * - false  选区需包含内容，否则返回 false。
     * - ''     选区有内容且完整嵌套（首尾在同一容器内），否则返回 false。
     * - null   完整嵌套，包含选区为空时。否则返回 false。
     * - undefined  无条件返回选区，没有条件约束。
     * 注记：
     * 返回折叠（无内容）的Range可以获取插入点。
     * 返回null表示文档内压根没有被点选/聚焦。
     * @param  {Boolean|null|''} collapse 折叠或严格约束标记
     * @return {Range|null|false}
     */
    sRange( evo, collapse ) {
        let _sel = window.getSelection(),
            _rng = _sel.rangeCount > 0 && _sel.getRangeAt(0);

        if ( _rng ) {
            switch ( collapse ) {
                case '':
                    return !_rng.collapsed && sameLevel( _rng ) && _rng;
                case true:
                    return _rng.collapsed && _rng;
                case false:
                    return !_rng.collapsed && _rng
                case null:
                    return sameLevel( _rng ) && _rng;
            }
        }
        return _rng || null;
    },

    __sRange: null,


    /**
     * 获取当前窗口内的范围对象。
     * 目标：暂存区1项可选。
     * 目标为范围限定元素，在范围内时才有效。
     * 如果压根就没有选区，返回null。
     * 如果选区不在限定元素内，返回false。
     * 如果没有指定范围限定元素，简单返回选区对象。
     * 注：
     * 与上面的sRange不同，不区分选区是否折叠或规范嵌套。
     * strict实参仅在有范围限定时才有意义。
     * @data: Element 限定容器
     * @param  {Boolean} strict 严格子级包含
     * @return {Range|null|false}
     */
    wRange( evo, strict ) {
        let _sel = window.getSelection(),
            _rng = _sel.rangeCount > 0 && _sel.getRangeAt(0);

        if ( !_rng || evo.data === undefined ) {
            return _rng || null;
        }
        return $.contains( evo.data, _rng.commonAncestorContainer, strict ) && _rng;
    },

    __wRange: -1,


    /**
     * 选取目标节点为一个范围（Range）。
     * 目标：暂存区/栈顶1项。
     * collapse: {
     *      true    折叠到元素前端
     *      false   折叠到元素末端
     *      undefined 元素为选取状态（无折叠）
     * }
     * @data: Element
     * @param  {Boolean} collapse 选区折叠，可选
     * @return {Range}
     */
    nodeRange( evo, collapse ) {
        let _rng = document.createRange();
        _rng.selectNode( evo.data );

        if ( collapse != null ) {
            _rng.collapse( !!collapse );
        }
        return _rng;
    },

    __nodeRange: 1,


    /**
     * 获取可编辑元素。
     * @data: Range|Element
     * @return {Element}
     */
    edbox( evo ) {
        let _el = evo.data.nodeType ?
            evo.data :
            evo.data.commonAncestorContainer;

        return $.closest( _el, '[contenteditable]' );
    },

    __edbox: 1,



    // 类型转换&构造。
    // 目标：暂存区/栈顶1项。
    // 返回值：
    // 如果调用mapCall，视流程数据返回一个值或值数组。
    //-----------------------------------------------------

    /**
     * 转为整数（parseInt）。
     * 注意：空串转换为 NaN 而非数值 0。
     * @param  {Number} radix 进制基数
     * @return {Number}
     */
    int( evo, radix ) {
        return mapCall( evo.data, v => parseInt(v, radix) );
    },

    __int: 1,


    /**
     * 将目标转为浮点数（parseFloat）。
     * 注意：空串转换为 NaN 而非数值 0。
     * @return {Number}
     */
    float( evo ) {
        return mapCall( evo.data, v => parseFloat(v) );
    },

    __float: 1,


    /**
     * 转化为正则表达式。
     * 如果提供了flag，肯定会返回一个新的正则对象。
     * 如果源本来就是一个正则对象，则原样返回。
     * @param  {String} flag 正则修饰符
     * @return {RegExp}
     */
    re( evo, flag ) {
        return mapCall( evo.data, v => RegExp(v, flag) );
    },

    __re: 1,


    /**
     * 转为布尔值（true|false）。
     * 假值：'', 0, false, null, undefined
     * 如果传递all为真，假值包含空对象（[], {}）。
     * @param  {Boolean} all 是否测试空对象/数组
     * @return {Boolean}
     */
    bool( evo, all ) {
        if ( all ) {
            return mapCall( evo.data, v => !!hasValue(v) );
        }
        return mapCall( evo.data, v => !!v );
    },

    __bool: 1,


    /**
     * 转为字符串。
     * 可以选择性的添加前/后缀。
     * @param  {String} pre 前缀，可选
     * @param  {String} suf 后缀，可选
     * @return {String}
     */
    str( evo, pre = '', suf = '' ) {
        return mapCall( evo.data, v => `${pre}${v}${suf}` );
    },

    __str: 1,


    /**
     * 转换为数组。
     * - 如果数据源已经是一个数组则简单返回。
     * - 如果源数据包含[Symbol.iterator]成员（字符串除外），则用Array.from转换。
     * - 其它单值被封装为一个单成员数组。
     * 注：
     * 如果要强制封装为一个单成员数组，可以用 pack(1) 指令。
     * 非字符串的转换效果与$$指令类似，但节点的转换结果可能不同。
     * @return {Array}
     */
    arr( evo ) {
        if ( typeof evo.data === 'string' ||
            !evo.data[ Symbol.iterator ] ) {
            return [ evo.data ];
        }
        return $.isArray( evo.data ) ? evo.data : Array.from( evo.data );
    },

    __arr: 1,


    /**
     * 转换为普通对象。
     * 可以传递键名，创建一个新对象并设置键值映射。
     * 键名可以是空格分隔的多个名称，此时如果目标为数组，则为一一对应设置，否则单个值映射到多个名称。
     * 如果为单个键名，值简单地映射到该键名。
     * 如果未传递键名，则简单将值本身进行Object转换。
     * @param  {String} key 封装键名，可选
     * @return {Object}
     */
    obj( evo, key ) {
        if ( key === undefined ) {
            return Object( evo.data );
        }
        return __reSpace.test( key ) ? gather( key.split(__reSpace), evo.data ) : { [key]: evo.data };
    },

    __obj: 1,


    /**
     * 创建预填充值数组。
     * 目标：暂存区/栈顶1项。
     * 目标为基准数组，如果不是数组会自动封装为数组。
     * 最后一个值用于剩余重复填充。
     * 如果完全没有填充值，数组成员会填充为undefined。
     * 例：
     * - push(10) array(3)      // [10, undefined, undefined]
     * - push(10) array(3, 'a') // [10, 'a', 'a']
     * @param  {Number} size 集合大小
     * @param  {...Value} vals 填充值序列，可选
     * @return {[Value]}
     */
    array( evo, size, ...vals ) {
        let x = evo.data;

        if ( !$.isArray(x) ) {
            x = [ x ];
        }
        return arrayFill( x.concat(vals), size );
    },

    __array: 1,


    /**
     * 简单创建元素。
     * 目标：暂存区/栈顶1项。
     * 目标为元素内容文本，支持数组对应创建多个元素。
     * 如果指定创建的数量，单个内容重复使有，数组内容截断或末尾填充。
     * 注意：
     * 只要指定了数量，就会创建一个集合（Collector），
     * 否则可能只创建单个元素。
     * @data: Value|[Value]
     * @param  {String} tag 标签名
     * @param  {Number} n 创建个数，可选
     * @return {Element|Collector}
     */
    elem( evo, tag, n ) {
        let x = evo.data;

        if ( n > 0 ) {
            x = arrayFill( $.isArray(x) ? x : [x], n );
        }
        return $.isArray(x) ? $(x).elem(tag) : $.elem(tag, x);
    },

    __elem: 1,


    /**
     * 目标（集）单次克隆。
     * 目标：暂存区/栈顶1项。
     * 如果目标上存在.clone方法，则调用该方法，否则按元素克隆。
     * 元素克隆参数：(event, deep, eventdeep)
     * @data: Object|Element|[Element]
     * @param  {Boolean} event 包含事件处理器，可选
     * @param  {Boolean} deep 深层克隆（含子元素），可选（默认true）
     * @param  {Boolean} eventdeep 包含子元素的事件处理器，可选
     * @return {Element|Collector}
     */
    clone( evo, ...args ) {
        let x = evo.data;
        return typeof x.clone === 'function' ? x.clone( ...args ) : $mapCall( x, 'clone', ...args );
    },

    __clone: 1,


    /**
     * 元素（集）多次克隆。
     * 目标：暂存区/栈顶1项。
     * 仅为元素克隆逻辑，支持元素上绑定的事件处理器克隆。
     * 始终返回一个数组。
     * @data: Element|[Element]
     * @param  {Number} cnt 克隆个数
     * @param  {Boolean} event 包含事件处理器，可选
     * @param  {Boolean} deep 深层克隆（含子元素），可选（默认true）
     * @param  {Boolean} eventdeep 包含子元素的事件处理器，可选
     * @return {[Element|Collector]}
     */
    clones( evo, cnt, event, deep = true, eventdeep ) {
        let _buf = [];

        while ( cnt-- > 0 ) {
            _buf.push(
                $mapCall( evo.data, 'clone', event, deep, eventdeep )
            );
        }
        return _buf;
    },

    __clones: 1,


    /**
     * 集合成员提取。
     * 默认为对象或数组中单个属性/下标取值。
     * 如果是Collector实例，无实参传递时返回一个原生数组。
     * 注意：
     * undefined会自动转换为null入栈，通常这是因为下标越界所致。
     * @data Array|Object
     * @param  {Number|String} idx 位置下标或键名称
     * @return {Value|[Value]|null}
     */
    item( evo, idx ) {
        let x = evo.data,
            v = $.isCollector( x ) ? x.item( idx ) : x[ idx ];

        return v === undefined ? null : v;
    },

    __item: 1,


    /**
     * 元素集封装。
     * 目标：暂存区/栈顶1项。
     * 目标只能是节点元素，非集合会被自动转为Collector。
     * 注：
     * 与To部分的同名方法不同，这里box应当只是字符串，
     * 即便是通过(_1)标识取元素实参，也不支持克隆选项。
     * @param  {String} box 封装容器HTML
     * @return {Collector}
     */
    wrapAll( evo, box ) {
        return $(evo.data).wrapAll( box );
    },

    __wrapAll: 1,


    /**
     * 获取绑定句柄。
     * 目标：暂存区/栈顶1项。
     * 目标为检索绑定信息的元素。
     * @param  {String} evn 事件名（单个），可选
     * @return {Object|[Function|EventListener]|null} 用户调用/处理器集
     */
    handles( evo, evn ) {
        return $.handles( evo.data, evn ) || null;
    },

    __handles: 1,


    /**
     * 提取元素多个特性值。
     * 始终会返回值数组，即便名称仅为单个。
     * 如果目标是一个集合，会返回一个二维的值数组。
     * @data: Element|[Element]
     * @param  {String} names 名称序列
     * @return {[Value]|[[Value]]} 值集或值集组
     */
    attrs( evo, names ) {
        names = names.split( __reSpace );
        return mapCall( evo.data, el => names.map( n => $.attr(el, n) ) );
    },

    __attrs: 1,


    /**
     * 提取元素的多个属性值。
     * 说明参考上面的.attrs指令。
     * 会保证提取的undefined值转换为null。
     * 注记：
     * 因为数组可能被展开，因此保证值不为undefined。
     * @data: Element|[Element]
     * @param  {String} names 属性名序列
     * @param  {Boolean} indet 是否检查不确定态，可选
     * @return {[Value]|[[Value]]} 值集或值集组
     */
    props( evo, names, indet ) {
        let _fun = indet ? indetProp : $.prop;

        names = names.split( __reSpace );
        return mapCall( evo.data, el => names.map( n => nullVal(_fun(el, n)) ) );
    },

    __props: 1,


    /**
     * 提取元素属性值。
     * 覆盖 tQuery.prop() 实现以支持不确定态判断。
     * 支持多个元素返回一个值数组。
     * @param  {String} name 属性名（单个）
     * @param  {Boolean} indet 是否检查不确定态（indeterminate），可选
     * @return {Value|[Value]}
     */
    prop( evo, name, indet ) {
        let _fun = indet ? indetProp : $.prop;
        return mapCall( evo.data, el => nullVal(_fun(el, name)) );
    },

    __prop: 1,


    /**
     * 提取元素的多个属性值。
     * 覆盖 tQuery.property() 实现以支持不确定态判断。
     * 支持多个元素返回一个值数组。
     * 注记：
     * 因为返回值为对象或对象数组，不存在展开不能入栈的问题，
     * 所以取值可以为 undefined。
     * 这与原生的 tQuery.property() 值状态兼容。
     * @param  {String} names 属性名序列
     * @param  {Boolean} indet 是否检查不确定态（indeterminate），可选
     * @return {Object|[Object]}
     */
    property( evo, names, indet ) {
        names = names.split( __reSpace );

        if ( !indet ) {
            return $mapCall( evo.data, 'property', names )
        }
        return mapCall(
            evo.data,
            el => names.reduce( (o, n) => (o[n] = indetProp(el, n), o), {} )
        );
    },

    __property: 1,


    /**
     * JSON 序列化。
     * @data: Object JSON对象
     * @param  {String|Number} space 缩进字符序列或空格数，可选
     * @param  {[String]|Function|null} replacer 属性名或处理器，可选
     * @return {String} JSON的字符串表示
     */
    json( evo, space, replacer ) {
        return JSON.stringify( evo.data, replacer, space );
    },

    __json: 1,


    /**
     * JSON 序列化（多目标）。
     * @data: [Object] JSON对象集
     * @param  {String|Number} space 缩进字符序列或空格数，可选
     * @param  {[String]|Function|null} replacer 属性名或处理器，可选
     * @return {[String]} JSON的字符串集
     */
    jsons( evo, space, replacer ) {
        return evo.data.map(
            o => JSON.stringify( o, replacer, space )
        );
    },

    __jsons: 1,


    /**
     * JSON 解析。
     * @data: String JSON格式串
     * @param  {Function} reviver 解析处理器
     * @return {Object|Value}
     */
    JSON( evo, reviver ) {
        return mapCall( evo.data, s => JSON.parse(s, reviver) );
    },

    __JSON: 1,


    /**
     * 创建URL对象。
     * 目标：暂存区/栈顶1项。
     * 注意base如果包含子路径，需要包含末尾的斜线/。
     * @data: String 定位目标（相对或绝对）
     * @param  {String} base 基础URL
     * @return {URL}
     */
    URL( evo, base ) {
        return new URL( evo.data, base );
    },

    __URL: 1,


    /**
     * 构造日期对象。
     * 目标：暂存区条目可选。
     * 目标如果有值，补充到模板实参序列之后（数组会展开）。
     * 无实参无目标时构造一个当前时间对象。
     * @param  {...Value} rest 实参值
     * @return {Date}
     */
    Date( evo, ...rest ) {
        return new Date( evo.data, ...rest );
    },

    __Date: 1,


    /**
     * 创建Map实例。
     * 目标：暂存区1项可选。
     * 目标作为创建实例的初始数据。
     * 注：多个实例会初始化为相同的数据。
     * @param  {Number} n 实例数量
     * @return {Map|[Map]}
     */
    Map( evo, n = 1 ) {
        if ( n == 1 ) {
            return new Map( evo.data );
        }
        return Array(n).fill().map( () => new Map(evo.data) );
    },

    __Map: -1,


    /**
     * 创建Set实例。
     * 目标：暂存区1项可选。
     * 目标作为创建实例的初始数据。
     * 注：多个实例会初始化为相同的数据。
     * @param  {Number} n 实例数量
     * @return {Set|[Set]}
     */
    Set( evo, n = 1 ) {
        if ( n == 1 ) {
            return new Set( evo.data );
        }
        return Array(n).fill().map( () => new Set(evo.data) );
    },

    __Set: -1,



    // 复杂取值。
    //-----------------------------------------------


    /**
     * 获取目标的成员值。
     * 目标：暂存区/栈顶1项。
     * name支持空格分隔的多个名称，返回一个值数组。
     * 单个名称时返回一个值。
     * 如果目标是一个数组且取多个值，返回的将是一个二维数组。
     * 注：数字名称可适用数组。
     * @data: Object|[Object]
     * @param  {String|Number} names 名称（序列）
     * @return {Value|[Value]|[[Value]]}
     */
    its( evo, names ) {
        return mapCall( evo.data, o => namesValue(names+'', o) );
    },

    __its: 1,


    /**
     * 用状态数组清理数组。
     * 目标：暂存区/栈顶1项。
     * 用依据数组的成员判断目标数组的相应成员是否保留。
     * 真值保留，假值去除。
     * 注记：
     * 这在根据表单控件状态提取另一组值时很有用。
     * @data: [Value] 目标数组
     * @param  {[Boolean]} junk 判断集
     * @return {[Value]} 结果数组
     */
    arr2j( evo, junk ) {
        return evo.data.filter( (_, i) => !!junk[i] );
    },

    __arr2j: 1,


    /**
     * 特殊转换：
     * 将支持.entries接口的对象（如Set/Map）转换为普通对象。
     * @data: {.entries}
     * @return {Object}
     */
    objz( evo ) {
        return Object.fromEntries( evo.data );
    },

    __objz: 1,


    /**
     * 对象属性提取/合并。
     * 目标：暂存区/栈顶1项。
     * 目标作为提供属性值的数据源对象。
     * 支持由空格分隔的多名称限定，空名称匹配全部属性（含Symbol）。
     * 注：属性仅限于对象自身（非继承）的可枚举属性。
     * @data: Object => Object
     * @param  {Object} to 接收对象
     * @param  {String} names 取名称序列，可选
     * @return {Object}
     */
    obj2x( evo, to, names ) {
        if ( !names ) {
            return Object.assign( to, evo.data );
        }
        let _ns = new Set( names.split(__reSpace) );

        return $.assign( to, evo.data, (v, n) => _ns.has(n) && [v] );
    },

    __obj2x: 1,


    /**
     * 获取模板管理器。
     * 目标：无。
     * 无参数时默认获取本系模板管理器。
     * 注意：
     * 因为返回Promise实例，所以注意avoid等操作应当在此之前。
     * 返回的模板管理器可用于克隆或获取节点。
     * @data: String 模板域
     * @param  {String} tname 模板管理器存储名，可选
     * @return {Templater}
     */
    tplr( evo, tname = TplrName ) {
        return TplsPool.get( tname );
    },

    __tplr: null,


    /**
     * 获取模板节点。
     * 目标：暂存区1项可选。
     * 目标为模板管理器，仅在有多个模板系时才需要。
     * 如果目标有值，优先于实参指定的模板管理器（通过名称引用）。
     * 注意：
     * 获取的模板节点为原始节点，如果需要克隆，可用 .clone() 接口。
     * 提示：
     * 因为返回Promise实例，所以注意avoid等操作应当在此之前定义。
     * @data: Templater 模板管理器
     * @param  {String} name 模板名（单个）
     * @param  {String} tname 模板管理器存储名，可选
     * @return {Promise<Element>}
     */
    tpl( evo, name, tname = TplrName ) {
        return ( evo.data || TplsPool.get(tname) ).get( name );
    },

    __tpl: -1,


    /**
     * 获取模板节点（集）。
     * 目标：暂存区1项可选。
     * 与上面的 .tpl 不同，直接返回节点元素而不是一个承诺。
     * 如果只请求单个节点且未找到，返回null（数组成员中未找到的也为null）。
     * name支持空格分隔的多个名称序列。
     * 注记：
     * 用户请求节点时应当知道节点载入情况，节点预先载入有3种方式：
     * 1. 在主页面中通过隐藏的tpl-source或tpl-node预先载入。
     * 2. 其它先构建（Tpb.build）的模板导致节点已经自动载入。
     * 3. 主动使用tpl载入单个节点，于是与该节点定义在同一文件中的其它节点也会自动载入。
     * @data: Templater 模板管理器
     * @param  {String} name 模板名/序列
     * @param  {String} tname 模板管理器存储名，可选
     * @return {Element|null|[Element|null]}
     */
    node( evo, name, tname = TplrName ) {
        let _tr = evo.data || TplsPool.get( tname );

        if ( __reSpace.test(name) ) {
            return name.split( __reSpace ).map( n => _tr.node(n) );
        }
        return _tr.node( name );
    },

    __node: -1,


    /**
     * 获得键数组。
     * 目标：暂存区/栈顶1项。
     * 主要为调用目标对象的.keys()接口。
     * 也适用于普通对象。
     * @data: {Array|Collector|Map|Set|Object}
     * @return {[Value]}
     */
    keys( evo ) {
        if ( $.isFunction(evo.data.keys) ) {
            return [...evo.data.keys()];
        }
        return Object.keys( evo.data );
    },

    __keys: 1,


    /**
     * 获取值数组。
     * 目标：暂存区/栈顶1项。
     * 主要为调用目标对象的.values()接口。
     * 也适用于普通对象。
     * @data: {Array|Collector|Map|Set|Object}
     * @return {[Value]}
     */
    values( evo ) {
        if ( $.isFunction(evo.data.values) ) {
             return [...evo.data.values()];
        }
        return Object.values( evo.data );
    },

    __values: 1,


    /**
     * 函数创建。
     * 目标：暂存区/栈顶1项。
     * 取目标为函数体构造函数，函数体通常应当包含return语句。
     * 实参即为函数参数名序列。
     * @param  {...String} names 参数名序列
     * @return {Function}
     */
    func( evo, ...names ) {
        return new Function( ...names, evo.data );
    },

    __func: 1,


    /**
     * 元素关联数据提取。
     * 目标：暂存区1项可选。
     * 若目标有值，则视为关联元素，否则关联当前委托元素。
     * name支持空格分隔的名称序列。
     * 如果不存在关联存储（Map），返回null。
     * 注意：返回null可用于判断状况，但无法区分本来就存储的null。
     * @data: Element
     * @param  {String} name 名称/序列
     * @return {Value|[Value]|null}
     */
    data( evo, name ) {
        let _el = evo.data || evo.delegate,
            _m = DataStore.get(_el);

        if ( DEBUG && !_m ) {
            window.console.warn('key:', _el, dataUnfound);
        }
        return _m ? getData(_m, name) : null;
    },

    __data: -1,


    /**
     * 生成元素基本信息。
     * 目标：暂存区/栈顶1项。
     * @data: Element|[Element]|Collector
     * @param  {Boolean} hasid 包含ID信息
     * @param  {Boolean} hascls 包含类名信息
     * @return {String|[String]|Collector}
     */
    einfo( evo, hasid, hascls ) {
        return mapCall( evo.data, el => elemInfo(el, hasid, hascls) );
    },

    __einfo: 1,


    /**
     * 检查是否容纳选区。
     * 目标：暂存区/栈顶1项。
     * 检查选区对象是否完全在目标容器元素之内。
     * 注记：
     * 当el为选择器时strict才比较友好，否则两个实参需要先压入数据栈再一起提取。
     * @data: Range
     * @param  {Element|String} el 容器元素或其选择器
     * @param  {Boolean} strict 严格子级包含
     * @return {Boolean}
     */
    hasRange( evo, el, strict ) {
        if ( typeof el === 'string' ) {
            el = Util.find( el, evo.delegate, true );
        }
        return evo.data && $.contains( el, evo.data.commonAncestorContainer, strict );
    },

    __hasRange: 1,


    /**
     * 修饰键按下检测。
     * 修饰键指 shift/ctrl/alt/meta 4个键。
     * 目标：无。
     * 排他性约束，names支持空格分隔的多个名称，And关系。
     * 键名忽略大小写。
     * 如果未指定键名，表示未按下任何修饰键。
     * 例：
     * scam('shift ctrl')  // 是否同时按下Shift和Ctrl键。
     * @param  {String} names 键名序列，可选
     * @return {Boolean}
     */
    scam( evo, names ) {
        let _set = new Set( scamKeys(evo.event) );
        if ( !names ) {
            return !_set.size;
        }
        return strictMatch( names.split(__reSpace), _set );
    },

    __scam: null,


    /**
     * 修饰键按下检测。
     * 目标：无。
     * 同上排他性约束，键名忽略大小写。
     * 多个实参键名为Or关系，单个实参键名支持空格分隔的多键名（And关系）。
     * 如果未传递键名，返回按下的键名集（全小写）。
     * @param  {...String} names 键名序列
     * @return {Set|Boolean}
     */
    SCAM( evo, ...names ) {
        let _set = new Set( scamKeys(evo.event) );

        if ( !names.length ) {
            return _set;
        }
        return names.some( n => strictMatch(n.split(__reSpace), _set) );
    },

    __SCAM: null,


    /**
     * 构建组合键序列。
     * 目标：无。
     * 将按下键键位串接为一个键名序列。
     * 如：alt+ctrl:f，表示同时按下Alt+Ctrl和F键。
     * 修饰键名有序排列后用+号连接，冒号之后为目标键名。
     * 注意：
     * 1. 单纯的修饰键也有目标键名，形如：alt:alt。
     * 2. 所有名称皆为小写形式以保持良好约定。
     * 3. 即便没有修饰键按下，目标键名之前的冒号依然需要。如 ":a"。
     * @return {String|null}
     */
    acmsk( evo ) {
        let _ks = scamKeys( evo.event ),
            _key = evo.event.key;

        // 鼠标点击录入表单选历史记录时，也会触发keydown事件，
        // 但此时无key键值（undefined）。
        if ( _key === undefined ) {
            return null;
        }
        return `${_ks.join('+')}:${_key.toLowerCase()}`;
    },

    __acmsk: null,


    /**
     * 是否为目标键之一。
     * 目标：无。
     * 指定数字键时需要包含引号，而不是直接的数值。
     * 数值实参表达约定的键区：
     * - 11:  纯数字键。
     * - 12:  纯字母键。
     * - 13:  纯数字&字母键。
     * - 14:  F1-F12 功能键系列。
     * - 15:  F1-F12 功能键系列（含ESC键）。
     * - 16:  Home/End/PgUp/PgDn 4个页面键。
     * - 17:  四个箭头键（← → ↑ ↓）。
     * - 18:  会导致换行变化的3个编辑键（无选取情况下）。
     * - 20:  浏览器编辑（contenteditable）支持的3个快捷键：<b><i><u>
     * @param  {...String|Number} keys 键名序列或键区值
     * @return {Boolean}
     */
    iskey( evo, ...keys ) {
        let _k = evo.event.key;

        return keys.some(
            v => v > 9 ? __keyArea[v].test(_k) : _k === v
        );
    },

    __key: null,


    /**
     * 预存储调用链提取（单个）。
     * 目标：暂存区/栈顶1项。
     * 提取目标元素上预存储的调用链（链头指令实例）。
     * 提取的调用链可直接用于实时的事件绑定/解绑（on|off|one），
     * 或者用于单独的调用（如 timeOut|timeTick）。
     * 注：
     * 克隆参数可用于新链头接收不同的初始值。
     * 如果没有目标存储集或目标调用链，返回错误并中断。
     *
     * @param  {String} evnid 事件名标识
     * @param  {Boolean} clone 是否克隆，可选
     * @return {Cell|reject}
     */
    chain( evo, evnid, clone ) {
        let _map = ChainStore.get( evo.data ),
            _cell = _map && _map.get( evnid );

        if ( _cell ) {
            return clone ? chainClone(_cell) : _cell;
        }
        return Promise.reject( chainUnfound );
    },

    __chain: 1,


    /**
     * 创建/清除定时器。
     * 目标：暂存区/栈顶1项。
     * 创建时目标为函数，可以是Cell实例（EventListener）。
     * 清除时目标为定时器ID。
     * 创建和清除由 delay 实参表达: 数值时为创建，null时为清除。
     * 创建时返回一个定时器ID，清除时无返回值。
     * 注：setTimeout 的定时器只执行一次。
     * @data: {Function|Cell|timemotID}
     * @param  {Number|null} delay 延迟时间或清除标记
     * @param  {...Value} args 目标函数调用时的实参
     * @return {timeoutID|void}
     */
    timeOut( evo, delay, ...args ) {
        let x = evo.data;

        if ( delay === null ) {
            return window.clearTimeout( x );
        }
        // 通用支持Cell实例。
        if ( $.isFunction(x.handleEvent) ) {
            return window.setTimeout( (ev, elo) => x.handleEvent(ev, elo), delay, evo.event, newElobj(evo) );
        }
        return window.setTimeout( x, delay, ...args );
    },

    __timeOut: 1,


    /**
     * 创建/清除持续定时器。
     * 目标：暂存区/栈顶1项。
     * 目标为函数或之前存储的定时器ID，说明参考上面timeOut。
     * 注意：
     * 每一次都会创建一个定时器，因此通常在单次事件中使用。
     * setInterval 的定时器会持续执行。
     * @param  {Number|null} dist 间隔时间（毫秒）
     * @param  {...Value} args 目标函数调用时的实参
     * @return {intervalID|void}
     */
    timeTick( evo, dist, ...args ) {
        let x = evo.data;

        if ( dist === null ) {
            return window.clearInterval( x );
        }
        // 通用支持Cell实例。
        if ( $.isFunction(x.handleEvent) ) {
            return window.setInterval( (ev, elo) => x.handleEvent(ev, elo), dist, evo.event, newElobj(evo) );
        }
        return window.setInterval( x, dist, ...args );
    },

    __timeTick: 1,


    /**
     * 创建缓动对象。
     * 目标：暂存区/栈顶1项。
     * 目标为缓动方式名（如 InOut）。
     * 如果未传递count值，视为无限次数。
     * @data: String kind 缓动方式
     * @param  {String} name 缓动名称（如 Cubic）
     * @param  {Number} count 总迭代次数，可选
     * @return {Ease} 缓动实例
     */
    ease( evo, name, count ) {
        return new Ease(
            name,
            evo.data || 'In',
            count || Infinity
        );
    },

    __ease: 1,


    /**
     * 获取当前缓动值。
     * 目标：暂存区/栈顶1项。
     * @data {Ease}
     * @param  {Number} total 总值，可选
     * @param  {Number} base 基数值，可选
     * @return {Number}
     */
    easing( evo, total = 1, base = 0 ) {
        return evo.data.value() * total + base;
    },

    __easing: 1,


    /**
     * 创建一个动画实例。
     * 目标：暂存区/栈顶1项。
     * 在目标元素上创建一个动画实例（Element.animate()）。
     * 目标支持多个元素，但共用相同的实参。
     * 提示：
     * 作为 To:Query 的目标可用于绑定事件处理。
     * 可用 data 存储以备其它事件控制使用。
     * @param  {[Object]} kfs 关键帧对象集
     * @param  {Object} opts 动画配置对象
     * @return {Animation|[Animation]}
     */
    animate( evo, kfs, opts ) {
        return mapCall( evo.data, el => el.animate(kfs, opts) );
    },

    __animate: 1,



    // 元素自身行为。
    //-------------------------------------------


    /**
     * 移除元素。
     * 目标：暂存区/栈顶1项。
     * 如果传递back为真，则移除的元素返回入栈。
     * 选择器slr仅适用于集合，但单元素版传递无害。
     * @param  {String|Boolean} slr 选择器或入栈指示，可选
     * @param  {Boolean} back 入栈指示，可选
     * @return {Element|Collector|void}
     */
    remove( evo, slr, back ) {
        if ( typeof slr === 'boolean' ) {
            [back, slr] = [slr];
        }
        let _v = $mapCall( evo.data, 'remove', slr );
        if ( back ) return _v;
    },

    __remove: 1,


    /**
     * 文本节点规范化。
     * 目标：暂存区/栈顶1项。
     * @return {void}
     */
    normalize( evo ) {
        $mapCall( evo.data, 'normalize' );
    },

    __normalize: 1,


    /**
     * 清空操作。
     * 目标：暂存区/栈顶1项。
     * 主要适用表单控件，否则简单调用目标的.clear()方法。
     * 注：
     * 选取类控件为取消选取，其它为清除value值。
     * @return {void}
     */
    clear( evo ) {
        let x = evo.data;

        if ( !$.isArray(x) ) {
            x = [ x ];
        }
        x.forEach( it => it.nodeType === 1 ? $.val(it, null) : it.clear() );
    },

    __clear: 1,


    /**
     * 触发目标变化事件。
     * 这是 click,blur 等事件系列的延伸（但元素上无此原生方法）。
     * 理解：重在”调用“。
     * @data: Element|[Element] 待激发元素
     * @return {void}
     */
    change( evo ) {
        $( evo.data ).trigger( 'change' );
    },

    __change: 1,


    /**
     * 表单控件变化通知。
     * 目标：暂存区/栈顶1项。
     * 目标需要为一个表单元素或元素集。
     * @param  {Value} extra 发送数据
     * @return {void}
     */
    changes( evo, extra ) {
        mapCall( evo.data, frm => $.changes(frm, extra) );
    },

    __changes: 1,


    /**
     * 定制：选取操作。
     * 如果是表单控件元素，简单调用其方法。
     * 如果是普通元素，选取其内容或元素自身为一个Range。
     * @param  {Boolean} self 选取元素自身，可选
     * @return {void}
     */
    select( evo, self ) {
        $mapCall( evo.data, 'select', self );
    },

    __select: 1,


    /**
     * 滚动到当前视口。
     * y, x: {
     *     0   就近显示（如果需要）（nearest）
     *     1   视口起点位置（start）
     *    -1   视口末尾位置（end）
     *     2   居中显示，默认（center）
     * }
     * @param  {Number|String|true|false} y 垂直位置标识
     * @param  {Number|String} x 水平位置标识
     * @param  {Boolean} smooth 平滑模式
     * @return {void}
     */
    intoView( evo, y, x, smooth ) {
        $.intoView( evo.data, y, x, smooth );
    },

    __intoView: 1,


    /**
     * 解绑调用链绑定。
     * 目标：暂存区/栈顶1项。
     * 解绑目标元素上绑定的事件处理器（调用链），调用链来源于目标元素上的预存储。
     * 目标可以是一个集合，对应提取各自解绑。
     * evnid 支持空格分隔的多个标识名。
     * 专用于 To.Update:bind|once() 的反向操作。
     * 注记：
     * 解绑 bind|once() 的处理器也可以用 To.Update:off() 来实现，
     * 但这需要先提取调用链对象，且选择器和是否捕获需要与预定义保持一致。
     * 此专用版便于使用（且在On段）。
     * @data: Element|[Element]
     * @param  {String} evnid 事件名:ID序列
     * @return {void}
     */
    unbind( evo, evnid ) {
        let _els = evo.data;

        if ( !$.isArray(_els) ) {
            _els = [ _els ];
        }
        for ( const id of evnid.trim().split(__reSpace) ) {
            unbindChain( _els, id );
        }
    },

    __unbind: 1,



    // 专有补充。
    //-------------------------------------------


    /**
     * 鼠标水平移动量。
     * 目标：无。
     * 前值存储在事件当前元素上，解绑时应当重置（null）。
     * 可以传递一个固定值用于替换鼠标移动量，这样可产生一种放大或缩小效应。
     * 用于替换的固定值会依鼠标移动方向而设置是否为负数。
     * 注意：
     * 仅在指针确实移动了（非零）才会返回替换的值。
     * 注记：
     * mousemove事件中movementX/Y的值在缩放显示屏下有误差（chrome），
     * 因此用绝对像素值（event.pageX/pageY）重新实现。
     * 前值存储在事件当前元素（evo.current）上，解绑时应当重置（null）。
     * @param  {Number|null} val 固定值或存储清除标记
     * @return {Number|void|null} 变化量（像素）
     */
    movementX( evo, val ) {
        let _el = evo.current;

        if ( val !== null ) {
            let _v = _el[__movementX];
            // n - undefined == NaN => 0
            return movementValue( (_el[__movementX] = evo.event.screenX) - _v || 0, +val );
        }
        delete _el[__movementX];
    },

    __movementX: null,


    /**
     * 鼠标垂直移动量。
     * 目标：无。
     * 说明参考上面movementX接口。
     * @param  {Number|null} val 固定值或存储清除标记
     * @return {Number|void|null} 变化量（像素）
     */
    movementY( evo, val ) {
        let _el = evo.current;

        if ( val !== null ) {
            let _v = _el[__movementY];
            return movementValue( (_el[__movementY] = evo.event.screenY) - _v || 0, +val );
        }
        delete _el[__movementY];
    },

    __movementY: null,


    /**
     * 内容横向滚动量。
     * 目标：暂存区1项可选。
     * 支持指定目标滚动元素，如果目标为空，则取事件当前元素。
     * 前值存储在事件当前元素上，因此目标元素的滚动量是特定于当前事件的。
     * 通常在事件解绑时移除该存储（传递null）。
     * @param  {null} nil 清除存储
     * @return {Number|void|null} 变化量（像素）
     */
    scrolledX( evo, nil ) {
        let _box = evo.current,
            _its = evo.data || _box;

        if ( nil !== null ) {
            let _v = _box[__scrolledX];
            return ( _box[__scrolledX] = _its.scrollLeft ) - _v || 0;
        }
        delete _box[__scrolledX];
    },

    __scrolledX: -1,


    /**
     * 内容垂直滚动量。
     * 目标：暂存区1项可选。
     * 说明：（同上）
     * @param  {null} nil 清除存储
     * @return {Number|void|null} 变化量（像素）
     */
    scrolledY( evo, nil ) {
        let _box = evo.current,
            _its = evo.data || _box;

        if ( nil !== null ) {
            let _v = _box[__scrolledY];
            return ( _box[__scrolledY] = _its.scrollTop ) - _v || 0;
        }
        delete _box[__scrolledY];
    },

    __scrolledY: -1,

};



//
// tQuery|Collector通用
// 集合版会预先封装目标为一个Collector，以便获得其接口的优点。
//////////////////////////////////////////////////////////////////////////////


//
// 参数固定：1
// 目标：暂存区/栈顶1项。
// 注：固定参数为1以限定为取值。
//===============================================
[
                    // 单元素版参数说明
    'attr',         // ( name:String ): String | null
    'attribute',    // ( name:String ): String | Object
    'xattr',        // ( name:String|[String]): String | Object | [String|null] | [Object] | null
    'css',          // ( name:String ): String
    'cssGets',      // ( name:String ): Object
    'hasClass',     // ( name:String ): Boolean
    'parentsUntil', // ( slr:String|Function ): [Element]
    'closest',      // ( slr:String|Function ): Element | null
    'is',           // ( slr:String|Element ): Boolean

    // To部分存在同名接口
    // 此处主要用于构造新元素而非封装DOM中节点。
    'wrap',         // ( box:String ): Element | Collector
    'wrapInner',    // ( box:String ): Element | Collector
]
.forEach(function( meth ) {

    // @data:  {Node|Array|Collector}
    // @return {Value|Collector}
    _Gets[meth] = function( evo, arg ) {
        return $mapCall( evo.data, meth, arg );
    };

    _Gets[`__${meth}`] = 1;

});


//
// 参数固定：0
// 目标：暂存区/栈顶1项。
// 注：无参数以限定为取值。
//===============================================
[
                    // 单元素版参数说明
    'height',       // (): Number
    'width',        // (): Number
    'innerHeight',  // (): Number
    'innerWidth',   // (): Number
    'scroll',       // (): {top, left}
    'scrollTop',    // (): Number
    'scrollLeft',   // (): Number
    'offset',       // (): {top, left}
    'val',          // (): Value | [Value] // 注意控件需要有name特性
    'html',         // (): String   // 目标可为字符串（源码转换）
    'text',         // (): String   // 同上
    'classAll',     // (): [String]
    'position',     // (): {top, left}
    'offsetParent', // (): Element
]
.forEach(function( meth ) {

    // @data:  {Element|Array|Collector}
    // @return {Value|Collector}
    _Gets[meth] = function( evo ) {
        return $mapCall( evo.data, meth );
    };

    _Gets[`__${meth}`] = 1;

});


//
// 参数不定（0-n）。
// 目标：暂存区/栈顶1项。
// 注：多余实参无副作用。
//===============================================
[
                    // 单元素版参数说明
    'outerWidth',   // ( margin? ): Number
    'outerHeight',  // ( margin? ): Number
    'next',         // ( slr?, until? ): Element | null
    'nextAll',      // ( slr? ): [Element]
    'nextUntil',    // ( slr? ): [Element]
    'nextNode',     // ( comment? ): Node | null
    'nextNodes',    // ( comment? ): [Node]
    'prev',         // ( slr?, until? ): Element | null
    'prevAll',      // ( slr? ): [Element]
    'prevUntil',    // ( slr? ): [Element]
    'prevNode',     // ( comment? ): Node | null
    'prevNodes',    // ( comment? ): [Node]
    'children',     // ( slr? ): [Element] | Element
    'contents',     // ( idx? ): [Node] | Node
    'siblings',     // ( slr? ): [Element]
    'siblingNodes', // ( comment? ): [Node]
    'parent',       // ( slr? ): Element | null
    'parents',      // ( slr? ): [Element]
    'textNodes',    // ( real? ): [Text]

    'Text',         // ( hasbr?:Boolean, doc?:Document ): Text|[Node]
    'fragment',     // ( clean?:Function|'svg', doc?:Document ): DocumentFragment
]
.forEach(function( meth ) {

    // @data:  {Element|Collector|String}
    _Gets[meth] = function( evo, ...args ) {
        return $mapCall( evo.data, meth, ...args );
    };

    _Gets[`__${meth}`] = 1;

});


//
// 元素创建。
// 目标：暂存区/栈顶1项。
// 目标作为元素的内容或特性配置。
//===============================================
[
    'Element',  // data: String|Object|Map
    'svg',      // data: String|Object|Map
]
.forEach(function( meth ) {

    // @return {Element|Collector}
    _Gets[meth] = function( evo, tag ) {
        return $.isArray( evo.data ) ?
            $(evo.data)[meth]( tag ) : $[meth]( tag, evo.data );
    };

    _Gets[`__${meth}`] = 1;

});



//
// tQuery专有
//////////////////////////////////////////////////////////////////////////////

//
// 简单工具。
// 目标：无。
// 注：多余实参无副作用。
//===============================================
[
    'slr',  // ( tag?, attr?, val?, op? ): String
    'now',  // ( json? ): Number|String
]
.forEach(function( meth ) {

    // @return {Value}
    _Gets[meth] = function( evo, ...args ) {
        return $[meth]( ...args );
    };

    _Gets[`__${meth}`] = null;

});


//
// 杂项工具。
// 目标：暂存区/栈顶1项。
//===============================================
[
    'table',        // ( cols, rows?, th0?, doc? ): $.Table
    'dataName',     // ( attr ): String
    'tags',         // ( code ): String
    'range',        // ( beg, size?, step? ): [Number]|[String]

    'isXML',        // ( el:Element ): Boolean
    'controls',     // ( frm:Element, names ): [Element]
    'serialize',    // ( frm:Element, names ): [Array2]
    'values',       // ( frm:Element, names, strict ): Object|[Value]
    'queryURL',     // ( target ): String
    'isArray',      // ( val ): Boolean
    'isNumeric',    // ( val ): Boolean
    'isFunction',   // ( val ): Boolean
    'isCollector',  // ( val ): Boolean
    'type',         // ( val ): String
    'kvsMap',       // ( map, kname?, vname? ): [Object2]
    'pathx',        // ( el:Element, end?, slp?, slr? ): [Number]
    'siblingNth',   // ( el:Element, slr? ): Number

    // 与concat效果类似，但会改变目标本身。
    'mergeArray',   // ( des, ...src ): Array
]
.forEach(function( meth ) {
    /**
     * 目标作为方法的首个实参。
     * 多余实参无副作用。
     */
    _Gets[meth] = function( evo, ...rest ) {
        return $[meth]( evo.data, ...rest );
    };

    _Gets[`__${meth}`] = 1;

});



//
// Collector专有。
// 目标：暂存区/栈顶1项。
// 目标通常为一个Collector，普通集合会被自动转换。
//////////////////////////////////////////////////////////////////////////////
[
    'first',    // ( slr? ): Value
    'last',     // ( slr? ): Value
]
.forEach(function( meth ) {
    /**
     * 集合成员取值。
     * 如果传递了过滤选择器但未匹配，返回null。
     * 注意：
     * 对空集合取值也会返回一个null。
     * @param  {Number|String} slr 过滤选择器
     * @return {Value|[Value]|null}
     */
    _Gets[meth] = function( evo, slr ) {
        return $(evo.data)[meth]( slr );
    };

    _Gets[`__${meth}`] = 1;

});


//
// 数组处理（兼容Collector）。
// 目标：暂存区/栈顶1项。
// 目标需要是一个数组，返回一个具体的值。
//////////////////////////////////////////////////////////////////////////////
[
    'shift',        // (): Value
    'join',         // (chr?: String): String
    'includes',     // (val: Value, beg?: Number): Boolean
    'indexOf',      // (val: Value, beg?: Number): Number
    'lastIndexOf',  // (val: Value, beg?: Number): Number
]
.forEach(function( meth ) {
    /**
     * 集合成员取值。
     * 注：v1 默认空串为 join 优化。
     * @param  {Value} v1 首个实参，可选
     * @param  {Value} v2 第二个实参，可选
     * @return {Value} 具体值
     */
    _Gets[meth] = function( evo, v1 = '', v2 ) {
        return evo.data[meth]( v1, v2 );
    };

    _Gets[`__${meth}`] = 1;

});



//
// PB专项取值。
// 目标：暂存区/栈顶1项。
// 即目标元素上 data-pbo|pba 特性的格式值。
// 注：简单调用 Util.pba/pbo 即可。
//////////////////////////////////////////////////////////////////////////////
[
    'pbo',  // 选项词序列
    'pba',  // 有序的参数词序列
]
.forEach(function( name ) {

    // @return {[String]|[[String]]}
    _Gets[name] = function( evo ) {
        return mapCall( evo.data, el => Util[name](el) );
    };

    _Gets[`__${name}`] = 1;

});


//
// 状态判断。
//-------------------------------------
[
    'hidden',
    'lost',
    'disabled',
    'folded',
    'truncated',
    'fulled',
]
.forEach(function( name ) {

    // @return {Boolean|[Boolean]}
    _Gets[name] = function( evo ) {
        return mapCall( evo.data, el => Util.pbo(el).includes(name) );
    };

    _Gets[`__${name}`] = 1;

});



//
// 元素自身行为。
// 注记：
// 下面的接口为To部分同名接口在On段的方便性支持。
//////////////////////////////////////////////////////////////////////////////


//
// 元素表现。
// 目标：暂存区/栈顶1项。
// 目标为元素或元素集。
// 状态标识 s：
//      1|true  状态执行，默认
//      0|false 状态取消
//      2       状态切换
// 注记：
// To:Update版本支持状态数组与元素集成员一一对应。
//===============================================
[
    ['hide',     'hidden'],
    ['lose',     'lost'],
    ['disable',  'disabled'],
    ['fold',     'folded'],
    ['truncate', 'truncated'],
    ['full',     'fulled'],
]
.forEach(function( names ) {

    // @return {void}
    _Gets[names[0]] = function( evo, s = 1 ) {
        mapCall( evo.data, el => pboState(el, s, names[1]) )
    };

    _Gets[`__${names[0]}`] = 1;

});


//
// 自我修改。
// 目标：暂存区/栈顶1项。
// 如果传递实参clean有值（非undefined），则结果入栈。
// 注记：
// clean参数既是方法所需，也用于表达当前是否需要。
// 明确要求结果集是否清理，表示结果集很重要。
//===============================================
[
    'empty',
    'unwrap',
]
.forEach(function( meth ) {

    // 注意：集合版返回的是二维数组。
    // @param  {Boolean} clean 结果集清理指示
    // @return {[Node]|Collector|void}
    _Gets[meth] = function( evo, clean ) {
        let _vs = $mapCall( evo.data, meth, clean );
        if ( clean !== undefined ) return _vs;
    };

    _Gets[`__${meth}`] = 1;

});


//
// 原生事件调用。
// 目标：暂存区/栈顶1项（激发元素）。
// 注：To:Next部分存在同名方法（目标不同）。
// 理解：重在“调用”。
//===============================================
[
    'click',
    'blur',
    'focus',
    'load',
    'play',
    'pause',
    'reset',
    // 'select',  // 定制
    'submit',
    'finish',
    'cancel',
]
.forEach(function( meth ) {

    // @return {void}
    _Gets[meth] = function( evo ) {
        if ( $.isArray(evo.data) ) {
            return evo.data.forEach( el => $[meth](el) );
        }
        $[meth]( evo.data );
    };

    _Gets[`__${meth}`] = 1;

});



//
// 工具函数。
///////////////////////////////////////////////////////////////////////////////


/**
 * 单值/集合调用封装。
 * @param  {Value|[Value]} data 数据/集
 * @param  {Function} handle 回调函数
 * @return {Value|[Value]}
 */
function mapCall( data, handle ) {
    if ( $.isArray(data) ) {
        return data.map( v => handle(v) );
    }
    return handle( data );
}


/**
 * 单值/集合调用封装（tQuery版）。
 * 数据为集合时，返回的集合会封装为Collector。
 * 如果数据为假，简单返回该假值。
 * @param  {Element|[Element]|Collector} data 数据（集）
 * @param  {String} meth 方法名
 * @param  {...Value} args 实参序列
 * @return {Value|Collector}
 */
function $mapCall( data, meth, ...args ) {
    if ( $.isArray(data) ) {
        return $(data)[meth]( ...args );
    }
    return $[meth]( data, ...args );
}


/**
 * 对象成员取值。
 * name可能由空格分隔为多个名称。
 * 单个名称内可用句点（.）连接表达递进取值。
 * 单名称时返回值，多个名称时返回值集。
 * @param  {String} name 名称/序列
 * @param  {Object} obj 取值对象
 * @return {Value|[Value]} 值（集）
 */
function namesValue( name, obj ) {
    if ( __reSpace.test(name) ) {
        return name.split( __reSpace ).map( n => nullVal(obj[n]) );
    }
    return nullVal( obj[name] );
}


/**
 * 是否为有值对象（非空）。
 * 注：空数组或空对象。
 * @param  {Object|Array} obj 测试对象
 * @return {null|Number|obj}
 */
function hasValue( obj ) {
    return typeof obj == 'object' ? obj && Object.keys(obj).length : obj;
}


/**
 * 获取关联数据。
 * @param  {Map} map 存储集
 * @param  {String} name 名称序列（空格分隔）
 * @return {Value|[Value]} 值或值集
 */
function getData( map, name ) {
    if ( !__reSpace.test(name) ) {
        return map.get( name );
    }
    return name.split(__reSpace).map( n => map.get(n) );
}


/**
 * 解绑调用链绑定（单个事件名标识）。
 * 目标元素上绑定的只能是其自身预存储的调用链。
 * @param  {[Element]} els 目标/存储元素（集）
 * @param  {String} evnid 事件名:ID标识
 * @return {void}
 */
function unbindChain( els, evnid ) {
    for ( const el of els ) {
        let _map = ChainStore.get( el ),
            _cell = _map && _map.get( evnid );

        if ( !_cell ) {
            window.console.warn( `Pre-store chain is unfound with [${evnid}]` );
            continue;
        }
        let _evno = _cell[ HEADCELL ];

        $.off( el, evnid.split(evnidDlmt, 1)[0], _evno.selector, _cell, _evno.capture );
    }
}


/**
 * 创建一个新的初始事件关联对象。
 * 注：用于.handleEvent()调用中的elo实参。
 * @param  {Object} evo 事件关联对象
 * @return {Object}
 */
function newElobj( evo ) {
    return {
        target:     evo.target,
        current:    evo.current,
        selector:   evo.selector,
        delegate:   evo.delegate,
    };
}


/**
 * 名值汇集构造对象。
 * 如果值为一个数组，则名值一一对应，否则单一值对应到多个名称。
 * @param  {[String]} names 名称序列
 * @param  {Value|[Value]} val 值/值集
 * @return {Object}
 */
function gather( names, val ) {
    if ( $.isArray(val) ) {
        return names.reduce( (o, k, i) => (o[k] = val[i], o), {} );
    }
    return names.reduce( (o, k) => (o[k] = val, o), {} );
}


/**
 * 获取修饰键真值集。
 * 状态为真的键才记录，名称为全小写。
 * @param  {Event} ev 事件对象
 * @return {[String]}
 */
function scamKeys( ev ) {
    return __modKeys.filter( n => ev[n] ).map( n => n.slice(0, -3) );
}


/**
 * 填充数组到目标大小。
 * 注：用最后一个有效值填充。
 * @param {Array} arr 原数组
 * @param {Number} size 数组大小
 */
function arrayFill( arr, size ) {
    let i = arr.length,
        v = arr[ i-1 ];

    arr.length = size;
    return i < size ? arr.fill(v, i) : arr;
}


/**
 * 提取元素简单信息。
 * 格式：tag#id.className
 * @param  {Element} el 目标元素
 * @param  {Boolean} hasid 包含ID信息
 * @param  {Boolean} hascls 包含类名信息
 * @return {String}
 */
function elemInfo( el, hasid, hascls ) {
    let _s = el.tagName.toLowerCase();

    if ( hasid && el.id ) {
        _s += `#${el.id}`;
    }
    if ( hascls && el.classList.length ) {
        _s += '.' + [...el.classList].join('.');
    }
    return _s;
}


/**
 * 属性判断取值。
 * 包含对不确定态检查，
 * 如果indeterminate属性为真，返回null而非属性值。
 * 注记：
 * 无法区分属性值本来就为null的情况，主要用于表单控件。
 * 注：表单控件值为null时通常就应当是不确定态。
 * @param  {Element} el 目标元素
 * @param  {String} name 属性名
 * @return {Value|null|undefined}
 */
function indetProp( el, name ) {
    return el.indeterminate ? null : $.prop( el, name );
}


/**
 * null值保证。
 * 将undefined值转换为null值，保证可以正常入栈。
 * @param {Value} v 目标值
 */
function nullVal( v ) {
    return v === undefined ? null : v;
}


/**
 * 严格匹配。
 * 名称序列是否与定义集内完全符合。
 * 对比忽略大小写。
 * @param  {[String]} names 名称序列
 * @param  {Set} set 名称定义集
 * @return {Boolean}
 */
function strictMatch( names, set ) {
    return names.length === set.size && names.every( n => set.has(n.toLowerCase()) );
}


/**
 * 鼠标移动固定替换值。
 * 问题：
 * - chrome 中鼠标移动距离计算偏小，很像鼠标移动后的位置取值滞后。
 * - firefox 中同样的计算和UI表现正常。
 * devicePixelRatio: 1.5
 * @param  {Number} inc 指针移动量
 * @param  {Number|void} val 替换值
 * @return {Number}
 */
function movementValue( inc, val ) {
    // window.console.info( inc );
    if ( inc === 0 || isNaN(val) ) {
        return inc;
    }
    return inc < 0 ? -val : val;
}


/**
 * 范围首尾是否在相同层级（正确嵌套）
 * @param  {Range} rng 选区范围
 * @return {Boolean}
 */
function sameLevel( rng ) {
    return rng.startContainer === rng.endContainer ||
        rng.startContainer.parentNode === rng.endContainer.parentNode;
}


//
// PBO状态标识符。
//
const __uiState = [ '-', '', '^' ];


/**
 * PBO状态单个设置。
 * @param  {Element} el 目标元素
 * @param  {Boolean} s 状态标识
 * @param  {String} name 状态特性名
 * @return {void}
 */
function pboState( el, s, name ) {
    Util.pbo( el, [`${__uiState[ +s ]}${name}`] );
}



//
// 预处理，导出。
// 注记：
// 指令集预先绑定所属名称空间以固化this，便于全局共享。
///////////////////////////////////////////////////////////////////////////////


//
// 取值指令集。
// @proto: Process < Control
//
const Get = $.proto(
    $.assign( {}, _Gets, bindMethod ), Process
);

//
// On指令集。
// 结构：{ 取值 < 处理 < 控制 }。
//
const On = Get;


export { On, Get };
