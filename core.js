/* $Id: core.js 2016.01.06 Tpb.Base $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@Project: Tpb v0.3.1
				@Author:  风林子 zhliner@gmail.com
*******************************************************************************

	核心部件。

	构建基本的OBT（On/By/To）逻辑。
	脱胎于jcEd项目的Teas框架，基于“模板驱动”设计。

	On：定义事件对应的PB操作链，表达外观/表象行为；
	By：定义响应事件的业务板块调用，可能复杂到需要ECMU四分层逻辑；
	To：定义业务处理数据的更新目标和方法，可能包含进一步的PB行为；

	格式
	----
		on = "事件序列|PB序列; ..."
		by = "板块调用; ..."
		to = "输出元素标识|赋值方式|PB序列（可选）; ..."

	说明
	----
		T:  模板 Template
		PB：表象行为（Presentational Behavior）

	===========================================================================

	交互文档
	--------
		这是最简单的使用方式，可作为普通网页对内容/文章的交互表达。
		无实时模板载入需求，因此也无本地化。

		1. 静态
		-------
		仅含On/To，无板块逻辑（By），单页面。可为本地文件（file://）。
		Core实例本身即实现。
		库文件：{
			tpb.js 		// 基本定义
			kits.js 	// 基本工具集
			core.js  	// 核心支持
			pbs.js 		// 基本PB集
			render.js 	// 节点渲染，可选
		}

		2. Taker
		--------
		通过By，由Taker实例请求服务器数据。但不含新的模板请求。

		库文件：{
			......
			+
			base.js 	// App基类定义
			taker.js 	// 服务端数据获取器，可选
		}

	页应用（Taker）
	--------------
		简单的页面App，包含对新模板的需求，可以本地化。
		无需MVC分层处理，属于WebApp的简化版。
		库文件：{
			......
			+
			base.js
			taker.js
			+
			localer.js 		// 本地化工具类，可选
			templater.js 	// 模板管理器，可选
		}

	WebApp（ECMU）
	--------------
		复杂的Web App，采用四分层逻辑（Entry/Control/Model/Update）。
		可进行复杂的业务构建。
		模板管理器（templater.js）支持子模板内容规划，也可方便的本地化。
		库文件：{
			......
			+
			base.js
			app.js  		// WebApp类定义
			+
			localer.js 		// ...可选
			templater.js 	// ...可选
		}

	===========================================================================

	用法
	----
	交互文档（静态）
		Tpb.run(...);

	交互文档（Taker）
		let App = new Tpb.Taker();
		App.run(...);

	页应用（Page）
		let App = new Tpb.Page();
		App.run(...);

	WebApp（ECMU）
		let App = new Tpb.WebApp(...);
		App.run(...);


	依赖：tQuery.js

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/

(function( $, T ) {
	//
	// 便捷引用。
	//
	const
		Util = T.Kits.Util,
		Spliter = T.Kits.Spliter;


	//
	// 基本定义。
	//
	const
		// OBT默认属性名
		__obtAttr = {
			on: '__on', 	// 触发事件和PB行为
			by: '__by', 	// 板块调用（传送器）
			to: '__to', 	// To输出目标
		},

		// 标识字符
		__chrDlmt = ';',  	// 并列分组
		__chrCall = ',', 	// 调用单元分隔
		__chrZero = '-',  	// 空白占位符


		// 管道分隔模式
		// 排除属性选择器里的|字符。
		__rePipe 	= /\|(?!=)/,

		// 简单词组
		// 如多个空格分隔的事件名。
		// 友好：支持句点字符。
		__reWords 	= /^[\w][\w\s.]*$/,

		// 字符串格式
		// 单双引号/反撇号
		__reString 	= /^".*"$|^'.*'$|^`.*`$/,

		// To:rid 格式
		// 可能包含第二个true参数。
		__reTorid = /^(.*?)(,\s*true)?$/;


	const
		__Gobj = $.object( null, {$}, T.Config.DATA ),

		// 基础PB集原型
		PB = {

			//-- 全局对象 -----------------------------------------------------
			// 首字母大写

			// 标志位集。
			// 由flag实施置标和取消置标。
			// 用于各PB实现全局状态共享。
			Marks: $.object(),

			// 元素关联数据。
			// 取值：this.Store(el).key;
			// 赋值：this.Store(el).key = value;
			Store: T.Kits.Privater(),

			// 全局对象。
			// env环境取值可用。
			Global: __Gobj,

			// 用户全局域。
			// 用于代码的执行，全局对象为顶级域。
			Scoper: new T.Kits.Scoper(__Gobj),


			//-- 全局方法 -----------------------------------------------------
			// 前置$字符

			/**
			 * 获取目标元素。
			 * - 只有在rid未定义时返回null；
			 * - 检索的结果可能是一个空集；
			 * @param  {String} rid  目标元素标识
			 * @param  {Boolean} one 单一检索，可选
			 * @return {Queue|null}
			 */
			$elem( rid, one ) {
				if (rid === undefined) {
					return null;
				}
				return $( Util.evel(this.targets, rid, one) );
			},

			/**
			 * 取格式值。
			 * 前置“@”字符标识，用于灵活获取值参数；
			 * 1. 支持Util.$val的“值格式”；
			 * 2. 支持@后跟随数字取流程数组成员值；
			 * 3. 格式值默认取值目标为事件当前元素；
			 * fmt: {
			 *  	'@xxx' 	prop('xxx')。元素属性值，
			 *  	'@=xx' 	attr('xx')。元素特性值，
			 *  	'@~xx' 	css('xx')。元素样式值（计算）
			 *  	'@$xx' 	$系获取。如 $.text(el)
			 *  	'@-xx' 	prop('-xx')。data-xx属性值（tQuery支持）
			 *
			 *  	'@12' 	流程数据成员。this.data[12]
			 *  	'@-1' 	同上，负数为字面键名。this.data[-1]
			 *  	'@@xx' 	@字面值标识，即“@xx”本身
			 *  	'xxxx' 	普通字符串值
			 * }
			 * @param  {String} fmt 格式值
			 * @return {Mixed} 结果值
			 */
			$value( fmt ) {
				if (!fmt || typeof fmt != 'string' || fmt[0] != '@') {
					return fmt;
				}
				fmt = fmt.substring(1);
				if (fmt[0] == '@') return fmt;

				if ( $.isNumeric(fmt) ) {
					return this.data[ +fmt ];
				}
				return Util.$val( this.targets.current, fmt );
			},

			/**
			 * 模板节点获取。
			 * @param  {String} name 模板名称
			 * @return {Element}
			 */
			$node( name ) {
				return T.Config.Templater.get(name);
			},

			/**
			 * 单一取值。
			 * - 单一成员取成员值，否则取集合本身；
			 * - 空集返回null；
			 * @param  {Array|Value} obj 目标集
			 * @return {Array|Mixed}
			 */
			$alone( obj ) {
				if (!$.isArray(obj)) {
					return obj;
				}
				return obj.length == 1 ? obj[0] : obj.length && obj || null;
			},

		},


		// 分组切分器。
		// 仅需调用内不切分。
		DlmtSpliter = new Spliter(__chrDlmt, true),

		// 调用单元切分器。
		// 用于PB调用序列的切分。
		CallSpliter = new Spliter(__chrCall, true, true),

		// 事件名分离器。
		// 单个空格分隔，仅排除参数模式。
		// 注：选择器定义在字符串里。
		EvnSpliter = new Spliter(' ', true),

		// 调用链存储（延迟绑定）。
		// Element: [{name, selector, chain}]
		ChainStore = new WeakMap();



//
// Tpb 核心。
// 解析OBT配置，绑定事件处理。
// 默认仅支持页面的静态交互（On/To）。
//
class _Core {
	/**
	 * @param {Object} obt OBT属性名定义
	 */
	constructor( obt = __obtAttr ) {
		this._obt = obt;
		this._PB = Object.create(PB);
	}


	/**
	 * 获取/设置OBT属性命名。
	 * 注：改变默认命名并不是一个常用操作。
	 * @param  {Object} set OBT属性名定义{on, by, to}
	 * @return {Array} 按On/By/To顺序列出的属性名
	 */
	obtAttr( set ) {
		if (set === undefined) {
			return [
				this._obt.on,
				this._obt.by,
				this._obt.to,
			];
		}
		Object.assign(this._obt, set);
	}


	/**
	 * 基础PB扩展。
	 * - 此为Core全局共享，应定义基础操作；
	 * - 简单覆盖赋值，后续可重定义已有接口；
	 * @param  {Object} obj 定义集
	 * @return {Object} 扩展后的PB集
	 */
	pbs( obj ) {
		return obj && Object.assign(this._PB, obj) || this._PB;
	}


	/**
	 * 启动运行。
	 * - 不支持板块（由Taker/WebApp实现）；
	 * - 无模板载入功能，故也无本地化；
	 * @param  {Element} root 起始根元素
	 * @return {Promise} then（模板管理器）
	 */
	run( root = document.body ) {
		let _tplr = new T.Templater(
				el => this.obts(el), null
			);
		return Promise.resolve( _tplr.build(root) );
	}


	/**
	 * OBT完整实现。
	 * - 元素OBT配置解析、构建/绑定、调用器完成解析；
	 * @param  {Element} box 容器元素
	 * @param  {Object} exPB 扩展PB集，可选
	 * @param  {Function} plater 板块载入器
	 * @return {Element} box
	 */
	obts( box, exPB, plater = null ) {
		let _calls = [],
			_PB = exPB || this._PB;

		for ( let it of this.parse(box) ) {
			this.build(it.elem, it.obt, _calls, _PB, plater);
		}
		this.calls(_calls, _PB);

		return box;
	}


	/**
	 * 调用器完成解析。
	 * - 用户扩展PB优先检索（可能覆盖公用PB）；
	 * @param  {Array} calls 调用器集
	 * @param  {Object} PB 目标PB集，可选
	 * @return {this}
	 */
	calls( calls, PB ) {
		PB = PB || this._PB;

		calls.forEach(
			caller => caller.apply( PB )
		);
		return this;
	}


	/**
	 * On/By/To解析。
	 * - 容器元素本身也会被解析；
	 * - 传递store可以存储属性配置{Element:Map}；
	 * 生成：{
	 *  	elem: 配置元素
	 *  	obt: {
	 *  		on: [{evs, pbs}]
	 *  		by: [Sender]
	 *  		to: [{updater, pbs}]
	 *  	}
	 * }
	 * @param  {Element} box 容器元素
	 * @param  {Map} store 属性值存储，可选
	 * @return {Array} “元素/OBT配置”对象数组
	 */
	*parse( box, store ) {
		let _obt = this.obtAttr();

		for ( let el of $.find(box, `[${_obt[0]}]`, true) ) {
			let _map = $.attr(el, _obt);
			yield {
				elem: el,
				obt: Parser.all( ..._map.values() ),
			};
			$.removeAttr(el, _obt);
			if (store) store.set(el, _map);
		}
	}


	/**
	 * OBT构建与绑定。
	 * - 提取调用器外部存储（oper尚未匹配）；
	 * @param {Element} el 目标元素
	 * @param {Object} obt OBT解析集{on, by, to}
	 * @param {Array} calls 调用器存储
	 * @param {Object} PB 目标PB集
	 * @param {Function} plater 板块载入回调
	 */
	build( el, obt, calls, PB, plater ) {
		let {by, to} = obt;

		obt.on.forEach(function(on, i) {
			this.binds(
				el,
				on.evs,
				Builder.build(on.pbs, by[i], to[i], PB, plater)
			);
			$.merge(
				calls,
				on.pbs || [],
				to[i] && to[i].pbs || []
			);
		}, this);
	}


	/**
	 * 事件绑定（一组OBT）。
	 * - 将调用链绑定到定义的事件序列；
	 * - 调用链实现了EventListener接口；
	 * - 事件的绑定按定义时的顺序进行；
	 * @param {Element} el 目标元素
	 * @param {Array} evs 事件定义集[name, {name, args}...]
	 * @param {Chain} chain 调用链实例
	 */
	binds( el, evs, chain ) {
		$.each( evs, it => {
			let [evn, slr] = this._bindArgs(it);

			if (evn[0] == '-') {
				return this.xbind(el, evn.substring(1), slr, chain);
			}
			$.on(el, evn, slr, chain);
		});
	}


	/**
	 * 延迟绑定存储。
	 * - 延迟绑定由On定义中事件名前置-配置；
	 * - 该存储主要用于PB中的.bind/.unbind接口使用；
	 * - 同一元素支持多个相同“事件名&选择器”的配置；
	 * WeakMap: Element: [
	 *  	{name, selector, chain}
	 * ]
	 * @param {Element} el 目标元素
	 * @param {String} name 事件名
	 * @param {String|null} selector 委托选择器
	 * @param {Chain} chain 调用链实例
	 */
	xbind( el, name, selector, chain ) {
		(
			ChainStore.get(el) ||
			ChainStore.set(el, [])
		)
		.push({ name, selector, chain });
	}


	/**
	 * 获取预存储调用链。
	 * - 从延迟绑定存储中检索；
	 * - 相同事件名&选择器的配置可能有多个；
	 * @param  {Element} el 目标元素
	 * @param  {String} evn 事件名
	 * @param  {String} slr 委托选择器
	 * @return {[Chain]} 调用链实例集
	 */
	chain( el, evn, slr = null ) {
		let _buf = ChainStore.get(el),
			_tmp = [];

		if (_buf) {
			$.each( _buf, it =>
				it.name == evn && it.selector === slr && _tmp.push(it.chain)
			);
		}
		return _tmp;
	}



	//-- PB 工具 --------------------------------------------------------------
	// 注：
	// 因为每一个PB接口都包含.next()调用以移动到下一步，
	// 因此需用以下方式组合调用其它PB接口。否则链内指针的移动不会是你想要的。


	/**
	 * 代理调用。
	 * - 类似组合，但不适用于包含异步的PB单元；
	 * - 代理流程里的data可直接由data属性获取；
	 * - 被调用的接口需要“return this.next(...)”；
	 * 示例：
	 *   Tpb.proxy(this)
	 *    	.val(ev, ...)
	 *    	.put(ev, ...)
	 *    	.data  // 代理流程数据
	 *
	 * @param  {Object} self 当前PB的this
	 * @return {Object} 代理对象
	 */
	proxy( self ) {
		let _this = Object.create(self);

		_this.next = function( data ) {
			if (data !== undefined) _this.data = data;
			return _this;
		};
		// _this.dispose = function() {};
		return _this;
	}


	/**
	 * 组合调用。
	 * - 提供在PB集内对其它成员的组合调用，以实现复杂的功能；
	 * - 会构建一个独立的调用链，支持包含异步的PB单元；
	 * 示例：
	 *   Tpb.combine(this,
	 *      // 名称, 参数序列...（省略ev）
	 *   	[ 'val', value ],
	 *   	[ 'put', name, rid ],
	 *   )
	 *   .start(ev, this.data, callback);
	 *   // 可导入初始流程数据（this.data）
	 *   // 可设置一个最终回调延续当前流程
	 *
	 * @param  {Object} self 当前PB调用的this对象
	 * @param  {Array} list 调用定义集 [[...], ...]
	 * @return {Object} 调用链实例（Chain）
	 */
	combine( self, ...list ) {
		let _ch = new Chain();

		for ( let it of list ) {
			let _fn = self[ it.shift() ];
			if (_fn) Builder.pb(_fn, it, _ch, self);
		}
		_ch.tween = self.tween;
		_ch.targets = self.targets;
		_ch.selector = self.selector;

		return _ch;
	}


	//-- 私有辅助 -------------------------------------------------------------


	/**
	 * 提取绑定所需参数。
	 * @param  {String|Object} it 事件定义对象
	 * @return {[String, String|null]} [事件名, 选择器]
	 */
	_bindArgs( it ) {
		return typeof it == 'string' ?
			[ it, null ] :
			[ it.name, it.args[0] || null ];
	}
}



//
// 解析器（OBT）
// 解析On/By/To格式串。
//
const Parser = {
	/**
	 * OBT一起解析。
	 * 返回值：{
	 *  	on: [{evs, pbs}]
	 *  	by: [Sender]
	 *  	to: [{updater, pbs}]
	 * }
	 * @param  {String} on On配置值
	 * @param  {String} by By配置值
	 * @param  {String} to To配置值
	 * @return {Object}
	 */
	all( on, by, to ) {
		return {
			on: this.on(on),
			by: this.by(by) || [],
			to: this.to(to) || [],
		};
	},


	/**
	 * __on="
	 *  	Ev;  // 单纯事件，分号分组
	 *  	Ev|pb, pbs()...;  // PB行为链（1个或多个）
	 *  	Ev Ev...|pb, pbs()...;   // 多个普通事件
	 *  	Ev Ev()...|pb, pb()...;  // 普通事件与委托事件混合
	 * "
	 * 返回值：[{
	 *  	evs: [ names, { name, args }, name... ],
	 *  	pbs: [ Caller ]
	 * }...]
	 * @param  {String} fmt 配置格式串
	 * @return {Array}
	 */
	on( fmt ) {
		let _buf = [];

		for ( let ss of DlmtSpliter.split(fmt) ) {
			let _pair = Util.rePair(ss, __rePipe);
			_buf.push({
				evs: this._onEvs(_pair[0].trim()),
				pbs: this._pbCalls(_pair[1].trim())
			});
		}
		return _buf;
	},


	/**
	 * __by="
	 *  	Plate.call();  // Plate板块里的call方法
	 *  	Plate.Sub.call;  // 支持多级引用，无参数可省略括号
	 * "
	 * @param  {String} fmt 配置格式串
	 * @return {[Sender]}
	 */
	by( fmt ) {
		if (!fmt) return;

		return [...DlmtSpliter.split( fmt, s => s.trim() )]
			.map(
				ss => ss == __chrZero ? null : this._sender(ss)
			);
	},


	/**
	 * __to="
	 *  	rid|where;
	 *  	rid|where|pbs...;
	 * "
	 * 返回值：[{
	 *  	updater: {Updater},
	 *  	pbs: [Caller]|null
	 * }...]
	 * @param  {String} fmt 格式串
	 * @return {Array} 更新器实例&PBs序列的数组
	 */
	to( fmt ) {
		if (!fmt) return;
		let _buf = [];

		for ( let ss of DlmtSpliter.split( fmt, s => s.trim() ) ) {
			if (!ss) continue;
			let [updater, _pbs] = this._updater(ss);

			_buf.push({
				updater,
				pbs: this._pbCalls(_pbs.trim()),
			});
		}
		return _buf;
	},


	//-- 私有辅助 -------------------------------------------------------------


	/**
	 * 解析On中的事件名序列。
	 * - 委托被解析为一个对象 {name, args}；
	 * - 事件名支持前置短横线-（预定义）；
	 * 格式：{
	 *  	evn evn evn('slr')
	 *  	evn -evn -evn(..)
	 * }
	 * @param  {String} fmt 事件定义串
	 * @return {Array} 结果数组
	 */
	_onEvs( fmt ) {
		if (!fmt) return null;

		if (__reWords.test(fmt)) {
			return [fmt];
		}
		fmt = fmt.replace(/\s+/g, ' ');

		return [...EvnSpliter.split(fmt, s => s.trim())]
			.map(
				ss => Util.funcArgs(ss)
			);
	},


	/**
	 * 解析调用序列。
	 * - PB调用链中的定义：pb, pb(...), ev.point...
	 * @param  {String} fmt 调用定义串
	 * @return {[Caller]} 调用器数组
	 */
	_pbCalls( fmt ) {
		if (!fmt) return null;

		let _buf = [];

		for ( let it of CallSpliter.split(fmt) ) {
			let _cal = this._caller(it.trim());
			if (_cal) _buf.push(_cal);
		}
		return _buf.length && _buf;
	},


	/**
	 * 解析调用串。
	 * @param  {String} fmt 调用串
	 * @return {Caller} 调用器实例
	 */
	_caller( fmt ) {
		let {name, args} = Util.funcArgs(fmt);
		if (!name) return null;

		return new Caller(name, args);
	},


	/**
	 * 解析板块调用。
	 * @param  {String} fmt 调用串
	 * @return {Sender} 发送器实例
	 */
	_sender( fmt ) {
		let {name, args} = Util.funcArgs(fmt);
		if (!name) return null;

		let _list = name.split('.');

		return new Sender(_list.pop(), args, _list);
	},


	/**
	 * 解析更新调用。
	 * @param  {String} fmt 更新配置串
	 * @return {[Updater, pbs]} 更新器和后续PB序列
	 */
	_updater( fmt ) {
		if (!fmt) return null;

		let _lst = fmt.split(__rePipe),
			[_slr, _all] = this._toRids(_lst[0]);

		// 首尾引号
		if (__reString.test(_slr)) {
			_slr = _slr.slice(1, -1).trim();
		}
		return [
			new Updater(_slr, _lst[1] || '', _all),
			_lst[2] || '',
		];
	},


	/**
	 * 解析提取To的rid定义。
	 * - 格式串包含rid字符串和可能有的true参数；
	 *   （如：'form@ b', true）
	 * @param  {String} fmt 格式串
	 * @return {[String, Boolean]}
	 */
	_toRids( fmt ) {
		// jshint unused:false
		let [_, rid, all] = fmt.trim().match(__reTorid);

		return [ rid.trim(), !!all ];
	},

};



//
// 构建OBT调用链。
// - 创建元素事件激发的调用链，包含：{
//  	On的PB序列，可选
//  	By的板块调用，可选
//  	To的更新和后继PB序列，可选
// }
// 流程data：
// - data在整个调用链内传递，每一个过程都可修改该data；
// - 调用this.next(data) 即可传递该数据，无data则不修改；
// - To如果成功update，会继续后续可能有的PB序列；
// 注：
// - To中的PB可以激发新的事件，因而可以创建某种连续循环；
// - 压入的实际上是一个代理函数，传递流程数据并调用目标函数；
//
const Builder = {
	/**
	 * 构建。
	 * pbs为null时为单纯绑定事件，可以有by配置。
	 * @param  {[Caller]} pbs On-PB调用序列
	 * @param  {Sender} snd By的发送器实例
	 * @param  {Object} to 目标定义对象{updater, pbs}
	 * @param  {Object} PB 目标PB集
	 * @param  {Function} plater 板块载入回调
	 * @return {Chain} 调用链实例
	 */
	build( pbs, snd, to, PB, plater ) {
		let _chain = new Chain();

		this.pbs(pbs, _chain, PB);
		this.plate(snd, _chain, plater);

		if (to) {
			this.update(to.updater, _chain);
			this.pbs(to.pbs, _chain, PB);
		}
		return _chain;
	},


	/**
	 * 压入PB调用。
	 * @param {Function} oper PB调用句柄
	 * @param {Array|null} args PB参数
	 * @param {Chain} chain 调用链实例
	 * @param {Object} base 继承的PB集
	 */
	pb( oper, args, chain, base ) {
		let _obj = Object.create(base);
		_obj.dispose = chain.remove.bind(chain, chain.size);

		chain.push(
			Process.pbs.bind(_obj, chain, oper, args || [])
		);
	},


	/**
	 * 压入PB调用序列。
	 * - 获取模板节点为基本需求，故提供tplNode引用；
	 * - dispose提供清除当前调用句柄能力（如one）；
	 *
	 * @param {[Caller]} pbs PB调用配置对象集
	 * @param {Chain} chain 调用链对象（存储）
	 * @param {Object} base 继承的PB集
	 */
	pbs( pbs, chain, base ) {
		if (!pbs || !pbs.length) {
			return;
		}
		for ( let cal of pbs ) {
			this.pb(cal.oper, cal.args, chain, base);
		}
	},


	/**
	 * 压入板块调用（By）。
	 * @param {Sender} sender 发送器实例
	 * @param {Chain} chain 调用链实例
	 * @param {Function} plater 板块载入回调
	 */
	plate( sender, chain, plater ) {
		if (!sender || !plater) return;

		chain.push(
			function(ch, snd, plater, data) {
				if (snd.done()) {
					return this(ch, snd, data);
				}
				plater( snd, () => this(ch, snd, data) );
			}
			.bind( Process.plate, chain, sender, plater )
		);
	},


	/**
	 * 压入更新调用。
	 * - 返回null表示无To定义；
	 * @param {Updater} updater 更新配置实例
	 * @param {Chain} chain 调用链实例
	 */
	update( updater, chain ) {
		if (!updater) return;

		chain.push(
			function(ch, up, view) {
				let _rev = this(ch.targets, up, view);
				return _rev && ch.next(_rev);
			}
			.bind( Process.update, chain, updater )
		);
	},

};


//
// OBT执行进程：{
//  	On: PBs
//  	By: Plate
//  	To: Update, PBs
// }
//
const Process = {
	//
	// PB展示。
	// - 向后延续执行流，执行this.next()即可；
	// @param {Chain} chain 调用链实例
	// @param {Function} oper 调用函数
	// @param {Array} args 调用参数序列
	// @param {Mixed} data 前一步传递来的数据
	//
	pbs( chain, oper, args, data ) {
		this.data = data;
		this.next = chain.next.bind(chain, data);

		this.tween = chain.tween;
		this.targets = chain.targets;
		this.selector = chain.selector;

		oper.bind(this, chain.event)(...args);
	},


	//
	// 板块调用。
	// @param {Chain} chain 调用链实例
	// @param {Sender} sender 发送器实例
	// @param {mixed} data 前一步传递来的数据
	//
	plate( chain, sender, data ) {
		sender.send(
			chain.event,
			chain.targets,
			sender.args,
			data,
			chain.next.bind(chain, data)
		);
	},


	//
	// 目标更新。
	// - 如果未指定输出容器ID，默认为当前元素；
	// - 未找到目标元素返回null，会导致后续PB失效；
	//
	// @param {Object} targets 事件目标元素集
	// @param {Updater} updater 更新配置实例
	// @param {Mixed} data 用于更新的数据
	//
	update( targets, updater, data ) {
		let $to = updater.target(targets);

		if (!$to.length) {
			console.error(`not matched element to update`);
			return null;
		}
		// To目标赋值
		targets.target = $to;

		return updater.update($to, data);
	},

};



//
// 调用链。
// - 用于PB/By/To执行流调用；
// - 实现EventListener接口，直接用于事件注册；
// - 因为支持委托绑定，事件目标可能会被调整；
// targets {
//  	delegate 	实际绑定事件处理的元素
//  	current 	当前匹配的目标元素
//  	origin  	最初激发事件的元素（event.target）
//  	target 		To目标元素（如果有To配置）
// }
// 说明：
// - 若注册时无委托，delegate与current相同；
// - 若注册时有委托，current为当前匹配的元素，selector有值；
// 注记：
// - trigger发送的数据在ev.detail属性上；
// - 一个调用链可能被多个事件/委托共享，
//   因此开放数据（event, targets, selector）是即时更新的；
//
class Chain {

	constructor() {
		// 原生事件对象
		this.event = null;
		// 目标集
		this.targets = {};
		// 委托选择器
		// this.selector;

		// 函数队列区
		// 通常用于动画
		this.tween = new Tween();
		// 动画暂停
		// this.tween.pause = false;
		// 动画终止
		// this.tween.halt = true;

		// 调用存储
		this._buf = [];
		// 当前下标
		this._cur = 0;

		// 结束回调
		// 仅start调用的临时链有用。
		this._end = null;
	}


	/**
	 * 开启执行流。
	 * - 用EventListener接口实现；
	 * - 当注册为委托时，selector存在；
	 * - _data仅用于组合封装调用（start）；
	 * @param  {Event} event 原生事件对象
	 * @param  {Object} targets 目标集（委托修订）
	 * @param  {String} slr 委托选择器
	 * @param  {Mixed} _data 初始导入流程数据
	 * @return {Chain} 调用链自身
	 */
	handleEvent( event, targets, slr, _data ) {
		this.event = event;
		this.targets = targets;

		if (slr) {
			this.selector = slr;
		}
		this.tween.halt = true;
		this.tween.pause = false;
		this.tween.length = 0;

		this._cur = 0;
		return this.next(_data);
	}


	/**
	 * 非触发启动。
	 * - 一般用于PB组合调用中；
	 * @param {Event} event 事件对象
	 * @param {Mixed} data 初始导入流程数据
	 * @param {Function} fend 结束回调
	 */
	start( ev, data, fend ) {
		this._end = fend;

		return this.handleEvent(
			ev,
			this.targets,
			this.selector,
			data
		);
	}


	/**
	 * 压入调用函数。
	 * - 考虑简单性，用集合当前size做键；
	 * 回调：(data)
	 * @param  {Function} handler 调用句柄
	 * @return {Chain} 当前实例
	 */
	push( handler ) {
		return handler && this._buf.push(handler);
	}


	/**
	 * 调用下一个函数。
	 * - data用于向下一个调用传递数据；
	 * - 如果外部调用没有data传递，延续prev传递；
	 * - 流程数据可能为扩展模式；
	 * @param {Mixed} prev 上一阶段的数据
	 * @param {Mixed} data 当前传递的数据，可选
	 * @return {Mixed} [description]
	 */
	next( prev, data = prev ) {
		// _extend为扩展标志
		if (data !== prev && $.isArray(prev) && prev._extend) {
			prev.push(data);
			data = prev;
		}
		if (this._cur >= this.size) {
			return this._end && this._end(data);
		}
		let _fn = this._buf[this._cur++];

		return _fn ? _fn(data) : this.next(prev, data);
	}


	/**
	 * 移除目标调用。
	 * 注：设置为null以保持池大小，正确完结。
	 * @param {Number} idx 下标值
	 */
	remove( idx ) {
		this._buf[idx] = null;
	}


	/**
	 * 返回调用链大小。
	 * @return {Number}
	 */
	get size() {
		return this._buf.length;
	}
}


//
// 补间调用序列。
// 注记：
// 因为压入的函数通常会绑定流程数据，而流程数据是即时变化的，
// 故此不应考虑压入函数的再利用。
// 即：每一次调用链的重新执行都需要重构函数压入。
//
class Tween extends Array {
	constructor() {
		super(0);
		this.halt  = true;
		this.pause = false;
	}
}



//
// 调用器。
// 用于PB成员调用，延迟获取句柄。
// 支持句点“.”分隔的多级PB成员引用。
//
class Caller {
	/**
	 * @param {String} name 调用名（序列）
	 * @param {Array|null} args 参数序列
	 */
	constructor( name, args ) {
		// public
		this.oper = null; 	// 调用句柄
		this.args = args;

		this._fns = name;
	}


	/**
	 * 应用到目标集。
	 * @param {object} PB PB定义集
	 */
	apply( PB ) {
		let _op = this._handle(
			this._fns.split('.'), PB
		);
		if (!_op) {
			console.error(`not found ${this._fns} in:`, PB);
		}
		this.oper = _op || null;
	}


	/**
	 * 获取调用句柄。
	 * - 调用名序列为句点分隔的名称集；
	 * @param  {[String]} names 调用名序列
	 * @param  {Object} PB PB定义集
	 * @return {Function}
	 */
	_handle( names, PB ) {
		return names.reduce( (o, k) => o[k.trim()], PB );
	}
}



//
// 发送器。
// 接受板块调用注册（执行器接口: start）
// 启动执行器：XX.start(...)
//
class Sender {
	/**
	 * 开放成员。
	 * @param {String} name 调用函数名
	 * @param {Array} args 参数数组或null
	 * @param {Array} team 板块名序列
	 */
	constructor( name, args, team ) {
		this.team = team;
		this.name = name;
		this.args = args;

		this._actor = null;
	}


	/**
	 * 绑定执行器
	 * 接口：obj.start(ev, args, data, next)
	 * @param {Object} obj 执行器实例
	 */
	bind( obj ) {
		this._actor = obj;
	}


	/**
	 * 执行发送。
	 * - 外部保证已经绑定执行器；
	 * - 调用执行器的start接口；
	 * @param {Event} ev 事件对象
	 * @param {Object} targets 事件目标集
	 * @param {Mixed} args 模板参数（sender.args）
	 * @param {Mixed} data 流程数据
	 * @param {Function} next 更新回调
	 */
	send( ev, targets, args, data, next ) {
		this._actor.start(ev, targets, args, data, next);
	}


	/**
	 * 是否已绑定回调。
	 * @return {bool}
	 */
	done() {
		return !!this._actor;
	}

}



//
// 更新器。
//
class Updater {
	/**
	 * @param {String} rid 元素选择器
	 * @param {String} where 位置或方法
	 * @param {Boolean} all  是否多检索
	 */
	constructor( rid, where, all ) {
		this._rid = rid;
		this._all = all;
		this._where = where.trim() || __chrZero;
	}


	/**
	 * 获取目标元素。
	 * - rid可为空占位符表示跳过；
	 * @param  {Object} targets 事件目标集
	 * @return {Queue}
	 */
	target( targets ) {
		if (!this._rid) {
			return $( targets.current );
		}
		if (this._rid == __chrZero) {
			return null;
		}
		return $( Util.$find(this._rid, targets.delegate), this._all );
	}


	/**
	 * 目标元素数据更新。
	 * - 目标元素集也可为空，直接向后续传数据；
	 * - 如果无更新逻辑，where应为一个占位符（-），向后传递元素集；
	 * - where为属性时，支持data系属性简写（tQ原生）；
	 * - 节点数据仅支持单点插入（首个目标元素）；
	 * - 多目标位置插入可用属性方式（text或html）；
	 * where: [
	 *  	// 参考$:Wheres
	 *  	begin 	// 元素内前端 $el.prepend()
	 *  	prepend // 同上
	 *  	end 	// 元素内末尾 $el.append()
	 *  	append 	// 同上
	 *  	after 	// 元素之后（同级） $el.after()
	 *  	before 	// 元素之前（同级） $el.before()
	 *  	fill 	// 元素内填充（先清空）
	 *  	replace // 目标替换
	 *
	 *  	-xxx 	// dataset系属性
	 *  	text 	// 设置textContent
	 *  	html 	// 设置innerHTML
	 *  	....	// 其它属性，如：value（取prop）
	 *
	 *  	// 数字下标
	 *  	// 目标是一个集合，按位置前插，支持负数
	 *  	{number}
	 * ]
	 * @param  {Queue} $to 目标元素（集）
	 * @param  {String|Number|Boolean|Element|Array|Node} data 数据
	 * @return {Queue|data} 目标元素
	 */
	update( $to, data ) {
		let _w = this._where;

		if (!$to || _w == __chrZero) {
			return $to || data;
		}
		if ( $.isNumeric(_w) ) {
			return Updater.index($to, _w, data);
		}
		return Updater.where($to[0], _w, data) || Updater.prop($to, _w, data);
	}


	/**
	 * 按下标前插。
	 * - 支持负数从末尾算起，-1插入末尾元素之前；
	 * - 可传递一个字符串“-0”插入末尾元素之后；
	 * @param  {Queue} $el 目标元素集
	 * @param  {Number|String} idx 下标值
	 * @param  {Element|Node[s]} data 元素/文本节点
	 * @return {Node[s]} data
	 */
	static index( $el, idx, data ) {
		if (idx == '-0') {
			$.after( $el.last()[0], data );
		} else {
			$.before( $el.get(parseInt(idx)), data );
		}
		return data;
	}


	/**
	 * 按属性赋值。
	 * - $el可能是一个集合，即多赋值；
	 * - 支持html/text属性修改元素内容；
	 * @param  {Queue} $el 目标元素（集）
	 * @param  {String} name 属性名（prop）
	 * @param  {String|Number|Boolean} data 新值
	 * @return {Queue} $el
	 */
	static prop( $el, name, data ) {
		if (name == 'text' || name == 'html') {
			return $el[name](data);
		}
		return $el.prop(name, data);
	}


	/**
	 * 按位置名称插入。
	 * - begin/prepend
	 * - end/append
	 * - after|before
	 * - fill|replace
	 * @param  {Element} ref 参考元素
	 * @param  {String} where 目标位置
	 * @param  {Element|Node[s]} data 数据
	 * @return {Node[s]} data
	 */
	static where( ref, where, data ) {
		let _meth = Updater._Wheres[where];
		return _meth && ref && $[_meth](ref, data);
	}

}


//
// 命名位置/操作方法映射。
//
Updater._Wheres = {
	'before': 	'before',
	'after': 	'after',
	'begin': 	'prepend',
	'prepend': 	'prepend',
	'end': 		'append',
	'append': 	'append',
	'fill': 	'fill',
	'replace': 	'replace',
};



//
// Debug
// 调试类 - 收集和显示动态信息
// 注记：
// 文件名对应的节点清单外部自行整理。
//
///////////////////////////////////////////////////////////////////////////////

class Debug {

	constructor () {
		// 收集待译条目
		this._l10n = new Set();

		// OBT定义集
		// {Element: {
		//  	on: [{evs, pbs}],
		//  	by: [senders],
		//  	to: [{updater, pbs}]
		// }}
		this._eobt = new Map();
	}


	/**
	 * 设置/获取元素OBT定义集。
	 * 注：对象数组在控制台显示更友好一些。
	 * @return {Array}
	 */
	obt( el, its ) {
		if (el !== undefined) {
			return this._eobt.set(el, its);
		}
		return [...this._eobt]
			.map( it => ({ elem: it[0], OBTs: it[1] }) );
	}


	/**
	 * 收集本地化信息。
	 * 用于整理待翻译文本条目。
	 * @param  {String} txt 源文本
	 * @return {Array} 信息集
	 */
	l10n( txt ) {
		if (typeof txt == 'string') {
			return this._l10n.add(txt);
		}
		return [...this._l10n.values()];
	}


	/**
	 * 提取PB调用配置。
	 * - 统计各PB使用的计数；
	 * @return {Object}
	 */
	pbs() {
		let _buf = {};

		for ( let it of this._eobt.values() ) {
			if (it.on.pbs) this._pbs(it.on.pbs, _buf);
			if (it.to.pbs) this._pbs(it.to.pbs, _buf);
		}
		return _buf;
	}


	/**
	 * 提取板块信息。
	 * - 主要用于检测板块书写是否错误；
	 * type: {
	 *  	name 	仅板块名称
	 *  	默认 	板块和执行器名，如 Art.latest
	 *  	args 	附加参数（不重复）
	 * }
	 * @param  {String} type 信息类型
	 * @param  {Boolean} clean 清除重复
	 * @return {Array}
	 */
	plates( type, clean = true ) {
		let _buf = [];

		for ( let it of this._eobt.values() ) {
			let by = it.by;

			if (by) {
				let _p = by.team.join('.'),
					_f = `${_p}.${by.name}`;
				switch (type) {
				case 'name':
					_buf.push(_p);
					break;
				case 'args':
					_buf.push(`${_f}(${by.args.join(', ')})`);
					break;
				default:
					_buf.push(_f);
				}
			}
		}
		return clean ? [...new Set(_buf).values()].sort() : _buf;
	}


	/**
	 * 获取模板节点信息。
	 */
	tpls() {
		let _buf = [];

		for ( let [k, el] of T.Config.Templater.debug().tpls ) {
			_buf.push({ [k]: el });
		}
		return _buf;
	}


	/**
	 * 获取ID串集。
	 * - 未实时收集，检索整理后直接返回；
	 * - 返回集已排序，重复项前置“____”醒目提示；
	 * @param  {object} 元素集（jQ）
	 * @return {array}
	 */
	ids( ...box ) {
		if (box.length === 0) {
			box = [document.body];
		}
		let _ids = $(box).find('[id]', true)
				.map( e => `#${e.id} <${e.tagName}>` ),
			_old = '';

		return _ids.sort()
			.map( id => {
				let _id = id.substring( 0, id.indexOf(' <') );
				return _id == _old ? ('____' + id) : (_old = _id, id);
			});
	}


	/**
	 * 统计PB调用次数。
	 * @param {Array} pbs 调用集[Caller]
	 * @param {Object} buf 计数存储
	 */
	_pbs( pbs, buf ) {
		for ( let cal of pbs ) {
			let _cnt = buf[_cal.name] || 0;
			buf[cal.name] = _cnt + 1;
		}
	}

}



//
// Expose
//
///////////////////////////////////////////////////////////////////////////////

T.Core = new _Core();

// 一个全局调试实例
T.debug = new Debug();


})( tQuery.proxyOwner(), Tpb );
