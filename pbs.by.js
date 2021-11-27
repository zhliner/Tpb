//! $ID: pbs.by.js 2019.08.19 Tpb.Base $
// +++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  OBT:By 方法集。
//
//  仅包含少量的几个顶级基础指令。
//  主要功能依赖于用户定义的库和系统内置的X库。
//
//  用户的扩展存在于By的顶层（By对象自身），但也可以扩展到任意子域上。
//
//  用户扩展：
//      import { processExtend } from "./tpb/tpb.js";
//      // import By, then
//      processExtend( By, 'Name', extobj );
//      processExtend( By, 'Name.Sub', extobj );  // 扩展到 Sub 子域
//
//  App创建：
//      import { cmvApp } from "./pbs.by.js";
//      cmvApp( 'MyApp', conf, meths );
//
//      模板使用：
//      by="MyApp.run('meth', ...)"
//      by="MyApp.meth(...)"  // 同上，形式友好。
//
///////////////////////////////////////////////////////////////////////////////
//

import $ from "./config.js";
import { bindMethod } from "./base.js";
import { Get } from "./pbs.get.js";

import { Render } from "./tools/render.js";


const _By = {
    /**
     * 节点树渲染（单根）。
     * 目标：暂存区/栈顶1项。
     * 仅支持单个根元素，如果目标是多个元素则需要封装到一个容器内。
     * 如果需要同一数据对多个元素分别渲染，可用To.Update:render。
     * @param  {Object|Value|[Value]} vals 渲染数据
     * @return {Element} 被渲染节点
     */
    render( evo, vals ) {
        return Render.update( evo.data, vals );
    },

    __render: 1,


    /**
     * 数据获取。
     * 目标：暂存区1项可选。
     * 数据类型名（type）指对响应数据的提取方法：
     * - arrayBuffer
     * - blob
     * - formData
     * - json       默认类型
     * - text
     * @data: 请求配置对象（init）
     * @param  {String|URL} url 远端处理器
     * @param  {String} type 获取的数据类型名，可选
     * @return {Promise<[type]>}
     */
    GET( evo, url, type = 'json' ) {
        return fetch( url, evo.data )
            .then( resp => resp.ok ? resp[type]() : Promise.reject(resp.statusText) );
    },

    __GET: -1,


    /**
     * 数据递送。
     * 目标：暂存区/栈顶1项。
     * 与GET方法不同，流程数据（暂存区项）是必须的。
     * 数据类型名指的是发送而非获取（如GET），提取返回的响应数据需要进一步调用其方法（见上）。
     * 注意：
     * 如果配置对象中已经存在headers属性，则忽略type实参。
     * 如果提交的数据为 FormData，此时不需要type实参，应当将其设置为null。
     * 注记：
     * 默认发送数据类型为JSON，这是Tpb逻辑的偏好鼓励。
     * @data: 请求配置对象（init）
     * @param  {String|URL} url 远端处理器
     * @param  {String} type 发送数据的类型，可选
     * @return {Promise<Response>}
     */
    POST( evo, url, type = 'application/json' ) {
        let _cfg = evo.data;

        if ( !_cfg.headers && type ) {
            _cfg.headers = new Headers( {'Content-Type': type} );
        }
        _cfg.method = 'POST';

        return fetch( url, _cfg ).then( resp => resp.ok ? resp : Promise.reject(resp.statusText) );
    },

    __POST: 1,

};



//
// 预处理&导出。
//////////////////////////////////////////////////////////////////////////////


// 绑定：this固化。
// @proto: Get < Process < Control
const By = $.proto(
    $.assign( {}, _By, bindMethod ),
    Get
);

export { By };