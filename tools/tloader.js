// $ID: tloader.js 2019.09.02 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  Loader 远端数据载入器
//  --------------------
//  实现 Promise<...> 数据的临时缓存，避免短时间内的重复请求。
//  如果全部载入完毕，可以调用.clear()清空缓存。或者在新的请求阶段前clear。
//
//
//  TplLoader 模板节点载入器
//  -----------------------
//  载入模板根目录下的模板文件。
//  用于 Tpb:Templater 中即时载入尚未缓存的模板节点。
//
//
//  用法：
//  let loader = new TplLoader(...);
//  const tpl = new Templater( ..., loader.load.bind(loader) );
//
//  注：
//  可以实时添加新的映射（.config(...)），使得模板节点的自动载入持续有效。
//
//
///////////////////////////////////////////////////////////////////////////////
//

const $ = window.$;


export class Loader {
    /**
     * 末尾应当包含/
     * @param {String} base Web路径根
     */
    constructor( base ) {
        // URL请求根
        this._base = base;

        // 已载入暂存。
        // 避免短时间内的重复请求。
        // {url: Promise}
        this._pool = new Map();
    }


    /**
     * 载入JSON文件。
     * @param  {String|URL} file 文件名/URL
     * @return {Promise<json>}
     */
    json( file ) {
        return this._load( this.url(file), 'json' );
    }


    /**
     * 载入普通文件。
     * @param  {String|URL} file 文件名/URL
     * @return {Promise<String>}
     */
    text( file ) {
        return this._load( this.url(file), 'text' );
    }


    /**
     * 载入HTML源码并构造为文档片段。
     * @param  {String|URL} file 文件名/URL
     * @return {Promise<DocumentFragment>}
     */
    node( file ) {
        return this._load( this.url(file), 'text', true );
    }


    /**
     * 获取Blob数据。
     * @param  {String|URL} file 文件名/URL
     * @return {Promise<Blob>}
     */
    blob( file ) {
        return this._load( this.url(file), 'blob' );
    }


    /**
     * 获取formData数据。
     * @param  {String|URL} file 文件名/URL
     * @return {Promise<fromData>}
     */
    formData( file ) {
        return this._load( this.url(file), 'formData' );
    }


    /**
     * 获取arrayBuffer数据。
     * @param  {String|URL} file 文件名/URL
     * @return {Promise<fromData>}
     */
    arrayBuffer( file ) {
        return this._load( this.url(file), 'arrayBuffer' );
    }


    /**
     * 获取URL根。
     * @return {String}
     */
    base() {
        return new URL('', this._base).href;
    }


    /**
     * 清空缓存池。
     * @return {void}
     */
    clear() {
        this._pool.clear();
    }


    /**
     * 清理文件承诺池。
     * 如果数据已经获取则可以清除以节省内存。
     * @param  {String|URL} file 文件名/URL
     * @return {Boolean} 是否成功清除
     */
    clean( file ) {
        return this._pool.delete( this.url(file).href );
    }


    /**
     * 获取文件URL（全路径）。
     * @param  {String|URL} file 文件名/URL
     * @return {URL} 资源定位实例
     */
    url( file ) {
        return typeof file == 'string' ? new URL( file, this._base ) : file;
    }


    // -- 私有辅助 ---------------------------------------------------------------


    /**
     * 载入目标数据。
     * type: "json|text|formData|blob|arrayBuffer|node"
     * @param  {URL} url 目标URL
     * @param  {String} type 载入类型
     * @param  {Boolean} node 构造为文档片段，可选
     * @return {Promise<...>}
     */
    _load( url, type, node ) {
        let _pro = this._pool.get(url.href);

        if ( !_pro ) {
            _pro = this._fetch( url, type, node );
            this._pool.set( url.href, _pro );
            //:debug
            window.console.log(`loading for "${url}"`);
        }
        return _pro;
    }


    /**
     * 拉取目标数据。
     * @param  {URL} url 目标URL
     * @param  {String} type 载入类型
     * @param  {Boolean} node 构造为文档片段，可选
     * @return {Promise<...>}
     */
    _fetch( url, type, node ) {
        let _pro = fetch(url).then(
                resp => resp.ok ? resp[type]() : Promise.reject(resp.statusText)
            );
        return node ? _pro.then( html => $.fragment(html) ) : _pro;
    }

}


//
// 模板节点载入器。
// 专用于Tpb的模板节点载入（节点名与文件名相互关联）。
//
export class TplLoader {
    /**
     * @param {String} dir 模板根目录
     * @param {Loader} loader URL载入器
     */
    constructor( dir, loader ) {
        this._loader = loader;

        if ( dir && !dir.endsWith('/') ) {
            dir += '/';
        }
        this._path = loader.base() + dir;

        // 文件名:节点名集
        // { file-name: [tpl-name] }
        this._fmap = new Map();

        // 节点名:文件名
        // { tpl-name: file-name }
        this._tmap = new Map();
    }


    /**
     * 模板节点映射集配置。
     * 映射文件名可以是字符串，相对于URL根。
     * 也可以是URL实例，此时为全路径。
     * 可以传递一个现成的配置对象，格式：{file: [tpl-name]}
     * @param  {String|URL|Object} maps 映射文件或配置对象
     * @return {Promise<Map>}
     */
    config( maps ) {
        if ( $.type(maps) == 'Object' ) {
            return Promise.resolve( this._config(maps) );
        }
        return this._loader.json( this.url(maps) ).then( cfg => this._config(cfg) );
    }


    /**
     * 载入节点（组）。
     * 如果已经载入，返回缓存的承诺对象。
     * 注记：
     * 由后续在单线程中处理重复解析的问题。
     * @param  {String} name 节点名称
     * @return {Promise<[DocumentFragment, String]>} 承诺对象
     */
    load( name ) {
        let _file = this._tmap.get( name );

        if ( !_file ) {
            return Promise.reject( `err: [${name}] not in any file.` );
        }
        // 附带文件名返回以完整化信息。
        return this._loader.node( this.url(_file) ).then( frg => [frg, _file] );
    }


    /**
     * 载入目标文件。
     * 主要用于元素上 obt-src 属性处理（引用json文件）。
     * 注：路径相对于模板根目录。
     * @param  {String} path 目标文件路径
     * @return {Promise<json>}
     */
    json( path ) {
        return this._loader.json( this.url(path) );
    }


    /**
     * 获取节点名集。
     * @return {[String]}
     */
    names() {
        return [ ...this._tmap.keys() ];
    }


    /**
     * 清空配置集。
     * 需在下一次编译（Tpb.build）之前执行。
     * @return {void}
     */
    clear() {
        this._tmap.clear();
        this._fmap.clear();
    }


    /**
     * 清理模板文件的关联配置。
     * 应当在文档片段内的全部模板节点编译完成之后执行。
     * - 节点名到模板文件名的映射（._tmap）。
     * - 模板文件名到节点名集的条目（._fmap）。
     * @param  {String} file 模板文件名
     * @return {void}
     */
    clean( file ) {
        let _list = this._fmap.get( file );

        if ( _list ) {
            _list.forEach( tn => this._tmap.delete(tn) );
        }
        this._fmap.delete( file );

        // 载入器清理，因为对应文档片段已使用完毕。
        this._loader.clean( this.url(file) );
    }


    /**
     * 获取文件URL（全路径）。
     * @param  {String|URL} file 文件名/URL
     * @return {URL} 资源定位实例
     */
    url( file ) {
        return typeof file == 'string' ? new URL( file, this._path ) : file;
    }


    // -- 私有辅助 ---------------------------------------------------------------


    /**
     * 设置节点/文件映射配置。
     * map: {文件名: [节点名]}
     * 转换为：{节点名: 文件名}
     * @param  {Object} map 映射配置
     * @return {Map} 节点名/文件名映射集
     */
    _config( map ) {
        for ( const [file, names] of Object.entries(map) ) {
            names.forEach(
                name => this._tmap.set( name, file )
            );
            this._fmap.set( file, names );
        }
        return this._tmap;
    }
}
