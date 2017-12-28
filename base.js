/* $Id: base.js 2017.02.13 Tpb.Base $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@project: Teas v0.3.2
				@author:  风林子 zhliner@gmail.com
*******************************************************************************

	应用基类。
	Taker/WebApp继承基本共享。

	扩展PB集采用原型继承于基础PB，因此各个App的扩展PB相对独立，互不影响。
	集内的PB可以复用基础PB和自身空间里的定义（通过Tpb.proxy|combine）。

	子类覆盖接口：{
		actuate( sender, plates )  // 板块启动（发送器绑定）
	}

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( T ) {


class Base {
	/**
	 * @param {Object} plates 板块集（总根）
	 */
	constructor( plates = {} ) {
		// 扩展PB集
		this._PB2 = Object.create( T.Core.pbs() );

		// 板块总根（默认名）
		this.Plate = plates;

		// 板块载入器
		this._Plater = new T.Plater();
	}


	/**
	 * 扩展PB集。
	 * @param {object} ext PB集
	 */
	pbs( ext ) {
		return ext ? Object.assign(this._PB2, ext) : this._PB2;
	}


	/**
	 * 程序运行。
	 * @param  {Element} root 起始根元素
	 * @return {Promise} then（模板管理器）
	 */
	run( root, lang ) {
		let _tplr = new T.Templater(
			el => this.build(el),
			T.Localer && new T.Localer(lang)
		);
		return new Promise(function( resolve ) {
			_tplr.ender( () => resolve(_tplr) )
			.build(root);
		});
	}


	/**
	 * 程序构建。
	 * @param {Element} el 目标元素
	 */
	build( el ) {
		T.Core.obts(
			el,
			this._PB2,
			this.plater.bind(this)
		);
		return el;
	}


	/**
	 * 载入板块（并构建）。
	 * - 板块载入完毕后构建ECMU逻辑；
	 * @param  {object} sender 发送器对象
	 * @param  {function} callback 结束回调
	 * @return {void}
	 */
	plater( sender, callback ) {
		this._Plater.load(sender.team)
		.then( () => {
			this.actuate( sender, this.Plate );
			if (callback) callback();
		} );
	}


	/**
	 * 接口：板块启动（发送器绑定）。
	 * @param  {Sender} sender 发送器实例
	 * @param  {Object} plates 板块存储根
	 * @return {this}
	 */
	actuate( /*sender, plates*/ ) {
		throw new Error('actuate must be overlay.');
	}

}



//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.App = Base;


})( Tpb );