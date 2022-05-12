//! $ID: config.js 2022.05.12 Tpb.Config $
// +++++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.5.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2021 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  Tpb 框架全局配置。
//
///////////////////////////////////////////////////////////////////////////////
//

import { tplRoot } from "./user.js";
import { Loader, TplLoader } from "./tools/tloader.js";


//
// 系统配置：谨慎修改。
//////////////////////////////////////////////////////////////////////////////

const
    DEBUG = true,

    Version = 'v0.5.0',

    // 本系模板管理器名称
    // 上级应用默认的模板系名称用一个空串表示。
    TplrName = '',

    // 事件名：ID分隔符。
    // 用于bind()|once()|unbind()中事件名ID的分离提取。
    evnidDlmt = ':',

    // 模板映射集配置
    // 相对于上面的 tplRoot 根路径。
    tplMaps = 'maps.json';



//
// 共享配置：请勿修改。
//////////////////////////////////////////////////////////////////////////////


const
    // 指令属性：自动取栈数量
    EXTENT = Symbol( 'stack: want-items' ),

    // 指令属性：需操作数据栈（特权）
    ACCESS = Symbol( 'stack: accessible' ),

    // jump指令标记。
    // 用于指令解析时判断赋值原始next。
    JUMPCELL = Symbol( 'set: jump Cell' ),

    // 设置前阶指令标记。
    // 主要用于To.Next:lone指令。
    PREVCELL = Symbol( 'set: prev Cell'),

    // Update流程控制标记
    // 用于在To:Update段条件终止执行流。
    UPDATEX  = Symbol( 'chain: update-control'),

    // 调用链头实例标记。
    // 用于链头中存储事件名定义实例（Evn）
    HEADCELL = Symbol( 'chain: first-cell' ),

    // 全局变量空间。
    Globals = new Map(),

    // 关联数据空间。
    // Element: Map{ String: Value }
    DataStore = new WeakMap(),

    // 预定义调用链存储。
    // 与元素关联，便于分组管理。
    // { Element: Map{evnid:String: chain:Cell} }
    ChainStore = new WeakMap(),

    // 本系模板载入器。
    TLoader = new TplLoader( '', new Loader(tplRoot) ),

    // 模板管理器池。
    // 每一个独立模板系列对应一个模板管理器。
    // { name:String: Templater }
    TplsPool = new Map();



/**
 * 存储本系模板管理器。
 * @param  {Templater} tplr 模板管理器
 * @return {Templater} tplr
 */
const tplInit = tplr => TplsPool.set( TplrName, tplr ) && tplr;



//
// 导出。
///////////////////////////////////////////////////////////////////////////////


export {
    DEBUG,
    Version,
    TplrName,
    evnidDlmt,
    tplMaps,
    EXTENT,
    ACCESS,
    JUMPCELL,
    PREVCELL,
    UPDATEX,
    HEADCELL,
    Globals,
    DataStore,
    ChainStore,
    TLoader,
    TplsPool,
    tplInit,
};


//
// 供统一引用。
//
export default window.$;
