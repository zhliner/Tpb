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
     * @data: Element
     * @param  {Object|Value|[Value]} vals 渲染数据
     * @return {Element} 被渲染节点
     */
    render( evo, data ) {
        return Render.update( evo.data, data );
    },

    __render: 1,


    /**
     * 在当前DOM中插入脚本。
     * @data: Element box 容器元素，可选
     * @param  {String|Object} data 脚本代码或配置对象
     * @return {Element|Promise<Element>}
     */
    script( evo, data ) {
        return $.script( data, evo.data );
    },

    __script: -1,


    /**
     * 在当前DOM中插入样式元素
     * @data: Element Next 参考元素，可选
     * @param  {String|Object} data 样式代码或配置对象
     * @return {Element|Promise<Element>}
     */
    style( evo, data ) {
        return $.style( data, evo.data );
    },

    __style: -1,


    /**
     * 数据获取。
     * 目标：暂存区1项可选。
     * 数据类型名（type）指对响应数据的提取方法：
     * - json
     * - text
     * - arrayBuffer
     * - blob
     * - formData
     * @data: 请求配置对象（init）
     * @param  {String} type 获取的数据类型名
     * @param  {String|URL} url 远端资源定位
     * @return {Promise<[type]>}
     */
    GET( evo, type, url ) {
        let _cfg = evo.data || {};
        _cfg.method = 'GET'

        return fetch( url, _cfg )
            .then( resp => resp.ok ? resp[type]() : Promise.reject(resp.statusText) );
    },

    __GET: -1,


    /**
     * 数据递送。
     * 目标：暂存区/栈顶1项。
     * 与GET方法不同，流程数据（暂存区项）是必须的。
     * 数据类型名指的是发送而非获取（如GET），提取返回的响应数据需要进一步调用其方法（见上）。
     * cfg参考：{
     *      application/json    JSON 数据
     *      text/html           HTML 源码文本
     *      text/plain          纯文本内容
     *      Object              定制配置对象
     *      undefined           FormData，默认
     * }
     * @data: 待发送的数据
     * @param  {String|URL} url 远端处理器
     * @param  {String|Object} cfg 发送数据的类型或配置对象
     * @return {Promise<Response>}
     */
    POST( evo, url, cfg = {} ) {
        if ( typeof cfg === 'string' ) {
            cfg = {
                headers: new Headers({ 'Content-Type': cfg })
            }
        }
        cfg.method = 'POST';
        cfg.body = evo.data;

        return fetch( url, cfg ).then( resp => resp.ok ? resp : Promise.reject(resp.statusText) );
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