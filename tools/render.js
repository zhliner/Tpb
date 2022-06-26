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
//  另：
//  tpb-root标记渲染根节点（即便是模板根，如果需要从它开始渲染，也需要标记）。
//
//
//  结构：
//  Grammars:{WeakMap}      源模板文法存储（总参考源）
//  __rootMap:{WeakMap}     渲染根映射（渲染目标 => 源模板节点）
//  __tmpGrams:{Map}        渲染时即时克隆元素的文法存储，临时空间（用完清空）
//
//  渲染：
//  1. 找到渲染目标（tpb-root）的源模板节点（__rootMap）。
//  2. 克隆源模板节点，包括其上的事件处理器和渲染文法，后者存储在__Grammars中。
//  3. 对克隆的新元素执行渲染。
//  4. 如果可以（目标非源模板引用），新元素替换渲染目标。
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

    //
    // 元素文法存储。
    // Element: Map{
    //      word: [...args] // 文法词: [参数序列]
    // }
    // 其中值采用Map结构，可附带文法的处理顺序。
    // args：
    // - [0]: handle:{Function} 表达式执行函数封装。
    // - ...: {Value} 文法特定的额外参数序列。
    // 附：
    // 调用处理：handle( ...args[1:] )
    //
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
    __For       = 'tpb-for',        // 子元素循环
    __Root      = 'tpb-root';       // 渲染根元素标记


const
    // 赋值属性前缀标识。
    __chrAttr   = '_',

    // 进阶处理（输出过滤）
    __chrPipe   = '|',

    // 渲染元素选择器。
    __slrRender = `[${HasRender}]`,

    // 渲染根选择器。
    __slrRoot = `[${__Root}]`,

    // 循环内临时变量名
    __loopIndex = 'INDEX',  // 当前条目下标（从0开始）
    __loopSize  = 'SIZE',   // 循环集大小

    // 当前域数据存储键。
    // 在元素上存储当区域数据，以便于后期引用。
    // 适用：tpb-with, tpb-each, tpb-for
    __scopeData = Symbol( 'scope-data' ),

    // Each渲染就绪标记。
    // 避免重复渲染（无限循环）。
    __eachDone = Symbol( 'each-done' ),

    // switch标的值存储键。
    // 供 Case/Last 分支对比。
    __switchCase = Symbol( 'switch-case' ),

    // 过滤切分器。
    // - 识别字符串语法（字符串内的|为普通字符）。
    // - 排除小括号封装：因为逻辑或（||）需包含在一对小括号内。
    // 注记：
    // 为了避免表达式中的逻辑或（||）与过滤标识符混淆，前者需要包含在一对小括号内。
    // 这也是上面排除小括号封装的原因。
    __pipeSplit = new Spliter( __chrPipe, new UmpCaller(), new UmpString() ),

    // 即时渲染文法存储区。
    // { Element: Map }
    __tmpGrams = new Map(),

    // 渲染根模板映射。
    // 即tpb-root标记的元素（副本）对源模板的映射。
    // {new:Element => src:Element}
    __rootMap = new WeakMap();



//
// 渲染配置解析。
// 构造文法集（Map{文法: 参数序列}）的存储。
// 解析相对独立，无DOM树依赖。
// 注记：
// 在tpl-node/source上设置渲染语法没有意义，因此不牵涉子模版。
//
const Parser = {
    //
    // 文法解析方法映射：[
    //      [ 属性名, 解析方法名 ]
    // ]
    // 逻辑互斥的文法不应在同一元素上同时定义（如 tpb-if 和 tpb-else）。
    // 注意：本列表隐含了文法处理优先级。
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
        // Assign at last...
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
                this[fn]( _map, el.getAttribute(an) );
                el.removeAttribute(an);
            }
        }
        // last!
        return this.assign( _map, el );
    },


    /**
     * 自迭代文法解析。
     * Each: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $each( map, val ) {
        return map.set(
            'Each',
            [ Expr.loop(val) ]
        );
    },


    /**
     * 循环文法解析。
     * For: [handle]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $for( map, val ) {
        return map.set(
            'For',
            [ Expr.loop(val) ]
        );
    },


    /**
     * with文法解析。
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
     * var文法解析。
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
     * if文法解析。
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
     * else|elseif 文法解析。
     * 如果包含条件测试，则为 elseif 逻辑。
     * Else: [handle|null]
     * @param  {Map} map 存储集
     * @param  {String} val 属性值
     * @return {Map} map
     */
    $else( map, val ) {
        return map.set(
            'Else',
            [ val ? Expr.value(val) : null ]
        );
    },


    /**
     * switch文法解析。
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
     * case文法解析。
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
     * case|default 文法解析。
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
     * 需要渲染的特性名前置一个下划线。
     * 注：这是最后一个解析的文法。
     * Assign: [[name], [handle]]
     * @param  {Map} map 存储集
     * @param  {Element} el 目标元素
     * @return {Map} map
     */
    assign( map, el ) {
        let _ats = [],
            _fns = [];

        for ( let at of Array.from(el.attributes) ) {
            let _n = at.name;

            if ( _n[0] == __chrAttr ) {
                _ats.push( _n.substring(1) );
                _fns.push( Expr.assign(at.value) );

                el.removeAttribute(_n);
            }
        }
        return _ats.length ? map.set('Assign', [_ats, _fns]) : map;
    },

};



//
// 渲染文法执行集。
// 按文法固有的逻辑更新目标元素（集）。
// 注记：
// 元素上存储的当前域数据[__scopeData]会被优先取用。
// @param  {Object} data  当前域数据
// @param  {Object} gdata 根数据源对象
// @return {void}
//
const Grammar = {
    /**
     * 当前元素自循环。
     * - 提取集合各成员，设置当前域。
     * - 结果元素上做标记，避免重复渲染（无限循环）。
     * 文法实参：[handle]
     * @param {Element} el 目标元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Each( el, handle, data, gdata ) {
        el[__eachDone] || $.replace(
            el,
            eachList( el, handle(data, gdata), data )
        );
    },


    /**
     * 子元素集循环。
     * 当前域数据存储在迭代克隆的每个子元素上。
     * 文法实参：[handle]
     * @param {Element} el For容器元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    For( el, handle, data, gdata ) {
        $.append(
            el,
            forList( $.empty(el), handle(data, gdata), data ).flat()
        );
    },


    /**
     * 创建新的当前域。
     * 新的当前域数据存储在元素的 [__scopeData] 属性上。
     * 文法实参：[handle]
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    With( el, handle, data, gdata ) {
        let _sub = handle( data, gdata );

        if ( typeof _sub !== 'object' ) {
            _sub = Object( _sub );
        }
        _sub.$ = data;  // 父域设置

        el[ __scopeData ] = _sub;
    },


    /**
     * 新建变量。
     * 表达式应该是在当前域对象上添加新的变量，
     * 简单执行即可。
     * 文法实参：[handle]
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Var( el, handle, data, gdata ) {
        handle( data, gdata );
    },


    /**
     * If 逻辑。
     * 结果为假时，当前元素直接从DOM中移除。
     * 结果为真时，向后检索Else/Elseif，移除它们。
     * 文法实参：[handle]
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    If( el, handle, data, gdata ) {
        if ( handle(data, gdata) ) {
            detachElse( el );
        } else {
            $.remove( el );
        }
    },


    /**
     * Else/Elseif 逻辑。
     * 如果 handle 非假即为 Elseif 逻辑，向后检索处理同 If 文法。
     * 否则即为单纯的 Else，则原地保持即可（无行为）。
     * 文法实参：[handle|null]
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Else( el, handle, data, gdata ) {
        if ( handle ) {
            handle( data, gdata ) ? detachElse( el ) : $.remove( el );
        }
    },


    /**
     * 分支选择创建。
     * 子元素分支条件判断，决定显示或隐藏。
     * 如果全部分支判断都为假，会移除switch元素本身。
     * 文法实参：[handle]
     * 实现：
     * 在当前元素上存储标的值即可，其它逻辑由子元素 Case/Last 完成。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Switch( el, handle, data, gdata ) {
        el[__switchCase] = handle( data, gdata );
    },


    /**
     * 分支测试执行。
     * 与 Switch 标的值比较（===），结果为真即保留，否则移除。
     * 当某一 Case 为真时，移除后续其它 Case/List 条目。
     * 文法实参：[handle]
     * 注意：
     * Switch/Case,Last 逻辑仅限于父子元素两个层级。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式取值函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Case( el, handle, data, gdata ) {
        let _box = el.parentElement;

        if ( _box[__switchCase] === handle(data, gdata) ) {
            return detachCase( el );
        }
        $.remove( el );
    },


    /**
     * 尾分支默认或测试。
     * 如果包含条件表达式，则类似 Case，否则为默认分支。
     * 如果尾分支都不匹配，会移除 Switch 树本身（即父元素）。
     * 文法实参：[handle|null]
     * 注记：
     * 如果需要全部分支都不匹配时，依然保留其它不含渲染文法的兄弟元素，
     * 可以仅使用 Case 文法。
     * Last 应该是最后一个分支，否则后面的 Case 会被视为新分支，
     * 即可能同时有两个分支被保留（Last 和 新的 Case）。
     * @param {Element} el 当前元素
     * @param {Function} handle 表达式函数
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Last( el, handle, data, gdata ) {
        let _box = el.parentElement;

        if ( handle && _box[__switchCase] !== handle(data, gdata) ) {
            $.remove( _box );
        }
    },


    /**
     * 特性赋值。
     * 特性名集和处理器集成员一一对应。
     * 支持两个特殊特性名：text, html。
     * 文法实参：[[name], [handle]]
     * @param {[String]} names 属性名集
     * @param {[Function]} handles 处理器集
     * @param {Object} data 当前域数据
     * @param {Object} gdata 根数据源对象
     */
    Assign( el, names, handles, data, gdata ) {
        names.forEach(
            (name, i) =>
            $.attr( el, name || 'text', handles[i](data, gdata) )
        );
    },

};



//
// 表达式处理构造。
// 返回一个目标渲染类型的表达式执行函数。
// 注：表达式无return关键词。
// 形参：
// [0]: $   当前域数据对象。
// [1]: $$  全局域根数据对象。
// @param  {String} expr 表达式串
// @return {Function|null}
//
const Expr = {
    /**
     * 取值表达式。
     * 适用：tpb-with|switch|var|if/else|case,
     * @return function(data, gdata): Value
     */
    value( expr ) {
        return new Function( '$', '$$', `return ${expr};` );
    },


    /**
     * 循环表达式。
     * 适用：tpb-each, tpb-for
     * @return function(data, gdata): Array
     */
    loop( expr ) {
        if ( !expr ) {
            // 空值返回当前域数据自身。
            // (data, gdata) => data
            return v => v;
        }
        return new Function( '$', '$$', `return ${expr};` );
    },


    /**
     * 属性赋值。
     * 支持可能有的过滤器序列，如：...|a()|b()。
     * 适用：_[name].
     * @param  {String} expr 赋值表达式
     * @return {Function} function(data, gdata): Value
     */
    assign( expr ) {
        let _ss = [...__pipeSplit.split(expr)],
            _fn = new Function( '$', '$$', `return ${_ss.shift()};` );

        if ( _ss.length == 0 ) {
            return _fn;
        }
        // 包含过滤器。
        let _f2s = _ss.map( filterHandle );

        return (data, gdata) => _f2s.reduce( (d, f2) => f2[0](d, ...f2[1](data, gdata)), _fn(data, gdata) );
    },

};



//
// 工具函数
///////////////////////////////////////////////////////////////////////////////


/**
 * 构造赋值过滤器对。
 * [0]: 过滤器函数。
 * [1]: 实参处理器（模板中小括号内的表达式）。
 * @param  {String} expr 调用表达式
 * @return {[Function, Function]} 过滤器&实参处理器对
 */
function filterHandle( expr ) {
    let _fn2 = Util.funcArgs( expr.trim() );

    return [
        Filter[ _fn2.name ],
        new Function( '$', '$$', `return [${_fn2.args}]` )
    ];
}


/**
 * 节点树文法克隆。
 * to应当是src的克隆（相同DOM结构）。
 * 应当在模板解析完成之后才使用。
 * 注记：
 * 不会处理<template>元素内的渲染语法。
 * 用途：
 * - 模板内部的克隆逻辑（tpl-node）。
 * - 渲染中创建新元素时的即时克隆。
 * @param  {Element} src 源元素
 * @param  {Element} to  目标元素
 * @param  {WeakMap|Map} srcbuf 文法取值区
 * @param  {WeakMap|Map} tobuf  文法存储区
 * @return {Element} to
 */
function cloneGrammar( src, to, srcbuf, tobuf ) {
    let _ss = $.find( __slrRender, src, true );

    $.find( __slrRender, to, true )
    .forEach(
        (el, i) => tobuf.set( el, srcbuf.get(_ss[i]) )
    )
    return to;
}


/**
 * 检查并创建渲染根映射。
 * 如果el有值，应当是tpl的克隆版（DOM结构相同）。
 * 目标节点也可能就是模板节点自身，这在模板初始解析时有用。
 * 模板节点也可能是一个克隆副本而不是初始源模板。
 * 注记：
 * 因为模板节点可被用户直接引用来渲染，所以模板也需要建立映射（自己映射到自己）。
 * 这样就可以方便地找到源模板（在同一集合内）。
 * @param  {Element} tpl 模板节点树
 * @param  {Element} to  目标节点树，可选
 * @return {Element} to
 */
function rootMap( tpl, to = tpl ) {
    let _src = $.find( __slrRoot, tpl, true );

    $.find( __slrRoot, to, true )
    .forEach(
        // .get() 尝试追溯源模板
        (el, i) => __rootMap.set( el, __rootMap.get(_src[i]) || _src[i] )
    );
    return to;
}


/**
 * 创建迭代新元素。
 * 如果存在根映射，则新元素也需要添加映射。
 * 同时也需要克隆自身和内部子元素可能有的渲染语法。
 * @param  {Element} el 渲染目标
 * @return {Element} 新元素
 */
function loopOne( el ) {
    let _new = rootMap(
        el,
        $.clone( el, true, true, true )
    );
    return cloneGrammar( el, _new, __tmpGrams, __tmpGrams );
}


/**
 * 创建Each元素集。
 * @param  {Element} el   渲染目标
 * @param  {[Value]} vals 迭代值数组
 * @param  {Object} data  当前域数据（循环前）
 * @return {[Element]}
 */
function eachList( el, vals, data ) {
    let _els = [];

    for ( const [i, v] of vals.entries() ) {
        let _new = loopOne( el );

        _new[__eachDone] = true;
        // 设置当前域。
        _new[__scopeData] = loopCell( v, i, data );

        _els.push( _new );
    }
    return _els;
}


/**
 * 设置元素（集）当前域。
 * 集合成员设置相同的域数据。
 * 适用：For子元素集单次迭代。
 * @param {[Node]} nodes 目标节点集
 * @param {Number} i     循环当前下标
 * @param {Value} v      循环当前值
 * @param {Object} sup   父域对象
 * @return [Element]
 */
function scopeElem( nodes, i, v, sup ) {
    nodes.forEach(
        nd => nd.nodeType === 1 && ( nd[__scopeData] = loopCell(v, i, sup) )
    );
    return nodes;
}


/**
 * 克隆节点集。
 * 包含文本节点，简单克隆即可。
 * 如果是元素，则同时克隆渲染文法和渲染根映射。
 * @param  {[Node]} nodes 节点集
 * @return {[Node]} 新的节点集
 */
function cloneList( nodes ) {
    return nodes.map(
        nd => nd.nodeType === 1 ? loopOne( nd ) : nd.cloneNode( true )
    );
}


/**
 * 创建For子节点集（二维）
 * @param  {[Node]} subs  子节点集
 * @param  {[Value]} vals 迭代值数组
 * @param  {Object} data  当前域数据（循环前）
 * @return {[[Node]]} 子节点集组
 */
function forList( subs, vals, data ) {
    let _buf = [];

    for ( const [i, v] of vals.entries() ) {
        _buf.push(
            scopeElem( cloneList(subs), i, v, data )
        );
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
 * 向后搜寻 Else/Elseif 文法元素并移除之。
 * 紧邻的 If/Else/Elseif 文法视为一组，
 * 不支持平级兄弟元素间的 If/If/Else/Else 类嵌套。
 * @param {Element} beg 起点元素
 */
function detachElse( beg ) {
    let _gram;

    for ( const el of $.nextAll(beg, __slrRender) ) {
        _gram = __tmpGrams.get(el);

        if ( _gram.has('If') ) {
            break;
        }
        if ( _gram.has('Else') ) $.remove( el );
    }
}


/**
 * Case 移除。
 * 向后搜寻 Case/Last 文法元素并移除之。
 * 各个平级 Case/Last 元素并不需要连续，其间可以自由定义其它渲染文法。
 * 注记：
 * 因为 Case/Last 是 Switch 容器的子元素，所以一个容器内只有一组 Case/Last。
 * 但这并不影响在子元素内定义新的 Switch 或其它文法。
 * @param {Element} beg 起点元素
 */
function detachCase( beg ) {
    let _gram;

    for ( const el of $.nextAll(beg, __slrRender) ) {
        _gram = __tmpGrams.get(el);

        if ( _gram.has('Case') || _gram.has('Last') ) {
            $.remove( el );
        }
    }
}


/**
 * 渲染目标元素。
 * 按规定的文法优先级渲染元素。
 * 渲染完成后，可渲染标记（_）和渲染根标记属性会被清除。
 * 注记：
 * 如果直接对模板节点执行渲染，该节点将失去“模板”的功能。
 * 因此el目标元素是一个源模板的克隆节点。
 * @param  {Element} el 目标元素
 * @param  {Object} data 数据源
 * @param  {Object} gdata 根数据源
 * @return {Object|Array} 渲染后的当前域数据
 */
function renderSelf( el, data, gdata ) {
    let _gram = __tmpGrams.get( el )

    if ( _gram ) {
        for (const [fn, args] of _gram) {
            Grammar[fn]( el, ...args, el[__scopeData] || data, gdata );
        }
        el.removeAttribute( HasRender );
    }
    el.removeAttribute( __Root );

    return el[__scopeData] || data;
}


/**
 * 用源数据更新节点。
 * 目标应当是tpb-root标记的元素的副本。
 * @param  {Element} root 渲染根
 * @param  {Object} data  源数据对象
 * @param  {Object} gdata 全局源数据（根数据）
 * @return {Element} root
 */
function update( root, data, gdata ) {
    data = renderSelf( root, data, gdata );

    // 利用 .children 动态更新特性
    for (let i = 0; i < root.children.length; i++) {
        update( root.children[i], data, gdata );
    }
    return root;
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
        _gram = Parser.grammar( el );

        if ( _gram.size > 0 ) {
            Grammars.set( el, _gram );
            el.setAttribute( HasRender, '' );
        }
    }
    return rootMap( tpl );
}


/**
 * 执行渲染。
 * 渲染目标el本身或其源模板必须标记过tpb-root（渲染根），
 * 前者指页面DOM中既有的元素（非模板）。
 * 会无条件克隆源模板的一个副本来执行渲染，即便目标本身就是一个模板。
 * 也即：
 * 渲染不会破坏源模板，用户无需预先克隆一个模板来渲染。
 * 注记：
 * 渲染目标仅用于检索其源模板节点，而非渲染目标本身。
 * 渲染出的是由源模板克隆的一个新元素。
 * 如果目标不是引用源模板本身，新元素会自动替换渲染目标。
 *
 * @param  {Element} el 渲染目标
 * @param  {Object} data 渲染源数据
 * @return {Element} 一个被渲染的已替换了渲染目标的新元素
 */
function render( el, data ) {
    let _tpl = __rootMap.get( el );

    if ( !_tpl ) {
        throw new Error( `Rendering is a non-[tpb-root] element.` );
    }
    // 根映射，便于渲染根引用。
    let _new = rootMap(
        _tpl,
        $.clone( _tpl, true, true, true )
    );
    update( cloneGrammar(_tpl, _new, Grammars, __tmpGrams), data, data );

    // 即时清理。
    __tmpGrams.clear();

    return _tpl !== el ? $.replace( el, _new ) : _new;
}


/**
 * 模板渲染文法克隆。
 * 应当仅用于模板内部的克隆逻辑（如tpl-node）。
 * @param  {Element} src 源元素
 * @param  {Element} to 目标元素
 * @return {Element} to
 */
function clone( src, to ) {
    return cloneGrammar( src, to, Grammars, Grammars );
}


/**
 * 提取渲染文法配置。
 * 注：主要用于调试查看渲染配置。
 * @param  {Element} el 目标元素
 * @return {Map}
 */
function get( el ) {
    return Grammars.get( el );
}


export const Render = { parse, render, clone, get };
