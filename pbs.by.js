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

import $, { Web } from "./config.js";
import { bindMethod } from "./base.js";
import { Get } from "./pbs.get.js";

import { Render } from "./tools/render.js";


const
    // 请求根路径。
    pullRoot = new URL( Web.pulls, Web.base );


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
     * 暂存区的流程数据会作为查询串上传。
     * 注记：
     * 大写的名称以突出有网络行为。
     * @data: [[key, value]]|{key: value}
     * @param  {String} path 远端处理器，可选
     * @return {Promise<json>}
     */
    GET( evo, path = 'index' ) {
        let _url = `${pullRoot}/${path}`;

        if ( evo.data != null ) {
            _url += '?' + new URLSearchParams(evo.data);
        }
        return fetch(_url).then(
            resp => resp.ok ? resp.json() : Promise.reject(resp.statusText)
        );
    },

    __GET: -1,


    /**
     * 数据递送。
     * 目标：暂存区全部数据可选。
     * 目标作为提交的数据集。
     * @param  {String} path 远端处理器
     * @param  {String} 提交数据的编码方法，可选
     * @return {Promise<json>}
     */
    POST( evo, path, enctype ) {
        //
    },

    __POST: 0,

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