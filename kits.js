/*! $Id: kits.js 2016.03.08 Tpb.Base $
*******************************************************************************
            Copyright (c) 铁皮工作室 2016 GNU LGPL

                @Project: Tpb v0.1
                @Author:  风林子 zhliner@gmail.com
*******************************************************************************

	Tpb.Kits.{
		Util 	实用函数集
		Spliter 序列分离器
		Scoper 	净域生成器
		PbVal 	PB串值类
		PbElem 	PB元素操作类
		Loader 	文件载入器
	}

	命名约定：
	前置$字符的函数名一般表示有特别约定（增强版）。


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function( $, K ) {

	const
		// 相对ID
		// 详见下面 $find 说明。
		__Rid = 'data-id',

		// 相对ID标志匹配
		// 结果：'x@' 或 '\\@'
		__reRID = /(?:[^\\]|\\.)@/,

		// 单引号匹配
		__reSQuote = /([^\\]|\\.)'/g,

		// 调用表达式
		// 注：特别支持前置-（On事件名）。
		__reCall = /^(-?\w[\w.]*)(\([^]*\))*$/;


	const
		// 修饰键名映射。
		__Modifier = {
			shift:  'shiftKey',
			alt: 	'altKey',
			ctrl: 	'ctrlKey',
			meta: 	'metaKey',
		},

		// 元素PbVal实例缓存。
		__pbvStore = new WeakMap();



const Util = {
	/**
	 * 相对定位检索。
	 * 原理：
	 * - 通过与目标元素最近的共同祖先容器为起点，向下检索目标元素；
	 * - 格式：box@val slr
	 * - “@”为相对ID标志符，前段父级定位，后为子级元素相对ID属性值，
	 *   空格之后可跟普通选择器（slr），用于进一步检索；
	 * - 如不包含该字符，视为普通选择器，在起点元素内检索；
	 * - 未指定起点元素或为ID（#xxx）检索时，为全局检索（忽略@）；
	 *
	 * box@val slr {
	 *  	box 向上至共同祖先容器的层级数或目标选择器
	 *  	val 共同容器之内，目标元素相对ID属性值（不含空格）
	 *  	slr 从目标元素再向下检索的选择器（扩展查询）
	 *  		如：'@abc >b' => '[data-id="abc"] >b'；
	 * }
	 * box 值 {
	 *  	0:  当前元素即为共同祖先容器，目标元素在内部；
	 *  	1:  上升一级，父元素为共同容器，即检索兄弟元素；
	 *  	x:  若为非数值，视为目标容器选择器，如上级表单 form@；
	 * }
	 * 注意：
	 * - box 的0值可省略不写，即“@val”的形式也可；
	 * - 如果目标就是祖先容器本身，val无值，即“box@”；
	 * - 单字符“@”返回起点元素本身，假值返回一个空集或null；
	 *
	 * 返回：
	 * - 如果指定val部分（data-id）且为终端匹配，默认返回首个匹配；
	 *   （注：data-id被赋予一个“准唯一性”概念）
	 * - 未指定val或还包含slr部分时，根据one参数匹配全部或单一检索；
	 * 例：
	 *   "@"    	起点元素本身
	 *   "@val"  	起点元素内data-id为“val”的首个元素（单一）
	 *   "@@xx" 	起点元素内data-id值为“@xx”的首个元素，第二个@无特殊含义
	 *   "2@" 		父元素的父元素
	 *   "1@abc" 	兄弟元素中首个data-id为“abc”的元素
	 *   "form@" 	最近的父级表单元素本身
	 *   "div@ >i" 	最近的父级div元素的<i>直接子元素集
	 *   "@ >b" 	起点元素内的直接<b>子元素集。注意空格
	 *   "@xx i" 	起点元素内data-id=xx的元素的<i>子孙元素集
	 *   "#xyz >i" 	ID为xyz的元素的<i>直接子元素集（常规查询）
	 *   "div p" 	常规选择器查询
	 *
	 * 记忆要点：
	 * 1. @之前向上检索，@之后向下检索。ID直接检索。空格扩展查询。
	 * 2. 纯粹的相对ID检索单个元素，data-id拥有准“唯一性”。
	 * 3. 复合型选择器检索多个元素，或由one参数强制规定。
	 *
	 * 注记：
	 * - "@ xx" 中的空白不设计为属性的存在性约束（[data-id]），
	 *   这是便于无需该属性的检索，如："form@ slr"，无data-id约束。
	 *   如果需要基于单纯data-id属性的约束，可构造如 "box@ [data-id]"。
	 *
	 * @param  {String}  fmt 标识串（外部trim）
	 * @param  {Element} beg 起点元素
	 * @param  {Boolean} one 单一匹配，可选
	 * @return {Queue|Element|null} 目标元素（集）
	 */
	$find( fmt, beg, one ) {
		if (fmt == '@') return beg;

		let _pair = beg && ridSplit(fmt);

		if (!_pair) {
			return query(beg, fmt, one);
		}
		return ridFind( ..._pair, beg, one );
	},


	/**
	 * “值格式”取值。
	 * - tQuery原生支持data系属性的简写（-xx => data-xx）；
	 * - 默认取属性值（prop）；
	 * fmt：{
	 *  	'=xx' 	attr('xx')。元素特性值，
	 *  	'~xx' 	css('xx')。元素样式值（计算）
	 *  	'$xx' 	$系获取。如 $.text(el)
	 *  	'-xx' 	prop('-xx')。data-xx属性值（tQuery支持）
	 *  	'xxx' 	prop('xxx')。元素属性值
	 *  	'=-xx' 	attr('-xx')，即attr('data-xx')
	 * }
	 * 示例：{
	 *  	'=value' 	=> $.attr(e, 'value')
	 *  	'value' 	=> $.prop(e, 'value')
	 *  	'=style' 	=> $.attr(e, 'style') // style.cssText
	 *  	'style' 	=> $.prop(e, 'style') // style对象（CSSStyleDeclaration）
	 *  	'=-val' 	=> $.attr(e, '-val')
	 *  	'-val'  	=> $.prop(e, '-val')  // e.dataset.val
	 *  	'~color' 	=> $.css(e, 'color')
	 *  	'$html' 	=> $.html(e)   // 取源码
	 *  	'$parent' 	=> $.parent(e) // 取父元素
	 * }
	 * $系直接取值：{
	 *  	text
	 *  	html
	 *  	height
	 *  	width
	 *  	val
	 *  	children
	 *  	clone
	 *  	contents
	 *  	innerHeight
	 *  	innerWidth
	 *  	outerWidth
	 *  	outerHeight
	 *  	next
	 *  	prev
	 *  	prevAll
	 *  	nextAll
	 *  	siblings
	 *  	offset
	 *  	position
	 *  	scrollLeft
	 *  	scrollTop
	 *  	parent
	 *  	offsetParent
	 * }
	 * 注记：
	 * - 出于简单性应该仅支持单目标元素；
	 * - 因为支持$.xx系接口，多目标会涉及元素重复问题；
	 *
	 * @param  {Element} el 目标元素
	 * @param  {String} fmt 格式值串
	 * @return {Mixed} 结果值
	 */
	$val( el, fmt ) {
		if (!fmt) return el;
		let _n = fmt.substring(1);

		switch (fmt[0]) {
			case '=': return $.attr(el, _n);
			case '~': return $.css(el, _n);
			case '$': return $[_n](el);
		}
		return $.prop(el, fmt);
	},


	/**
	 * 设置元素特定类型值。
	 * 类型名type：[
	 *  	prop 	特性值
	 *  	attr 	属性值
	 *  	css 	内联样式
	 *  	$ 		$系操作
	 * ]
	 * tQ系赋值name：{
	 *   	html
	 *   	text
	 *   	height
	 *   	width
	 *  	val
	 *   	offset
	 *   	scrollLeft
	 *   	scrollTop
	 *   	empty
	 *    	addClass
	 *    	removeClass
	 *    	toggleClass
	 *    	removeAttr
	 *
	 *    	// 集合多对多
	 *    	// val需为节点数据
	 *    	before
	 *     	after
	 *   	prepend
	 *   	append
	 *   	replace
	 *   	fill
	 *   	// 反向赋值
	 *   	// val容器元素或html结构
	 *   	wrap
	 *   	wrapInner
	 *
	 *   	// 集合反向赋值
	 *   	// val需为容器元素
	 *   	insertBefore
	 *    	insertAfter
	 *    	prependTo
	 *    	appendTo
	 *    	replaceAll
	 *    	fillTo
	 *    	wrapAll  // val容器元素或html结构
	 * }
	 * @param {Queue} $el 目标元素
	 * @param {String} name 键名
	 * @param {Value|Node[s]} val 数据值（集）
	 * @param {String} type 类型名
	 */
	$set( $el, type, name, ...val ) {
		if (!$el || !$el.length) {
			return;
		}
		if (type == '$') {
			return $el[name](...val);
		}
		// prop|attr|css
		return $el[type](name, val[0]);
	},


	/**
	 * 元素属性取值。
	 * type: [prop|attr|css|$]
	 * @param  {Element} el  目标元素
	 * @param  {String} name 取值键
	 * @param  {String} type 取值类型
	 * @return {Mixed}
	 */
	$get( el, type, name, ...rest ) {
		return type == '$' ?
			$[name](el, ...rest) : $[type](el, name);
	},


	/**
	 * 获取事件目标元素。
	 * rid可能为已检索元素本身，直接返回。
	 * rid：{
	 *  	'@' 	委托元素（事件绑定）
	 *  	null  	当前元素，默认
	 *  	0    	事件起点元素（ev.target）
	 *  	'' 		To目标元素（target）或当前元素
	 * }
	 * 事件元素集map: {
	 *  	origin  	事件起始元素（event.target）
	 *  	delegate 	事件委托绑定元素（event.currentTarget）
	 *  	current 	事件委托目标元素或
	 *  				无委托绑定元素（event.currentTarget）
	 *  	target  	To定位目标元素
	 * }
	 * 友好：
	 * 空串定位To目标元素，但依然备用当前元素。
	 *
	 * @param  {Object} map 事件元素集
	 * @param  {String} rid 标识串
	 * @param  {Boolean} one 单一检索
	 * @return {Element|Array|Queue|rid|null} 目标元素（集）
	 */
	evel( map, rid = null, one = undefined ) {
		switch (rid) {
			case 0: return map.origin;
			case null: return map.current;
		}
		if (typeof rid != 'string') {
			return rid;
		}
		return rid ? this.$find(rid.trim(), map.delegate, one) : map.target || map.current;
	},


	/**
	 * 字符串切分两片。
	 * @param  {String} str 源字符串
	 * @param  {String} sep 分割字符串
	 * @return {[String, String]}
	 */
	strPair( str, sep ) {
		var _pos = str.indexOf(sep);

		return _pos < 0 ?
			[str, ''] :
			[
				str.substring(0, _pos),
				str.substring(_pos + sep.length)
			];
	},


	/**
	 * 正则切分两片。
	 * - 注意正则表达式不可为g模式；
	 * @param  {String} str 源字符串
	 * @param  {RegExp} sep 分割正则式
	 * @return {[String, String]}
	 */
	rePair( str, sep ) {
		var _pos = str.search(sep);

		return _pos < 0 ?
			[str, ''] :
			[
				str.substring(0, _pos),
				str.substring(_pos).replace(sep, '')
			];
	},


	/**
	 * 后行断言求下标。
	 * - 对特定后行断言匹配式求真正目标位置；
	 * 匹配式：
	 * - 匹配目标字符但不包含前置反斜线的情况；
	 * - 格式如：/(?:[^\\]|\\.)A/
	 *   => 匹配 A 但不包含 \A 的情况；
	 * - 必然有一个前置字符，不处理A在首位的情况；
	 *
	 * @param  {String} fmt 格式串
	 * @param  {RegExp} re  特定格式后行匹配式
	 * @return {Number}
	 */
	behindIndex( fmt, re ) {
		let _idx = fmt.search(re);

		return _idx < 0 ? -1 : _idx + (fmt[_idx] == '\\' ? 2 : 1);
	},


	/**
	 * 解析多层子对象引用。
	 * @param  {Array} refs 引用名集
	 * @param  {Object} data 源对象
	 * @return {Mixed} 末端成员值
	 */
	subObj( refs, data ) {
		if (!data || !refs.length) {
			return data;
		}
		return refs.reduce((d, k) => d[k], data);
	},


	/**
	 * 提取调用句法的函数名和参数列表。
	 * - 支持无参数时省略调用括号；
	 * - 调用名支持句点连接的多级引用；
	 *   如：fn(...), Md.fn(), fn, Md.fn 等。
	 * - 支持调用串内部任意位置换行；
	 * - 参数序列串需符合JSON格式（容忍单引号）；
	 * - 无法匹配返回undefined；
	 * 注：
	 * - 特别支持前置-字符用于事件名（延迟绑定）；
	 * 返回值：{
	 *  	name: {String} 调用名（可含句点）
	 *  	args: {Array|null} 参数值序列
	 * }
	 * @param  {String} fmt 调用格式串
	 * @return {Object} 解析结果
	 */
	funcArgs( fmt ) {
		var _pair = fmt.match(__reCall);

		if (!_pair) {
			console.error(`this ${fmt} call is invalid`);
			return '';
		}
		return {
			'name': _pair[1],
			'args': argsParse( _pair[2] && _pair[2].slice(1, -1).trim() )
		};
	},


	/**
	 * 激发目标事件。
	 * - 默认的延迟时间足够短，仅为跳过当前执行流；
	 * @param {Queue} $el 目标元素
	 * @param {String} name 事件名
	 * @param {Mixed} extra 附加数据
	 * @param {Number} delay 延迟毫秒数
	 */
	fireEvent( $el, name, extra, delay ) {
		if (!$el.length || !name) {
			return;
		}
		let _fn = () => $el.trigger(name, extra);

		if (!delay) {
			return _fn();
		}
		// <= 20，可能的习惯值
		return isNaN(delay) || delay < 21 ? requestAnimationFrame(_fn) : setTimeout(_fn, delay);
	},


	/**
	 * 修饰键按下检查。
	 * - 检查names中设定的键是否按下；
	 * - 多个键名为And关系（同时按下）；
	 * - 修饰键：Alt，Ctrl，Shift，Meta，键名小写；
	 *
	 * @param  {Event} ev 事件对象（原生）
	 * @param  {String|Array} names 键名称（集）
	 * @return {Boolean}
	 */
	scamMasked( ev, names ) {
		return [].concat(names)
			.every( ns => ev[ __Modifier[ns.toLowerCase()] ] );
	},

};



//
// 序列切分器。
// - 解析分离由分隔符隔开的独立单元；
// - 可以配置忽略参数段/属性段/块段不切分；
// - 字符串类型是一个整体，不会被切分；
// - 支持\转义分隔符为普通字面量；
// - 支持按区段切分，如字符串、参数段、普通段等；
// 注：
// - 参数段由()包围，属性段由[]包围，块段由{}包围；
//
class Spliter {
	/**
	 * 构造切分器。
	 * - 切分符号只能是单个字符；
	 * - 切分符号为任意字符，包括4字节Unicode；
	 * @param {String} sep 切分符号
	 * @param {Boolean} args 参数段忽略（()）
	 * @param {Boolean} attr 属性段忽略（[]）
	 * @param {Boolean} block 块段忽略（{}）
	 */
	constructor( sep, args, attr, block ) {
		this._sep = sep;

		// 当前引号标识符
		// ['"`]或空，空表示在引号外
		this._qch = '';

		// 测试集。
		// 包含参数/属性/块段。
		let _buf = [];

		if (args)  _buf.push( this._inArgs.bind(this) );
		if (attr)  _buf.push( this._inAttr.bind(this) );
		if (block) _buf.push( this._inBlock.bind(this) );

		this._test = _buf;
	}


	/**
	 * 切分器（分隔符）。
	 * - 返回一个切分迭代器；
	 * - 可以传递一个进阶过滤函数处理当前切分的串；
	 * @param  {String} fmt 格式串
	 * @param  {Function} fltr 进阶处理回调
	 * @return {Iterator}
	 */
	*split( fmt, fltr ) {
		let _ss = '',
			_fs = this._test[0] && this._test;

		while (fmt) {
			[_ss, fmt] = this._pair(fmt, this._sep, _fs);
			yield fltr ? fltr(_ss) : _ss;
		}
	}


	/**
	 * 状态重置。
	 * - 可避免前一次解析串不规范的情况；
	 * @return {this}
	 */
	reset() {
		this._qch = '';
		this._args = this._attr = this._block = false;
		return this;
	}


	/**
	 * 切分器（区段）。
	 * - 按不同区段（字符串/参数段/普通段等）切分；
	 * - 只有普通段才存在首尾空白，类型段首尾为包围字符；
	 * @param  {String} fmt 格式串
	 * @param  {Function} fltr 进阶处理回调
	 * @return {Iterator}
	 */
	*partSplit( fmt, fltr ) {
		let _ss = '',
			_fs = this._test[0] && this._test,
			_inc;

		while (fmt) {
			[_ss, fmt, _inc] = this._part(fmt, _fs, _inc);
			// 起始或连续类型区段会切分出一个空串，忽略
			if (!_ss) continue;
			yield fltr ? fltr(_ss) : _ss;
		}
	}


	//-- 私有辅助 -------------------------------------------------------------


	/**
	 * 2片切分。
	 * - 切分为前段字符串和后段剩余字符串；
	 * - 可以正确处理4字节Unicude字符序列；
	 * @param  {String} fmt 格式串
	 * @param  {String} sep 分隔符
	 * @param  {Array} test 测试集
	 * @return [String, String] 前段和后段
	 */
	_pair( fmt, sep, test ) {
		let _pch = '',
			_pos = 0;

		for ( let ch of fmt ) {
			let _n = this._skipChar(_pch, ch, test);
			_pos += _n;
			_pch = ch;
			if (_n) continue;
			if (ch == sep) break;
			_pos += ch.length;
		}
		return [
			fmt.substring(0, _pos),
			fmt.substring(_pos + sep.length)
		];
	}


	/**
	 * 区段切分。
	 * - 按区段切分出字符串、参数段、普通段等；
	 * - 可用于提取或排除特定类型的字符串区段；
	 * @param  {String} fmt  格式串
	 * @param  {Array} test  测试集
	 * @param  {Boolean} inc 在类型段内
	 * @return [String, String]
	 */
	_part( fmt, test, inc = false ) {
		let _pch = '',
			_pos = 0,
			_cur = 0;

		for ( let ch of fmt ) {
			_cur = this._skipChar(_pch, ch, test, true);
			_pos += ch.length;
			_pch = ch;
			if (_cur === true) continue;
			_cur = !!_cur;
			if (_cur != inc) break;
		}
		if (_cur) {
			_pos--;
			this.reset();
		}
		return [
			fmt.substring(0, _pos),
			fmt.substring(_pos),
			_cur,
		];
	}


	/**
	 * 忽略跳过的字数。
	 * - js字符为UTF-16类型，对于4字节字符则为2长度；
	 * - 逃逸检查时，匹配返回true而非字节数（用于typeSplit）；
	 * @param  {String} pc 之前一个字符
	 * @param  {String} ch 当前字符
	 * @param  {Array} test 测试集
	 * @param  {Boolean} esc 检查逃逸字符
	 * @return {Number}
	 */
	_skipChar( pc, ch, test, esc ) {
		if (pc == '\\' || ch == '\\') {
			return esc || ch.length;
		}
		return this._inStr(ch) || test && test.every( f => f(ch) ) ?
			ch.length : 0;
	}


	/**
	 * 是否在字符串内。
	 * - 会同时进行判断和处理；
	 * - 引号包含：双引号/单引号/模板字符串撇号；
	 * @param  {string} ch 当前字符
	 * @return {bool}
	 */
	_inStr( ch ) {
		if (ch == '"' || ch == "'" || ch == '`') {
			if (this._qch == ch) this._qch = '';
			else if (!this._qch) this._qch = ch;
		}
		return !!this._qch;
	}


	/**
	 * 进入参数段。
	 * - 不考虑字符串内情形；
	 * @param  {String} ch 当前字符
	 * @return {Boolean} 是否进入
	 */
	_inArgs( ch ) {
		if (ch == '(') {
			this._args = true;
		}
		else if (ch == ')') {
			this._args = false;
		}
		return this._args;
	}


	/**
	 * 进入属性段。
	 * @param  {String} ch 当前字符
	 * @return {Boolean} 是否进入
	 */
	_inAttr( ch ) {
		if (ch == '[') {
			this._attr = true;
		}
		else if (ch == ']') {
			this._attr = false;
		}
		return this._attr;
	}


	/**
	 * 进入块段。
	 * @param  {String} ch 当前字符
	 * @return {Boolean} 是否进入
	 */
	_inBlock( ch ) {
		if (ch == '{') {
			this._block = true;
		}
		else if (ch == '}') {
			this._block = false;
		}
		return this._block;
	}

}



//
// 净域生成器。
// - 为js代码的执行创建一个空域环境；
// - 域内所用数据由构造函数和代理调用引入（两级）；
// - 仅支持表达式；
// - 这不是一个沙盒，它只是让合法的代码干净的执行；
// 注记：
// 就目前来看，JS下暂无真的沙盒。
// 除null/undefined外，任何值都可以从constructor上溯构造函数执行。
// 如：
//   ''.constructor.constructor('alert("hai")')()
//   (x=>x)['const'+'ructor']('alert("hai")')()
//
class Scoper {
	/**
	 * @param {...Object} data 全局域数据序列
	 */
	constructor( ...data ) {
		this._data  = $.object( null, ...data );
		this._scope = new Proxy( this._data, { has: () => true } );
	}


	/**
	 * 构造执行器。
	 * - 由执行器的参数引入用户当前域数据；
	 * - 当前域数据会被绑定到最终执行函数的this上；
	 * - 内部二级with(this)，因此this内数据也可直接引用；
	 * 注记：
	 * 由于一级with已经屏蔽了参数，故二级with用this。
	 *
	 * 特点：
	 * - 外部无法改变执行器内的this（如bind）；
	 * - 表达式函数简单执行，没有外部参数输入可用；
	 *
	 * @param  {String} expr 表达式串
	 * @return {Function} 执行器 func(data)
	 */
	runner( expr ) {
		/*jshint -W054 */
		let _call = new Function(
			'G',
			`with(G) with(this) return ${expr};`
		);

		return function( scope, data = null ) {
			return this.bind(
				// data maybe String, Number...
				data === null ? {} : data
			)(scope);
		}
		// 新空间避免全局数据被污染
		.bind( _call, $.object(this._scope) );
	}


	/**
	 * 构造代理函数。
	 * - 用原型继承的方式引入用户数据（浅拷贝）；
	 * - 代理函数可以绑定this，并会被传递到表达式函数内；
	 * - 最终执行函数的参数序列被设置在“_”变量上；
	 *
	 * 特点：
	 * - 返回函数可由外部绑定this，使数据随函数传递；
	 * - 最终函数执行时可传递任意参数，由“_”名称引用；
	 *
	 * @param  {String} expr 表达式串
	 * @param  {Object} data 用户域数据
	 * @return {Function} 包装函数
	 */
	handle( expr, data = null ) {
		/*jshint -W054 */
		let _gobj = $.object(this._scope, data),
			_call = new Function(
				'G', `with(G) return ${expr};`
			);

		return function() {
			_gobj._ = arguments;
			return _call.bind( this || {} )( _gobj );
		};
	}


	/**
	 * 获取成员值。
	 * - 简单获取成员的优化版，避免编译代理函数；
	 * - name需要是一个合法的变量名；
	 * @param  {String} name 键名
	 * @param  {Object} data 取值域数据，可选
	 * @return {Mixed}
	 */
	get( name, data ) {
		let _val;

		if (data !== undefined) {
			_val = data[name];
		}
		return _val !== undefined ? _val : this._data[name];
	}


	/**
	 * 获取被代理的对象本身。
	 * @return {Object}
	 */
	get data() {
		return this._data;
	}

}



//
// PB串值类。
// 用于方便的设置 data-pb 属性值。
// PB值分为两部分：参数和选项。
// - 参数为-分隔，处于前端位置；
// - 选项空格分隔，在参数之后；
// 例：{
//   data-pb="lang-zh- bold x4"
//   // 参数为lang-zh，选项为bold和x4
//   data-pb="- fold"
//   // 参数为空，选项词为fold
// }
// - 参数用“|=”属性选择器定位，如：[data-pb|="lang-zh"]；
// - 选项用“~=”属性选择器定位，如：[data-pb~="bold"]；
//
// 注：
// - 一般地，参数用于描述“是什么”，“-”用于分级；
// - 选项通常用于表达一种“开关”（设置或取消），动态；
//
class PbVal {
	/**
	 * @param {String} val 混合值串
	 */
	constructor( val ) {
		let _vs = this.parse(val) || [];

		this._args = _vs[0] || '-';
		this._opts = _vs[1] || new Set();
	}


	/**
	 * 解析格式串赋值。
	 * - 单纯的选项词序列前应有一个空格（表示空参数）；
	 * - 前置单个-字符也可表示空参数（如"- fold x4"）；
	 * @param {String} fmt 混合格式串
	 * @return {Array} [args, opts]
	 */
	parse( fmt ) {
		if (!fmt) return;
		let _ws = fmt.split(/\s+/);

		return [ _ws.shift(), new Set(_ws) ];
	}


	/**
	 * 获取/设置参数串。
	 * 末尾会附带一个“-”字符；
	 * @param  {...String} rest 参数序列，可选
	 * @return {String|this}
	 */
	args( ...rest ) {
		if (!rest.length) {
			return this._args.slice(0, -1);
		}
		let _v = rest.join('-');

		this._args = _v.slice(-1) == '-' ? _v : _v + '-';
		return this;
	}


	/**
	 * 选项词操作。
	 * - 各选项可以被单独添加/删除/切换；
	 * - 3种操作由前置字符决定：{
	 *  	+ 	添加（默认，可选）
	 *  	- 	删除（-* 清空）
	 *  	! 	有无切换
	 * }
	 * - 可以指定一个特殊的词“-*”清空选项集；
	 *
	 * @param  {...String} words 选项词序列，可选
	 * @return {Set|this}
	 */
	opts( ...words ) {
		if (!words.length) {
			return this._opts;
		}
		for ( let w of words ) {
			switch (w[0]) {
			case '-':
				this.remove(w.substring(1));
				break;
			case '!':
				this.toggle(w.substring(1));
				break;
			default:
				this.add(w);
			}
		}
		return this;
	}


	/**
	 * 获取整串值。
	 * 格式：arg1-arg2... opt1 opt2...
	 * - 参数-分隔，前置，选项空格分隔；
	 * - 单个空参数（-占位）时返回空串；
	 * @return {String} 格式串
	 */
	value() {
		let _val = this._args + this._optstr();
		return _val == '-' ? '' : _val;
	}


	/**
	 * 添加选项词。
	 */
	add( word ) {
		this._opts.add(
			word[0] == '+' ? word.substring(1) : word
		);
	}


	/**
	 * 删除目标选项。
	 */
	remove( word ) {
		if (word == '*') {
			return this._opts.clear();
		}
		this._opts.delete(word);
	}


	/**
	 * 切换选项词
	 */
	toggle( word ) {
		this._opts[ this._opts.has(word) ? 'delete' : 'add' ](word);
	}


	//-- 私有辅助 -------------------------------------------------------------


	/**
	 * 返回选项词序列。
	 * -各选项词空格连接且前置一个空格；
	 * @return {String}
	 */
	_optstr() {
		return this._opts.size ? ' ' + [...this._opts].join(' ') : '';
	}

}


//
// PB元素操作类。
//
class PbElem {
	/**
	 * @param {Element} el 目标元素
	 * @param {String} attr PB属性名
	 */
	constructor( el, attr ) {
		this._el   = el;
		this._attr = attr;
		this._pbv  = this._pbv(el, attr);
	}


	/**
	 * 获取/设置参数。
	 * - 参数为不包含-字符的单词；
	 * @param  {...String} rest 参数序列
	 * @return {String|this} 参数串
	 */
	args( ...rest ) {
		return this._opit('args', ...rest);
	}


	/**
	 * 操作选项词。
	 * - 各选项可以被单独添加/删除/切换；
	 * - 3种操作由前置字符决定：{
	 *  	+ 	添加（默认，可选）
	 *  	- 	删除（-* 清空）
	 *  	! 	有无切换
	 * }
	 * - 可以指定一个特殊的词“-*”清空选项集；
	 *
	 * @param  {...String} words 选项词序列，可选
	 * @return {Set|this} 选项词集
	 */
	opts( ...words ) {
		return this._opit('opts', ...words);
	}


	//-- 私有辅助 -------------------------------------------------------------


	/**
	 * 参数/选项操作。
	 * 完全的空值下，属性本身会被删除。
	 * @param {String} op 操作名（args|opts）
	 * @return {String|Set|this}
	 */
	_opit( op, ...rest ) {
		if (!rest.length) {
			return this._pbv[op]();
		}
		$.attr(
			this._el,
			this._attr,
			this._pbv[op](...rest).value() || null
		);
		return this;
	}


	/**
	 * 获取对应PbVal实例。
	 * @param  {Element} el 目标元素
	 * @param  {String} attr PB属性名
	 * @return {PbVal}
	 */
	_pbv( el, attr ) {
		return __pbvStore.get(el) ||
			__pbvStore.set( el, new PbVal($.attr(el, attr)) );
	}

}



//
// 文件载入器。
//
class Loader {
	/**
	 * @param {String} root 基础路径
	 */
	constructor( root ) {
		this._base = root || '';
		this._head = document.head;
	}


	/**
	 * 设置/获取根路径。
	 * - 设置时返回当前实例；
	 * @param {String} path 起始路径
	 */
	root( path ) {
		if (path === undefined) {
			return this._base;
		}
		this._base = path;
		return this;
	}


	/**
	 * 顺序载入多个Js文件。
	 * - 一旦载入失败会终止后续文件载入；
	 * - 注意文件数组本身会被修改；
	 * - 初始即为空数组时，返回的不是一个Promise；
	 * @param  {Array} files 文件路径数组
	 * @return {Promise}
	 */
	scripts( files ) {
		if (!files.length) {
			return;
		}
		return this.script( files.shift() )
		.then(
			function() { return this.scripts(files); }
			.bind(this)
		);
	}


	/**
	 * 载入单个脚本。
	 * - 脚本成功载入后会被移出DOM；
	 * @param  {String}   file 脚本文件
	 * @return {Promise}
	 */
	script( file ) {
		return $.script(
			$.Element('script', { src: this._base + '/' + file })
		);
	}


	/**
	 * 通用数据获取。
	 * @param  {String} file 目标文件
	 * @return {Promise}
	 */
	fetch( file ) {
		return fetch(this._base + '/' + file);
	}


	/**
	 * 载入样式文件（在head的末尾插入）。
	 * @param  {String} file 目标文件
	 * @return {Promise}
	 */
	style( file ) {
		return $.style(
			$.Element( 'link', {
				'rel':  'stylesheet',
				'href': this._base + '/' + file,
			})
		);
	}


	/**
	 * 卸载样式文件。
	 * @param {String} file 先前载入的文件
	 * @return {this}
	 */
	unstyle( file ) {
		if (! file) return;

		let _url = this._base + '/' + file,
			_sel = $.One(`link[rel="stylesheet"][href="${_url}"]`, this._head);

		if (_sel) $.remove(_sel);

		return this;
	}

}



//
// 域代码执行器。
// 用于模板中参数定义支持undefined解析。
//
const __Scoper = new Scoper();


/**
 * 参数解析（优先JSON）。
 * - 参数里的字符串可用单引号包围；
 * - 参数可为函数定义，undefined关键字有效；
 * 注记：
 *   Html模板中属性值需要用引号包围，
 *   故值中的字符串所用引号必然同类（和串内引号）。
 *
 * @param  {String} args 参数定义序列
 * @return {Array|null}
 */
function argsParse( args ) {
	if (!args) {
		return null;
	}
	args = `[${args.replace(__reSQuote, '$1\\"')}]`;

    try {
    	return JSON.parse(args);
    }
    catch (e) {
    	console.warn(e);
    }
	return __Scoper.handle(args)();
}


//-- 相对ID辅助 ---------------------------------------------------------------


/**
 * 相对ID解构。
 * - 支持反斜线转义@字符（无特殊含义）；
 * 注记：首字符为@时单独检测，否则反斜线无法判断。
 * @param  {String} slr 选择器格式串
 * @return {[String, String]} 选择器对[上，下]
 */
function ridSplit( fmt ) {
	let _pos = passRID(fmt) ? ridIndex(fmt) : -1;

	return _pos >= 0 &&
	[
		fmt.substring(0, _pos),
		fmt.substring(_pos + 1)
	];
}


/**
 * 有效分隔符@下标。
 * - 排除前置反斜线转义的情况；
 * @param  {String} fmt 格式串
 * @return {Number}
 */
function ridIndex( fmt ) {
	return fmt[0] == '@' ? 0 : Util.behindIndex(fmt, __reRID);
}


/**
 * 是否提取RID。
 * @param  {String} fmt 格式串
 * @return {Boolean}
 */
function passRID( fmt ) {
	let _ch = fmt[0];
	return _ch && _ch != '#' && _ch != '>';
}


/**
 * 用相对ID检索。
 * @param  {String} up   向上检索标识
 * @param  {String} down 向下检索标识
 * @param  {Element} ctx 起点元素
 * @param  {Boolean} one 检索单个元素
 * @return {Queue|Element|null} 结果（集）
 */
function ridFind( up, down, ctx, one ) {
	ctx = ridParent( up, ctx );

	return down ? ridChildren(...Util.rePair(down, /\s+/), ctx, one) : ctx;
}


/**
 * 向上定位父级目标元素。
 * - 上溯层次支持数值指定，0表示当前元素；
 * - 字符串选择器从父元素开始测试匹配；
 *
 * @param  {Selector|Number} slr 上溯选择器或层次值
 * @param  {Element} cur 当前元素
 * @return {Element} 目标容器元素
 */
function ridParent( slr, cur ) {
	let _n = slr ? parseInt(slr) : 0;

	if (_n > 0) {
		while (_n--) cur = cur.parentNode;
		// 注记：
		// 层级数应当准确指定，不检查超出文档错误。
		// if cur == null... error
	}
	// NaN => closest
	return _n <= 0 ? cur : $.closest(cur.parentNode, slr);
}


/**
 * 获取子元素（集）。
 * - 根据相对ID和可选的扩展选择器检索元素；
 * @param  {String} id    相对ID值
 * @param  {Element} ctx  容器元素
 * @param  {Selector} ext 进阶选择器
 * @param  {Boolean} one  单一检索
 * @return {Queue|Element|null} 目标元素（集）
 */
function ridChildren( id, ext, ctx, one ) {
	let _slr = '';

	if (id) {
		_slr = `[${__Rid}="${id}"]`;
	}
	if (ext) {
		_slr += ' ' + ext;
	}
	return query( ctx, _slr, one === undefined ? !ext : one );
}


/**
 * 单一或多检索。
 * @param  {Element} ctx 检索上下文
 * @param  {String} slr  选择器
 * @param  {Boolean} one 单一检索
 * @return {Element|Queue|null}
 */
function query( ctx, slr, one ) {
	return one ? $.One(slr, ctx) : $(slr, ctx);
}



// Expose
/////////////////////////////
K.Util 		= Util;
K.Spliter 	= Spliter;
K.Scoper 	= Scoper;
K.PbVal 	= PbVal;
K.PbElem 	= PbElem;
K.Loader 	= Loader;


})( tQuery.proxyOwner(), Tpb.Kits );