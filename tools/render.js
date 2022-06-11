//! $ID: render.js 2022.06.03 Tpb.Tools $
// +++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2022 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  渲染器（Render）
//
//  解析模板中的渲染语法，用数据对节点树进行渲染。
//  解析之后节点中的各个渲染属性会被清除，但会设置一个标志属性名（_）便于检索。
//
//  渲染语法（9+1）{
//      each                当前迭代
//      with                当前域声明
//      var                 新变量定义
//      if/else             逻辑判断（含 elseif）
//      switch/case/last    分支选择
//      for                 子元素循环
//      _[attr]             属性赋值（系列）
//  }
//  注：原地更新支持任意渲染语法，Each列表甚至可以从中间开始。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { Filter } from "./filter.js";
import { Spliter, UmpString, UmpCaller } from "./spliter.js";
import { Util } from "./util.js";


const
    $ = window.$,

    // 渲染标识特性。
    // 标记存在渲染定义的元素，用于高效检索（如配置克隆）。
    // 这一特性名会保留在DOM元素上。
    HasRender = '_',

    // 元素文法存储。
    // 包含原始模板中和页面中采用渲染处理的元素。
    // Map {
    //      [word]: [...]    // [文法词]: [参数序列]
    // }
    // 参数序列：
    // - handle: Function 表达式执行器。
    // - ...: Value 文法特定的额外参数序列。
    // 注：
    // - 参数序列应该可以直接解构传入文法操作函数。
    // - 存储器采用Map结构，隐含了文法的处理顺序。
    //
    // { Element: Map }
    Grammars = new WeakMap();


//
// 基本配置/定义。
//
const
    // 渲染属性名。
    __Each      = 'tpb-each',       // 元素自身循环
    __With      = 'tpb-with',       // 创建新域
    __Var       = 'tpb-var',        // 新建变量/赋值
    __If        = 'tpb-if',         // if （当前元素，下同）
    __Else      = 'tpb-else',       // else
    __Switch    = 'tpb-switch',     // switch （子元素分支）
    __Case      = 'tpb-case',       // switch/case
    __Last      = 'tpb-last',       // switch/last（含 default）
    __For       = 'tpb-for';        // 子元素循环


const
    // 赋值属性前缀标识。
    __chrAttr   = '_',

    // 进阶处理（输出过滤）
    __chrPipe   = '|',

    // 渲染元素选择器。
    __slrRender = `[${HasRender}]`,

    // 循环内临时变量名
    __loopIndex = 'INDEX',  // 当前条目下标（从0开始）
    __loopSize  = 'SIZE',   // 循环集大小

    // 当前域数据存储键。
    // 用于循环中或With在元素上存储当前域数据。
    // 注：调用者取当前域先从元素上检索。
    __scopeData = Symbol('scope-data'),

    // Each克隆元素序位记忆。
    // 可用于从克隆元素开始更新。
    __eachIndex = Symbol('each-index'),

    // 比较状态存储。
    // 来源：If/Else, Case/Last。
    __compState = Symbol('compare-result'),

    // switch标的值存储键。
    __switchValue = Symbol('switch-value'),

    // case状态存储。
    // 存储在父元素（switch）上。
    __casePass  = Symbol('case-pase'),

    // switch简单隐藏前原值存储。
    // 适用当last文法判断为假时的增强行为。
    __switchDisplay = Symbol('switch-display'),

    // For子元素引用保留。
    // 避免空数组渲染清空子元素后渲染缺乏目标。
    __forSubs = Symbol('for-children'),

    // 过滤切分器。
    // - 识别字符串语法（字符串内的|为普通字符）。
    // - 排除小括号封装：逻辑或（||）需包含在一对小括号内。
    __pipeSplit = new Spliter( __chrPipe, new UmpCaller(), new UmpString() );



//
// 渲染配置解析。
// 构造 Map{文法: 参数序列} 的存储（Grammars）。
//
// 解析相对独立，无DOM树依赖。
// - Each语法向上检查父元素（For标记）。
// - For语法向下依赖直接子元素（统计配置）。
//
// 注：
// 在tpl-node/source上设置渲染语法没有意义，
// 因此渲染解析是模板独立的（不牵涉子模版）。
//
const Parser = {
    //
    // 文法解析方法映射：[
    //      [ 属性名, 解析方法名 ]
    // ]
    // 同一组文法不应在单一元素上同时存在（如if/else同时定义）。
    // 下面的列表隐含了语法处理的优先级。
    //
    Method: [
        [__Each,    '$each'],
        [__With,    '$with'],
        [__Var,     '$var'],
        [__Else,    '$else'],
        [__If,      '$if'],
        [__Case,    '$case'],
        [__Last,    '$last'],
        [__Switch,  '$switch'],
        [__For,     '$for'],
        // Assign at last.
    ],


    /**
     * 解析文法配置。
     * @param  {Element} el 目标元素
     * @return {Map} 文法配置集
     */
    grammar( el ) {
        let _map = new Map();

        for ( const [an, fn] of this.Method ) {
            if ( el.hasAttribute(an) ) {
                // $for/$each 需要第三个实参
                this[fn]( _map, el.getAttribute(an), el );
                el.removeAttribute(an);
            }
        }
        // last!
        return this.assign( _map, el );
    },


    /**
     * Each文法解析。
     * Each: [handle, prev-size]
     * 需检查标记父元素可能有的For文法配置。
     * 注：此语法向上依赖。
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @param  {Element} el 当前元素
     * @return {Map} map
     */
    $each( map, val, el ) {
        // 父元素For检查。
        eachFor( el.parentElement );

        return map.set(
            'Each',
            [ Expr.loop(val), 1 ]
        );
    },


    /**
     * For文法解析。
     * For: [handle, size, each]
     * each为子元素Each文法标记，可避免冗余清理，
     * 这在子元素的$each解析中更新（子元素后处理）。
     * 注：此语法向下依赖（直接子元素）。
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @param  {Element} el 当前元素
     * @return {Map} map
     */
    $for( map, val, el ) {
        // 引用存储，
        // 预防子元素被清空失去渲染目标。
        forSubs( el, true );

        return map.set(
            'For',
            [ Expr.loop(val), el.childElementCount, false ]
        );
    },


    /**
     * With文法解析。
     * With: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $with( map, val ) {
        return map.set(
            'With',
            [ Expr.value(val) ]
        );
    },


    /**
     * Var文法解析。
     * Var: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $var( map, val ) {
        return map.set(
            'Var',
            [ Expr.value(val) ]
        );
    },


    /**
     * If文法解析。
     * If: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $if( map, val ) {
        return map.set(
            'If',
            [ Expr.value(val) ]
        );
    },


    /**
     * Else文法解析。
     * 含 elseif 逻辑。
     * Else: [handle|pass]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $else( map, val ) {
        return map.set(
            'Else',
            [ val ? Expr.value(val) : Expr.pass() ]
        );
    },


    /**
     * Switch文法解析。
     * Switch: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $switch( map, val ) {
        return map.set(
            'Switch',
            [ Expr.value(val) ]
        );
    },


    /**
     * Case文法解析。
     * Case: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $case( map, val ) {
        return map.set(
            'Case',
             [ Expr.value(val) ]
        );
    },


    /**
     * case/default 文法解析。
     * Last: [handle|null]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $last( map, val ) {
        return map.set(
            'Last',
            [ val ? Expr.value(val) : null ]
        );
    },


    /**
     * 属性赋值文法解析。
     * 需要渲染的属性名前置一个下划线。
     * 注：这是最后一个解析的文法。
     * Assign: [[name], [handle]]
     * @param  {Map} map 存储集
     * @param  {Element} el 目标元素
     * @return {Map} map
     */
    assign( map, el ) {
        let _ats = [], _fns = [];

        for ( let at of Array.from(el.attributes) ) {
            let _n = at.name;
            if ( _n[0] == __chrAttr ) {
                _ats.push( _n.substring(1) );
                _fns.push( Expr.assign(at.value) );

                el.removeAttribute(_n);
            }
        }
        return _ats.length > 0 ? map.set('Assign', [_ats, _fns]) : map;
    },

};



//
// 渲染文法执行。
// 按文法固有的逻辑更新目标元素（集）。
// 元素上存储的当前域数据（[__scopeData]）拥有最高的优先级。
// @data {Object} 应用前的当前域数据
// @return {void}
//
const Grammar = {
    /**
     * 自迭代循环。
     * 用数据集更新原始集，可从任意成员位置开始（向后更新）。
     * - 如果原始集小于需要的集合大小，会自动扩展。
     * - 如果原始集大于需要的集合大小，会截断至新集合大小。
     * - 需要检查/处理父元素中的For语法影响（如果有）。
     * 文法：{ Each: [handle, size] }
     * 会存储当前域数据到每一个元素的 [__scopeData] 属性上。
     * @param {Element} el 起始元素
     * @param {Function} handle 表达式取值函数
     * @param {Number} size 原始集（前次）大小
     * @param {Object} data 当前域数据
     */
    Each( el, handle, size, data ) {
        let _idx = el[__eachIndex] || 0,
            _arr = handle( data );

        this._alignEach( eachList(el, size-_idx), _arr.length, _idx+1 )
        .forEach(
            // 设置当前域对象。
            (el, i) => el[__scopeData] = loopCell( _arr[i], i, data )
        );
        // 更新计数。
        Grammars.get(el).get('Each')[1] = _arr.length + _idx;
    },


    /**
     * 子元素循环。
     * 文法：{ For: [handle, size, each] }
     * 当前域数据存储在迭代克隆的每个子元素上。
     * 注：被隐藏的元素不再渲染。
     * @param {Element} el For容器元素
     * @param {Function} handle 表达式取值函数
     * @param {Number} size 单次循环子元素数量
     * @param {Boolean} each 子元素是否含Each文法
     * @param {Object} data 当前域数据
     */
    For( el, handle, size, each, data ) {
        if ( hidden(el) ) {
            return;
        }
        let _arr = handle( data );

        if ( el.childElementCount === 0 ) {
            $.append( el, forSubs(el) );
        }
        // 需移除子元素中多余的Each。
        this._alignFor( cleanEach(el, each), size, _arr.length )
        .forEach(
            (el, n) => {
                let _i = parseInt( n / size );
                // 当前域存储。
                el[__scopeData] = loopCell( _arr[_i], _i, data );
            }
        );
    },


    /**
     * 创建新的当前域。
     * 文法：{ With: [handle] }
     * 新的当前域数据存储在元素的 [__scopeData] 属性上。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     */
    With( el, handle, data ) {
        let _sub = handle( data );

        if ( !_sub ) _sub = Object(_sub);
        _sub.$ = data;

        // 友好：原型继承
        if ( $.type(_sub) == 'Object' && $.type(data) == 'Object' ) {
            $.proto( _sub, data );
        }
        el[ __scopeData ] = _sub;
    },


    /**
     * 新建变量。
     * 文法：{ Var: [handle] }
     * 表达式应该是在当前域对象上添加新的变量，简单执行即可。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     */
    Var( el, handle, data ) {
        handle( data );
    },


    /**
     * If 逻辑。
     * 文法：{ If: [handle] }
     * 注：仅针对元素自身显示或隐藏（<template>）。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     */
    If( el, handle, data ) {
        return handle(data) ? showElem(el) : hideElem(el);
    },


    /**
     * Else 逻辑。
     * 文法：{ Else: [handle] }
     * 向前检索If/Elseif元素，判断当前元素显示或隐藏。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式函数
     * @param {Object} data 当前域数据
     */
    Else( el, handle, data ) {
        return elseShow(el) ? this.If(el, handle, data) : hideElem(el);
    },


    /**
     * 分支选择。
     * 文法：{ Switch: [handle] }
     * 子元素分支条件判断，决定显示或隐藏。
     * 实现：在当前元素上存储标的值。
     * 注：被隐藏的元素不再渲染。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     */
    Switch( el, handle, data ) {
        if ( !hidden(el) ) {
            el[__switchValue] = handle( data );
            el.style.display = originStyle( el );
        }
    },


    /**
     * 分支测试执行。
     * 文法：{ Case: [handle] }
     * 与Switch标的值比较（===），真为显示假为隐藏。
     * - 真：向后检索其它Case/Last文法元素，标记隐藏。
     * - 假：隐藏当前元素，向后检索其它Case/Last隐藏标记设置为假。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     */
    Case( el, handle, data ) {
        let _box = el.parentElement;

        if ( caseShow(_box) && _box[__switchValue] === handle(data) ) {
            showElem( el );
            _box[__casePass] = true;
        } else {
            hideElem( el );
            _box[__casePass] = false;
        }
    },


    /**
     * 默认分支。
     * 文法：{ Last: [handle|null] }
     * 如果文法配置非null，最后Case逻辑，不匹配时隐藏父Switch。
     * 否则为Default逻辑，无条件匹配。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式函数
     * @param {Object} data 当前域数据
     */
    Last( el, handle, data ) {
        let _box = el.parentElement;

        if ( !handle ) {
            // Default: 不再设置[__casePass]。
            return caseShow(_box) ? showElem(el) : hideElem(el);
        }
        this.Case( el, handle, data );

        // 依然未匹配。
        // 注记：后期修改会影响下一次渲染，因此用设置style。
        if ( caseShow(_box) ) _box.style.display = 'none';
    },


    /**
     * 特性赋值。
     * 文法：{ Assign: [[name], [handle]] }
     * 支持两个特殊属性名：text, html。
     * 多个属性名之间空格分隔，与 handles 成员一一对应。
     * 注：被隐藏的元素不再渲染。
     * @param {[String]} names 属性名集
     * @param {[Function]} handles 处理器集
     * @param {Object} data 当前域数据
     */
    Assign( el, names, handles, data ) {
        if ( hidden(el) ) {
            return;
        }
        names.forEach(
            (name, i) =>
            $.attr( el, name || 'text', handles[i](data) )
        );
    },


    //-- 私有辅助 -----------------------------------------------------------------


    /**
     * Each元素集数量适配处理。
     * 如果目标大小超过原始集，新的元素插入到末尾。
     * @param  {[Element]} els 原始集
     * @param  {Number} count 循环迭代的目标次数
     * @param  {Number} beg 起始下标
     * @return {[Element]} 大小适合的元素集
     */
    _alignEach( els, count, beg ) {
        let _sz = count - els.length;

        if ( _sz < 0 ) {
            // 移除超出部分。
            els.splice(_sz).forEach( e => $.remove(e) );
        }
        else if ( _sz > 0 ) {
            // 补齐不足部分。
            let _ref = els[els.length-1];
            els.push(
                ...$.after( _ref, eachClone(_ref, _sz, beg) )
            );
        }
        return els;
    },


    /**
     * For子元素数量适配处理。
     * 需要包含子元素循环才有意义。
     * @param  {[Element]} els For子元素集（全部）
     * @param  {Number} size 单次循环子元素数量
     * @param  {Number} count 循环迭代的目标次数
     * @return {[Element]} 数量适合的子元素集
     */
    _alignFor( els, size, count ) {
        let _loop = parseInt(els.length / size),
            _dist = count - _loop;

        if ( _dist < 0 ) {
            // 移除超出部分。
            els.splice(_dist * size).forEach( e => $.remove(e) );
        }
        else if ( els.length > 0 && _dist > 0 ) {
            // 补齐不足部分。
            let _new = forClone( els.slice(-size), _dist );
            els.push(
                ...$.after( els[els.length-1], _new )
            );
        }
        return els;
    },

};



//
// 表达式处理构造。
// 返回一个目标渲染类型的表达式执行函数。
// 注：表达式无return关键词。
// @param  {String} expr 表达式串
// @return {Function|null}
//
const Expr = {
    /**
     * 取值表达式。
     * 适用：tpb-with|switch|var|if/else|case,
     * @return function(data): Value
     */
    value( expr ) {
        return new Function( '$', `return ${expr};` );
    },


    /**
     * 循环表达式。
     * 空值返回传入的数据本身。
     * 适用：tpb-each, tpb-for.
     * @return function(data): Array
     */
    loop( expr ) {
        if ( !expr ) {
            return v => v;
        }
        return new Function( '$', `return ${expr};` );
    },


    /**
     * 简单通过。
     * 适用：tpb-else 无值的情况。
     * @return function(): true
     */
    pass() {
        return () => true;
    },


    /**
     * 属性赋值。
     * 支持可能有的过滤器序列，如：...|a()|b()。
     * 适用：_[name].
     * 注：初始取值部分支持命名比较操作词。
     * @return function(data): Value
     */
    assign( expr ) {
        let _ss = [...__pipeSplit.split(expr)],
            _fn = new Function( '$', `return ${_ss.shift()};` );

        if ( _ss.length == 0 ) {
            return _fn;
        }
        // 包含过滤器。
        let _fxs = _ss.map( filterHandle );

        return data => _fxs.reduce( (d, fx) => fx[0](d, ...fx[1](data)), _fn(data) );
    },

};



//
// 工具函数
///////////////////////////////////////////////////////////////////////////////


/**
 * 提取赋值过滤器句柄。
 * [
 *      func:Function,
 *      args:[Value]|''
 * ]
 * @param  {String} call 调用表达式
 * @return {Object} 过滤器对象
 */
function filterHandle( call ) {
    let _fn2 = Util.funcArgs( call.trim() );

    return [
        Filter[ _fn2.name ],
        new Function( '$', `return [${_fn2.args}]` )
    ];
}


/**
 * 文法元素集检索。
 * 包含<template>内的子元素匹配。
 * 适用于元素被隐藏（template化）后的文法克隆。
 * 注：el必然存在文法。
 * @param  {Element|DocumentFragment}} el 上下文对象
 * @param  {String} slr 选择器
 * @return {[Element]}
 */
function gramElements( el, slr ) {
    let _els = [el];

    if ( el.nodeName === 'TEMPLATE' ) {
        el = el.content;
    }
    return _els.concat( $.find(slr, el) );
}


/**
 * 节点树文法克隆&存储。
 * to应当是src的克隆（相同DOM结构）。
 * @param  {Element} src 源元素
 * @param  {Element} to 目标元素
 * @return {Element} to
 */
function cloneGrammar( src, to ) {
    cloneGrammars(
        gramElements( src, __slrRender ),
        gramElements( to, __slrRender )
    );
    return to;
}


/**
 * 批量克隆文法配置存储。
 * 注：to和src是两个大小一致的集合。
 * @param  {[Element]} srcs 源节点集
 * @param  {[Element]} tos 新节点集
 * @return {void}
 */
function cloneGrammars( srcs, tos ) {
    srcs
    .forEach( (el, i) =>
        Grammars.set( tos[i], Grammars.get(el) )
    );
}


/**
 * 获取Each元素清单。
 * @param  {Element} el 起点元素
 * @param  {Number} size 元素数量
 * @return {[Element]}
 */
function eachList( el, size ) {
    let _buf = [];

    while ( --size >= 0 && el ) {
        _buf.push( el );
        el = el.nextElementSibling;
    }
    return _buf;
}


/**
 * 指定数量的元素克隆。
 * 会存储新元素的渲染文法配置。
 * 用于Each中不足部分的批量克隆。
 * @param  {Element} ref 参考元素（克隆源）
 * @param  {Number} size 克隆的数量
 * @param  {Number} beg 新下标起始值
 * @return {[Element]} 新元素集
 */
function eachClone( ref, size, beg ) {
    let _els = [];

    for (let i=0; i<size; i++) {
        let _new = $.clone(ref, true, true, true);

        _new[__eachIndex] = beg + i;
        _els.push( cloneGrammar(ref, _new) );
    }
    return _els;
}


/**
 * 元素集克隆。
 * 存在渲染配置的元素会进行文法克隆存储。
 * 注：用于For循环的子元素单次迭代。
 * @param  {[Element]} els 子元素集
 * @return {[Element]} 克隆的新元素集
 */
function cloneList( els ) {
    let _new = els.map(
        el => $.clone(el, true, true, true)
    );
    _new.forEach(
        (e, i) => cloneGrammar( els[i], e )
    );
    return _new;
}


/**
 * Each父元素的For文法检查/标记。
 * @param {Element} box 父元素
 */
function eachFor( box ) {
    let _grm = Grammars.get(box),
        _for = _grm && _grm.get('For');

    if (_for) _for[2] = true;
}


/**
 * For子元素引用存储&提取。
 * 存储时返回undefined。
 * @param  {Element} box For容器元素
 * @param  {Boolean} save 子元素引用存储
 * @return {[Element]|void} 子元素集
 */
function forSubs( box, save ) {
    if ( !save ) {
        return box[ __forSubs ];
    }
    box[ __forSubs ] = [ ...box.children ];
}


/**
 * 清理子元素。
 * 移除多余的Each克隆元素以保持For规范。
 * 注记：
 * 子元素中的Each可能被单独更新，因此移除更可靠。
 * @param  {Element} box For容器元素
 * @param  {Boolean} each 子元素包含Each文法
 * @return {[Element]} 子元素集
 */
function cleanEach( box, each ) {
    if ( each ) {
        for ( const el of $.children(box, __slrRender) ) {
            if ( el[__eachIndex] > 0 ) {
                $.remove(el);
            }
        }
    }
    return $.children( box );
}


/**
 * 循环克隆元素集。
 * 用于For循环中子元素集的迭代。
 * @param  {[Element]} els 源元素集
 * @param  {Number} cnt 克隆次数
 * @return {[Element]} 克隆总集
 */
function forClone( els, cnt ) {
    let _buf = [];

    for (let i=0; i<cnt; i++) {
        _buf = _buf.concat( cloneList(els) );
    }
    return _buf;
}


/**
 * 构造循环单元当前域对象。
 * 设置2个即时成员变量和父域引用。
 * 注意 undefined 和 null 两个值会直接返回。
 * 注记：
 * 基本类型需要转换为Object，否则无法添加属性。
 * 因此外部对单元数据执行相等比较时，不宜用全等（===）。
 * @param  {Object} data 单元数据
 * @param  {Number} i    当前下标（>= 0）
 * @param  {Object} supObj 父域对象
 * @return {Object} 设置后的数据对象
 */
function loopCell( data, i, supObj ) {
    if ( data == null ) {
        return data;
    }
    // 自动Object化
    return Object.assign( data, {
        [__loopIndex]: i,
        [__loopSize]: supObj.length,
        $: supObj,
    });
}


/**
 * 获取元素原始display样式。
 * 用于switch文法，因为可能被子元素last修改。
 * @param  {Element} el 目标元素
 * @return {String}
 */
function originStyle( el ) {
    if ( el[__switchDisplay] === undefined ) {
        el[__switchDisplay] = el.style.display;
    }
    return el[__switchDisplay];
}


/**
 * 元素是否隐藏。
 * 隐藏的元素无需向下继续渲染。
 * 来源：If/Else, Case/Last
 * @param  {Element} el 当前元素
 * @return {Boolean}
 */
function hidden( el ) {
    return el[__compState] === false;
}


/**
 * 隐藏元素。
 * 将目标元素插入一个临时的模板元素内，
 * 注意需要同时克隆元素自身的渲染配置。
 * @param {Element} el 目标元素
 */
function hideElem( el ) {
    let _tmp = $.attr(
        $.elem('template'), HasRender, ''
    );
    $.append(
        $.replace(el, _tmp).content, el
    );
    _tmp[__compState] = false;
    // 文法保持。
    Grammars.set( _tmp, Grammars.get(el) );
}


/**
 * 显示元素。
 * 将临时占位的模板元素用其内容替换回来。
 * 如果未被隐藏过，则为原始元素。
 * @param {Element} el 目标元素或占位元素
 */
function showElem( el ) {
    if ( hidden(el) ) {
        $.replace( el, el.content.firstElementChild );
    }
    el[__compState] = true;
}


/**
 * 同级else判断是否显示。
 * 向前检索关联If/Elseif元素是否已显示（为真）。
 * @param  {Element} cur 当前元素
 * @return {Boolean}
 */
function elseShow( cur ) {
    let _gram;

    for (const el of $.prevAll(cur, __slrRender)) {
        _gram = Grammars.get(el);

        if ( _gram.has('If') ) {
            return !el[__compState];
        }
        if ( _gram.has('Else') && el[__compState] ) {
            return false;
        }
    }
    throw new Error('Else not find previous If.');
}


/**
 * 同级case是否已执行。
 * @param  {Element} box Switch元素
 * @return {Boolean}
 */
function caseShow( box ) {
    return !box[__casePass];
}


/**
 * 渲染目标元素（单个）。
 * 按规定的文法优先级渲染元素。
 * @param  {Element} el 目标元素
 * @param  {Object} data 数据源
 * @return {Object|Array} 渲染后的当前域数据
 */
function render( el, data ) {
    let _gram = Grammars.get(el)

    if ( _gram ) {
        for (const [fn, args] of _gram) {
            Grammar[fn]( el, ...args, el[__scopeData] || data );
        }
    }
    return el[__scopeData] || data;
}



//
// 导出
///////////////////////////////////////////////////////////////////////////////


/**
 * 解析节点树渲染配置。
 * 通常用于源模板节点初始导入之后。
 * 注：<template>子元素的渲染配置不会被解析。
 * @param  {Element} tpl 模板节点
 * @return {Element} tpl
 */
function parse( tpl ) {
    let _gram;

    for ( const el of $.find('*', tpl, true) ) {
        _gram = Parser.grammar(el);

        if ( _gram.size > 0 ) {
            Grammars.set( el, _gram );
            el.setAttribute( HasRender, '' );
        }
    }
    return tpl;
}


/**
 * 节点树渲染文法克隆。
 * 应当在 parse 之后使用，用于克隆源模板节点时。
 */
const clone = cloneGrammar;


/**
 * 用源数据更新节点树。
 * 可用于页面中既有渲染元素的原地更新。
 * @param  {Element} root 渲染根
 * @param  {Object} data  源数据对象
 * @return {Element} root
 */
function update( root, data ) {
    data = render( root, data );

    for (let i = 0; i < root.children.length; i++) {
        update( root.children[i], data );
    }
    return root;
}


/**
 * 提取渲染文法配置。
 * @param  {Element} el 目标元素
 * @return {Map}
 */
function get( el ) {
    return Grammars.get( el );
}


export const Render = { parse, clone, update, get };
