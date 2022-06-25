// $ID: templater.js 2019.09.02 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2021 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  模板管理器。
//
//  提取文档内定义的模板节点，解析构建OBT逻辑和渲染配置并存储节点供检索。
//  如果DOM中有子模版配置，会实时导入并解析存储。
//
//  解析顺序：
//      1. 导入根模板节点。
//      2. 解析OBT配置，构建调用链并绑定。
//      3. 解析渲染文法（Render.parse）。
//      4. 如果有模板中包含子模版，导入并解析之。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { Render } from "./render.js";


const
    $ = window.$,

    // OBT属性名定义
    OBTA = {
        on:     'on',
        by:     'by',
        to:     'to',
        src:    'obt-src',
    },

    // 子模板分隔符
    // 注：tpl-node/source可定义多个子模板引用。
    __loadSplit = ',',

    // 取出标记字符。
    // 适用 tpl-source 语法。
    __flagPick  = '~',

    // 绑定的事件处理器一起克隆标记。
    // 适用 tpl-node 语法。
    __flagBound = '!',

    // 特性名定义。
    __tplName   = 'tpl-name',   // 模板节点命名
    __tplNode   = 'tpl-node',   // 模板节点引入（克隆）
    __tplSource = 'tpl-source', // 模板节点引入（原始）

    // 模板添加完成事件。
    __tplDone   = 'tpled',

    // 选择器。
    __nameSlr   = `[${__tplName}]`,
    __nodeSlr   = `[${__tplNode}], [${__tplSource}]`,

    // OBT属性选择器
    __obtSlr    = `[${OBTA.on}], [${OBTA.src}]`;



class Templater {
    /**
     * 创建实例。
     * @param {Builder} obter OBT构建器
     * @param {TplLoader} loader 模板载入器
     * @param {Map} buf 共享节点存储区，可选
     */
    constructor( obter, loader, buf ) {
        this._obter = obter;
        this._loader = loader;
        this._tpls = buf || new Map();

        // 临时存储（就绪后移除）
        this._tplx = new Map();  // 有子模版的模板节点 {name: Promise}
        this._pool = new Map();  // 载入的文档片段承诺 {root: Promise}
    }


    /**
     * 获取模板节点（原始）。
     * 如果模板不存在会自动载入。
     * @param  {String} name 模板名
     * @return {Promise<Element>} 承诺对象
     */
    get( name ) {
        let _tpl = this._tpls.get( name );

        if ( _tpl ) {
            return Promise.resolve( _tpl );
        }
        return this._tplx.get( name ) || this._load( name );
    }


    /**
     * 返回既有模板节点。
     * 需确信模板节点已经添加到内部存储，
     * 并且该节点的内部子节点已经就绪（tpl-node|source 完成）。
     * @param  {String} name 节点名
     * @return {Element|null}
     */
    node( name ) {
        let _tpl = this._tpls.get( name );

        if ( !_tpl ) {
            window.console.warn( `[${name}] template not found.` );
            return null;
        }
        return _tpl;
    }


    /**
     * 克隆模板节点。
     * 如果模板不存在，会自动尝试载入。
     * 克隆包含渲染文法。
     * @param  {String} name 模板名
     * @param  {Boolean} bound 包含绑定的事件处理器，可选
     * @return {Promise<Element>} 承诺对象
     */
    clone( name, bound ) {
        return this.get( name ).then( el => this._clone(el, bound) );
    }


    /**
     * 移除模板。
     * 这是不可逆的，移除之后的节点不会因.get()而重新引入。
     * 可用于存储集清理或精简。
     * @param  {String} name 模板名
     * @return {Element|null} 被移除的模板
     */
    del( name ) {
        let _tpl = this._tpls.get( name );

        if ( _tpl ) {
            this._tpls.delete( name );
        }
        return _tpl || null;
    }


    /**
     * 清空模板存储集。
     * @return {void}
     */
    clear() {
        this._tpls.clear();
    }


    /**
     * 模板构建。
     * file仅在实时导入时有意义，
     * 用于清除文件对应的模板节点配置（载入&解析完毕后）。
     * @param  {Element|Document|DocumentFragment} root 构建目标
     * @param  {String} file 文档片段对应的文件名，可选
     * @return {Promise<this:Templater>}
     */
    build( root, file ) {
        return this._build( root, file ).then( () => this );
    }


    /**
     * 提取命名的模板节点。
     * 检查不在命名模版节点内的子模版导入配置。
     * @param  {Element|DocumentFragment} root 根容器
     * @return {[Promise<void>]}
     */
    tpls( root ) {
        // 先提取命名模板。
        for ( const tpl of $.find(__nameSlr, root, true) ) {
            this.add( tpl );
            // 可用于即时移除节点（脱离DOM）。
            $.trigger( tpl, __tplDone, null, false, false );
        }
        // 模板外的导入处理。
        let _ps = this._subs( root );

        return _ps ? Promise.all(_ps) : Promise.resolve();
    }


    /**
     * 添加模板节点。
     * 元素应当包含tpl-name特性值。
     * @param  {Element} tpl 模板节点元素
     * @return {void}
     */
    add( tpl ) {
        let _name = $.xattr( tpl, __tplName ),
            _subs = this._subs( tpl );

        if ( !_subs ) {
            return this._add( _name, tpl );
        }
        let _pro = Promise.all( _subs )
            .then( () => this._add(_name, tpl) )
            .then( () => this._tplx.delete(_name) && tpl );

        this._tplx.set( _name, _pro );
    }


    /**
     * 配置模板节点映射。
     * 即配置内部的模板节点载入器本身。
     * 注记：
     * 模板管理器与节点配置紧密相关，所以应当可以在此配置。
     * @param  {String|URL|Object} maps 映射文件或配置对象
     * @return {Promise<this>}
     */
    config( maps ) {
        // 容错无配置值
        return this._loader.config( maps || {} ).then( () => this );
    }


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 模板构建。
     * 元素实参主要用于初始或手动调用。
     * 系统自动载入并构建时，实参为文档片段，此时file实参存在。
     * 注记：
     * 参数file仅用于清理自动载入器内的配置存储。
     * @param  {Element|Document|DocumentFragment} root 构建目标
     * @param  {String} file 文档片段对应的文件名，可选
     * @return {Promise<Boolean>}
     */
    _build( root, file = false ) {
        if ( this._pool.has(root) ) {
            return this._pool.get(root);
        }
        // 注记：
        // 先从总根构建OBT后再处理子模版可以节省解析开销，
        // 否则子模板克隆会直接复制OBT特性，相同值重复解析。
        let _pro = this._buildx( root )
            .then( () => this.tpls(root) )
            .then( () => this._pool.delete(root) )
            // 配置清理节约内存。
            .then( () => file && !this._loader.clean(file) );

        this._pool.set( root, _pro );

        return Render.parse( root ) && _pro;
    }


    /**
     * 安全添加。
     * 抛出错误以及时发现问题。
     * 可能由于存在重复的模板名而出现，
     * 也可能由于 文件:模板 配置错误重复载入而出现。
     * @param  {String} name 模板名
     * @param  {Element} tpl 模板节点
     * @return {void}
     */
    _add( name, tpl ) {
        if ( this._tpls.has(name) ) {
            throw new Error( `[${name}] node was exist.` );
        }
        this._tpls.set( name, tpl );
    }


    /**
     * 载入模板节点。
     * @param  {String} name 模板名
     * @return {Promise<Element>}
     */
    _load( name ) {
        return this._loader.load( name )
            .then( ([fg, file]) => this._build(fg, file) )
            .then( () => this._tpls.get(name) || this._tplx.get(name) );
    }


    /**
     * 克隆模板节点。
     * - 渲染文法（如果有）会被无条件克隆。
     * - 是否克隆事件处理器由bound实参控制。
     * @param  {Element} tpl 原模板节点
     * @param  {Boolean} bound 包含绑定的事件处理器，可选
     * @return {Element} 克隆的新节点
     */
    _clone( tpl, bound ) {
        return Render.clone(
            tpl,
            $.clone( tpl, bound, true, bound )
        );
    }


    /**
     * 解析/载入子模板。
     * 即处理 tpl-node/tpl-source 两个指令。
     * @param  {Element|DocumentFragment} root 根容器
     * @return {[Promise<void>]} 子模版载入承诺集
     */
     _subs( root ) {
        let _els = $.find(__nodeSlr, root, true);

        if ( _els.length === 0 ) {
            return null;
        }
        return $.map( _els, el => this._imports(el) );
    }


    /**
     * 取出模板节点。
     * 如果模板节点已经不存在，会导致 .get() 重新导入，
     * 此时节点对应文件的映射已经清除，因此会因无配置而出错。
     * 因此取出是不可逆操作。
     * @param  {String} name 模板名
     * @return {Promise<Element>}
     */
    _pick( name ) {
        return this.get( name ).then(
            el => ( this._tpls.delete(name) || this._tplx.delete(name) ) && el
        );
    }


    /**
     * 导入元素引用的子模版。
     * 子模版定义可以是一个逗号分隔的列表（有序）。
     * @param  {Element} el 配置元素
     * @return {Promise<void>}
     */
    _imports( el ) {
        let [meth, val] = this._reference(el),
            _bound = false;

        if ( val[0] === __flagBound ) {
            _bound = true;
            val = val.substring( 1 );
        }
        return Promise.all(
            // 多余的_bound无副作用。
            val.split(__loadSplit).map( n => this[meth](n.trim(), _bound) )
        )
        // $.replace
        // tQuery:nodeok 定制事件可提供初始处理机制。
        .then( els => $.replace( el, els) )
    }


    /**
     * 获取节点引用。
     * tpl-node优先于tpl-source，两者不应同时配置。
     * 取出标识符^用在tpl-node上无效，它会被简单忽略掉。
     * 返回取值方法名和配置值。
     * @param  {Element} el 配置元素
     * @return {[method, value]}
     */
    _reference( el ) {
        let _n = el.hasAttribute(__tplNode) ? __tplNode : __tplSource,
            _v = $.xattr(el, _n).trim(),
            _f = 'get';

        if ( _v[0] === __flagPick ) {
            _f = '_pick';
            _v = _v.substring( 1 );
        }
        return [ _n == __tplNode ? 'clone' : _f, _v ];
    }


    /**
    * 节点树OBT构建。
    * 仅OBT处理，不包含渲染语法的解析。
    * @param  {Element|DocumentFragment} root 根节点
    * @return {Promise<void>}
    */
    _buildx( root ) {
        let _buf = [];

        for ( const el of $.find(__obtSlr, root, true) ) {
            _buf.push(
                obtAttr( el, this._loader )
                .then( obts => obts.forEach(obt => this._obter.build(el, obt)) )
            );
        }
        return Promise.all( _buf );
    }
}


//
// OBT定义提取和处理
//////////////////////////////////////////////////////////////////////////////


const
    // obt-src并列分隔符。
    // 各部分路径独立（都相对于根路径）。
    __sepPath = ',',

    // OBT名称序列。
    __obtName = `${OBTA.on} ${OBTA.by} ${OBTA.to} ${OBTA.src}`;


/**
 * 取OBT特性值。
 * @param  {Element} el 取值元素
 * @return {Object3}
 */
function _obtattr( el ) {
    return {
        on: $.attr( el, OBTA.on ) || '',
        by: $.attr( el, OBTA.by ) || '',
        to: $.attr( el, OBTA.to ) || '',
    };
}


/**
 * 从远端载入OBT配置。
 * 支持逗号分隔的多目标并列导入，如：obt-src="obts/aaa.json, obts/bbb.json"。
 * 路径相对于模板载入器内的根目录。
 * @param  {String} src 源定义
 * @param  {TplLoader} loader 模板载入器
 * @return {[Promise<Object3|[Object3]>]}
 */
function _obtjson( src, loader ) {
    return src
        .split( __sepPath )
        .map( path => loader.json(path.trim()) );
}


/**
 * 获取目标元素的OBT配置。
 * - 本地配置优先，因此会先绑定本地定义。
 * - 会移除元素上的OBT配置属性，如果需要请预先取出。
 * - 外部配置JSON中支持OBT对象数组，因此需要再展开。
 * 注意：
 * 如果需要解析obt-src特性，需要传递模板载入器loader。
 * @param  {Element} el 目标元素
 * @param  {TplLoader} loader 模板载入器，可选
 * @return {Promise<[Object3]>} OBT配置集（[{on, by, to}]）
 */
function obtAttr( el, loader ) {
    let _buf = [];

    // 本地配置先处理。
    if ( el.hasAttribute(OBTA.on) ) {
        _buf.push( _obtattr(el) );
    }
    // 外部配置。
    if ( el.hasAttribute(OBTA.src) ) {
        _buf.push( ..._obtjson($.attr(el, OBTA.src), loader) )
    }
    $.removeAttr( el, __obtName );

    return Promise.all( _buf ).then( obts => obts.flat() );
}


//
// 导出。
//////////////////////////////////////////////////////////////////////////////


export { Templater, obtAttr };
