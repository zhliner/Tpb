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
//      Control[method]：function( data, ...rest:Value ): Promise<val>
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

export class App {
    /**
     * 构建一个App。
     * @param {Object} ctrl 控制调用集
     * @param {Object} model 模型调用集
     * @param {Object} view 视图调用集
     */
    constructor( ctrl, model, view ) {
        this._cobj = ctrl  || new Proxy( {}, { get: () => d => Promise.resolve(d) } );
        this._mobj = model || new Proxy( {}, { get: () => d => d } );
        this._vobj = view  || new Proxy( {}, { get: () => d => d } );
    }


    /**
     * 程序运行。
     * @data: Any
     * @param  {Object} evo 事件关联对象
     * @param  {String} meth 运行方法
     * @param  {...Value} rest 剩余参数
     * @return {Promise}
     */
    run( evo, meth, ...rest ) {
        return this._cobj[meth]( evo.data, ...rest )
            .then( d => this._mobj[meth]( d ) )
            .then( d => this._vobj[meth]( d ) );
    }


    /**
     * 方法调用封装。
     * 注：绑定专用。
     * @param  {String} meth 运行方法
     * @param  {...Value} rest 剩余参数
     * @return {Promise}
     */
    call( meth, evo, ...rest ) {
        return this.run( evo, meth, ...rest );
    }
}
