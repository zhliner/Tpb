//! $ID: tpb.js 2019.08.19 Tpb.Base $
// ++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2021 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  基础定义集。
//
//  Tpb {
//      Init:{Function}     应用初始化
//      build:{Function}    节点树构建（OBT&渲染语法），需先执行上面的.Init()
//      obtBuild:{Function} 单元素OBT构建
//  }
//  On 扩展：
//      customGetter
//
//  By 扩展：
//      processExtend
//      processProxy
//      cmvApp
//
//  支持：
//  - 子模板系列自动动态导入（根据 文件:节点名 配置）。
//  - 特性（Attribute）定义式元素渲染。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { On } from "./pbs.get.js";
import { By } from "./pbs.by.js";
import { To } from "./pbs.to.js";

import $, { DEBUG, XLoader, Web, tplInit, DataStore } from "./config.js";
import { storeChain, hostSet, namedExtend, deepExtend, funcSets } from "./base.js";
import { App } from "./app.js";
import { Builder } from "./core.js";

import { Templater } from "./tools/templater.js";


//
// 本系模板管理器。
// 即应用中未命名的模板域对应的默认模板管理器。
//
let __Tpls = null;


//
// 调试工具
//////////////////////////////////////////////////////////////////////////////


if ( DEBUG ) {

    window.Update = To.Update;
    window.Next = To.Next;
    window.namedTpls = namedTpls;
    window.DataStore = DataStore;

}


/**
 * 输出模板节点定义。
 * 提取模板文件中定义的模板节点配置。
 * 用于模板开发结束后配置模板映射文件（templates/maps.json）。
 * 注：在浏览器控制台执行。
 * @param  {[String]} files 模板文件名集
 * @param  {Boolean} sort 是否排序
 * @return {void}
 */
function namedTpls( files, sort ) {
    let _buf = new Map();

    if ( !$.isArray(files) ) {
        files = [files];
    }
    // 先插入以保留原始顺序。
    files.forEach( f => _buf.set(f, null) );

    // 避免之前构建影响。
    XLoader.clear();

    Promise.all(
        files.map( f =>
            XLoader.node(`${Web.tpldir}/${f}`)
            .then( frag => $.find('[tpl-name]', frag).map(el => $.attr(el, 'tpl-name')) )
            .then( ns => _buf.set(f, sort ? orderList(ns) : ns) )
        )
    ).then(
        () => tplsOuts(_buf)
    );
}


// 输出配置对象。
function tplsOuts( map ) {
    let _obj = {};
    for (const [f, vs] of map) _obj[f] = vs;

    window.console.info( JSON.stringify(_obj, null, '\t') );
}


// 有序清单（标记重复）。
function orderList( vals ) {
    let _p;
    return vals.sort().map(
        v => {
            let _v = v === _p ? `[__REPEATED__]: ${v}` : v;
            _p = v;
            return _v;
        }
    );
}


//
// 扩展工具。
//////////////////////////////////////////////////////////////////////////////


/**
 * 自定义取值方法。
 * 对象/类实例：
 * - 方法默认会绑定（bind）到所属宿主对象。
 * - 可以注入到深层子域，但扩展集本身不支持深层嵌套（不用于By）。
 * - 如果目标中间子域不存在，会自动创建。
 * 函数：
 * 支持单个函数扩展到目标子域，此时args为取栈数量实参。
 * 这在简单扩展单个函数时有用（避免构造一个对象）。
 * 注记：
 * - 这是简化版的 By:processExtend 逻辑。
 * - 只能在 On.v 空间设置。
 * @param  {Object} on On空间对象
 * @param  {String|null} name 目标子域序列
 * @param  {Object|Instance|Function} exts 扩展集或类实例或取值函数
 * @param  {[String]|Number} args 方法名集或取栈数量，可选。
 * @param  {Number} n 默认取栈数量，在args为方法名集时有用。可选
 * @return {void}
 */
function customGetter( on, name, exts, args, n ) {
    if ( $.isFunction(exts) ) {
        return hostSet( on, name, exts, args );
    }
    namedExtend( name, exts, args, n, on );
}


/**
 * 接口：用户扩展。
 * 对象：
 * - 扩展中的方法默认会绑定（bind）到所属宿主对象。
 * - 支持多层嵌套的子域，子域是一种分组，由普通的Object封装。
 * - 扩展时会自动创建不存在的中间子域。
 * - 如果方法需要访问指令单元（this:Cell），传递args为true。
 * 类实例：
 * 支持扩展类实例的方法，此时args需要是一个方法名数组。
 * 函数：
 * 支持单个函数扩展到目标子域，此时args为取栈数量实参。
 *
 * @param  {Object} by By空间对象
 * @param  {String} name 目标域或名称序列（子域由句点分隔）
 * @param  {Object|Instance|Function} exts 扩展集或类实例或操作句柄
 * @param  {Boolean|[String]|Number} args 是否无需绑定或方法名集或取栈数量，可选。
 * @param  {Number} n 默认取栈数量，在args为方法名集时有用。可选
 * @return {void}
 */
function processExtend( by, name, exts, args, n ) {
    if ( $.isFunction(exts) ) {
        return hostSet( by, name, exts, args );
    }
    if ( $.isArray(args) ) {
        return namedExtend( name, exts, args, n, by );
    }
    deepExtend( name, exts, args, by );
}


/**
 * 接口：代理扩展。
 * 仅支持取值代理：function( name ): Function。
 * 通常，取值代理会返回一个操作函数或结果值。
 * @param  {Object} by By空间对象
 * @param  {String} name 目标域（子域由句点分隔）
 * @param  {Function} getter 取值函数
 * @param  {Number} n 取栈数量
 * @return {void}
 */
function processProxy( by, name, getter, n ) {
    let _pro = new Proxy(
            {},
            { get: (_, k) => funcSets(getter(k), n) }
        );
    hostSet( by, name, _pro );
}


/**
 * 接口：创建CMV程序。
 * 每个程序遵循 CMV（Control/Model/View）三层划分，
 * 三层逻辑各自实现，依靠相同的方法名称达成关联。
 *
 * 模板调用：[MyApp].run([meth], ...)
 * 可传递 methods 构造友好的调用集：[MyApp].[meth](...)。
 * 注意 run 为总调用方法，不应覆盖（除非你希望这样）。
 *
 * 每一层逻辑实现为一个调用集。
 * conf: {
 *      control: Object[n]:function( data, ...rest ): Promise,
 *      model:   Object[n]:function( data ): Value,
 *      view:    Object[n]:function( data ): Value,
 * }
 * 注：
 * 与By普通用户扩展一样，占用By顶层空间。
 * 如果程序名称（name）已经存在，会抛出异常（而非静默覆盖）。
 *
 * @param  {Object} by By空间对象
 * @param  {String} name 程序名
 * @param  {Object} conf CMV配置对象
 * @param  {[String]} meths 方法名集，可选
 * @return {void}
 */
function cmvApp( by, name, conf, meths = [] ) {
    let obj = by[ name ];

    if ( obj != null ) {
        throw new Error(`By[${name}] is already exist.`);
    }
    by[ name ] = obj = {};

    let app = new App(
            conf.control,
            conf.model,
            conf.view
        );
    obj.run = app.run.bind( app );

    // 可能覆盖.run
    meths.forEach( m => obj[m] = app.call.bind(app, m) );
}



//
// 基本工具。
//////////////////////////////////////////////////////////////////////////////


/**
 * 获取OBT构建器。
 * 注记：
 * To部分不支持用户扩展，因此无参数传入。
 * @param  {Object} on On定义集，可选
 * @param  {Object} by By定义集，可选
 * @return {Builder}
 */
function obtBuilder( on = On, by = By ) {
    return new Builder({
            on,
            by,
            update: To.Update,
            next:   To.Next,
        },
        storeChain
    );
}


/**
 * 单元素OBT构建。
 * 可用于即时测试外部的OBT配置，或构建无法直接定义OBT的对象（如Documet）。
 * 仅OBT处理，不包含渲染语法的解析。
 * 如果没有传递ob定义集，则默认支持基础OnBy方法集。
 * @param  {Element} el 目标元素
 * @param  {Object} conf OBT配置对象（{on, by, to}）
 * @param  {Object} ob On/By方法集，可选。默认全局On/By定义集
 * @return {Element} el
 */
function obtBuild( el, conf, ob = {} ) {
    return obtBuilder( ob.on, ob.by ).build( el, conf );
}


/**
 * Tpb初始化。
 * 设置全局模板管理器，在一个应用启动之前调用。
 * 强制模板存放在默认配置的目录内（Web.tpldir）。
 * @param  {Object} on On定义集，可选
 * @param  {Object} by By定义集，可选
 * @return {void}
*/
function Init( on, by ) {
    __Tpls = tplInit( new Templater(obtBuilder(on, by), Web.tpldir) );
}


/**
 * 通用OBT全构建。
 * 包括节点树内引入的子模版的连锁解析构建（tplr）。
 * 可用于DOM节点和可绑定事件的普通对象（如window）。
 * - 单纯传递 root 可用于页面中既有OBT构建（没有子模版逻辑）。
 * - 如果 root 中包含模板语法且需要引入外部子模版，则 conf 是必需的。
 * - 如果模板存放在非默认目录内，可以传递一个自定义的模板管理器实例（tplr）。
 * 注意：
 * conf为子模板配置对象时，格式参考 templates/maps.json。
 * 如果没有自定义的模板管理器，则需要先初始化默认的模板管理器（.Init()）。
 * 返回的承诺对象承诺了根元素及其子模板内的所有构建。
 * @param  {Element|Document|Object} root 根容器或处理对象
 * @param  {String|Object} conf 模板节点配置文件或配置对象，可选
 * @param  {Templater} tplr 模板管理器实例，可选
 * @return {Promise<void>}
 */
function build( root, conf, tplr ) {
    tplr = tplr || __Tpls;
    return tplr.config( conf ).then( () => tplr.build(root) );
}



//
// 导出。
//////////////////////////////////////////////////////////////////////////////


export {
    On as BaseOn,
    By as BaseBy,
    customGetter,
    processExtend,
    processProxy,
    cmvApp,
    obtBuilder,
};

export const Tpb = { Init, build, obtBuild };
