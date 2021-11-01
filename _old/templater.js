/* $Id: templater.js 2016.12.21 Tpb.Tools $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@project: Teas v0.3.2
				@author:  风林子 zhliner@gmail.com
*******************************************************************************

	文件式模板管理器。
	实现模板的实时导入和解析，会处理本地化。


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( $, T ) {
	/**
	 * 获取模板根目录。
	 * @param  {Object} dir 系统目录配置
	 * @return {String}
	 */
	const Root = dir => dir.setup + '/' + dir.template;


//
// 文件式模板管理器。
//
class FileTpl extends T.TplBase {
	/**
	 * @param {Function} obter OBT解析回调
	 * @param {Localer} l10n 本地化处理器实例
	 */
	constructor( obter, l10n ) {
		super(obter);

		this._tfile = new TFile(
			Root( T.Config.dir ), l10n
		);

		// 已载入缓存
		// { file: Promise }
		this._pool = new Map();

		// 节点组属集
		// { tpl-name: file }
		this._team = Object.create(null);

		// 初始处理
		// 节点名：所属组映射
		this._init( T.Config.loadMap );
	}


	/**
	 * 重载：载入节点组并提取目标节点。
	 * - 如果已经载入，返回的是缓存的承诺对象；
	 * then参数：目标节点
	 * @param  {String} team 节点组名称
	 * @param  {String} name 节点名称
	 * @return {Promise} 承诺对象
	 */
	load( name ) {
		let _file = this.team(name);

		if (!_file) {
			return Promise.reject(`${name} not in any file.`);
		}
		if (!this._pool.has(_file)) {
			this._pool.set(
				_file, this._load(_file, name)
			);
			console.log(`${_file} loaded with ${name}`);
		}
		return this._pool.get(_file);
	}


	/**
	 * 设置/提取节点所属组名。
	 * - 可以无参数调用获取组定义属性名；
	 * @param  {String} name 节点名
	 * @param  {String} file 节点组文件名
	 * @return {String}
	 */
	team( name, file ) {
		if (file === undefined) {
			return this._team[name] || null;
		}
		this._team[name] = file;
	}


	//-- 私有辅助 -----------------------------------------------------------------


	/**
	 * 初始化。
	 * 配置“节点名:所属组”基础数据。
	 * @param {Object} map “组:节点名”映射集
	 */
	_init( map ) {
		if (! map) return;

		for ( let [f, els] of Object.entries(map) ) {
			// jshint loopfunc: true
			els.forEach( tpl => this.team(tpl, f) );
		}
	}


	/**
	 * 载入节点组并提取目标节点。
	 * then参数：目标节点
	 * @param  {String} file 节点组所在文件名
	 * @param  {String} name 目标节点名
	 * @return {Promise} 承诺对象
	 */
	_load( file, name ) {
		return this._tfile.load(file)
			.then( els => {
				els.forEach( e => this.build(e) );
				return this.get(name, true);
			});
	}

}


//
// 模板文件类。
// 解析提取模板文件顶层元素集，同时本地化。
//
class TFile {
	/**
	 * @param {String} root 模板根路径
	 * @param {Localer} l10n 本地化处理器实例
	 */
	constructor( root, l10n ) {
		this._l10n = l10n;
		// 载入器
		this._loader = new T.Kits.Loader(root);
	}


	/**
	 * 载入模板文件。
	 * then参数：顶层元素集；
	 * @param  {String} file 模板文件
	 * @return {Promise} 承诺对象
	 */
	load( file ) {
		return this._loader.fetch(file)
			.then( response => response.ok && response.text() )
			.then( html => this._parse( this._localize(html) ) );
	}


	//-- 私有辅助 -----------------------------------------------------------------


	/**
	 * 本地化翻译。
	 * @param  {String} text 格式文本
	 * @return {String} 翻译后的文本
	 */
	_localize( text ) {
		return this._l10n ? this._l10n.localize(text) : text;
	}


	/**
	 * 解析模板源码。
	 * @param  {String} html 模板源码
	 * @return {Array}
	 */
	_parse( html ) {
		return Array.from( $.create(html).children );
	}

}



//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.Templater = new FileTpl();


})( tQuery, Tpb );