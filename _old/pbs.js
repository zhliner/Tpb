/* $Id: pbs.js 2016.03.9 Tpb.Base $
*******************************************************************************
			Copyright (c) 黔原小屋 2016 GNU LGPL

				@Project: Tpb v0.3
				@Author:  风林子 zhliner@gmail.com
*******************************************************************************

	表象行为集（Presentational Behavior - PB）

	不涉及业务逻辑的UI展示和程序执行前的一些预备行为（如状态存储）。
	它们可能触发进一步的业务逻辑，也可能仅是一种UI秀。

	这里是通用的基础操作定义，不同需求有其自身特定的扩展。

	提示
	----
	> 如果rid实参省略，通常会取事件当前元素（targets.current）；
	> this.next()无参数（或undefined）调用时，前段this.data向后续传；
	> $xx格式的变量名支持“值格式”取值（详见this.$value和__U.$val），
	  取值元素一般为事件当前元素（targets.current）；

	依赖：core.js

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function( $, T ) {
	//
	// 便捷引用
	//
	const
		Util = T.Kits.Util,
		PbElem = T.Kits.PbElem,
		chain  = T.Core.chain.bind(null),
		alone  = T.pbs().$alone.bind(null),
		tplNode = T.pbs().$node.bind(null);


	const
		// PB样式属性名
		__pbAttr = 'data-pb',

		// 名称空间
		NS = {
			Event: 	 	{},  // 事件相关（ev）
			Element: 	{},  // 元素相关（el）
			$: 		 	{},  // 检索相关（$）
			UI: 	 	{},  // 界面相关（ui）
			Effects: 	{},  // 动效相关（ef）
			Animation: 	{},  // 动画相关（an）
			Example: 	{},  // 样例操作（eg）
		};


	//
	// 基本常量。
	//
	const
		// 通用值存储键
		__VALUE = '__base::elem-value',

		// 消息计时器存储键
		__TIMER = '__base::elem-timer',

		// 数组值存储键
		__ARRAY = '__base::elem-array',

		// PB:tab参数选择器
		__pbTab = '[data-pb|=tab]',

		// 动画：刷新率（帧/秒）。
		__frameRate = 60,

		// 动画：单帧时间（毫秒）。
		__frameCell = 1000/__frameRate;



//
// 基础PB集。
// this继承基础PB集。
// this {
//  	data 		上一个PB传递来的数据
//  	targets 	目标元素配置集（委托调整）
//  	selector 	委托选择器串，可选
//  	tween 		函数队列区，常用于动画
//  	next()  	继续执行流调用（否则终止）
//  	dispose() 	移除当前调用句柄（如单次执行）
// }
// 接口约定：
// - 首个参数都为事件对象，模板中定义时忽略该参数；
// - 继续当前执行流（调用链）执行 this.next() 即可；
// - 向下一个PB传递数据data，执行 this.next(data)，
//   如果data未定义，原this.data向后续传。
//
// 注记：
// - 每个定义的next调用应当return，使得可以被代理；
// - 目标元素标识串rid格式详见Tpb.Kits.Util.$find；
//
// Event：
// - 事件对象为浏览器原生对象；
// - 自定义事件发送的附加数据在detail属性上；
//
// @param  {String|Number|null} rid 目标元素标识（相对ID）
// @return {next()}
//
T.pbs({
	//
	// 基本名称空间。
	//
	$:  NS.$,
	ev: NS.Event,
	el: NS.Element,
	ui: NS.UI,
	ef: NS.Effects,
	an: NS.Animation,

	eg: NS.Example,


	//-- 方法集 ---------------------------------------------------------------


	/**
	 * 取消默认行为。
	 */
	void( ev ) {
		ev.preventDefault();
		return this.next();
	},


	/**
	 * 简单停止。
	 * - 默认仅停止事件冒泡；
	 * - over为真会终止当前执行流；
	 * - all为真会结束后续同类绑定的调用；
	 *
	 * @param {Boolean} over 终止执行流
	 * @param {Boolean} all  全部终止（同类事件）
	 */
	stop( ev, over, all ) {
		if (over) {
			return all && ev.stopImmediatePropagation();
		}
		ev.stopPropagation();

		return this.next();
	},


	//-- 取值 -----------------------------------------------------------------
	// 获取数据进入执行流。
	// 只有如下4个检索元素的PB名前置$字符
	// （注：前置$字符用于顶级全局方法名称约定）


	/**
	 * 元素检索或包装。
	 * - 若rid未定义，取流程数据为rid；
	 * - 如果rid已经是对象，简单打包为Queue对象；
	 * - 如果rid包含相对ID且无扩展部分，检索单个元素，
	 *   否则按多元素匹配检索（详见Util.$find）；
	 * - 可以传递one参数为真明确检索单个元素；
	 * rid特例：{
	 *  	0     => targets.origin
	 *  	'@'   => targets.delegate
	 *  	''	  => targets.target || targets.current
	 *  	null  => targets.current
	 * }
	 * @param {String} rid 目标元素标识，可选
	 * @param {Boolean} one 明确单一匹配，可选
	 * @next: {Queue} tQ结果集
	 */
	$e( ev, rid, one ) {
		return this.next(
			this.$elem(rid, one) || $(this.data)
		);
	},


	/**
	 * $系集合版操作（$().XX）。
	 * - 仅取值操作会赋值流程数据；
	 * - 方法名和基本参数支持“值格式”取值；
	 *
	 * @data: {Element|[Element]}
	 * @param {String} $meth 方法名
	 * @param {Value} $arg 基本参数
	 * @param {...Value} rest 其余参数序列
	 */
	$$( ev, $meth, $arg, ...rest ) {
		let $els = $(this.data),
			_val = $els[ this.$value($meth) ](
				this.$value($arg),
				...rest
			);
		return _val !== $els ? this.next(_val) : this.next();
	},


	/**
	 * 直接赋值。
	 * - $val可为数值、字符串、对象或数组等；
	 * - $val为字符串时支持“值格式”取值；
	 * - 传递$key则在流程数据对象上存储值；
	 * 注意：
	 * - 模板中参数会作为JSON解析，因此对象属性名需有引号
	 *   （可为单引号）。
	 *
	 * @param {Mixed} $val 字面值，任意类型
	 * @param {String} $key 存储键，可选
	 */
	val( ev, $val, $key = null ) {
		let _val = this.$value($val);

		return this.next(
			$key === null ?
			_val :
			objStore(this.data, this.$value($key), _val)
		);
	},


	/**
	 * 简单追加。
	 * - 如果源数据不为数组则将之转为数组；
	 * - 接受多个值参数，顺序并列追加（数组参数不会展开）；
	 * 注：
	 * - 与Arr标记扩展之后相似，但此一次性添加；
	 *
	 * @param {...Value} val 追加值
	 */
	add( ev, ...val ) {
		var _dt = this.data;

		if ( !$.isArray(_dt) ) {
			_dt = Array.of(_dt);
		}
		// no spread
		return this.next( $.merge(_dt, val) );
	},


	/**
	 * 从环境取值。
	 * - 可用值视外部配置而定，默认$可用；
	 * - name未定义时取trigger值检索或值本身；
	 * - name为null时取事件对象本身；
	 * - name支持"tween"取流程函数队列引用；
	 * 通常配置：[
	 *  	$,
	 *  	Date, Math, Array, Object
	 * ]
	 * name: [
	 *  	null 	=> {Event} ev
	 *  	'tween' => {Array} this.tween
	 *  	'$' 	=> $
	 *  	'Date', 'Math', 'Array', 'Object' => ...
	 *
	 *  	默认 => ev.detail => ...
	 * ]
	 * @param {String} name 引用名
	 */
	env( ev, name = ev.detail ) {
		let _dt;

		switch (name) {
			case 'tween':
				_dt = this.tween; break;
			case null:
				_dt = ev; break;
			default:
				_dt = this.Global[name] || name;
		}
		return this.next(_dt);
	},


	/**
	 * 请求模板节点（异步）。
	 * @param {String} $name 模板节点名
	 */
	tpl( ev, $name ) {
		tplNode( this.$value($name) )
			.then( tpl => this.next(tpl) );
	},


	/**
	 * 表达式运算。
	 * - 构建一个代理函数封装表达式代码用于执行；
	 * - 调用时流程数据被绑定到this，其成员可直接引用（with）；
	 * - code也可能是一个函数定义串，生成一个新的函数；
	 * - 如果code未定义或为null，取流程数据为代码；
	 * - 表达式可立即执行或向后传递，由fn进行调用；
	 *
	 * 提示：
	 * - 改变流程数据，可实现对不同数据的相同操作；
	 * - 函数定义配合fn，可实现参数自由的不同调用；
	 *
	 * 注意：
	 * - 代码的执行被封装在一个用户全局域中（非window），
	 *   但JS下很难实现真正的沙盒，故代码的安全性仍需留意；
	 *
	 * - 表达式函数内的this会绑定到调用时传入的参数，
	 *   因此后续调用会动态的影响函数内的this值；
	 *
	 * @param {String} code 表达式代码
	 * @param {Boolean} run 立即执行
	 */
	expr( ev, code = null, run = true ) {
		if (code === null) {
			code = this.data;
		}
		if (!code) {
			return this.next();
		}
		let _fn = this.Scoper.runner(code);

		return this.next( run ? _fn(this.data) : _fn );
	},


	/**
	 * 构造日期对象。
	 * - 实参v1未定义时，构造当前时间对象；
	 * - rest为Date构造函数除首个外剩余的参数序列；
	 * - 明确传递v1为null，取this.data为构造值；
	 * - 取v1为this.data时，也可以为其补足剩余参数；
	 *
	 * 提示：
	 * 设置当前时间毫秒数也可以如下：
	 * > val('@$now') 或
	 * > env('Date'),fn('now') 或
	 * > env('$'),fn('now', ...) 更多格式
	 *
	 * @param {Number|String|Array} v1 初始值
	 * @param {Number...} rest 剩余参数序列
	 */
	date( ev, v1, ...rest ) {
		if (v1 === undefined) {
			return this.next(new Date());
		}
		if (v1 === null) {
			v1 = this.data;
		}
		if (!$.isArray(v1)) {
			v1 = [v1];
		}
		return this.next(new Date(...v1, ...rest));
	},


	/**
	 * 构造选择器。
	 * - 出于简单性，只有属性值支持动态求值；
	 * - 无参数调用结果为空，传递委托选择器（可能为undefined）；
	 * - 属性支持data系简写形式（tQ原生支持）；
	 * @param {String} attr 属性名
	 * @param {String} $val 属性值，可选
	 * @param {String} op 属性匹配符，可选
	 * @param {String} tag 标签名，可选
	 */
	slr( ev, attr, $val, op, tag = '' ) {
		let _slr = $.selector(
			tag,
			attr,
			this.$value($val) || '',
			op
		);
		return this.next(_slr || this.selector);
	},


	/**
	 * 修饰键状态封装。
	 * （Alt/Ctrl/Shift/Meta）
	 * 注：按使用频率排序成名。
	 */
	scam( ev ) {
		return this.next( keySCAM(ev) );
	},


	/**
	 * 正则表达式。
	 * - str未定义时取this.data为模式串；
	 * - 无修饰符时可传递一个空串；
	 * - 流程数据或str参数需要是一个字符串；
	 * @param {String} flag 修饰符（i|g|m|u...）
	 * @param {String} str 正则模式串，可选
	 */
	RE( ev, flag, str = null ) {
		if (str === null) {
			str = this.data;
		}
		return this.next( new RegExp(str, flag) );
	},


	/**
	 * 数组转换/扩展。
	 * - 设置数组扩展标志，后续流程数据为追加而非替换；
	 * - 若流程数据非数组，可选择转换或新建一个空数组；
	 * - 设置ext为假，关闭扩展模式（恢复正常）；
	 * - 无参数调用，默认转流程数据为数组；
	 * 注记：
	 * - 仅以下4个方法首字母大写，基本为类型转换；
	 * - 首字母大写用于顶级全局对象名称约定！
	 * op: {
	 *  	0 	  简单封装，流程数据为首个数组单元
	 *  	null  创建一个空数组，忽略原流程数据
	 * }
	 * @param {Boolean} ext 扩展模式
	 * @param {null|0} op 转换标示
	 */
	Arr( ev, ext, op ) {
		let _dt = this.data;

		switch (op) {
		case 0:
			_dt = Array.of(_dt); break;
		case null:
			_dt = $.object(); break;
		default:
			// null/undefined可用
			if (!$.isArray(_dt)) _dt = Array.from(_dt || '');
		}
		// Chain:next支持
		_dt._extend = !!ext;

		return this.next( _dt );
	},


	/**
	 * 转为字符串。
	 * @param {String} pre 前置串
	 * @param {String} suf 后置串
	 */
	Str( ev, pre = '', suf = '' ) {
		return this.next( pre + this.data + suf );
	},


	/**
	 * 转换到数值。
	 * - 指定转换进制则为整数，否则为浮点数；
	 * @param {Number} spec 进制值
	 */
	Num( ev, spec ) {
		return this.next(
			spec ? parseInt(this.data, spec) : parseFloat(this.data)
		);
	},


	/**
	 * 转为布尔值。
	 */
	Bool( /*ev*/ ) {
		return this.next( !!this.data );
	},


	//-- 进阶取值 -------------------------------------------------------------
	// 从流程数据上取值传递。
	// 若流程数据为多个成员的集合，取值为集合。单个成员取值本身。


	/**
	 * 元素上通用取值。
	 * - 单个目标元素取值本身，否则取值数组；
	 * - 支持$库中的通用取值方法，注意name值作用；
	 * - 默认针对流程元素，也可传递rid改变目标元素；
	 * 注：与Util.$val相似，此为集合版。
	 * meth {
	 *  	// name有值
	 *  	prop 	属性值
	 *  	attr 	特性值
	 *  	css 	计算样式值
	 *
	 *  	// $x系单纯取值方法
	 *  	// 注意name值，一般为undefined
	 *  	text 	元素内容
	 *  	width 	宽度值
	 *  	val 	表单控件value（通用）
	 *  	clone 	元素克隆（name可为true）
	 *  	......
	 *  	[假] 	普通储值（__VALUE）
	 * }
	 * 注记：
	 * - 增加rid可简单扩展取值源，便于连续PB求值；
	 *   如：流程数据为数组扩展模式时。
	 *
	 * @param {String} meth 取值方法
	 * @param {String} name 目标键名，可选
	 * @param {String} rid  目标元素标识，可选
	 */
	get( ev, meth, name, rid ) {
		let $el = this.$elem(rid) || $(this.data),
			_dt = meth ?
				$el[meth](name) :
				$el.map( e => this.Store(e)[__VALUE] );

		return this.next( alone(_dt) );
	},


	/**
	 * 取成员数据。
	 * - 数值支持负数从末尾算起；
	 * - 字符串键用于对象，忽略end；
	 * - pos可为一个键数组，零散的指定目标；
	 * - 目标数据含slice方法即可；
	 * @param {Number|String|Array} pos 起点位置或键或下标集
	 * @param {Number} end 位置终点，可选
	 */
	sub( ev, pos, end ) {
		let _obj = this.data;

		if (typeof pos == 'string') {
			return this.next( _obj[pos] );
		}
		return this.next(
			$.isArray(pos) ? pos.map(k => _obj[k]) : alone( _obj.slice(pos, end) )
		);
	},


	/**
	 * 成员值连接。
	 * @data: {Array}
	 * @param {String} sep 连接符
	 * @next: {String}
	 */
	join( ev, sep = '' ) {
		return this.next( this.data.join(sep) );
	},


	/**
	 * 计算修改。
	 * - 对流程数据计算修改；
	 * - 如果流程数据是数组/对象，原地修改；
	 * - 传递pos为null，取值和替换则对整个流程数据；
	 * - expr中用this引用源数据值；
	 * @param {String|Number} pos 键或下标
	 * @param {String} expr 计算表达式
	 */
	calc( ev, pos, expr = '' ) {
		let _v = this.data;

		if (pos !== null) {
			_v[pos] = this.Scoper.runner(expr)(_v[pos]);
			return this.next();
		}
		return this.next( this.Scoper.runner(expr)(_v) );
	},


	//-- 数据处理 -------------------------------------------------------------


	/**
	 * 取反。
	 * - 传递skip为真跳过对undefined值的处理；
	 * @param {Boolean} skip 跳过未定义
	 */
	not( ev, skip ) {
		if (skip && this.data === undefined) {
			return this.next();
		}
		return this.next( !this.data );
	},


	/**
	 * 相等转换。
	 * - 对流程值全等测试，匹配则改变流程值；
	 * - 如果$val未定义，取trigger值；
	 * @param {Mixed} val 相等测试值
	 * @param {Mixed} eq 相等替换值，可选
	 * @param {Mixed} ne 不相等替换值，可选
	 */
	eqto( ev, $val, eq = true, ne = false ) {
		if ($val === undefined) {
			$val = ev.detail;
		}
		return this.next( this.data === this.$value($val) ? eq : ne );
	},


	/**
	 * 流程函数调用（通用）。
	 * - 默认取this.data[$name]为目标函数；
	 * - 若$name为null，视this.data本身为函数；
	 * - args为目标函数参数序列，若为null，取trigger值；
	 * - $name及参数序列都支持“值格式”取值；
	 * 注：
	 * - 若函数调用无返回值，则不改变流程数据引用；
	 * - 目标不为函数时输出一条错误信息后简单跳过；
	 * - 一般在动态获取目标函数或参数时才使用；
	 *
	 * 例：{
	 *  	$E(...), fn('filter','@-val')
	 *  	// 调用this.data.filter(...)过滤元素集
	 *  	// $E打包当前元素为tQ结果集
	 *  	// @-val取当前元素data-val值为选择器
	 *
	 *  	expr(...), fn(null, 'abc')
	 *  	// 调用this.data('abc')
	 *  	// expr构造出一个小函数
	 *
	 *  	Arr, fn('push', null)
	 *  	// 调用this.data.push(ev.detail)
	 *  	// Arr构造数组
	 * }
	 * @param {String|null} $name 调用名
	 * @param {...Mixed|null} args 目标函数的参数序列
	 */
	fn( ev, $name, ...args ) {
		let _ns = this.$value($name),
			_fn = fnOper(this.data, _ns);

		if (!_fn) {
			console.error(`fn: not function from ${_ns} getter.`);
			return this.next();
		}
		if (args[0] === null) {
			args = ev.detail;
		}
		return this.next(
			_fn.bind(this.data)( ...fnArgs(args, this.$value.bind(this)) )
		);
	},


	/**
	 * 流程函数调用（连续）。
	 * - 同fn，但完全不改变流程数据引用（不管函数返回值）；
	 * - 后续PB可连续调用流程数据里的函数；
	 */
	xfn( ev, $name, ...args ) {
		T.proxy(this).fn(ev, $name, ...args);
		// no data
		return this.next();
	},


	/**
	 * 集合测试（某一匹配）。
	 * - $val未定义时取成员值本身真假；
	 * - 成员值与测试值为全等测试；
	 * - 流程数据需为数组；
	 *
	 * @param {String} $val 匹配测试值，可选
	 * @param {String} _op 操作名（some|every），私用
	 * @next: {Boolean}
	 */
	some( ev, $val, _op = 'some' ) {
		let _v = this.$value($val),
			_f = _v === undefined ? (v => !!v) : (v === _v);

		return this.next( $[_op](this.data, _f) );
	},


	/**
	 * 集合测试（全部匹配）。
	 * 参数说明同some。
	 * @param {String} $val 匹配测试值，可选
	 * @next: {Boolean}
	 */
	every( ev, $val ) {
		return this.some(ev, $val, 'every');
	},


	//-- 函数队列 -------------------------------------------------------------
	// 处理this.tween区域
	// 包含动画驱动基础函数


	/**
	 * 构造函数压入tween。
	 * - $obj为函数宿主对象，传递假值取流程数据；
	 * - $obj支持“值格式”检索获取函数宿主对象；
	 * - args为函数参数序列，若为null，取trigger值；
	 * - $name及args内也支持“值格式”取值；
	 * - 构造为bound函数：this为宿主，参数一并绑定；
	 *
	 * 注记：
	 * 函数宿主/函数名/参数可自由指定，fn调用受制于PB的执行顺序。
	 *
	 * @param {String|Object} $obj 函数宿主
	 * @param {...Mixed|null} args 目标函数的参数序列
	 */
	func( ev, $obj, $name, ...args ) {
		$obj = $obj || this.data;

		if (typeof $obj == 'string') {
			$obj = this.$value($obj);
		}
		let _fn = fnOper( $obj, this.$value($name) );

		if (_fn) {
			if (args.length == 1 && args[0] === null) {
				args = ev.detail;
			}
			this.tween.push(
				_fn.bind( $obj, ...fnArgs(args, this.$value.bind(this)) )
			);
		}
		return this.next();
	},


	/**
	 * 函数序列调用。
	 * - tween为一个函数队列，顺序执行一次；
	 * - 前一个函数的返回值会作为后一个函数的参数；
	 * - 下标位置支持负数从末尾算起；
	 * - 流程数据为初始参数（首个函数接收）；
	 * - 最后一个函数的执行结果作为流程数据传递；
	 *
	 * @param {Number} beg 队列起始下标
	 * @param {Number} beg 队列结束下标，可选
	 */
	call( ev, beg = 0, end = undefined ) {
		if (!this.tween.length) {
			return this.next();
		}
		let _dt = this.tween
			.slice(beg, end)
			.reduce(
				(dt, fn) => fn(dt), this.data
			);
		return this.next( _dt );
	},


	/**
	 * 动画队列清理。
	 * - 或指定一个长度，清除多余的成员；
	 * - 一般用于顺序执行多段不同的动画集；
	 * @param {Number} len 队列长度重置
	 */
	tween( ev, len = 0 ) {
		this.tween.length = len;
		return this.next();
	},


	//-- 元素处理 -------------------------------------------------------------
	// 流程数据本身为元素（集），自我处理；
	// 该部分取值会考虑trigger发送的值（ev.detail）；
	// 不会向流程赋新值；


	/**
	 * 通用赋值。
	 * - $name和$val支持“值格式”取值；
	 * - $val未定义时取trigger值；
	 * - 支持prop|attr|css|$系赋值；
	 *
	 * @param {String} $name 键名或方法名
	 * @param {Mixed} $val   取用值，可选
	 * @param {String} type  赋值类型[prop|attr|css|$]，可选
	 * @param {...Value} rest 可能的参数序列，可选
	 */
	set( ev, $name, $val, type, ...rest ) {
		if ($val === undefined) {
			$val = ev.detail;
		}
		Util.$set(
			$(this.data),
			type || 'prop',
			this.$value( $name ),
			this.$value( $val ), ...rest
		);
		return this.next();
	},


	/**
	 * PB属性操作（参数赋值/取值）。
	 * - 对data-pb属性值中的参数部分赋值；
	 * - $val支持“值格式”取值；
	 * - 传递$val空串可以清除参数值；
	 * 注：
	 * - 若$val首个参数为true，表示等待动画执行完毕后才继续执行流；
	 * - 支持多个元素动画的等待，但如果有一个失败，流程就无法继续；
	 *
	 * @param {...String} $wds 参数词序列
	 * @next: {[String]|String}
	 */
	pba( ev, ...$wds ) {
		let $el = $(this.data);

		return $el.length ?
			pbvCalls($el, $wds.map(w => this.$value(w)), this.next, 'args') :
			this.next();
	},


	/**
	 * PB属性操作（选项配置/取值）。
	 * - 对data-pb属性值中的选项部分操作；
	 * - $wds支持“值格式”取值；
	 * - 若$wds未定义，取流程数据值；
	 * - 若$val首个参数为true，表示等待动画执行完毕后才继续执行流；
	 * $wds格式: {
	 *  	+ 	添加（默认，可选）
	 *  	- 	删除（-* 清空）
	 *  	! 	有无切换
	 * }
	 * @param {...String} $wds 选项词序列
	 * @next: {[Set]|Set}
	 */
	pbo( ev, ...$wds ) {
		let $el = $(this.data);

		return $el.length ?
			pbvCalls($el, $wds.map(w => this.$value(w)), this.next, 'opts') :
			this.next();
	},


	//-- 对外操作 -------------------------------------------------------------
	// 用流程数据对即时检索的目标元素操作。
	// 该部分操作都有rid参数。


	/**
	 * 赋值。
	 * - $name和流程数据支持“值格式”取值；
	 * - 传递类型为“$”，对目标元素执行$系设置；
	 *   （此时$name为方法名）
	 * type: {
	 *  	prop 	特性值，默认
	 *  	attr 	属性值（attribute）
	 *  	css 	样式（内联style）
	 *  	$ 		$系方法操作（详见__U.$set）
	 * }
	 * @param {String} $name 赋值键名或$方法名
	 * @param {String} rid   目标元素标识，可选
	 * @param {String} type  操作类型，可选
	 * @param {...Value} rest 可能的参数序列，可选
	 */
	put( ev, $name, rid, type, ...rest ) {
		// rid默认null
		let _el = Util.evel(this.targets, rid);

		if (!_el) {
			return this.next();
		}
		let _dt = this.data;
		this.data = _el;

		// ev.detail by set...
		return this.set( ev, $name, _dt, type, ...rest );
	},


	/**
	 * 数据记忆。
	 * - 将流程数据与目标元素关联存储（WeakMap）；
	 * - 数据可能存储到多个目标元素上；
	 * 注记：
	 * 一个标识应用于一类操作，不支持用户指定键值。
	 *
	 * @param {String} rid 容器元素标识
	 */
	hold( ev, rid = null ) {
		let $box = this.$elem(rid);

		if ($box.length) {
			$box.forEach( el => this.Store(el)[__VALUE] = this.data );
		}
		return this.next();
	},


	/**
	 * 存储到集合。
	 * - 流程数据存储到元素关联的外部空间；
	 * - 如果指定下标位置，则覆盖相应位置值；
	 * @param {String} rid 容器元素标识
	 * @param {Number} idx 位置下标，可选
	 */
	push( ev, rid, idx = null ) {
		let $box = this.$elem(rid);

		if ($box.length) {
			$box.forEach(
				el => dataPush(this.Store(el)[__ARRAY], this.data, idx)
			);
		}
		return this.next();
	},


	/**
	 * 从集合提取。
	 * - 把通过push存储的数据提取到流程；
	 * - 传递idx数值表示取出集合中的特定数据；
	 * - 默认取出全部集合数据；
	 * @param {String} rid 容器元素标识
	 * @param {Number} idx 位置下标，可选
	 */
	pull( ev, rid, idx ) {
		let $box = this.$elem(rid),
			_buf = [];

		if ($box.length) {
			$box.forEach(
				el => dataPull(this.Store(el)[__ARRAY], idx, _buf)
			);
		}
		return this.next(_buf);
	},


	//-- 系统全局 -------------------------------------------------------------


	/**
	 * 标志设置/取值。
	 * - 标志设置时不改变流程数据；
	 * - 标志名为数组时仅支持取值；
	 * $val: {
	 *   	未定义 	取标志值
	 *   	null 	删除该标志
	 *   	... 	支持值格式取值
	 * }
	 * @param {String|Array} name 标志名（集）
	 * @param {Mixed} $val 标志值，可选
	 */
	flag( ev, name, $val ) {
		if ($val === undefined) {
			return tihs.next( values(this.Marks, name) );
		}
		if ($val === null) {
			delete this.Marks[name];
		}
		else {
			this.Marks[name] = this.$value($val);
		}
		return this.next();
	},


	/**
	 * 通过检测。
	 * - 检测标志值是否为真，真则允许流程继续；
	 * - 多个标志之间为“Or”关系，满足一个即可；
	 * - 多个单独的 pass 序列可构成 And 关系；
	 * - 未指定标志时，直接测试this.data是否为真；
	 *
	 * @param {...String} flags 标志词集
	 */
	pass( ev, ...flags ) {
		let _ok = flags.length ?
			flags.some( fg => !!this.Marss[fg] ) : this.data;

		return _ok && this.next();
	},


	/**
	 * 判断终止。
	 * - 与stop类似，但此处是对流程值做真值检测；
	 * - 检测目标为真为匹配，终止当前执行流；
	 * - 若检测目标是数组，任何一个为真都为匹配；
	 * - 两个参数加入匹配时的处理；
	 * 注：
	 * - 多个标志之间为“Or”关系，与连续单个end相同；
	 * - 该方法一般配合flag取值使用；
	 *
	 * @param {Boolean} bubbles 停止冒泡
	 * @param {Boolean} all 全部终止（同类事件）
	 */
	end( ev, bubbles, all ) {
		let _dt = this.data;

		if ($.isArray) {
			_dt = _dt.some( v => !!v );
		}
		if (!_dt) return this.next();

		// chain break...
		if (all) {
			return ev.stopImmediatePropagation();
		}
		return bubbles && ev.stopPropagation();
	},


	//-- 键盘行为 -------------------------------------------------------------


	/**
	 * 键位过滤传递。
	 * - 键名匹配才继续流程并传递键名；
	 * - 键名可指定多个，若无指定，视为全部通过；
	 * - 末尾参数也用于终止/通过的逻辑判断：{
	 *  	真（有效键值）： 通过
	 *  	假（0 或假值）： 终止
	 *   }
	 * - 不匹配终止流程，但不会中止事件冒泡；
	 * 注：字符键有两个大小写不同的键名，如：F,f
	 * 例：
	 * - keys('Tab','Enter') 仅Tab和回车键通过并继续流程；
	 * - keys('Tab','Enter',false) Tab和回车键会终止流程；
	 * - keys 与 keys(false) 结果一样（无终止键名）；
	 *
	 * @param {...String} vs 键名序列
	 */
	keys( ev, ...vs ) {
		let _val = keyName(ev);

		if (!vs.length || _val === undefined) {
			return this.next( _val );
		}
		let _pas = vs[vs.length - 1],
			_has = vs.indexOf(_val) >= 0;

		return (_pas ? _has : !_has) && this.next( _val );
	},


	/**
	 * 修饰键限定。
	 * - pass为通过时，修饰键匹配则通过；
	 * - pass为禁止时，无匹配时则正常通过；
	 * - 通常与keys合用构造快捷键，也用于屏蔽修饰键；
	 *
	 * 修饰键名称（忽略大小写）[
	 *  	Ctrl, Shift, Alt, Meta
	 * ]
	 * @param {String|Array} names 修饰键名（集）
	 * @param {Boolean|0} pass 通过或禁止
	 */
	xkey( ev, names, pass = true ) {
		let _ok = Util.scamMasked( ev, names );
		return (pass ? _ok : !_ok) && this.next( keyName(ev) );
	},


	/**
	 * 键=>方法映射。
	 * - 只有键名匹配才会设置方法传递；
	 * - 方法已经绑定this到宿主对象（流程数据）；
	 * - 方法名null表示流程数据本身；
	 * - 一个键映射一个方法，方法无效时设置为null；
	 * 提示：
	 * - 后续用PB:fn调用传递的方法，提供所需参数；
	 *
	 * @param {String} key 键名
	 * @param {String} fun 方法名
	 */
	kmap( ev, key, fun ) {
		let _fn = fnOper(this.data, fun) || null;

		if (_fn) {
			_fn = _fn.bind(this.data);
		}
		return this.next( keyName(ev) == key ? _fn : undefined );
	},


	//-- 杂项 -----------------------------------------------------------------


	/**
	 * 消息提示。
	 * - 持续时间由UI设计师在模板中指定；
	 * - 流程数据作为消息体，可以是多种类型；
	 * - 计时器ID记录在各消息容器上；
	 * @param {String} rid 显示容器标识
	 * @param {Number} time 持续时间（秒），可选
	 */
	info( ev, rid, time ) {
		let $to = this.$elem(rid);
		$to.html(this.data || '');

		if (time) {
			$to.forEach( el => {
				clearTimeout( this.Store(el)[__TIMER] );
				this.Store(el)[__TIMER] = setTimeout( () => $.empty(el), time * 1000 );
			});
		}
		return this.next();
	},


	/**
	 * 简单显示信息。
	 */
	debug( ev, msg ) {
		msg = msg || this.data || ev;

		console.info(
			`Debug: ${this.targets.origin.tagName}: ${this.selector}...`, msg
		);
		return this.next();
	},

});


//
// 事件相关。
// 向子元素触发同名事件会导致循环触发（冒泡机制）。
// 应当在子元素至当前元素之间停止同名事件的冒泡。
//
Object.assign( NS.Event, {
	/**
	 * 触发事件跳转。
	 * - 取流程数据为发送值（可以较复杂）；
	 * - 传递$evn为null，取trigger发送值；
	 * @param {String} rid 目标元素标识
	 * @param {String} $evn 事件名
	 * @param {Number} delay 延迟毫秒数，可选
	 * @param {Mixed} _val 发送值，私用
	 */
	go( ev, rid, $evn, delay, _val ) {
		if ($evn === null) {
			$evn = ev.detail;
		}
		Util.fireEvent(
			this.$elem(rid),
			this.$value($evn),
			_val === undefined ? this.data : _val,
			delay
		);
		return this.next();
	},


	/**
	 * 对流程元素激发事件。
	 * - 传递$evn为null，取trigger值（fire处理）；
	 * @param {String} $evn 事件名
	 * @param {Mixed} $val 发送数据，可选
	 * @param {Number} delay 延迟毫秒数，可选
	 */
	xgo( ev, $evn, $val, delay ) {
		return this.go(
			ev,
			this.data,
			$evn,
			delay,
			this.$value($val) || null
		);
	},


	/**
	 * 构造判断激发对象。
	 * - 比较pass与流程数据，相等则构造激发对象传递；
	 * - $env定义与fire约定相同；
	 * - 注：激发对象由后续的go具体实施；
	 * 激发对象：{
	 *  	event:  {String}  事件名
	 *  	passed: {Boolean} 测试通过
	 * }
	 * @param {Value} pass  测试通过值
	 * @param {String} $evn 事件名
	 */
	test( ev, pass, $evn ) {
		let _obj;

		if (pass === this.data) {
			_obj = { passed: true, event: $evn };
		}
		return this.next(_obj);
	},


	/**
	 * 判断激发事件。
	 * - 根据流程数据对象的值情况，决定激发目标事件；
	 * - 流程数据包含：{
	 *  	passed：必须为true
	 *  	event： 事件名
	 * }
	 * @param {String} rid 目标元素标识
	 * @param {Mixed} $val 发送数据，可选
	 * @param {Number} delay 延迟毫秒数，可选
	 */
	fire( ev, rid, $val, delay = true ) {
		var _obj = this.data;

		if (!_obj || !_obj.passed) {
			return this.next();
		}
		return this.go(
			ev,
			rid,
			_obj.event,
			delay,
			this.$value($val) || null
		);
	},


	/**
	 * 单次触发（默认延迟）。
	 * - 传递$evn为null，取trigger值；
	 * - 流程数据作为发送值；
	 * 注：
	 * - 一般用于首次UI就绪后的事件联动；
	 *
	 * @param {String} rid 目标元素标识
	 * @param {String} $evn 事件名
	 * @param {Number|Boolean} delay 延迟毫秒数，可选
	 */
	one( ev, rid, $evn, delay = true ) {
		if ($evn === null) {
			$evn = ev.detail;
		}
		this.dispose();  // 调用链内清除

		return this.go(
			ev, rid, $evn, delay, this.data || null
		);
	},


	/**
	 * 控件检测激发。
	 * - 根据流程控件元素checked状态向目标发送事件。
	 * - 会同时发送checked值为附加数据；
	 * - 实时激发；
	 * @param {String} rid 目标元素标识
	 * @param {String} $n1 true时的事件名
	 * @param {String} $n0 false时的事件名，可选
	 */
	check( ev, rid, $n1, $n0 ) {
		let _ok = this.data.checked,
			$en = (_ok || !$n0) ? $n1 : $n0;

		Util.fireEvent(
			this.$elem(rid), this.$value($en), _ok
		);
		return this.next();
	},


	/**
	 * 事件绑定。
	 * - 通过事件名和选择器检索调用链对象；
	 * - 调用链由前置-字符的On事件定义构造；
	 * - 同一调用链对同一元素的同一配置不重复绑定；
	 * 注：
	 * - 一般用于临时绑定，如频发事件move的处理；
	 * @param {String} evn 事件名
	 * @param {String} slr 委托选择器
	 */
	bind( ev, evn, slr ) {
		$(this.data)
			.each(
				el => bindChain(el, evn, slr)
			);
		return this.next();
	},


	/**
	 * 事件解绑定。
	 * - bind的逆过程；
	 * @param {String} evn 事件名
	 * @param {String} slr 委托选择器
	 */
	unbind( ev, evn, slr ) {
		$(this.data)
			.each(
				el => unbindChain(el, evn, slr)
			);
		return this.next();
	},


	/**
	 * 单次绑定（自动解绑）。
	 * - 默认检索预存储的调用链；
	 * - 如果next为true，取当前next为事件处理函数；
	 *   （即只有在事件触发后，执行流才继续）
	 * - 只在解绑之后新的再次绑定才会有效（once）；
	 * @param {String} evn 事件名
	 * @param {String} slr 委托选择器
	 * @param {Boolean} next 绑定流程接续
	 */
	xbind( ev, evn, slr, next ) {
		let _fn = next && [this.next];

		$(this.data)
			.each( el =>
				onceBinds( el, evn, slr || null, _fn )
			);

		return this.next();
	},


	//-- 事件取值 -------------------------------------------------------------


	/**
	 * 提取鼠标位置。
	 * @param  {String} type 位置类型（page|client|offset）
	 * @return {Object} {top, left}
	 */
	point( ev, type = 'page' ) {
		return {
			top:  ev[ type + 'Y' ],
			left: ev[ type + 'X' ],
		};
	},

});


//
// 元素相关。
// 指与元素关联较为紧密的部分。
//
Object.assign( NS.Element, {
	/**
	 * 属性赋值（Property）。
	 * - $val未定义时取trigger值；
	 * @param {String} $name 属性名
	 * @param {String|Number} $val 待赋值
	 */
	prop( ev, $name, $val ) {
		return this.set(ev, $name, $val, 'prop');
		// already next()
	},


	/**
	 * 特性赋值（Attribute）。
	 * - $val未定义时取trigger值；
	 * @param {String} $name 属性名
	 * @param {String|Number} $val 待赋值
	 */
	attr( ev, $name, $val ) {
		return this.set(ev, $name, $val, 'attr');
		// already next()
	},


	/**
	 * 样式赋值。
	 * - $val未定义时取trigger值；
	 * - 实为设置内联样式（style）；
	 * @param {string} $name 样式属性名
	 * @param {String|Number} $val 待赋值
	 */
	css( ev, $name, $val ) {
		return this.set(ev, $name, $val, 'css');
		// already next()
	},


	/**
	 * 类名操作。
	 * - 支持空格分隔的多个名称；
	 * - $name为null时取trigger值（与set系不同）；
	 * - force仅在切换操作中有效，其它操作忽略；
	 * 操作类型：{
	 *  	0 	切换。$name空值整体切换
	 *  	1 	添加
	 *  	-1 	删除。$name空值会清空全部类名
	 * }
	 * @param {String} $name 类名序列
	 * @param {Number} op 操作类型
	 * @param {Boolean} force 强制设定，可选
	 */
	cls( ev, $name, op = 0, force = null ) {
		if ($name === null) {
			$name = ev.detail;
		}
		clsHandles[op](
			$(this.data), this.$value($name) || '', force
		);
		return this.next();
	},


	/**
	 * 元素内联样式。
	 * @param {string} name 样式属性名
	 */
	style( ev, name ) {
		let _dt = $(this.data)
			.map( e => e.style[name] );

		return this.next( alone(_dt) );
	},


	/**
	 * 节点插入。
	 * - 默认内前插，可对后续兄弟元素样式施加影响（X + p）；
	 * - 也可插入目标元素之前或之后，或填充、替换等；
	 * - 目标容器元素只支持单个；
	 *
	 * 注：一般配合this:tpl使用。
	 *
	 * @param {String} rid 目标容器/元素标识
	 * @param {String|Number} where 目标位置/方法
	 */
	into( ev, rid = null, where = 2 ) {
		$[ __Methods[where] ]
		(
			Util.evel(this.targets, rid),
			this.data
		);
		return this.next();
	},


	/**
	 * 双值切换。
	 * - 流程数据为单元素；
	 * - 对流程元素的name属性/特性/样式/内容等切换；
	 * type: [prop|attr|css|$]
	 * 例：
	 * - name: text, type: $ => 元素内容切换
	 *
	 * @param {Value} v1 切换值A
	 * @param {Value} v2 切换值B
	 * @param {String} name 赋值键名，可选
	 * @param {String} type 操作类型，可选
	 */
	swap( ev, v1, v2, name = 'value', type = 'prop' ) {
		let _el = this.data,
			_v0 = Util.$get(_el, type, name);

		Util.$set(
			$(_el),
			type,
			name,
			(_v0 === v1 ? v2 : v1)
		);
		return this.next();
	},


	/**
	 * 内容迁移。
	 * 获取内容并替换目标元素。
	 * 1. 将目标元素的内容迁移至流程元素内；
	 * 2. 用流程元素替换原目标元素（在DOM中）；
	 * - 可以有多个目标元素，但流程元素只能是单个；
	 * - 多个目标元素时，替换和滚动条恢复都只认首个元素；
	 * 注：
	 * - 会恢复垂直滚动条的位置（如果有）；
	 * - 流程元素可能是一个模板节点，不在DOM内；
	 * - 通常配合this:tpl使用；
	 *
	 * @param {String} rid 内容元素标识
	 */
	cons( ev, rid ) {
		let $con = this.$elem(rid),
			_box = this.data;

		if ($con.length) {
			let _pos = $.scrollTop($con[0]);

			$con.contents().appendTo(_box);
			$.replace(_box, $con[0]);

			$.scrollTop(_box, _pos);
		}
		return this.next();
	},


	/**
	 * 样式值设置到目标元素。
	 * - 从流程元素的样式属性里取值（内联样式）；
	 * - 默认赋值到目标元素的同名样式；
	 * - 如果获取的样式值未定义，不会进行赋值；
	 *
	 * @param {String} rid 目标元素标识
	 * @param {String} name 样式属性名
	 * @param {String} key  目标键名，可选
	 * @param {String} type 操作类型（css|prop|attr），可选
	 */
	cssto( ev, rid, name, key = name, type = 'css' ) {
		T.proxy(this)
			.style(ev, name)
			.put(ev, key, rid, type);

		return this.next();
	},


	/**
	 * 清除select选取。
	 * @param {String} rid 选单元素标识，可选
	 */
	unsel( ev, rid ) {
		let $sel = this.$elem(rid) ||
			$(this.data);

		$sel.forEach( el => el.selectedIndex = -1 );
		return this.next();
	},


	/**
	 * 表单提交。
	 * - 向form元素发送提交，包含修饰键位状态；
	 * - 此动作一般由form内的表单控件触发；
	 * - 仅支持单一表单元素提交；
	 * 注记：
	 * - form的submit事件没有修饰键状态；
	 *
	 * @param {String} rid form元素标识，可选
	 */
	submit( ev, rid ) {
		let _frm = this.$elem(rid) || [this.targets.current.form];

		$.trigger(
			_frm[0], 'submit', keySCAM(ev)
		);
		return this.next();
	},


	/**
	 * 控件事件分发（表单重置）。
	 * - 检查表单内控件值是否会改变，决定触发change；
	 * - 向内部控件分发的change事件在reset之后发生（延迟）；
	 * 注记：
	 * - 浏览器尚未实现表单重置时其内控件值改变的事件；
	 *
	 * @param {String} rid form元素标识，可选
	 */
	reseton( ev, rid ) {
		let _frm = this.$elem(rid) || [this.targets.current.form];

		Util.fireEvent(
			$( changeFC(_frm[0]) ), 'change', null, true
		);
		return this.next();
	},

});


//
// tQuery相关。
// - 流程数据一律视为已封装Queue实例；
// - this为PB顶级域，而非当前对象；
//
Object.assign( NS.$, {
	/**
	 * 单元素检索。
	 * - 流程数据为检索上下文（起点元素）；
	 * - 若无起点元素，会以文档为检索上下文；
	 * @param {Selector} rid 相对选择器
	 * @next: {Element|null}
	 */
	one( ev, rid = '' ) {
		return this.next(
			Util.$find( rid.trim(), this.data, true)
		);
	},


	/**
	 * 多元素检索。
	 * .one的多元素版，说明同上；
	 * @param {Selector} rid 相对选择器
	 * @next: {Queue}
	 */
	all( ev, rid = '' ) {
		return this.next(
			Util.$find( rid.trim(), this.data, false)
		);
	},


	/**
	 * 源码提取/转换。
	 * - 目标为元素时取其innerHTML或outerHTML；
	 * - 目标为源码时进行html转义（< => &lt;）；
	 * 注：
	 * - 元素集为空时向后传递值为null；
	 * - 目标为源码时，outer参数无意义；
	 *
	 * @data: {Node|[Node]|String}
	 * @param {Boolean} outer 是否取outerHTML
	 */
	html( ev, outer ) {
		let _dt = this.data;

		if (typeof _dt == 'string') {
			_dt = $.html(null, _dt);
		} else {
			_dt = outer ? $(_dt).prop('outerHTML') : $(_dt).html();
		}
		return this.next( alone(_dt) );
	},


	/**
	 * 文本提取/转换。
	 * - 目标为元素时取其textContent；
	 * - 目标为源码时解译为文本（&lt; => <）；
	 * 注：
	 * - 元素集为空时向后传递值为null；
	 *
	 * @data: {Node|[Node]|String}
	 * @param {Boolean} outer 是否取outerHTML
	 */
	text(/* ev */) {
		let _dt = this.data;

		return this.next( alone(
			typeof _dt == 'string' ? $.text(null, _dt) : $(_dt).text()
		));
	},


	/**
	 * 将源码转为元素（集）。
	 * @data: String
	 * @param {String} html 源码，可选
	 */
	elem( ev, html ) {
		let _els = $.create(html || this.data).children;

		return this.next(
			_els.length <= 1 ? _els[0] : Array.from(_els)
		);
	},


	/**
	 * 元素集匹配。
	 * - fn(ev, 'is', $slr) 的独立版；
	 * - 流程数据需为Queue实例；
	 *
	 * @param {String} $slr 选择器
	 * @next: {Array}
	 */
	is( ev, $slr ) {
		$slr = this.$value($slr);
		return this.next( this.data.is($slr).get() );
	},


	/**
	 * 元素集过滤。
	 * - fn(ev, 'filter', $slr) 的独立版；
	 * - 流程数据需为Queue实例；
	 *
	 * @param {String} $slr 选择器
	 * @next: {Queue}
	 */
	filter( ev, $slr ) {
		$slr = this.$value($slr);
		return this.next( this.data.filter($slr) );
	},


	/**
	 * 元素删除。
	 * - 流程元素脱离DOM，流程内保持；
	 * @param {String} rid 目标元素标识，可选
	 * @param {Boolean} all 多获取，可选
	 */
	remove( ev, rid, all ) {
		$( this.$elem(rid, all) || this.data ).remove();
		return this.next();
	},


	/**
	 * 元素克隆。
	 * @param {Boolean} event 事件克隆
	 * @param {Boolean} deep  深度克隆（含子元素），可选
	 */
	clone( ev, event, deep = true ) {
		return this.next(
			$(this.data).clone(event, deep)
		);
	},

});


//
// UI相关。
// 在WebApp中会大量使用。
//
Object.assign( NS.UI, {
	/**
	 * 当前抑制。
	 * - 测试目标元素是否匹配选择器，是则流程终止；
	 * - 用于UI当前状态保持，选择性中止事件的执行；
	 * 注记：
	 * - 出于简单实用性，不考虑测试流程数据；
	 *
	 * 序列：$e(rid), is(slr), end
	 *
	 * @param {String} slr 选择器（默认PB:tab）
	 * @param {String} rid 目标元素标识，可选
	 */
	stay( ev, rid, slr = __pbTab ) {
		let $el = this.$elem(rid) ||
			$(this.data);

		return $el.is(slr).some( v => !!v ) || this.next();
	},


	/**
	 * 隐藏（visibility:hidden）
	 * - 设置元素不可见（仍占用空间；
	 * - 若rid未定义，会取流程数据为目标元素；
	 */
	hide( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, 'hide');
		return this.next();
	},


	/**
	 * 显示（visibility:visible）
	 * - 设置元素为可见；
	 */
	show( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, '-hide', '-lose', '-fold');
		return this.next();
	},


	/**
	 * 消失（display:none）
	 * - 将元素隐藏消失（不占用空间）；
	 */
	lose( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, 'lose');
		return this.next();
	},


	/**
	 * 出现（display:inherit）
	 * - 恢复元素的显示；
	 */
	rise( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, '-lose', '-hide', '-fold');
		return this.next();
	},


	/**
	 * 折叠
	 * 实际上为操作目标元素的下一个兄弟元素。
	 */
	fold( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, 'fold');
		return this.next();
	},


	/**
	 * 展开
	 * 为fold的反操作。
	 */
	unfold( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, '-fold', '-hide', '-lose');
		return this.next();
	},


	/**
	 * 折叠切换（fold|unfold）
	 * 需要删除外观等效的“hide|lose”选项值。
	 */
	folds( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, '-hide', '-lose', '!fold');
		return this.next();
	},


	/**
	 * 折叠状态。
	 * - 折叠时为true，展开时为false；
	 * - 仅支持单个（首个）目标元素测试；
	 * @next: {Boolean}
	 */
	folded( ev, rid ) {
		return this.next(
			T.proxy(this).$e(ev, rid).pbo(ev).data
			.has('fold')
		);
	},


	/**
	 * 隐藏子菜单
	 * 结构：li/h6, menu
	 * - 样式隐藏<menu>子元素；
	 */
	unpop( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, 'unpop');
		return this.next();
	},


	/**
	 * 弹出子菜单
	 * 结构：li/h6, menu
	 * - 样式显示<menu>子元素；
	 */
	popup( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, '-unpop');
		return this.next();
	},


	/**
	 * 失效状态。
	 * - 仅为外观表现，通常样式为中等灰色；
	 */
	invalid( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, 'disabled');
		return this.next();
	},


	/**
	 * 取消失效回复正常。
	 */
	valid( ev, rid ) {
		T.proxy(this).$e(ev, rid).pbo(ev, '-disabled');
		return this.next();
	},


	/**
	 * 检查是否启用。
	 * - 仅支持单个（首个）目标元素测试；
	 * @param {string} rid 目标元素标识
	 * @next: {Boolean}
	 */
	enabled( ev, rid ) {
		let $el = this.$elem(rid) || $(this.data);
			_val = T.proxy(this)
				.next($el[0]).pbo(ev).data.has('disabled');

		return this.next(!_val);
	},


	/**
	 * 标签页。
	 * PB参数：tab-[name]
	 * - 在一个元素集合中互斥选定当前目标元素；
	 * - 应当是在共同根容器节点上的一个委托绑定；
	 * - 如果仅针对直接子元素，可不用委托；
	 * @param {String} name 具项标签名，可选
	 */
	tabs( ev, name = '' ) {
		T.proxy(this)
			.$e(ev, this.selector || '>*').pba(ev, '')
			.$e(ev, null).pba(ev, 'tab', name);

		return this.next();
	},


	/**
	 * 设置目标焦点。
	 * - 设置延迟可跳过当前流程，对结果操作；
	 * @param {Number} delay 延迟毫秒数，可选
	 */
	focus( ev, rid, delay ) {
		Util.fireEvent(
			this.$elem(rid) || $(this.data),
			'focus',
			null,
			delay
		);
		return this.next();
	},


	/**
	 * 移除焦点。
	 * 可消除输入框提示列表（遮挡）；
	 */
	blur( ev, rid, delay ) {
		Util.fireEvent(
			this.$elem(rid) || $(this.data),
			'blur',
			null,
			delay
		);
		return this.next();
	},


	/**
	 * 选取目标内容。
	 * - 默认延迟激发可跳过当前执行流；
	 * @param {number} delay 延迟毫秒数，可选
	 */
	select( ev, rid, delay = true ) {
		Util.fireEvent(
			this.$elem(rid) || $(this.data),
			'select',
			null,
			delay
		);
		return this.next();
	},

});


//
// 动效相关。
// 此为工作原理基础实现，外部具体扩展。
//
Object.assign( NS.Effects, {
	/**
	 * 动效开启。
	 * （requestAnimationFrame）
	 * - 以动画方式执行tween里的函数队列；
	 * - 以秒为单位更易直观感受；
	 * 提示：
	 * - 仅单次行为，无循环重复逻辑；
	 * - 动效函数对流程数据的需求自行处理；
	 *
	 * @param {Number} times 持续时间（秒，浮点数）
	 * @param {String} easing 缓动类型.名，可选
	 */
	start( ev, times, easing = 'Linear' ) {
		if (!this.tween.length || times < 0) {
			return this.next();
		}
		if (!times) times = Infinity;

		progress(
			this.tween,
			times * __frameRate,
			easing,
			this.data,
			data => this.next(data)
		);
	},


	/**
	 * 动画控制递交。
	 * - 向外发送一个控制函数；
	 * - 调用时传递null终止动画，其它假值暂停动画；
	 * - 恢复暂停的动画传递true调用即可；
	 * 注：
	 * - 外部通常先存储，然后定义用户事件触发控制；
	 * - 此控制一般在动画开始之前发送（无延迟）；
	 *
	 * @param {String} rid 接收元素标识
	 * @param {String} evn 接收事件名
	 */
	hander( ev, rid, evn ) {
		Util.fireEvent(
			this.$elem(rid),
			evn,
			run => this.tween[run === null ? 'halt' : 'pause'] = !run,
			false
		);
		return this.next();
	},

});


//
// 动画相关。
// 支持Element.animate和CSS动画。
// animate调用返回Animation实例，可绑定事件处理。
// 注：
// Animation可用事件名：[finish, cancel]
//
Object.assign( NS.Animation, {
	//
	// Element.animate 部分。
	//-------------------------------------------------------------------------


	/**
	 * 关键帧定义（keyframes）。
	 * - 存储用于元素animate接口的首个参数；
	 * - $name为多个名称的数组时，$val也为数组且成员一一对应；
	 * - 如果逐帧配置（from...to），流程数据需先为一个数组；
	 *   （可用PB:val预设一个空数组）
	 * 注：
	 * - animate首个参数可为一个帧配置数组或一个多帧配置对象；
	 * @param  {String|Array} $name 样式属性名（集）
	 * @param  {Value|[Value]} $val 样式值/值集
	 * @next: {Array|Object}
	 */
	kf( ev, $name, $val ) {
		let _kfo = keyFrame(
			this.$value($name), this.$value($val)
		);
		if (!$.isArray(this.data)) {
			return this.next(_kfo);
		}
		return this.next( this.data.concat(_kfo) );
	},


	/**
	 * 动画运行。
	 * - 向后传递animate()创建的Animation实例；
	 * - 传递rid为undefined，可以捕获trigger发送来的元素；
	 * @data: {Array|Object}
	 * @param {String|undefined} rid 动画元素标识
	 * @param {Number} duration 持续时间（秒，浮点数）
	 * @param {Number} iterations 迭代次数，可选
	 * @param {String} easing 缓动类型.名，可选
	 * @param {Object} opts 更多选项
	 */
	play( ev, rid, duration, iterations, easing, opts = {} ) {
		let $el = this.$elem(rid) || $(ev.detail),
			_vs = $el.animate(
				this.data,
				Object.assign( opts, {duration, iterations, easing} )
			);

		return this.next( alone(_vs) );
	},


	/**
	 * 发送动画实例（Animation）。
	 * - 流程数据即为.play传递来的Animation实例；
	 * - 外部通常先存储，然后定义用户事件触发控制；
	 * 注意：
	 * - 每次发送一个新的动画实例，外部应逐一处理；
	 *
	 * @data: {Animation}
	 * @param {String} rid 接收元素标识
	 * @param {String} evn 接收事件名
	 */
	send( ev, rid, evn ) {
		Util.fireEvent(
			this.$elem(rid), evn, this.data, 0
		);
		return this.next();
	},


	//-------------------------------------------------------------------------
	// 以下为处理端接口，支持Animation实例数组。


	/**
	 * 动画暂停。
	 * @data: {Animation[s]}
	 */
	pause(/* ev */) {
		callAnis(this.data, 'pause');
		return this.next();
	},


	/**
	 * 动画提前完成。
	 * @data: {Animation}
	 */
	finish(/* ev */) {
		callAnis(this.data, 'finish');
		return this.next();
	},


	/**
	 * 取消执行。
	 * @data: {Animation}
	 */
	cancel(/* ev */) {
		callAnis(this.data, 'cancel');
		return this.next();
	},


	/**
	 * 反向执行。
	 * @data: {Animation}
	 */
	reverse(/* ev */) {
		callAnis(this.data, 'reverse');
		return this.next();
	},


	/**
	 * 动画实例属性设置。
	 * 提示：取值可用PB:sub
	 * @data: {Animation[s]}
	 * @param {String|Object} $name 属性名或配置对象
	 * @param {Value} $val 属性值
	 */
	prop( ev, $name, $val ) {
		let _k = this.$value($name),
			_v = this.$value($val);

		if (!$.isArray(this.data)) {
			aniProp(this.data, _k, _v);
		} else {
			this.data.forEach(ani => aniProp(ani, _k, _v));
		}
		return this.next();
	},


	//
	// CSS动画接口。
	//-------------------------------------------------------------------------
	// 由外部CSS定义，可由pba/pbo改变触发动画执行。
	// 注：事件名 [animationstart, animationend, animationiteration]


	/**
	 * 等待完毕。
	 * - 等待CSS动画完毕才继续执行流；
	 *   定义多个wait为等待多个目标动画依次结束；
	 * 注意：
	 * - 如果动画已经结束或没有动画，无法触发next调用，执行流中断；
	 * - 此PB一般定义在同On配置的前一个调用链中，
	 *   或紧跟在动画激发定义之后（动画的结束需要时间）；
	 *
	 * @param {String} rid 目标元素标识，可选
	 */
	wait( ev, rid ) {
		return aniWaits(
			// next: bound function
			this.$elem(rid) || $(this.data), this.next
		);
	},

});


//
// 示例集。
// - OBT解析（Core.obts）；
// - PB样式属性名标准化（data-pb）；
// 注：
// - 类似Golang的ExampleXxx示例功能；
// - 可能需要结合PB:$.elem转换使用；
//
Object.assign( NS.Example, {
	/**
	 * 源码格式化。
	 * - 取目标元素/集源码（outer）；
	 * - 多个目标元素源码用换行连接；
	 * @data: Element[s]
	 * @next: String
	 * @param {String} tab 前置缩进字符串，可选
	 */
	fmt( ev, tab = '\t' ) {
		return this.next(
			$(this.data).map( el => htmlFormat(el, tab) ).join('\n')
		);
	},


	/**
	 * 源码输出。
	 * - 目标为一个textarea元素；
	 * @data: String
	 * @param {String} tid 文本框元素标识
	 */
	put( ev, tid = null ) {
		this.$elem(tid).prop('value', this.data);
		return this.next();
	},


	/**
	 * OBT属性校正。
	 * - 仅在用不同的属性定义时需要；
	 * - 待校正名称为前缀字符连接实际的On/By/To名称（若未修改则为标准名称）；
	 * 注：
	 * - 用户可能会采用与真实解析名不同的OBT名称，在此修改以便于OBT解析；
	 * - 标准OBT名称可能已经被应用重定义，此仅去除前缀后写入新属性名；
	 * @data: Element[s]
	 * @param {String} prefix 前缀字符
	 */
	obt( ev, prefix ) {
		let _obt = T.Core.obtAttr(),
			_ns3 = _obt.map( n => prefix + n );

		for (let el of $(this.data)) {
			let _val = [...$.attr(el, _ns3).values()];

			$.attr( el, arr2Obj(_obt, _val) );
			$.removeAttr(el, _ns3);
		}

		return this.next();
	},


	/**
	 * PB样式属性名设置。
	 * - 即转换到data-pb标准属性名；
	 * - 仅在定义了不同的属性名时需要；
	 * @data: Element[s]
	 * @param {String} name 属性名
	 */
	pbn( ev, name ) {
		for (let el of $(this.data)) {
			$.attr( el, __pbAttr, $.attr(el, name) );
			$.removeAttr(el, name);
		}
		return this.next();
	},


	/**
	 * 执行。
	 * - OBT解析、构建并绑定；
	 * - 不支持板块载入回调（App）；
	 * @data: Element[s]
	 */
	run(/* ev */) {
		for (let el of $(this.data) ) {
			T.Core.obts( el, this );
		}
		return this.next();
	},


	/**
	 * 结果显示（流程数据）。
	 * - 仅支持单个目标容器；
	 * 输出：{
	 *  	-1 	容器内顶部
	 *  	0 	填充（先清空）
	 *  	1 	内末尾添加
	 * }
	 * @data: Element[s]
	 * @param {String} rid 目标容器标识
	 * @param {Number} pos 填充标识
	 */
	show( ev, rid, pos = 0 ) {
		let _box = this.$elem(rid, true),
			_mth = {
				'-1': 'prepend',
				'0':  'fill',
				'1':  'append',
			};
		if (_box) {
			$[ _mth[pos] ](_box, this.data);
		}
		return this.next();
	},


	/**
	 * 在嵌入框架中显示内容。
	 * - 覆盖框架的全部内容；
	 * - 框架需要遵循同源策略；
	 * @param {String} rid 框架标识
	 */
	frame( ev, rid ) {
		let _frm = this.$elem(rid, true);
		if (_frm) {
			$.fill(_frm.contentDocument.body, this.data);
		}
		return this.next();
	},

});



//
// 私有工具集
///////////////////////////////////////////////////////////////////////////////


/**
 * 动画执行等待。
 * - 仅适用元素CSS动画（支持animationend事件）；
 * - 用once绑定防止无动画元素资源无限占用；
 * @param {Element}   el  目标元素
 * @param {Function} next 完毕后执行的回调
 */
function aniWait( el, next ) {
	if (!el) return next();
	$.once(el, 'animationend', null, next);
}


/**
 * 多个动画执行等待。
 * - 全部动画执行完后继续next回调；
 * - 如果有一个执行失败，不会执行next（即挂起）；
 * - 如果元素集为空，直接next（不挂起）；
 *
 * @param {[Element]} els 动画元素集
 * @param {Function} next 最终完毕回调
 */
function aniWaits( els, next ) {
	if (els.length < 2) {
		return aniWait(els[0], next);
	}
	Promise.all(
		els.map( el => new Promise(ok => aniWait(el, ok)) )
	)
	.then( next );
}


/**
 * 元素集PB属性获取。
 * @param  {Array|Queue} els 目标元素集
 * @param  {String} op 处理方法（args|opts）
 * @return {Array} 值集
 */
function pbvGets( els, op ) {
	return els[0] &&
		$els.map( el => new PbElem(el, __pbAttr)[op]() );
}


/**
 * 元素集PB属性设置。
 * @param  {Array|Queue} els 目标元素集
 * @param  {Array} val 新值序列
 * @param  {String} op 处理方法（args|opts）
 * @return {undefined}
 */
function pbvSets( els, val, op ) {
	return els[0] &&
	els.forEach( el =>
		new PbElem(el, __pbAttr)[op](...val)
	);
}


/**
 * 元素PB属性操作。
 * - 可能激发元素动画；
 * - wds首个成员用于定义动画等待与否；
 * - 详细说明参见 PB:pba/pbo
 *
 * @param  {[Element]} els 目标元素集
 * @param  {Array} wds 参数/选项词序列
 * @param  {Function} next 下一步回调
 * @param  {String}   type 操作类型（args|opts）
 * @return {next|undefined}
 */
function pbvCalls( els, wds, next, type ) {
	if (!wds.length) {
		return next( alone(pbvGets(els, type)) );
	}
	if (wds[0] === true) {
		return pbvFire(els, wds.slice(1), next, type);
	}
	pbvSets(els, wds, type);
	return next();
}


/**
 * PbVal操作激发（动画等待）。
 * @param {[Element]} els 目标元素集
 * @param {Array} wds 参数/选项词序列
 * @param {Function} next 下一步回调
 * @param {String}   type 操作类型（args|opts）
 */
function pbvFire( els, wds, next, type ) {
	// 动画等待先
	aniWaits(els, next);
	// 动画激发...
	return pbvSets(els, wds, type);
}


/**
 * 构造一个关键帧配置对象。
 * （Element.animate首个数组参数的成员）
 * - name为多个名称的数组时，val也为数组一一对应；
 * @param  {String|Array} name 样式名（集）
 * @param  {Value|[Value]} val 样式值（集）
 * @return {Object}
 */
function keyFrame( name, val ) {
	if (typeof name == 'string') {
		return { [name]: val };
	}
	let _i = 0;
	return name.reduce( (o, k) => o[k] = val[_i++], {} );
}


/**
 * 动画实例属性设置。
 * @param  {Animation} ani 动画实例
 * @param  {String|Object} name 属性名或名值配置
 * @param  {Value} val 属性值
 * @return {Animation} ani
 */
function aniProp( ani, name, val ) {
	if (typeof name == 'string') {
		ani[name] = val;
	} else {
		$.each( name, (v, k) => ani[k] = v );
	}
	return ani;
}


/**
 * 提取调用函数。
 * 规则：
 * - 若name为null，视 obj 即为函数；
 * - 否则取 obj[name] 为目标函数；
 * - 若最终目标不是函数，返回假值；
 * @param  {Object|Function} obj 函数容器或函数
 * @param  {String} name 调用名
 * @return {Function} 目标函数
 */
function fnOper( obj, name ) {
	let _fn = name === null ?
		obj : obj[name];

	return typeof _fn == 'function' && _fn;
}


/**
 * 提取调用参数。
 * - 参数序列里的参数取值由get实施；
 * @param  {Array|Value} args 参数序列
 * @return {Array}
 */
function fnArgs( args, get ) {
	if (args === undefined) {
		return [];
	}
	if (!$.isArray(args)) {
		args = [args];
	}
	return args.map( v => get(v) );
}


/**
 * 键（集）取值。
 * - 键名为数组则返回值数组，否则返回单个值；
 * @param  {Object} store 储值对象
 * @param  {String|Array} key 键名（集）
 * @return {Value|[Value]} 结果集
 */
function values( store, key ) {
    return $.isArray(key) ?
    	key.map( k => store[k] ) : store[key];
}


/**
 * 对象存储值。
 * - 存储区如果不是对象则转为对象；
 * @param  {Object} obj 存储区对象
 * @param  {String} key 存储键
 * @param  {Mixed} val 存储值
 * @return {Object} 存储对象本身
 */
function objStore( obj, key, val ) {
    if (typeof obj != 'object') {
    	obj = Object(obj);
    }
    return obj[key] = val, obj;
}


//
// 调用链绑定记录。
// Element: Map{ Chain: Set }
//
const __boundChain = new WeakMap();


/**
 * 获取调用链绑定标记存储。
 * @param  {Element} el 目标元素
 * @param  {Chain} ch   调用链实例
 * @return {Set} 存储集
 */
function chainSets( el, ch ) {
	let _map = __boundChain.get(el) ||
		__boundChain.set(el, new Map());

	return _map.get(ch) || _map.set(ch, new Set());
}


/**
 * 检查&标记绑定。
 * @param  {Set} sets 标志集
 * @param  {String} flag 标记串
 * @return {Boolean} 是否已绑定
 */
function hasBound( sets, flag ) {
	return sets.has(flag) || (sets.add(flag), false);
}


/**
 * 调用链绑定。
 * - 从延迟绑定存储中检索调用链实例并绑定；
 * @param {Element} el 目标元素
 * @param {String} evn 事件名
 * @param {String|null} slr 委托选择器
 */
function bindChain( el, evn, slr = null ) {
	let _flg = evn + slr;

	$.each(
		chain(el, evn, slr),
		ch => hasBound(chainSets(el, ch), _flg) || $.on(el, evn, slr, ch)
	);
}


/**
 * 解绑调用链。
 * - bindChain的逆过程；
 * - 调用链从延迟绑定存储中检索；
 * @param {Element} el 目标元素
 * @param {String} evn 事件名
 * @param {String|null} slr 委托选择器
 */
function unbindChain( el, evn, slr = null ) {
	let _flg = evn + slr;

	$.each(
		chain(el, evn, slr),
		ch => chainSets(el, ch).delete(_flg) && $.off(el, evn, slr, ch)
	);
}


/**
 * 单次绑定。
 * - 系统自动解绑，无需存储；
 * @param {Queue} els 元素集
 * @param {Array} fns 句柄集
 */
function onceBinds( el, evn, slr, fns ) {
	$.each(
		fns || chain(el, evn, slr),
		fn => $.once(el, evn, slr, fn)
	);
}


//
// 类名操作集。
//
const clsHandles = {
	'1':  ($el, cls) => $el.addClass(cls),

	'-1': ($el, cls) => $el.removeClass(cls),

	'0':  ($el, cls, force) => $el.toggleClass(cls, force),
};


//
// 插入位置/方法名映射。
// - 名称与tQ规范相同；
//
const __Methods = {
	'1': 		'before',
	before: 	'before',
	'-1': 		'after',
	after: 		'after',

	'2': 		'prepend',
	begin: 		'prepend',
	prepend: 	'prepend',
	'-2': 		'append',
	end: 		'append',
	append: 	'append',

	'0': 		'fill',
	fill: 		'fill',
	'': 		'replace',
	replace: 	'replace',
};


// 键盘事件名匹配
const __keyEvent = /^key/;

/**
 * 获取键位名。
 * @param  {Event} ev 事件对象
 * @return {String|undefined} 键名或未定义
 */
function keyName( ev ) {
    return __keyEvent.test(ev.type) ? ev.key : undefined;
}


/**
 * 返回修饰键状态。
 * @param  {Event} ev 原生事件对象
 * @return {Object}
 */
function keySCAM( ev ) {
    return {
		'alt':   ev.altKey,
		'ctrl':  ev.ctrlKey,
		'shift': ev.shiftKey,
		'meta':  ev.metaKey,
	};
}


/**
 * 重置有改变的表单控件集
 * @param  {Element} frm 表单元素
 * @return {Array}
 */
function changeFC( frm ) {
	let _buf = [];

	for ( let el of Array.from(frm.elements) ) {
		switch (el.type) {
		case 'text':
		case 'textarea':
			if (el.defaultValue != el.value) _buf.push(el);
			break;
		case 'select-one':
			if (!el.options[el.selectedIndex].defaultSelected) _buf.push(el);
			break;
		case 'radio':
		case 'checkbox':
			if (el.defaultChecked != el.checked) _buf.push(el);
		}
	}
	return _buf;
}


/**
 * 数据压入。
 * - 如果指定下标则覆盖；
 * @param {Array} buf  存储数组
 * @param {Value} dt   数据
 * @param {Number} idx 位置下标，可选
 */
function dataPush( buf, dt, idx = null ) {
	return idx === null ? buf.push(dt) : buf[idx] = dt;
}


/**
 * 数据提取。
 * - 如果未指定下标则取整个集合；
 * - 如果取集合则合并到存储区；
 * @param  {Array} src  数据来源集
 * @param  {Number} idx 位置下标
 * @param  {Array} buf  提取存储区
 * @return {Array} buf
 */
function dataPull( src, idx, buf ) {
	if (idx === null) {
		$.merge(buf, src);
	} else {
		buf.push(src[idx]);
	}
	return buf;
}


/**
 * 将键值数组转换为一个对象。
 * - 两个数组取键值按下标一一对应；
 * - 重复的键会被后来者覆盖掉；
 * @param  {Array} keys 键名数组
 * @param  {Array} vals 值数组
 * @return {Object}
 */
function arr2Obj( keys, vals ) {
	let _i = 0;

	return keys.reduce(
		(obj, k) => (obj[k] = vals[_i++], obj), {}
	);
}


// 源码格式化
// 强制清理，统一格式。
///////////////////////////////////////////////////////////////////////////////


/**
 * 元素源码格式化。
 * - 仅支持元素、文本和注释节点；
 * - 内容纯空白的节点会被压缩为空节点；
 * - 外部调用时，nd通常为元素（文本节点意义不大）；
 *   （OBT示例时，元素自身更重要）
 * @param  {Node} nd 目标节点
 * @param  {String} tab 缩进字符串
 * @param  {String} prefix 前置字符串
 * @return {String} 格式串
 */
function htmlFormat( nd, tab, prefix = '', newline = false ) {
	switch (nd.nodeType) {
	case 1:
		return newLine('', prefix, newline) + (
			keepHTML(nd) || elemString(nd, tab, prefix)
		);
	case 3:
		// 避免原始空白/换行叠加
		return nd.textContent.trim();
	case 8:
		return newLine('', prefix, newline) + `<!--${nd.data}-->`;
	}
	return '';
}


/**
 * 元素自身格式化。
 * - 内联元素自身和内部不起新行；
 * - 块级元素自身强制起新行；
 * - 块级元素内仅含单个文本节点时不起新行；
 * @param  {Element} el 当前元素
 * @param  {String} tab 缩进字符串
 * @param  {String} prefix 前置字符串
 * @return {String} 格式串
 */
function elemString( el, tab, prefix = '' ) {
	let _tag = el.tagName.toLowerCase(),
		_sng = singleElem[_tag],
		_htm = `<${_tag}${attrString(el.attributes, !_sng)}`,
		_con = '';

	if (_sng) {
		return _htm + ' />';
	}
	let _ns = el.childNodes;
	for ( let i = 0; i < _ns.length; i++ ) {
		// !inlineElem[_tag]
		// 块元素内首层强制换行
		_con += htmlFormat(_ns[i], tab, prefix + tab, !inlineElem[_tag]);
	}

	// 单个文本节点时不起新行
	if (_con && (_ns.length > 1 || _ns[0].nodeType == 1)) {
		_con += newLine(_tag, prefix);
	}

	return _htm + _con + `</${_tag}>`;
}


/**
 * 元素属性序列。
 * - 指目标元素内的属性序列，不含内容和结尾标签；
 *   如：<a href="#" target="_blank">
 * - 空值属性保持为单属性标志状态（无=）；
 *
 * @param  {NamedNodeMap} attrs 元素属性集
 * @param  {Boolean} close 是否闭合标签（>）
 * @return {String}
 */
function attrString( attrs, close ) {
	let _ats = '';

	for ( let i = 0; i < attrs.length; i++ ) {
		let _at = attrs[i];
		_ats += ` ${_at.name}` + (_at.value === '' ? '' : `="${_at.value}"`);
	}
	return close ? _ats + '>' : _ats;
}


/**
 * 新行缩进。
 * - 用于块级元素自我换行缩进；
 * @param  {String} tag    元素标签名
 * @param  {String} indent 缩进字符串
 * @param  {Boolean} force 强制换行
 * @return {String}
 */
function newLine( tag, indent = '', force = false ) {
	return tag && !inlineElem[tag] || force ? '\n' + indent : '';
}


/**
 * 返回原始保持内容。
 * - 仅用于<code>和<pre>元素；
 * - 源码为outerHTML，故返回空串表示元素不匹配；
 * @param  {Element} el 目标元素
 * @return {String} 源码
 */
function keepHTML( el ) {
	let _tag = el.nodeName;
	return _tag == 'CODE' || _tag == 'PRE' ? $.prop(el, 'outerHTML') : '';
}


//
// HTML单标签集。
// 注：用于标签的友好关闭（/>）。
//
const singleElem = {
	'hr': 		1,
	'img': 		1,
	'input': 	1,
	'param': 	1,
	'base': 	1,
	'meta': 	1,
	'link': 	1,
	'frame': 	1,
	'keygen': 	1,
	'area': 	1,
	'source': 	1,
	'track': 	1,
	'wbr': 		1,
	'br': 		1,
};


//
// 内联元素标签集。
// 注：内部内容不用换行。
//
const inlineElem = {
	'embed': 	1,
	'br': 		1,
	'img': 		1,
	'audio': 	1,
	'video': 	1,
	'a': 		1,
	'strong': 	1,
	'b': 		1,
	'em': 		1,
	'i': 		1,
	'q': 		1,
	'abbr': 	1,
	'cite': 	1,
	'small': 	1,
	'time': 	1,
	'del': 		1,
	'ins': 		1,
	'sub': 		1,
	'sup': 		1,
	'mark': 	1,
	'code': 	1,
	'ruby': 	1,
	'rt': 		1,
	'rp': 		1,
	'wbr': 		1,
	'span': 	1,
	'dfn': 		1,
	'samp': 	1,
	'kbd': 		1,
	'var': 		1,
};



//
// 动效支持（基础）
//
///////////////////////////////////////////////////////////////////////////////
// 动效参数会传递给每一个动画函数的每帧调用。
// 动效参数：{
//  	{Number} start 	起始时间戳
//  	{Object} frames 总帧数存储（frames.total）
//  	{Number} count 	当前迭代计数
//  	{Number} ratio 	曲线当前比值
//  	{Number} timestamp 	当前绘制时间戳
// }
// 注：
// - 总帧数用一个对象引用存储，外部的修改内部可见；
// - 内部会自动对该值进行修订，外部改变仅用于非常规情况；
//


/**
 * 动画配置并执行。
 * - 传递迭代总次数0表示无限循环（Infinity）；
 * @param  {[Function]} tween 调用集
 * @param  {Number} total 总迭代次数
 * @param  {String} names 缓动类型.名
 * @param  {Mixed} data 初始传入数据（首个代理调用的数据参数）
 * @param  {Function} done 成功回调
 * @param  {Function} fail 失败回调
 * @return {Resource} 资源请求ID
 */
function progress( tween, total, names, data, done, fail ) {
    let _obj = { total },
    	iter = easing(_obj, names),
    	args = {
			start:  null,
			frames: _obj,
		};

	return requestAnimationFrame(
		step.bind({ iter, tween, args, data, done, fail })
	);
}


/**
 * 每帧调用。
 * this {
 *  	{Iterator} iter 缓动迭代器（总）
 *  	{Array} tween 	动画函数队列
 *  	{Object} args 	每帧当前参数
 *  	{Function} done 完成回调
 *  	{Function} fail 失败回调
 *  	{Mixed} data  	最后一个调用的结果（或初始值）
 * }
 * - 最后一个调用的结果会回传；
 * - 集中任何一个动画函数返回false，会终止动画序列；
 *
 * @param  {Number} tm 当前绘制时间戳
 * @return {Resource} 请求标识ID
 */
function step( tm ) {
	let {iter, tween, args, data, done, fail} = this;

	if (tween.pause) {
		// 空转...
		return requestAnimationFrame( step.bind(this) );
	}
    if (data === false) {
    	return fail && fail();
    }
 	let _o = iter.next();

    if (_o.done) {
    	return done && done(data);
    }
    this.data = stepCall(tween, args, data, _o.value, tm);

	requestAnimationFrame( step.bind(this) );
}


/**
 * 每帧调用（实施）。
 * - 返回false表示终止整个动画；
 * - 每帧调用时都会检查调用链是否重新开启；
 *
 * 动画函数参数：{
 *  	{Object} args 	如前“动效参数”
 *  	{Mixed} data 	上一个动画函数的返回值
 * }
 * 注：
 * 动画执行期间源元素调用链重启，会中断当前动画。
 *
 * @param  {[Function]} tween 调用集
 * @param  {Object} args 每帧参数
 * @param  {Mixed} data 上一帧动画序列的返回值（或初始值）
 * @param  {Array} val [当前计次，比值]
 * @param  {Number} tm 当前绘制时间戳
 * @return {Boolean} 是否终止（fail）
 */
function stepCall( tween, args, data, val, tm ) {
    if (!args.start) {
    	args.start = tm;
    }
    args.count = val[0];
    args.ratio = val[1];
    args.timestamp = tm;

    for ( let fn of tween ) {
    	// halt of chain
    	if (tween.halt || (data = fn(args, data)) === false) return false;
    }
    // 帧数修订
    remedy(args.frames, args.start, val[0], tm);

    return data;
}


/**
 * 帧率校订。
 * - 如果动画函数集花费较多时间，会错过每秒60帧的速率，
 *   因此需要修订以满足整体的时间要求（粗略）；
 * - 修订在每一次绘制时执行，且修改总帧数，较为平滑；
 * @param {Object} frames 总帧数存储
 * @param {Number} start  起始时间
 * @param {Number} count  当前计次（帧）
 * @param {Number} current 当前时间
 */
function remedy( frames, start, count, current ) {
	let _pas = current - start,
		_std = count * __frameCell,
		_dif = _pas - _std;

    if (_dif > __frameCell) frames.total -= _dif/__frameCell;
}


/**
 * 提取缓动函数。
 * @param  {String|Array} names 缓动类型.名
 * @param  {Object} eases 缓动函数定义集
 * @return {Function|null}
 */
function easeHandle( names, eases ) {
	if (!names) {
		return null;
	}
	let [a, b] = names.split('.');
	if (!b) {
		return eases[a];
	}
	return eases[a] && eases[a][b];
}


/**
 * 获取缓动值集。
 * 注：frames.total是可以在外部调整的；
 * @param {Object} frames 总次数存储对象
 * @param {String} names 缓动类型.名
 * @yield [i, Number] 当前计次与比值
 */
function *easing( frames, names ) {
    let _fn = easeHandle(names, _Easing) || easeHandle(names, T.Easing);
    if (!_fn) {
    	throw new Error(`invalid easing with ${names}`);
    }
    for ( let i = 1; i <= frames.total; i++ ) {
    	yield [ i, _fn(i, frames.total) ];
    }
}


// 默认缓动函数
const _Easing = { Linear: ( t, d ) => t/d };


/**
 * 调用动画对象特定方法。
 * - 如果its为一个动画实例集，则批量调用；
 * - 目标方法没有参数；
 * - 会检查目标对象是否支持方法，安全调用；
 *   （以便容错提取的数据集）
 *
 * @param {Animation|[Animation]} its 目标（集）
 * @param {String} meth 方法名
 */
function callAnis( its, meth ) {
	if (!$.isArray(its)) {
		return its[meth] && its[meth]();
	}
	its.forEach( ani => ani[meth] && ani[meth]() );
}


})( tQuery.proxyOwner(), Tpb );