/* $Id: app.js 2017.02.13 Tpb.Base $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@project: Teas v0.3.2
				@author:  风林子 zhliner@gmail.com
*******************************************************************************

	WebApp 应用。
	用法：
		let App = new Tpb.WebApp(...);
		......
		App
		.run(root, lang)
		.then( function(tpl) {
				Tpb.Config.Templater = tpl; ....
			} )

	分层: {
		Entry   	入口。提取参数，预处理。
		Control 	控制。浏览器本地逻辑，综合性控制。
		Model   	模型。业务逻辑，可能与服务器交互（纯数据）。
		Update  	更新。节点渲染或赋值，处理模型来的数据。
	}


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( T ) {
	//
	// 便捷引用
	//
	const
		Util = T.Kits.Util,
		App = T.App;


class WebApp extends App {
	/**
	 * @param {Object} plates 板块集（总根）
	 */
	constructor( plates = {} ) {
		super(plates);
	}


	/**
	 * 接口：板块启动（发送器绑定）。
	 * @param  {Sender} sender 发送器实例
	 * @param  {Object} plates 板块存储根
	 * @return {this}
	 */
	actuate( sender, plates ) {
		Builder.build(sender, plates);
		return this;
	}

}



//
// ECMU.4分层逻辑构造器。
// - 在与用户交互的PB之后，程序的细粒度逻辑划分；
// - 与MVC模式类似，但为平级结构，粒度也更细；
// 4层：{
//  	Entry: 		入口。提取参数，简单加工
//  	Control：	控制。综合性杂项部分，如客户端本地控制
//  	Model：		模型。核心业务逻辑，可能与服务器交互
//  	Update： 	更新。接收模型的数据，渲染相关节点
// }
//
const Builder = {
	/**
	 * 构建x4调用逻辑。
	 * @param  {Sender} sender 发送器对象
	 * @return {void}
	 */
	build( sender, plates ) {
		if (!sender) return;

		let _p = sender.team,
			_e = this._get(plates, _p, 'Entry') || {},
			_c = this._get(plates, _p, 'Control') || {},
			_m = this._get(plates, _p, 'Model') || {},
			_u = this._get(plates, _p, 'Update') || {};

		sender.bind( new Actuator(sender.name, _e, _c, _m, _u) );
	},


	/**
	 * 获取目标类型的实现集。
	 * - 板块路径可能为多级子目录构造而来；
	 * @param  {Array} path  板块路径
	 * @param  {String} type 目标类型[Entry|Model|Control|Update]
	 * @return {Object|null}
	 */
	_get( plates, path, type ) {
		let _obj = Util.subObj(path, this._store);
		if (_obj) {
			return _obj[type] || null;
		}
		console.error(`the "${path}" plate not defined`);
	}

};



//
// ECMU 执行器。
// 实例成员：4阶段调用句柄存储。
// Sender接口：start(...)
//
class Actuator {
	/**
	 * 构造。处理空值。
	 * @param {String} op 调用名
	 * @param {Object} entry 入口定义集
	 * @param {Object} control 控制定义集
	 * @param {Object} model 模型定义集
	 * @param {Object} update 更新定义集
	 */
	constructor( op, entry, control, model, update ) {
		let _e = entry[op],
			_c = control[op],
			_m = model[op],
			_u = update[op];

		this._E = _e;
		this._C = _c && _c.bind(control);
		this._M = _m && _m.bind(model);
		if (!_m) {
			console.warn(`the "${op}" model not defined`);
		}
		this._U = _u && _u.bind(update);
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

		let _hold = this.entry(ev, args, data, targets);

		return _hold && _hold
			.then( a => this.control(a), this.fail )
			.then( d => this.model(d), this.fail )
			.then( d => this.update(d), this.fail )
			.then( o => next(o), this.fail );
	}


	/**
	 * 入口承诺。
	 * - 集合中未定义时续传流程数据；
	 * - 定义但无返回值，会导致流程终止；
	 * @param  {Event} ev 事件对象
	 * @param  {Array} args 用户参数序列
	 * @param  {Mixed} data 流程数据
	 * @param  {Object} targets 事件目标集
	 * @return {Promise}
	 */
	entry( ev, args, data, targets ) {
		if (this._E) {
			data = this._E.bind(targets.current)(ev, args, data);
			if (data === undefined) return;
		}
		return Promise.resolve(data);
	}


	/**
	 * 控制承诺。
	 * @param  {Mixed} args 入口层来的参数
	 * @return {Promise}
	 */
	control( args ) {
		return this._process(this._C, args);
	}


	/**
	 * 模型承诺。
	 * - 模型成员未定义时控制台输出警告信息；
	 * @param  {Mixed} data 控制层来的数据
	 * @return {Promise}
	 */
	model( data ) {
		return this._process(this._M, data);
	}


	/**
	 * 更新承诺。
	 * @param  {Mixed} dict 模型提交的渲染数据
	 * @return {Promise}
	 */
	update( dict ) {
		return this._process(this._U, dict);
	}


	/**
	 * 出错简单显示。
	 */
	fail( msg ) {
		console.error(msg);
	}


	/**
	 * 进程传输。
	 * - 调用句柄未定义时直接向后传输执行；
	 * @param  {Function} handle 调用句柄
	 * @param  {Mixed} args 传输参数
	 * @return {Object} 承诺对象
	 */
	_process( handle, args ) {
		if (!handle) {
			return Promise.resolve(args);
		}
		return new Promise(
			function(a, ok, fail) { this(a, ok, fail); }
			.bind(handle, args)
		);
	}

}



//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.WebApp = WebApp;


})( Tpb );