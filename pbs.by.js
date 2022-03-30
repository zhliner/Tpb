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
import { Util } from "./tools/util.js";


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
     * 如果传入box，脚本元素插入其内部末尾（并保留）。
     * 支持box传入选择器即时检索目标容器，选择器支持二阶检索（以当前绑定元素为起点）。
     * 如果未传入box，脚本容器为<head>且会即时删除。
     * @data: String|Object 脚本代码或配置对象
     * @param  {String|Element} box 容器元素或其选择器，可选
     * @return {Element|Promise<Element>}
     */
    script( evo, box ) {
        if ( typeof box === 'string' ) {
            box = Util.find( box, evo.delegate, true );
        }
        return $.script( evo.data, box );
    },

    __script: 1,


    /**
     * 在当前DOM中插入样式元素
     * 如果传入next，则插入其前面，否则插入<head>内末尾。
     * 如果next是选择器，支持二阶查询（以当前绑定元素为起点）。
     * @data: String|Object 样式代码或配置对象
     * @param  {String|Element} next 参考元素或其选择器，可选
     * @return {Element|Promise<Element>}
     */
    style( evo, next ) {
        if ( typeof next === 'string' ) {
            next = Util.find( next, evo.delegate, true );
        }
        return $.style( evo.data, next );
    },

    __style: 1,


    /**
     * 载入外部资源。
     * 如果data已经是一个元素则直接插入，
     * 否则data视为配置对象构建一个<link>元素插入。
     * 仅用于可触发 load 事件的元素（如<img>）。
     * @data: Object|Element 配置对象或游离元素
     * @param  {Node} next 插入参考位置（下一个节点）
     * @param  {Element} box 插入的目标容器，可选
     * @return {Promise<Element>} 载入承诺
     */
    loadin( evo, next, box ) {
        return $.loadin( evo.data, next, box );
    },

    __loadin: 1,


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