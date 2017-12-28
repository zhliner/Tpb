/* $Id: taker.js 2017.02.13 Tpb.Base $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@project: Tpb v0.3.2
				@author:  风林子 zhliner@gmail.com
*******************************************************************************

	应用
	----
		1. 数据侍者
		获取纯粹的数据，无新模板load逻辑。仅服务于初始页面，也无本地化机会。
		板块仅用数据渲染初始导入的模板节点。

		2. 页服务器
		含模板load逻辑（载入相应实现即可），若载入本地化实现即拥有本地化能力。
		板块中自行请求模板数据、渲染。

	用法
	----
		let App = new Tpb.Taker(...);
		......
		App
		.run(root)
		.then(
			tpl => Tpb.Config.Templater = tpl
		)

	板块接口：
		Plate.[funcName](ev, args, data, ok, fail)
		Plate.subName.[funcName](ev, args, data, ok, fail)
		注：
		this 已绑定到 targets.current 元素。


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( T ) {
	//
	// 便捷引用
	//
	const
		Util = T.Kits.Util,
		App = T.App;


class Taker extends App {
	/**
	 * @param {Object} plates 板块集（总根）
	 */
	constructor( plates = {} ) {
		super(plates);
	}


	/**
	 * 板块驱动（绑定）。
	 * @param  {Sender} sender 发送器实例
	 * @param  {Object} plates 板块存储根
	 * @return {this}
	 */
	actuate( sender, plates ) {
		if (sender) {
			sender.bind(
				new Actuator( sender.name, Util.subObj(sender.team, plates) )
			);
		}
		return this;
	}

}



//
// By执行器。
// Sender接口：start(...)
//
class Actuator {
	/**
	 * @param {String} op 调用名
	 * @param {Object} store 板块存储
	 */
	constructor( op, store ) {
		let _op = store[op];

		this._op = _op;
		this._err = _op && `the "${op}" method not defined`;
	}


	/**
	 * 接口：启动执行。
	 * @param {Event} ev 事件对象
	 * @param {Object} targets 事件目标集
	 * @param {Array} args 用户参数序列
	 * @param {Mixed} data 流程数据
	 * @param {Function} next 更新回调
	 */
	start( ev, targets, args, data, next ) {

		return this.taking(
				ev, args, data, targets
			)
			.then( dt => next(dt), this.fail );
	}


	/**
	 * 数据请求。
	 * 接口：(ev, args, data, ok, fail)
	 * @param  {Event} ev 事件对象
	 * @param  {Array} args 用户参数序列
	 * @param  {Mixed} data 流程数据
	 * @param  {Object} targets 事件目标集
	 * @return {Promise}
	 */
	taking( ev, args, data, targets ) {
		if (!this._op) {
			return Promise.reject(this._err);
		}
		return new Promise(
			function(el, ev, a, d, ok, fail) {
				this.bind(el)(ev, a, d, ok, fail);
			}
			.bind(this._op, targets.current, ev, args, data)
		);
	}


	/**
	 * 出错简单显示。
	 */
	fail( msg ) {
		console.error(msg);
	}

}



//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.Taker = Taker;


})( Tpb );