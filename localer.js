/* $Id: localer.js 2016.12.21 Tpb.Tools $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@project: Teas v0.3.1
				@author:  风林子 zhliner@gmail.com
*******************************************************************************

	本地化处理器（Tpb.Localer）。
	使用时，每种语言需要一个处理器实例。

	可以设置一个备用语言翻译集（自行管理），以构造一种中转模式
	——即键不是原文，而是简短的标识串。这可用于大篇幅文档的本地化。
	（默认，键本身在模板中，书写为原文）

	中转模式：
		当原文更新时，一般会同步更新模板中的索引键（如附加日期），
		因此其它语言的翻译自动失效，从而引用原文。
		这便于立即发现，促进译文的更新，体现有效性。

	链式机制：
		如果备用Localer也包含其自身的备用Localer，
		则会形成按语言优先级递进的链式检索（其翻译集也需预先载入）。


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( $, T ) {
	/**
	 * 获取本地化根目录。
	 * @param  {Object} dir 系统目录配置
	 * @return {String}
	 */
	const Root = dir => dir.setup + '/' + dir.locale;

	// 本地化段匹配
	// {{ abc }} 首尾空白忽略
	const __rePhrase = /[\\]?\{\{\s*([^]+?)\s*\}\}/g;



class Localer {
	/**
	 * 构造一个本地化处理器。
	 * @param {String} lang 目标语言
	 * @param {Localer} spare 备用语言翻译集
	 */
	constructor( lang, spare ) {
		let _cfg = T.Config;

		// 全局数据域
		this._data = _cfg.DATA;

		this._loader = new T.Kits.Loader(
			Root( _cfg.dir ) + '/' + (lang || _cfg.language)
		);
		// 翻译集存储
		// { 原文: 译文 }
		this._l10n = Object.create(null);

		// 备用Localer
		this._more = spare;

		// 已载入存储
		// { file: Promise }
		this._pool = new Map();
	}


	/**
	 * 载入目标翻译集。
	 * - 翻译集文件为JSON格式，路径相对于当前语言；
	 * - 返回的承诺对象的then参数为当前实例；
	 *   然后可直接调用.localize(...)。
	 * @param  {String} file 翻译文件（不含扩展名）
	 * @return {Promise} 承诺对象
	 */
	load( file ) {
		if (!this._pool.has(file)) {
			this._pool.set(
				file,
				this._loader.fetch(file + '.json')
				.then( resp => resp.json() )
				.then( json => (this.extend(json), this) )
			);
		}
		return this._pool.get(file);
	}


	/**
	 * 源码本地化。
	 * - 需要转换翻译的文本被包括在“{{”和“}}”内；
	 * - 如果翻译集中无对应项，保留去除括号的原始文本；
	 * - 如果前置一个反斜线，括号内容不被解析；
	 *
	 * 支持ES6中的模板字符串，但首尾需用``包围（模板字符串格式）。
	 * 例：
	 *   模板中：
	 *   	<b>{{ `版权所有：${copyright}。` }}</b>
	 *   	//< 友好：首尾空白忽略
	 *   翻译集内：
	 *   {
	 *    	// 键值都包含``字符本身
	 *    	// 首尾应无额外空白
	 *    	"`版权所有：${copyright}。`": "`Copyright: ${copyright}.`"
	 *   }
	 * @param  {string} text 目标文本
	 * @param  {object} l10n 翻译信息集
	 * @return {string} 结果文本
	 */
	localize( text ) {
		if (! text) return '';

		return text.replace(__rePhrase, (match, key) => {
			if (match[0] == '\\') return match.substring(1);

			//:debug 1
			T.debug.l10n(key);

			return this.text(key);
		});
	}


	/**
	 * 提取译文接口。
	 * @param  {String} key 译文键
	 * @return {String} 译文
	 */
	text( key ) {
		let _txt = this._l10n[key];

		if (key[0] == '`') {
			return this._tplstr(_txt) || this._spare(key);
		}
		return typeof _txt == 'string' ? _txt : this._spare(key);
	}


	/**
	 * 扩展翻译集。
	 * - 会覆盖相同的原文键的翻译；
	 * @param  {Object} l10n 新翻译集
	 * @return {Object} 扩展后的翻译集
	 */
	extend( l10n ) {
		return Object.assign(this._l10n, l10n);
	}


	//-- 私有辅助 -----------------------------------------------------------------


	/**
	 * 解析模板字符串值。
	 * - 容忍末尾未合法`结束的情况；
	 * - 模板字符串的数据域为this._data和全局域；
	 * @param  {String} ts 模板字符串（`...`）
	 * @return {String} 解析后的值
	 */
	_tplstr( ts ) {
		if (typeof ts != 'string') {
			return null;
		}
		if (ts[0] != '`') return ts;

		if (ts[ts.length-1] != '`') {
			ts += '`';
		}
		/*jshint -W054 */
		let _fun = new Function("D", `with (D) return ${ts};`);

		return _fun(this._data);
	}


	/**
	 * 返回备用译文。
	 * - 不存在备用译文时返回键本身；
	 * 注：键本身即可能是原文。
	 * @param  {String} key 译文键
	 * @return {String} 译文或译文键本身
	 */
	_spare( key ) {
		return this._more ? this._more.text(key) : key;
	}

}


//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.Localer = Localer;


})( tQuery, Tpb );