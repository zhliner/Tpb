/* $Id: effect.js 2016.03.9 Tpb.PB $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@Project: Tpb v0.3.1
				@Author:  风林子 zhliner@gmail.com
*******************************************************************************

	动效扩展

	定义元素“属性、样式、颜色”等值的缓动变化，生成动效函数。
	动效PB只是向tween集合写入动效函数，不会改变流程数据引用。

	与元素动画（Element.animate）和CSS动画（Animations）不同，
	动效为单次行为，表达变化的某种韵律，无循环往复逻辑。

	注：动效可以通过动画的逻辑部分地实现出来，但此扩展更为通用/简化。


	依赖：tQuery, Tpb.Easing

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function( $, T ) {

	const
		__Effects = T.pbs().ef,

		// 数值匹配（可含单位）
		// [1]: num, [2]: unit
		__reNumUnit = /^([+-]?[\d.]+)(\w+)?$/,

		// 纯数值（含小数）
		// 序列内提取：d="M90 60 C 120 80,..."
		__reNumber = /[+-]?[\d.]+/g,

		// RGB[A]颜色匹配
		__reColorRGBA = /^(?:rgba?)\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/,

		// 单位比率
		// 1单位对应的像素值。
		UnitRatio = {
			mm:  0,
			cm:  0,
			in:  0,
			pt:  0,
			pc:  0,
			rem: 0,
			px:  1,
		};


Object.assign( __Effects, {
	/**
	 * 样式变化。
	 * - 默认对流程元素实施动效，仅支持单个元素；
	 * - 若easing未定义，取后续start全局值；
	 * - 名称和值支持值格式取值（或已足够）；
	 * - 传递$val为null可捕获trigger传值；
	 * - $val支持 [起始值, 最终值] 数组方式配置；
	 * 注：
	 * - 用百分比单位时，部分属性因复杂性而缺乏支持（如margin-xx），
	 *   明确指定起始值可回避系统支持的约束。
	 * - 数组0位成员为起始值，1位成员为终点值；
	 * - 仅百分比单位和缺乏自动支持的属性才需要指定起始值；
	 *   （这是对缺乏自动支持的一种补偿）
	 *
	 * 注记：
	 * - 鼓励操作目标为流程元素，可分解复杂性；
	 * - 调用链的顺序逻辑，可设定动效的分组顺序；
	 * - 多组元素同时动效可在元素自身上定义，然后同时激发，
	 *   或者向定义目标连续发送单个的动效元素；
	 *
	 * @param {String} $name 样式属性名
	 * @param {Number|String|Array} $val 变化目标值（对）
	 * @param {String} easing 缓动集.名（定制）可选
	 * @param {String} rid 元素标识
	 */
	css( ev, $name, $val, easing, rid ) {
		if ($val === null) {
			$val = ev.detail;
		}
		let $el = this.$elem(rid) || $(this.data),
			_ns = this.$value($name);

		if (!$el.length) {
			console.error(`no element selected`);
			return this.next();
		}
		let [_beg, _end, unit] = $.isArray($val) ?
			rangePair( this.$value($val[0]), this.$value($val[1]) ) :
			rangeValue( $el[0], _ns, this.$value($val) );

		this.tween.push(
			handler.bind( $el[0], {
				name: _ns,
				begin: _beg,
				amount: _end - _beg,
				unit,
				ease: easeHandle(easing)
			}, 'style')
		);
		return this.next();
	},


	/**
	 * 参数值处理（SVG attr）。
	 * - args的单值版本；
	 * 例：<rect
	 *  	x="10"
	 *  	y="10"
	 *  	width="100"
	 * .../>
	 * @param {String} $name 目标属性名
	 * @param {Number|String} $val 变化目标值
	 * @param {String} easing 缓动集.名（定制）可选
	 * @param {String} rid 元素标识，可选
	 */
	attr( ev, $name, $val, easing, rid ) {
		if ($val === null) {
			$val = ev.detail;
		}
		let $el = this.$elem(rid) || $(this.data),
			_ns = this.$value($name);

		if (!$el.length) {
			console.error(`no element selected`);
			return this.next();
		}
		let [_beg, _end, unit] = rangeAttr( el, _ns, this.$value($val) );

		this.tween.push(
			handler.bind( $el[0], {
				name: _ns,
				begin: _beg,
				amount: _end - _beg,
				unit,
				ease: easeHandle(easing)
			}, 'attribute')
		);
		return this.next();
	},


	/**
	 * 参数映射（SVG attr）。
	 * - 提取属性值内数值，对应参数序列定义变动；
	 * - $vals内成员需与属性值中数值顺序一一对应；
	 * - 此处的百分比单位没有特殊对待；
	 * 注：主要用于SVG元素。
	 * 例：<path
	 *  	 d="M90 60 C120 80, 180 80, 170 60"
	 * ... />
	 * @param {String} $name 目标属性名
	 * @param {[Number|String]} $vals 变化目标值序列
	 * @param {String|Array} easing 缓动类型.名（集）可选
	 * @param {String} rid 元素标识，可选
	 */
	args( ev, $name, $vals, easing, rid ) {
		if ($vals === null) {
			$vals = ev.detail;
		}
		let $el = this.$elem(rid) || $(this.data);

		if (!$el.length) {
			console.error(`no element selected`);
			return this.next();
		}
		let name = this.$value($name),
			[_beg, _end] = rangeArgs(
				beginArgs($el[0], name),
				$vals.map( v => this.$value(v) )
			);
		this.tween.push(
			handler.bind( $el[0], {
				name,
				begin: _beg,
				amount: _end.map( (n, i) => n - _beg[i] ),
				ease: easeHandles(easing, _beg.length)
			}, 'arglist')
		);
		return this.next();
	},


	/**
	 * RGB颜色定义。
	 * $vals: [R, G, B, A]
	 * - 各颜色分量指定变化目标值或变化量（前置+或-）；
	 * - 若不同颜色分量有各自的缓动，可定义easing为一个数组；
	 *
	 * @param {String} $name 目标样式名
	 * @param {Array} $vals  颜色分量目标值或变化量序列
	 * @param {String|Array} easing 缓动集.名（序列），可选
	 * @param {String} ctype 颜色值类型，私用
	 */
	rgb( ev, $name, $vals, easing, rid, _ctype = 'rgba' ) {
		if ($vals === null) {
			$vals = ev.detail;
		}
		let $el = this.$elem(rid) || $(this.data);

		if (!$el.length) {
			console.error(`no element selected`);
			return this.next();
		}
		let name = this.$value($name),
			_vals = $vals.map( v => this.$value(v) ),
			_alph = _vals[3] !== undefined,
			begin = beginColor($.css($el[0], name), _alph, _ctype);

		this.tween.push(
			handler.bind( $el[0], {
				name,
				begin,
				amount: colorAmount(begin, _vals),
				ease: easeHandles(easing, 4),
			}, _ctype)
		);
		return this.next();
	},


	/**
	 * HSL颜色定义。
	 * $vals: [H, S, L, A]
	 * - easing约定同rgb；
	 * @param {String} $name 目标属性名
	 * @param {Array} $vals 颜色值序列
	 * @param {String|Array} easing 缓动集.名（序列），可选
	 */
	hsl( ev, $name, $vals, easing, rid ) {
		return this.rgb(ev, $name, $vals, easing, rid, 'hsla');
	},


	/**
	 * 滚动条动效定义。
	 * - pair[0]为null时，取当前位置为起点；
	 * - pair[1]为null时，取滚动条端部位置；
	 * - pair成员支持百分比字符串值定义；
	 * @param {String} type 滚动条类型（Y|X|y|x|left|top）
	 * @param {Array} pair 滚动起点/终点值对
	 */
	scroll( ev, type, pair, rid ) {
		if (pair === null) {
			pair = ev.detail;
		}
		let $el = this.$elem(rid) || $(this.data);

		if (!$el.length || !$.isArray(pair)) {
			console.error(`no element selected or pair not array`);
			return this.next();
		}
		type = type.toUpperCase();
		pair = rangeScroll($el[0], pair, type);

		if (pair) {
			this.tween.push(
				handler.bind( $el[0], {
					type: scrollType[type],
					begin: pair[0],
					amount: pair[1] - pair[0],
				}, 'scroll')
			);
		}
		return this.next();
	},


	/**
	 * 节奏控制。
	 * - 对目标元素按缓动曲线激发事件；
	 * - $base可附带单位，默认秒；
	 * - 注：缓动曲线由后续start提供；
	 * @param {Number|String} $base 时间基准
	 * @param {String} $fire 激发事件名
	 * @param {String} $val 发送值，可选
	 * @param {String} rid  目标元素标识，可选
	 */
	beat( ev, $base, $fire, $val, rid ) {
		if ($val === null) {
			$val = ev.detail;
		}
		let $el = this.$elem(rid) || $(this.data),
			_vs = String(this.$value($base)).match(__reNumUnit);

		if (!$el.length || !_vs) {
			console.error(`no element selected or ${$base} was invalid`);
			return this.next();
		}
		let _tm = parseFloat(_vs[1]);

		this.tween.push(
			handler.bind( $el[0], {
				base: _vs[2] == 'ms' ? _tm/1000 : _tm,
				event: this.$value($fire),
				extra: this.$value($val),
				count: 1,
			}, 'tempo')
		);
		return this.next();
	},


	//-- Tracker支持 ----------------------------------------------------------
	// 用户自行定义，应当配置在动效开始（ef.start）前。


	/**
	 * 通用快照（属性）。
	 * - 用于动画开始前的初始值记录，以便重置恢复；
	 * - 颜色和样式（rgb|hsl|css）也用此追踪，用style属性即可；
	 * 注：动画的高频逐帧变化不宜存入Tracker栈。
	 *
	 * @param {String} $name 属性名
	 */
	snap( ev, $name, rid ) {
		attrTracker(
			this.$elem(rid) || $(this.data),
			this.$value($name)
		);
		return this.next();
	},


	/**
	 * 滚动条快照。
	 * - 仅用于滚动条动画（scroll）的重置；
	 * @param {String} type 滚动条类型（Y|X|y|x|left|top）
	 */
	snapScroll( ev, type, rid ) {
		scrollTracker(
			$el = this.$elem(rid) || $(this.data),
			scrollType[type.toLowerCase()]
		);
		return this.next();
	},

});



/**
 * 提取缓动函数。
 * @param  {String} name 缓动类型.名
 * @return {Function|null}
 */
function easeHandle( name ) {
	if (!name) {
		return null;
	}
	let [a, b] = name.split('.'),
		_ease = T.Easing[a] && T.Easing[a][b];

	if (!_ease) {
		console.error(`invalid easing with ${name}`);
	}
	return _ease || null;
}



/**
 * 提取缓动函数集。
 * @param  {String|Array|undefined} names 缓动类型.名集
 * @param  {Number} size 集大小
 * @return {[Function|null]}
 */
function easeHandles( names, size ) {
	if (!$.isArray(names)) {
		names = [names];
	}
	let _eases = [];

	for ( let i of $.range(0, size-1) ) {
		_eases[i] = easeHandle(names[i]);
	}
	return _eases;
}


//
// 获取起始值
// @param  {Element} el 目标元素
// @param  {String} name 样式名
// @return {Number} 目标单位值
///////////////////////////////////////////////////////////////////////////////


/**
 * 范围提取（值）
 * - 从元素样式取值；
 * - 返回一个3单元数组：起止数值和单位；
 * @param  {String|Number} end 终点值
 * @return {Array} [beg, end, unit]
 */
function rangeValue( el, name, end ) {
	let _val = String(end).match(__reNumUnit),
		_beg = null;

	if (!_val) {
		throw new Error(`the ${end} was invalid`);
	}
	let _unit = _val[2] || '';

	if (!_unit) {
		_beg = beginNumber(el, name);
	}
	else if (_unit == '%') {
		_beg = beginPercent(el, name);
	}
	else {
		_beg = UnitHandles[_unit](el, name);
	}
	return [ _beg, parseFloat(end), _unit ];
}


/**
 * 范围提取（值）
 * - 从元素属性取值；
 * - 单位仅支持百分比和纯数值；
 * - 返回一个3单元数组：起止数值和单位；
 * @param  {String|Number} end 终点值
 * @return {Array} [beg, end, unit]
 */
function rangeAttr( el, name, end ) {
	let _val = String(end).match(__reNumUnit);

	if (!_val) {
		throw new Error(`the ${end} was invalid`);
	}
	return [
		_val[2] == '%' ? beginPercent(el, name) : parseFloat($.attr(el, name)),
		parseFloat(end),
		_val[2] || '',
	];
}


/**
 * 范围提取（值对已知）
 * @param  {String|Number} beg 初始指定值
 * @param  {String|Number} end 配置最终值
 * @return {Array} [beg, end, unit]
 */
function rangePair( beg, end ) {
	let _val = String(end).match(__reNumUnit);

	if (!_val) {
		throw new Error(`the ${end} was invalid`);
	}
	return [
		parseFloat(beg), parseFloat(end), _val[2] || ''
	];
}


/**
 * 序列值范围集。
 * - 返回的集合中值已经为数值类型；
 * @param  {[String]} beg 起始值集
 * @param  {[String]} end 终点值集
 * @return {Array} [[beg], [end]]
 */
function rangeArgs( beg, end ) {
	return [
		beg.map( n => parseFloat(n) ),
		end.map( n => parseFloat(n) )
	];
}


/**
 * 获取起始数值。
 * - 支持基本尺寸属性和样式取值；
 */
function beginNumber( el, name ) {
	return $[name] ? +$[name](el) : parseFloat($.css(el, name));
}


/**
 * 参数值序列。
 * - 元素属性值为多数值序列的切分（如<path d="..."里的d值）；
 * - 提取数值，数值与指令字符无需空格分开；
 * - 动效配置的终点值序列需与属性中的值序列按位置对应；
 * 注记：
 * - 动效的值序列采用原位替换方式，因此数值可紧挨非数值；
 *
 * @param  {Element} el 目标元素
 * @param  {String} name 属性名
 * @return {Array} 字符串数值序列
 */
function beginArgs( el, name ) {
	return $.attr(el, name).match(__reNumber);
}


/**
 * 解析颜色值（rgba）。
 * RGBA格式：(0-255, 0-255, 0-255, 0-1)
 * 注：SVG的颜色填充也由CSS计算值提取。
 * @param  {String} val RGB[A]格式值
 * @param  {Boolean} alpha 透明度支持
 * @return {Array} [R, G, B, A]
 */
function colorRGBA( val, alpha ) {
	let _val = val.match(__reColorRGBA),
		_rgb = [ _val[1], _val[2], _val[3] ];

	if (alpha) {
		_rgb.push( $.isNumeric(_val[4]) ? _val[4] : 1 );
	}
	return _rgb.map( n => parseFloat(n) );
}


/**
 * 解析颜色值（hsla）。
 * HSLA格式：(0-360, 0-100%, 0-100%, 0-1)
 * @param  {String} val RGB[A]格式值
 * @param  {Boolean} alpha 透明度支持
 * @return {Array} [H, S, L, A]
 */
function colorHSLA( val, alpha ) {
	let _cvs = colorRGBA(val, alpha),
		_hsl = rgbToHsl(..._cvs);

	return alpha ? _hsl.concat(_cvs[3]) : _hsl;
}


/**
 * 计算颜色变化量。
 * vals成员为字符串且前置+或-字符时，表示变化量。
 * @param  {Array} begs 颜色分量起始值序列
 * @param  {Array} vals 颜色分量目标值或变化量序列
 * @return {Array} 颜色分量变化量序列
 */
function colorAmount( begs, vals ) {
	return vals.map( function(v, i) {
		if (typeof v == 'number') {
			return v - begs[i];
		}
		return v[0] == '+' || v[0] == '-' ? parseFloat(v) : v - begs[i];
	});
}


/**
 * 颜色初始值。
 * @param  {String} val RGB[A]格式值
 * @param  {Boolean} alpha 透明度支持
 * @param  {String} type 取值类型（rgba|hsla）
 * @return {Array} [R,G,B,A] | [H,S,L,A]
 */
function beginColor( val, alpha, type ) {
	switch (type) {
		case 'rgba': return colorRGBA(val, alpha);
		case 'hsla': return colorHSLA(val, alpha);
	}
}


/**
 * 获取起始百分比。
 */
function beginPercent( el, name ) {
	let _per = RectStyles[name];
	return _per ? _per(el, name) : Percent.normal(el, name);
}


/**
 * 获取垂直滚动条范围。
 * - 如果没有滚动条，返回null；
 * - 原始值为null时才求值设置；
 * @param  {Element} box 容器元素
 * @param  {Array} buf 原始值范围
 * @return {Array|null} buf
 */
function rangeScrollY( box, buf ) {
	let _dif = box.scrollHeight - box.clientHeight;
	if (_dif < 1) return null;

	if (buf[0] === null) buf[0] = $.scrollTop(box);
	if (buf[1] === null) buf[1] = _dif;
}

/**
 * 获取水平滚动条范围。
 * （说明同上）
 */
function rangeScrollX( box, buf ) {
	let _dif = box.scrollWidth - box.clientWidth;
	if (_dif < 1) return null;

	if (buf[0] === null) buf[0] = $.scrollLeft(box);
	if (buf[1] === null) buf[1] = _dif;
}


/**
 * 百分比转换为数值。
 * @param  {Array} vals  百分比值序列
 * @param  {Number} total 百分比总量
 * @return {Array}
 */
function percentNumber( vals, total ) {
	return vals.map( v =>
		$.isNumeric(v) ? v : total * parseFloat(v) / 100
	);
}


/**
 * 获取滚动条范围值。
 * @param  {Element} box 容器元素
 * @param  {Array} buf 原始值范围
 * @param  {String} type 滚动条类型（Y|X）
 * @return {Array|null}
 */
function rangeScroll( box, buf, type ) {
	let _total;

	switch (type) {
	case 'Y':
		buf = rangeScrollY(box, buf);
		_total = box.scrollHeight - box.clientHeight;
		break;
	case 'X':
		buf = rangeScrollX(box, buf);
		_total = box.scrollWidth - box.clientWidth;
	}
	return buf && percentNumber(buf, _total);
}


//
// 滚动条类型名映射。
//
const scrollType = {
	y:  	'scrollTop',
	top: 	'scrollTop',
	x:  	'scrollLeft',
	left: 	'scrollLeft',
};



/**
 * 动效代理。
 * - this绑定为动效目标元素；
 * - 返回值作为下一个代理函数的数据参数（data）；
 * - 返回false会终止当前动效；
 * init: {
 *  	{String} name 属性/样式名
 *  	{Number|Array} begin 起始值（集）
 *  	{Number|Array} amount 变化量（集）
 *  	{String} unit 值单位
 *  	{Function|[Function]} ease 定制缓动取值函数
 *  	// rate专用
 *  	{Number} base  基准时间（秒）
 *  	{String} event 事件名
 *  	{Value} extra  发送数据
 *  	{Number} count 激发计次
 *  	// 滚动条专用
 *  	{String} type 滚动类型（scrollTop|scrollLeft）
 * }
 * @param  {Object} init 动效初始数据（bound）
 * @param  {String} type 处理类型（bound）
 * @param  {Object} args 当前帧参数对象
 * @param  {Mixed} data  上一个动效的返回值
 * @return {Mixed|false}
 */
function handler( init, type, args, data ) {
	return Tween[type](this, init, args, data);
}


//
// 代理调用集。
// 处理每一帧的元素属性。
// 本集合中并未使用data参数，原样返回。
///////////////////////////////////////////////////////////////////////////////
// 参数约定：
// @param {Element} el 目标元素
// @param {Object} init 初始数据
// @param {Object} args 每帧参数对象
// args: {
//  	{Number} start 	起始时间戳
//  	{Object} frames 总帧数存储（frames.total）
//  	{Number} count 	当前迭代计数
//  	{Number} ratio 	曲线当前比值
//  	{Number} timestamp 当前绘制时间戳
// }
//
const Tween = {
	/**
	 * 属性动效。
	 */
	attribute( el, init, args, data ) {
		$.attr(
			el,
			init.name,
			init.begin + oneRatio(init.ease, args) * init.amount + init.unit
		);
		return data;
	},


	/**
	 * 样式动效。
	 */
	style( el, init, args, data ) {
		$.css(
			el,
			init.name,
			init.begin + oneRatio(init.ease, args) * init.amount + init.unit
		);
		return data;
	},


	/**
	 * 颜色动效（RGB|RGBA）
	 */
	rgba( el, init, args, data ) {
		$.css(
			el,
			init.name,
			rgbaValue( init.begin, init.amount, allRatio(init.ease, args) )
		);
		return data;
	},


	/**
	 * 颜色动效（HSL|HSLA）
	 */
	hsla( el, init, args, data ) {
		$.css(
			el,
			init.name,
			hslaValue( init.begin, init.amount, allRatio(init.ease, args) )
		);
		return data;
	},


	/**
	 * 节奏控制（准动效）
	 */
	tempo( el, init, args, data ) {
		let _to  = init.base * __frameRate * init.count;

		if (args.ratio * args.frames.total >= _to) {
			let _data = {
					count: init.count++,
					extra: init.extra,
				};
			$.trigger(el, init.event, _data);
		}
		return data;
	},


	/**
	 * 滚动条动效。
	 * init.type: [scrollTop|scrollLeft]
	 */
	scroll( el, init, args, data ) {
		$[init.type](
			el,
			init.begin + args.ratio * init.amount
		);
		return data;
	},


	/**
	 * 属性值参数序列动效。
	 * 如SVG元素<path>的d属性控制。
	 */
	arglist( el, init, args, data ) {
		let _ratio = allRatio(init.ease, args),
			_value = $.attr(el, init.name);
		$.attr(
			el,
			init.name,
			argsValue(_value, init.begin, init.amount, _ratio)
		);
		return data;
	},

};


/**
 * 获取缓动比值。
 * @param  {Function|null} ease 定制缓动函数
 * @param  {Object} args 动效帧参数对象
 * @return {Number} 缓动比值
 */
function oneRatio( ease, args ) {
	return ease ? ease(args.count, args.frames.total) : args.ratio;
}


/**
 * 获取缓动比值集。
 * @param  {[Function|null]} eases 缓动函数集
 * @param  {Object} args 动效帧参数对象
 * @return {[Number]|Number} 比值集
 */
function allRatio( eases, args ) {
	return eases.map( fn => fn ? fn(args.count, args.frames.total) : args.ratio );
}


/**
 * 颜色分量值数组。
 * - 同时适用于 RGBA 和 HSLA 两种规格；
 * @param  {Array} begins  起始值集
 * @param  {Array} amounts 变化量集
 * @param  {Array} ratios  缓动比值集
 * @return {[Number]} 分量值集
 */
function colorValues( begins, amounts, ratios ) {
	return begins.map(
		(beg, i) => beg + ratios[i]*amounts[i]
	);
}


/**
 * RGBA字符串表示。
 * @param  {Array} begins  起始值集
 * @param  {Array} amounts 变化量集
 * @param  {Array} ratios  缓动比值集
 * @return {String}
 */
function rgbaValue( begins, amounts, ratios ) {
	let _cc = colorValues(
			begins, amounts, ratios
		),
		_vs = `${_cc[0]%255}, ${_cc[1]%255}, ${_cc[2]%255}`;

	return _cc.length == 3 ? `rgb(${_vs})` : `rgba(${_vs}, ${_cc[3]})`;
}


/**
 * HSLA字符串表示。
 * @param  {Array} begins  起始值集
 * @param  {Array} amounts 变化量集
 * @param  {Array} ratios  缓动比值集
 * @return {String}
 */
function hslaValue( begins, amounts, ratios ) {
	let _cc = colorValues(
			begins, amounts, ratios
		),
		_vs = `${_cc[0]%360}, ${_cc[1]%100}%, ${_cc[2]%100}%`;

	return _cc.length == 3 ? `hsl(${_vs})` : `hsla(${_vs}, ${_cc[3]})`;
}


/**
 * 参数序列值表示。
 * - begins从attr中匹配提取，故长度匹配；
 * @param  {String} attr   属性值
 * @param  {Array} begins  起始值序列
 * @param  {Array} amounts 变化量序列
 * @param  {Array} ratios  缓动比值序列
 * @return {String}
 */
function argsValue( attr, begins, amounts, ratios ) {
	let _i = -1;

	return attr.replace(
		__reNumber,
		() => ( _i++, begins[_i] + ratios[_i]*amounts[_i] )
	);
}



//
// 单位处理（样式）
///////////////////////////////////////////////////////////////////////////////


/**
 * 单位通用转换。
 * - 计算像素值对应的目标单位值；
 * - 如果目标单位非法或不支持，返回0值；
 * - 支持相对于文档根的rem单位；
 * 适用：[
 *  	mm, cm, in, pt, pc, rem, px
 * ]
 * @param  {Element} el 目标元素
 * @param  {String} name 样式名
 * @return {Number} 目标单位值
 */
function normalUnit( el, name ) {
	let _pxs = parseFloat( $.css(el, name) );
	return _pxs / ( UnitRatio[unit] || Infinity );
}


/**
 * 视口单位转换。
 * 适用：{
 *  	vh, vw, vmin, vmax
 * }
 * @param  {Element} el 目标元素
 * @param  {String} name 样式名
 * @param  {Window} view 视口对象
 * @return {Number} 目标单位值
 */
function viewUnit( el, name, view = document.defaultView ) {
	let _pxs = parseFloat( $.css(el, name) );
	return __viewGetter[unit](_pxs, view);
}


//
// 视口处理集。
// @param  {Number} px 像素值
// @param  {Window} ve 视口对象
// @return {Number} 目标单位值
//
const __viewGetter = {
	vh:   (px, ve) => px / $.outerHeight(ve) * 100,
	vw:   (px, ve) => px / $.outerWidth(ve) * 100,

	vmin: (px, ve) => px / Math.min($.outerHeight(ve), $.outerWidth(ve)) * 100,
	vmax: (px, ve) => px / Math.max($.outerHeight(ve), $.outerWidth(ve)) * 100,
};


/**
 * 相对单位转换。
 * - 相对于父元素，以其1个单位值为基础；
 * - 优先用$系方法匹配目标名称，其次视为CSS属性；
 * 适用：[
 *  	em, ex, ch, %（普通）
 * ]
 * 注：rem在normalUnit中直接支持。
 *
 * @param  {Element} el 目标元素
 * @param  {String} name 属性/样式名
 * @param  {Element} _box 相对基元素
 * @return {Number} 目标单位值
 */
function relativeUnit( el, name, _box ) {
	_box = _box || el.parentElement;

	if ($[name]) {
		return $[name](el) / $[name](_box);
	}
	return parseFloat($.css(el, name)) / parseFloat($.css(_box, name));
}


//
// 单位对应处理函数。
// 百分比（%）特别对待（见后）。
// 注记：
// - 不支持角度控制，它通常由CSS函数操作；
// - 时间控制主要应用于动效之外，元素通用操作的节奏，
//   如插入内容的速率、动效启动的节奏等。
//
// @param  {Element} el 目标元素
// @param  {String} name 属性/样式名
//
const UnitHandles = {
	mm:   normalUnit,
	cm:   normalUnit,
	in:   normalUnit,
	pt:   normalUnit,
	pc:   normalUnit,
	px:   normalUnit,
	rem:  normalUnit,

	em:   relativeUnit,
	ex:   relativeUnit,
	ch:   relativeUnit,

	vh:   viewUnit,
	vw:   viewUnit,
	vmin: viewUnit,
	vmax: viewUnit,
};



//
// 百分比处理。
// 由于百分比直接与父容器相关，而父容器又受当前元素的position样式影响，
// 因此目前仅支持几个基本样式属性：{
//  	height, width
//  	top, right, bottom, left
// }
// 未自动支持的尺寸样式，需人工给出初始百分比。如：{
//  	margin-[top|right|bottom|left]
//  	padding-[top|right|bottom|left]
//  	min-[width|height]
//  	max-[width|height] ...
// }
// @param  {Element} el 目标元素
// @param  {String} name 属性/样式名
// @return {Number} 结果值（x100）
///////////////////////////////////////////////////////////////////////////////


const Percent = {
	/**
	 * 通用百分比。
	 * - 计算元素目标样式当前像素值对应的百分比值；
	 * - 适用当前元素position为relative和默认值时的百分比计算；
	 */
	normal: (el, name) => relativeUnit(el, name) * 100,


	/**
	 * 尺寸百分比。
	 * - 计算元素目标样式当前像素值对应的百分比值；
	 * - 适用尺寸/位置样式，相对容器元素与定位属性有关；
	 * 适用：height, width
	 */
	rectsize: (el, name) => relativeUnit(el, name, positionBox(el)) * 100,


	/**
	 * 垂直偏移百分比。
	 * 适用：top, bottom
	 */
	voffset: (el, name) => rectOffset(el, name, 'height') * 100,


	/**
	 * 水平偏移百分比。
	 * 适用：left, right
	 */
	hoffset: (el, name) => rectOffset(el, name, 'width') * 100,

};


/**
 * 获取元素相对容器。
 * - 与当前元素的position样式值相关；
 * - 绝对定位下未找到定位元素时，父容器为窗口；
 * 注记：
 * 绝对定位下，没有上级定位元素时：
 * - 设置属性时，浏览器参考窗口对象；
 * - 未设置属性而获取时，浏览器参考文档根元素（html）；
 * - 此处获取容器是为了设置属性，因此返回窗口；
 *
 * @param  {Element} el 当前元素
 * @return {Element} 相对容器元素
 */
function positionBox( el ) {
	let _pos = $.css(el, 'position'),
		_doc = el.ownerDocument,
		_win = _doc.defaultView;

	if (_pos == 'fixed') return _win;
	if (_pos != 'absolute') return el.parentElement;

	let _box = $.offsetParent(el);
		_htm = _doc.documentElement;

	return _box === _htm && $.css(_htm, 'position') == 'static' ? _win : _box;
}


/**
 * 尺寸偏移。
 * @param  {Element} el 目标元素
 * @param  {String} name 属性/样式名
 * @param  {String} type 方向参考（height|width）
 * @return {Number} 结果值
 */
function rectOffset( el, name, type ) {
	let _box = positionBox(el),
		_all = $[type](_box),
		_val = parseFloat($.css(el, name));

	return _val && _val/_all || 0;
}



//
// 适用矩形百分比的样式。
// - margin/padding系百分比计算较为复杂，暂不支持；
// - 相对容器元素与本元素position设置有关；
// - 本元素至少需要设置position=relative属性；
// - 相对容器元素可能需要明确设置height/width样式值；
// @param  {Element} el 目标元素
// @param  {String} name 属性/样式名
// @return {Number} 百分比值（x100）
//
const RectStyles = {
	width: 	 Percent.rectsize,
	height:  Percent.rectsize,
	top: 	 Percent.voffset,
	bottom:  Percent.voffset,
	left: 	 Percent.hoffset,
	right: 	 Percent.hoffset,
};



/**
 * @cite https://gist.github.com/mjackson/5311256
 * @2017.03.05
 *
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * 注：返回值的H已为角度，SL已为百分比（x100）
 *
 * @param  {Number} r 颜色R分量
 * @param  {Number} g 颜色G分量
 * @param  {Number} b 颜色B分量
 * @return {Array} [H, S, L]
 */
function rgbToHsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;

	let max = Math.max(r, g, b),
		min = Math.min(r, g, b),
		h = 0,
		s = 0,
		l = (max + min) / 2;

	if (max == min) return [ h, s, l*100 ];

	let d = max - min;
	s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

	switch (max) {
		case r: h = (g - b) / d + (g < b ? 6 : 0); break;
		case g: h = (b - r) / d + 2; break;
		case b: h = (r - g) / d + 4; break;
	}

	return [ h*60, s*100, l*100 ];
}



/**
 * 追踪器支持（压入）。
 * - 在本动效模块中，通常仅为存储相关初始值；
 * @param {Object|Function} back 回退操作
 */
function tracker( back ) {
	return $.Fx.Tracker && $.Fx.Tracker.push(back);
}


/**
 * 属性追踪器。
 * @param {Queue} $el 元素（集）
 * @param {String} name 属性名
 */
function attrTracker( $el, name ) {
	let _vs = $el.attr(name);

	tracker( () =>
		$el.forEach( (el, i) => $.attr(el, name, _vs[i]) )
	);
}


/**
 * 滚动条追踪。
 * @param {Queue} $el 元素（集）
 * @param {String} fn 滚动条设置函数名（scrollLeft|scrollTop）
 */
function scrollTracker( $el, fn ) {
	let _vs = $el[fn]();

	tracker( () =>
		$el.forEach( (el, i) => $[fn](_vs[i]) )
	);
}



//
// 单位初始求值。
// 每1单位对应的像素值。
// 注记：
// 页面初始载入时插入一个临时元素，
// 设置尺寸并获取浏览器计算后的像素值。与当前环境相关。
//
function __unitInit( el, name, buf = {} ) {
	$.css(el, {
		zIndex: -1,
		position: 'absolute',
	})
	.append(document.body, el);

	Object.keys(buf)
	.reduce( (o, s) => {
		o[s] = parseFloat( $.css(el, name, 10+s).css(el, name) ) / 10;
		return o;
	}, buf );

	return $.remove(el), buf;
}



// Init
///////////////////////////////////////////////////////////////////////////////

//
// 环境参数：
// 求值不同单位对应的像素值。
//
$.ready( function() {
	__unitInit( $.Element('div'), 'width', UnitRatio );
});


//:debug
T.Units = UnitRatio;


// 注：
// 因动效为高频修改，故不支持嵌入代理（$:Tracker）。
// $ == tQuery
})( tQuery, Tpb );