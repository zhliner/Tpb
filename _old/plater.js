/* $Id: plater.js 2017.02.16 Tpb.Tools $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@project: Teas v0.3.2
				@author:  风林子 zhliner@gmail.com
*******************************************************************************

	文件式板块载入器。
	多级板块用多级子目录表达。

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( $, T ) {
	/**
	 * 获取板块根目录。
	 * @param  {Object} dir 系统目录配置
	 * @return {String}
	 */
	const Root = dir => dir.setup + '/' + dir.plate;

	//
	// 固定名称配置。
	//
	const
		mainFile = 'main.js',  		// 默认脚本名
		confList = '_list.json'; 	// 清单配置（JSON:数组）


//
// 板块载入器（文件系统）
// 文件系统类实现，板块的子级分层采用子目录。
// - 记忆已载入板块名称，不重复载入；
// - 板块路径大小写等同，默认清单文件名为小写；
// - 清单文件用于配置板块库文件的顺序载入（含板块文件本身）；
//
class FilePlater {
	/**
	 * @param {String} list 板块清单文件名
	 */
	constructor() {
		this._loader = new T.Kits.Loader( Root(T.Config.dir) );
		// 已载入缓存
		// { file: Promise }
		this._pool = new Map();
	}


	/**
	 * 载入板块关联文件。
	 * - 板块路径可能为多级子目录，大小写等同；
	 * @param  {Array} team 板块名序列
	 * @return {Promise} 承诺对象
	 */
	load( team ) {
		let _path = team.join('/');

		if (!this._pool.has(_path)) {
			this._pool.set(
				_path,
				this.list(_path).then( fs => this._loader.scripts(fs) )
			);
		}
		return this._pool.get(_path);
	}


	/**
	 * 获取板块清单。
	 * - 无清单文件时，默认文件构造入清单；
	 * - 返回的清单里的文件已包含分组路径；
	 * @param  {String} path 板块路径
	 * @return {Promise} 清单（承诺）
	 */
	list( path ) {
		return this._loader.fetch( `${path}/${confList}` )
		.then(
			resp => resp.json(),
			// 无清单文件
			// 默认文件名构造为清单
			() => [ mainFile ]
		)
		.then( list => list.map( f => `${path}/${f}`) );
	}
}



//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.Plater = FilePlater;


})( tQuery, Tpb );