//! $ID: base.js 2021.10.11 Tpb.Base $
// +++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2021 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  基础工具集。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import $, { ACCESS, EXTENT } from "./config.js";


//
// 基础支持
//=========================================================

/**
 * 绑定方法到原宿主对象（obj）。
 * 支持对象子集嵌套，会递进处理。
 * - 处理取栈条目数（[EXTENT]），由前置两个下划线的属性表达。
 * - 处理特权设置（[ACCESS]），由前置两个下划线和_x结尾的属性表达。
 * 注记：
 * 这是 $.assign() 函数的处理器。
 * 创建已绑定的方法供全局共享，而不是每次创建一个绑定的新方法。
 *
 * @param  {Function} f 源方法
 * @param  {String} k 方法名
 * @param  {Object} obj 源宿主对象
 * @param  {Object} to 目标宿主对象
 * @return {[Function,]} 值/键对（键忽略）
 */
 function bindMethod( f, k, obj, to ) {
    if ( $.type(f) == 'Object' ) {
        return [ $.assign(to[k] || {}, f, bindMethod) ];
    }
    if ( !$.isFunction(f) ) {
        return null;
    }
    if ( !f.name.startsWith('bound ') ) {
        f = f.bind( obj );
    }
    return [ funcSets(f, obj[`__${k}`], obj[`__${k}_x`]) ];
}


/**
 * 简单地获取方法（未绑定）。
 * 支持对象子集嵌套，会递进处理。
 * - 处理取栈条目数（[EXTENT]），由前置两个下划线的属性表达。
 * - 处理特权设置（[ACCESS]），由前置两个下划线和_x结尾的属性表达。
 * 注：这是 $.assign() 函数的非绑定处理器。
 * @param  {Function} f 源方法
 * @param  {String} k 方法名
 * @param  {Object} obj 源对象
 * @param  {Object} to 目标宿主对象
 * @return {[Function,]} 值/键对（键忽略）
 */
function getMethod( f, k, obj, to ) {
    if ( $.type(f) == 'Object' ) {
        return [ $.assign(to[k] || {}, f, getMethod) ];
    }
    if ( !$.isFunction(f) ) {
        return null;
    }
    return [ funcSets(f, obj[`__${k}`], obj[`__${k}_x`]) ];
}


/**
 * 指令/方法属性设置：{
 *  - [ACCESS] 是否为特权方法。
 *  - [EXTENT] 自动取栈条目数。
 * }
 * @param  {Function} f 目标指令
 * @param  {Number} n 自动取栈数量
 * @param  {Boolean} ix 是否为特权指令
 * @return {Function}
 */
function funcSets( f, n, ix ) {
    if ( ix ) {
        f[ ACCESS ] = true;
    }
    // null|undefined
    if ( n != null ) {
        f[ EXTENT ] = n;
    }
    return f;
}


/**
 * 宿主成员简单赋值。
 * @param  {Object} host 宿主对象
 * @param  {String} name 名称序列（句点分隔）
 * @param  {Proxy|Function} item 代理对象或操作句柄
 * @param  {Number} n 取栈数量
 * @return {void}
 */
function hostSet( host, name, item, n ) {
    let _ns = name.split( '.' ),
        _nx = _ns.pop();

    if ( n !== undefined ) {
        item[EXTENT] = n;
    }
    ( subObj(_ns, host) || host )[ _nx ] = item;
}


/**
 * 获取目标子域。
 * 如果目标子域不存在，则自动创建。
 * 子域链上的子域必须是普通对象类型（Object）。
 * @param {[String]} names 子域链
 * @param {Object} obj 取值域对象
 */
function subObj( names, obj ) {
    let _sub = obj;

    for ( const name of names || '' ) {
        _sub = obj[name];

        if ( !_sub ) {
            obj[name] = _sub = {};
            obj = _sub;
        }
        else if ( $.type(_sub) !== 'Object' ) {
            throw new Error(`the ${name} field is not a Object.`);
        }
    }
    return _sub;
}


/**
 * 深度扩展。
 * 对待扩展集内的所有方法进行扩展，支持对象嵌套（递进处理）。
 * 被扩展的方法默认会绑定（bind）到所属宿主对象。
 * 接受扩展的目标子域可以是深层的（句点连接），重名方法会被覆盖。
 * 注记：
 * 如果目标子域不存在，会自动创建，包括中间层级的子域。
 * 如果方法需要访问指令单元（this:Cell），可以传递nobind为真。
 * 可无exts实参调用，返回子域本身。
 * 源定义支持取栈数量（__[name]）和特权（__[name]_x）配置。
 * @param  {String} name 接受域标识
 * @param  {Object} exts 待扩展目标集，可选
 * @param  {Boolean} nobind 无需绑定，可选。
 * @param  {Object} base 扩展根域
 * @return {Object} 目标子域
 */
function deepExtend( name, exts, nobind, base ) {
    let _f = nobind ?
        getMethod :
        bindMethod;

    return $.assign( subObj(name.split('.'), base), exts || {}, _f );
}


/**
 * 具名扩展。
 * 需要指定待扩展的目标方法，且仅限于成员的直接引用。
 * 适用普通对象和任意直接使用的类实例。
 * 如果从类实例扩展，通常需要传递一个统一的取栈数量n实参。
 * 通过方法名前置双下划线设置的取栈数量可以覆盖默认的n值。
 * 如果接收域标识为空字符串或假值，则接收域为base本身。
 * 注记同上。
 * @param {String} name 接收域标识
 * @param {Instance} obj 待扩展对象或类实例
 * @param {[String]} methods 方法名集
 * @param {Number} n 默认取栈数量，可选
 * @param {Object} base 扩展根域
 */
function namedExtend( name, obj, methods, n, base ) {
    let host = subObj(
            name ? name.split( '.' ) : [],
            base
        );
    for ( const m of methods ) {
        let _n = obj[ `__${m}` ];

        if ( _n === undefined ) {
            _n = n;
        }
        host[ m ] = funcSets( obj[m].bind(obj), _n, obj[`__${m}_x`] )
    }
}


//
// 导出。
//////////////////////////////////////////////////////////////////////////////


export {
    bindMethod,
    getMethod,
    funcSets,
    hostSet,
    subObj,
    deepExtend,
    namedExtend,
};