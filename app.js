//! $ID: app.js 2019.08.10 Tpb.Base $
//+++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  页面小程序。
//  将程序的逻辑划分为三个平行的层次，在此实现这三个层次之间的连系调用。
//
//  三个入口实现：
//  - Control
//      对流程数据（前阶pop）进行前置的控制和预处理。
//      Control[method]：function( data, ...rest:Value ): Value
//    注意：
//    如果未定义目标成员，默认只返回首个实参到 Model 部分。
//
//  - Model
//      处理业务模型。方法的实参为控制部分返回的值。
//      Model[method]：function( val:Value ): Value
//
//  - View
//      用于与视图相关的后期处理，也可能与控制部分相呼应。
//      方法的实参为模型返回的值。返回值回到流程里。
//      View[method]：function( val:Value ): Value
//
//  实现可以为普通对象或类实例。
//  每个层次都是可选的，三个层次之间通过相同的方法名（method）进行关联（串联调用）。
//
//
///////////////////////////////////////////////////////////////////////////////
//

// 简单缩写。
const warn = msg => window.console.warn( msg );


export class App {
    /**
     * 构建一个App。
     * @param {Object} ctrl 控制调用集
     * @param {Object} model 模型调用集
     * @param {Object} view 视图调用集
     */
    constructor( ctrl, model, view ) {
        this._c = this._getter( ctrl || {} );
        this._m = this._getter( model || {} );
        this._v = this._getter( view || {} );
    }


    /**
     * 程序运行。
     * @data: Any
     * @param  {Object} evo 事件关联对象
     * @param  {String} fn  运行方法名
     * @param  {...Value} rest 剩余参数
     * @return {Promise<Value>}
     */
    run( evo, fn, ...rest ) {
        let _v = this._c[fn]( evo.data, ...rest );
        return Promise.resolve(_v).then( d => this._m[fn](d) ) .then( d => this._v[fn](d) );
    }


    /**
     * 获取/扩展控制集。
     * @param  {Object} obj 控制调用集
     * @return {Proxy}
     */
    control( obj = {} ) {
        return Object.assign( this._c, obj );
    }


    /**
     * 获取/扩展模型集。
     * @param  {Object} obj 模型调用集
     * @return {Proxy}
     */
    model( obj = {} ) {
        return Object.assign( this._m, obj );
    }


    /**
     * 获取/扩展视图集。
     * @param  {Object} obj 视图处理集
     * @return {Proxy}
     */
    view( obj = {} ) {
        return Object.assign( this._v, obj );
    }


    /**
     * 绑定专用：
     * 方法调用封装。
     * @param  {String} meth 运行方法
     * @param  {...Value} rest 剩余参数
     * @return {Promise<Value>}
     */
    call( meth, evo, ...rest ) {
        return this.run( evo, meth, ...rest );
    }


    /**
     * 创建一个Get代理器。
     * 有值则返回，无值时返回一个“简单返值”的函数。
     * 注：
     * 附带设置检查器，非函数成员时输出警告信息。
     * @param  {Object} obj 目标对象
     * @return {Proxy}
     */
    _getter( obj ) {
        return new Proxy( obj, {
            get: (o, k) => o[k] || (d => d),
            // 非函数成员依然设置。
            set: (o, k, v) => typeof v !== 'function' && warn(v, 'is not a function.' || (o[k] = v) )
        });
    }
}
