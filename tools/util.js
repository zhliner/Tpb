//! $ID: util.js 2019.08.18 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2017 - 2019 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  基本工具集。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { Spliter, UmpString } from "./spliter.js";


const
    $ = window.$,

    // 二阶选择器切分字符
    __chrSp2    = '/',

    // PB属性名。
    __attrPBO   = 'data-pbo',   // 选项词
    __attrPBA   = 'data-pba',   // 参数序列

    __chrOpt1   = '-',  // 选项词：减
    __chrOpt2   = '^',  // 选项词：切换

    // 调用表达式
    // 首尾空白需要预先清除。
    // 支持参数内的任意字符和换行。
    __reCall = /^(\w+)(?:\(([^]*)\))?$/,

    // 二阶选择器切分器。
    __slrSplit = new Spliter(__chrSp2, new UmpString());



const Util = {
    /**
     * 二阶检索（最近路径）。
     * 原理：
     * 向上查找与目标元素最近的共同祖先容器，然后向下检索目标元素。
     * 这可以压缩搜索范围以提高效率，同时还可以避免标识名的唯一性约束。
     *
     * 格式：UpSlr/DownSlr
     * UpSlr:
     *      {Number}    表示递升的层级。
     *      {String}    向上检索匹配的CSS选择器（不含起点元素）。
     * DownSlr:
     *      {String}    普通的CSS选择器，支持相对ID。
     *
     * 关于ID：
     *      通常来说，元素的ID标识应当在文档中唯一，但 #xxx 形式的ID选择器实际上可以被限定检索。
     *      即：如果指定了上下文元素，该ID检索是不会超出元素范围的。
     *      因此，只要明确上下文环境，ID标识实际上可以不用理会其是否在整个DOM中重复。
     *
     *      当然，ID的全局唯一性依然重要，比如链接的锚点定位。但明显地，此时你可以让它唯一。
     *      注：CSS选择器和.querySelector[All]都能处理重复ID。
     *
     * 例：
     * /            单独的 / 表示起点元素本身。
     * 0/           0上级，即当前起点（同上）。
     * 2/           祖父元素（2级，父元素的父元素）
     * form/        起点元素上层首个<form>元素。
     *
     * />b          起点元素的<b>子元素。
     * /p >b        起点元素内匹配 p>b 选择器的元素。
     * .abc         整个文档内（全局)类名为 abc 的元素。
     * /.abc        起点元素内类名为 abc 的元素。
     * #xyz         全局（document）ID检索（无唯一性限制）。
     * /#xyz        起点元素内ID为 xyz 的元素。
     * /p#xyz >b    起点元素内ID为 xyz 的<p>元素的<b>直接子元素。
     *
     * div/#xyz     起点元素之上首个<div>内ID为 xyz 的元素。
     * 3/.abc       起点元素之上第3层父节点内类名为 abc 的元素。
     * -1/#xyz li   负值简单忽略，起点元素内ID为 xyz 的元素内的<li>元素。
     *
     * 注记：
     * 单元素检索指用$.get()获取单个元素，多元素检索依然可能只有一个元素，但返回Collector。
     * 如果要包含二阶逻辑（从起点开始），必须包含 / 分隔符，否则为全局检索。
     *
     * 全局上下文ctx实参仅用于“非二阶”选择器时的范围限定。
     * 通常是一个文档片段，但也可以是元素（比如根限定）。
     *
     * @param  {String}  slr 选择器串（外部trim）
     * @param  {Element} beg 起点元素，可选
     * @param  {Boolean} one 是否单元素检索，可选
     * @param  {Element} ctx 全局上下文，可选
     * @return {Collector|Element|null} 目标元素（集）
     */
    find( slr, beg, one, ctx ) {
        if ( !slr || slr == __chrSp2 ) {
            return one ? beg : $( beg );
        }
        if ( slr.includes(__chrSp2) ) {
            [slr, beg] = fmtSplit( slr, beg, ctx );
        } else {
            beg = ctx || undefined;
        }
        // slr 可能再为空
        return one ? query1( slr, beg ) : query2( slr, beg );
    },


    /**
     * 获取/设置PB参数序列。
     * wds未定义时为获取，否则为设置。
     * 传递wds为null会移除参数序列。
     * 取值时都会返回一个数组（可能为空）。
     * 技术：
     * 单词之间以短横线（-）分隔，含末尾的-分隔符。
     * 即用 |= 属性选择器匹配的部分。
     * 注记：
     * 特性设置采用tQuery库接口，以支持varyevent事件通知机制。
     *
     * @param  {Element} el 目标元素
     * @param  {[String]|null} wds 参数词序列（有序）
     * @return {[String]|void}
     */
    pba( el, wds ) {
        let _v = el.getAttribute( __attrPBA );

        if ( wds === undefined ) {
            // 末尾-会切分出一个空串。
            return _v ? _v.split('-').slice(0, -1) : [];
        }
        if ( wds === null ) {
            return _v && $.removeAttr( el, __attrPBA );
        }
        // 末尾需要一个-，以匹配 |= 选择器。
        $.attr( el, __attrPBA, wds.join('-') + '-' );
    },


    /**
     * 获取/设置PB选项序列。
     * wds未定义时为获取，否则为设置。取值时返回一个词数组。
     * 选项词配置为加减逻辑：
     *      -xxx    移除xxx选项
     *      ^xxx    切换xxx选项
     *      xxx     添加xxx选项，无前置特殊字符
     * 传递wds为null会移除全部选项词。
     * 技术：
     * 选项词之间以空格分隔，可用 ~= 属性选择器匹配。
     *
     * @param  {Element} el 目标元素
     * @param  {[String]|null} wds 选项词序列
     * @return {[String]|void}
     */
    pbo( el, wds ) {
        let _v = el.getAttribute( __attrPBO ),
            _o = _v ? _v.split(/\s+/) : [];

        if ( wds === undefined ) {
            return _o;
        }
        if ( wds === null ) {
            return _v && $.removeAttr( el, __attrPBO );
        }
        $.attr( el, __attrPBO, pboSet(wds, _o).join(' ') );
    },


    /**
     * 解析多层子对象引用。
     * 支持字符串中句点（.）的逐层引用格式。
     * 注：外部应保证字符串无多余空格。
     * @param  {Array} list 引用名序列
     * @param  {Object} data 数据源对象
     * @return {Value} 末端成员值
     */
    subObj( list, data ) {
        if ( !data || !list.length ) {
            return data;
        }
        return list.reduce( (d, k) => d[k], data );
    },


    /**
     * 提取调用句法的函数名和参数列表。
     * - 支持无参数时省略调用括号。
     * - 无法匹配时抛出异常。
     * Object {
     *      name: {String} 调用名
     *      args: {String} 实参序列
     * }
     * @param  {String} fmt 调用格式串
     * @return {Object} 解析结果
     */
    funcArgs( fmt ) {
        var _v2 = fmt.match( __reCall );

        if ( !_v2 ) {
            throw new Error( `${fmt} is not a call().` );
        }
        return { 'name': _v2[1], 'args': _v2[2] };
    },


    /**
     * 激发目标事件。
     * rest：[extra, bubble, cancelable]，参见 $.trigger。
     * @param {Collector} $els 目标元素集
     * @param {String} name 事件名
     * @param {Number} delay 延迟毫秒数
     * @param {...Value|Boolean} rest 剩余参数
     */
    fireEvent( $els, name, delay, ...rest ) {
        if ( !delay ) {
            return $els.trigger( name, ...rest );
        }
        return setTimeout( () => $els.trigger(name, ...rest), delay );
    },


    /**
    * 构造Web安全色序列。
    * 每36色一个区，共分6区（视觉矩形）。
    * @return {[String]}
    */
    color216() {
        let _chs = ['0', '3', '6', '9', 'c', 'f'],
            _buf = [];

        for (let _R = 0; _R < 6; ++_R) {
            for (let _G = 0; _G < 6; ++_G) {
                for (let _B = 0; _B < 6; ++_B) {
                    _buf.push('#' + _chs[_R] + _chs[_G] + _chs[_B]);
                }
            }
        }
        return _buf;
    },

};



//
// 辅助工具
///////////////////////////////////////////////////////////////////////////////


/**
 * 二阶选择器解构。
 * 用SSpliter实现准确切分（/可能包含在属性值内）。
 * 如果实际上不是二阶选择器，起点即为全局上下文。
 * @param  {String} slr 选择器串
 * @param  {Element} beg 起点元素
 * @param  {Element} ctx 全局上下文，可选
 * @return {[String, Element]} 向下选择器和上下文元素
 */
function fmtSplit( fmt, beg, ctx ) {
    let _s2 = [
        ...__slrSplit.split(fmt, 1)
    ];
    if ( _s2.length == 1 ) {
        return [ fmt, ctx ];
    }
    return [ _s2[1], closest(_s2[0].trim(), beg) ];
}



/**
 * 向上检索目标元素。
 * @param {String|Number} slr 向上选择器或递进层级数
 * @param {Element} beg 起点元素
 * @return {Element|null} 目标元素
 */
function closest( slr, beg ) {
    if ( slr <= 0 ) {
        return beg;
    }
    return isNaN(slr) ? $.closest(beg.parentNode, slr) : $.closest(beg, (_, i) => i == slr);
}


/**
 * 向下单元素检索。
 * 注：若无选择器，返回上下文元素本身。
 * @param  {String} slr 选择器
 * @param  {Element} beg 上下文元素
 * @return {Element|null}
 */
function query1( slr, beg ) {
    return slr ? $.get( slr, beg ) : beg;
}


/**
 * 向下多元素检索。
 * 注：若无选择器，返回上下文元素本身（封装）。
 * @param  {String} slr 选择器
 * @param  {Element|null} beg 上下文元素
 * @return {Collector}
 */
function query2( slr, beg ) {
    return slr ? $( slr, beg ) : $( beg );
}



/**
 * 处理PB选项序列。
 * - 前置 - 表示移除。
 * - 前置 ^ 表示切换。
 * 注：无前置加号（+）功能。
 * @param  {[String]} wds 目标词序列
 * @param  {[String]} opts 原选项词集
 * @return {[String]}
 */
function pboSet( wds, opts ) {
    let _set = new Set( opts );

    for ( const w of wds ) {
        switch (w[0]) {
            case __chrOpt1:
                _set.delete( w.substring(1) ); break;
            case __chrOpt2:
                optToggle( _set, w.substring(1) ); break;
            default:
                _set.add( w );
        }
    }
    return [ ..._set ];
}


/**
 * 选项词切换。
 * @param {Set} set 词集
 * @param {String} name 词名
 */
function optToggle( set, name ) {
    return set.has(name) ? set.delete(name) : set.add(name);
}


// 导出。
export { Util };
