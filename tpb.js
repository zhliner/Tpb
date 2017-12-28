/*! $Id: tpb.js 2016.12.22 Tpb.Base $
*******************************************************************************
            Copyright (c) 铁皮工作室 2017 MIT License

                @Project: Tpb v0.3.1
                @Author:  风林子 zhliner@gmail.com
*******************************************************************************

	Tpb 构成：{
		Kits 		基础：实用函数/工具类
		Config 		基础：项目全局配置
		Core 		基础：基本服务实例

		TplBase 	辅助：模板管理器通用基类
		Templater 	辅助：当前模板管理器
		Localer 	辅助：本地化处理器
		Plater 		辅助：板块载入器
		Render 		辅助：渲染器

		App 		应用：基类
		Taker 		应用：数据侍者/动态页（小App）
		WebApp 		应用：全功能App（4分层，类似MVC）

		Easing 		动画：缓动函数库

		run 		方法：基础实例运行
		pbs 		方法：基础PB扩展接口
		proxy 		方法：PB代理调用
		combine 	方法：PB组合调用
	}

	依赖：tQuery

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function( window, undefined ) {

//
// 名称空间。
// 基本成员定义/声明。
//
const Tpb = {

	Kits:  	{}, 	// namespace
	Config: null, 	// Object
	Core: 	null, 	// Instance


	TplBase: 	null, 	// Class/Base Class
	Templater: 	null, 	// Class
	Localer: 	null, 	// Class


	// 渲染器：{
	//   parse( Element ) Boolean
	//   clone( Element, Element ) this
	//   show( Element, Data ) Element
	//   insitu( Element ) Boolean
	// }
	Render: null,


	App: 	null, 	// Base Class
	Taker: 	null, 	// Class
	WebApp: null, 	// Class


	Easing: {},  // 缓动函数库


	/**
	 * 基础实例运行。
	 * 此为单独运行，提供静态交互服务。
	 * @param {Element} root 起始根容器
	 */
	run: root => Tpb.Core.run(root),

	/**
	 * 基础PB扩展。
	 */
	pbs: obj => Tpb.Core.pbs(obj),

	/**
	 * PB组合调用。
	 */
	combine: (...a) => Tpb.Core.combine(...a),

	/**
	 * PB代理调用。
	 */
	proxy: self => Tpb.Core.proxy(self),

};


/**
 * 私有存储生成器。
 * 可在每个函数域内赋值为一个_，然后在类定义中_(this).xx取赋值。
 */
function Privater() {
    return function( self ) {
    	return this.get(self) ||
    		this.set( self, Object.create(null) ).get(self);
    }
    .bind( new WeakMap() );
}



//
// 模板类。
// 其它不同载入方式继承，覆盖load实现。
///////////////////////////////////////////////////////////////////////////////

const
	_ = Privater(),  // 局域存储

	__tplName = 'tpl-name',  // 模板节点命名属性
	__tplLoad = 'tpl-load',  // 模板节点载入属性名

	__slrName = `[${__tplName}]`,
	__slrLoad = `[${__tplLoad}]`;


//
// 基类实现。
// 成员数据局域存储（私有），避免子类干扰。
// 注记：
// - 基类方法内的this取值会被子类覆盖（拦截）；
// - 此模式实际上是使基类中已经没有数据成员；
//
class TplBase {
	/**
	 * @param {Function} obter OBT解析回调
	 */
	constructor( obter ) {
		let X = _(this);

		X.obter = obter;
		X.store = new Map();

		X.count = 0;  // load计数
		X.ender = null;  // 最终回调
	}


	/**
	 * 获取模板节点。
	 * - 返回Promise承诺对象作为统一的接口；
	 * - _end用于load载入后标记，预防配置错误导致死循环；
	 * 注意：获取的是原始节点对象本身。
	 *
	 * @param  {String} name 模板节点名
	 * @param  {Boolean} _end 已经载入过
	 * @return {Promise} 承诺对象
	 */
	get( name, _end ) {
		let _tpl = _(this).store.get(name);

		if (_tpl) {
			return Promise.resolve(_tpl);
		}
		if (_end) {
			return Promise.reject(`not found ${name} node.`);
		}
		return this.load(name);
	}


	/**
	 * 设置完成回调。
	 * - 每次build最终完成后使用（可能有递进load）；
	 * - 仅在支持load的时候才会有效；
	 * @param  {Function} handle 回调函数
	 * @return {this}
	 */
	ender( handle = null ) {
		_(this).ender = handle;
		return this;
	}


	/**
	 * 模板构建。
	 * - 解析并添加到实例存储；
	 * - 匹配检查包括容器元素本身；
	 * - 如果必要，同时进行OBT解析；
	 * @param  {Element} box 容器元素
	 * @return {this}
	 */
	build( box ) {
		let X = _(this);

		// 先解析规避嵌套
		if (X.obter) {
			box = X.obter(box);
		}
		this.parse(box).forEach( el => TplBase.add(X, el) );

		return this;
	}


	/**
	 * 解析提取模板节点集。
	 * - 如果load配置，载入目标节点插入；
	 * - 匹配检查包含容器元素本身；
	 * @param  {Element} box 容器元素
	 * @return {Array} 节点元素集
	 */
	parse( box ) {
		let X = _(this);
		// load-attr
		for ( let el of $.find(box, __slrLoad, true) ) {
			let _n = el.getAttribute(__tplLoad);
			X.count ++;
			el.removeAttribute(__tplLoad);
			// jshint loopfunc:true
			this.get(_n).then( tpl => TplBase.insert(X, el, tpl) );
		}
		// name add
		return $.find(box, __slrName, true);
	}


	/**
	 * 即时载入。
	 * - 载入节点组并提取目标节点；
	 * - 基类不实现，子类重载覆盖；
	 * @param  {String} name 节点名称
	 * @return {Promise} 承诺对象.then(目标节点)
	 */
	load( name ) {
		console.error('templater-load not supported');
		return this.get(name, true);
	}


	/**
	 * 调试用数据。
	 */
	debug() {
		return {
			name: __tplName,
			load: __tplLoad,
			tpls: _(this).store,
		};
	}


	/**
	 * 添加模板节点。
	 * @param {Object} self 当前实例私有存储
	 * @param {Element} el 节点元素
	 */
	static add( self, el ) {
		let _n = el.getAttribute(__tplName);

		if (self.store.has(_n)) {
			console.warn(`overlay "${_n}" template node!`);
		}
		if (_n !== null) {
			self.store.set(_n, el);
		}
		el.removeAttribute(__tplName);
	}


	/**
	 * load插入节点。
	 * - 插入容器元素内顶部；
	 * - 如果全部导入完毕，调用结束回调；
	 * @param  {Object} self 当前实例私有存储
	 * @param  {Element} box 容器元素
	 * @param  {Element} tpl 模板节点
	 * @return {Mixed}
	 */
	static insert( self, box, tpl ) {
		$.prepend(box, tpl);
		return --self.count === 0 && self.ender && self.ender();
	}

}


// 基类即默认实现
Tpb.Templater = Tpb.TplBase = TplBase;




// Expose
///////////////////////////////////////////////////////////////////////////////


let _Tpb = window.Tpb;

Tpb.noConflict = function()
{
	if ( window.Tpb === Tpb ) window.Tpb = _Tpb;
	return Tpb;
};

window.Tpb = Tpb;


// one Tools
Tpb.Kits.Privater = Privater;

})( window );