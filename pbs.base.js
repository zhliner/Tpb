//! $ID: pbs.base.js 2019.08.19 Tpb.Base $
// +++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  OBT 基础集定义。
//
//  约定：{
//      __[name]    表达[name]方法的取栈条目数。
//      __[name]_x  指定[name]是否为特权方法（可取用数据栈stack）。
//  }
//
//  接口参数：
//  - 首个实参为事件关联对象（evo），在模板中被隐藏。
//  - 如果接口需要直接操作数据栈（特权），数据栈对象会作为第二个实参传入（对模板隐藏）。
//
///////////////////////////////////////////////////////////////////////////////
//

import $, { EXTENT, ACCESS, Globals, DEBUG, JUMPCELL, PREVCELL } from "./config.js";
import { bindMethod } from "./base.js";
import { format } from "./tools/date.js";


const
    // 字符串空白清理方法集。
    trimFunc = {
        '1':    'trimStart',
        '0':    'trim',
        '-1':   'trimEnd',
    },

    // 空白分隔符。
    __reSpace = /\s+/,

    // 至少1个空白。
    // 保留首个匹配字符和剩余部分记忆。
    // 注：trims专用。
    __reSpace1n = /(\s)(\s*)/g,

    // 颜色函数形式
    __reRGBfx = [
        // rgb(128.0, 128, 128, 0.6)
        /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.%]+))?\s*\)/,
        // rgb(34 12 64 / 0.6)
        /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)/,
    ],

    // RGBA十六进制表示。
    // 兼容3位安全色表示（如：#999）。
    __reRGB16 = /^#(?:[0-9A-F]{3}|[0-9A-F]{6}(?:[0-9A-F]{2})?)$/i,

    // 选区对象存储池。
    __tmpRanges = {},

    // 选区默认存储键。
    __rngKey = Symbol( 'Range-store' );



//
// 控制类。
// 适用 On/By/To:Next 三个域。
//
const _Control = {

    // 基本控制。
    //-----------------------------------------------------

    /**
     * 通过性检查。
     * 目标：暂存区/栈顶1项。
     * 检查目标值是否为真（非假）或是否为实参序列之一（===），
     * 结果为假会中断执行流。
     * @param  {...Value} vals 对比值集，可选
     * @return {void|reject}
     */
    pass( evo, ...vals ) {
        let _v = evo.data;

        if ( vals.length ) {
            _v = vals.includes( _v );
        }
        if ( !_v ) return Promise.reject();
    },

    __pass: 1,


    /**
     * 流程结束。
     * 目标：暂存区/栈顶1项。
     * 检查目标值是否为真（非假）或是否为实参序列之一（===），
     * 结果为真会结束执行流。
     * @param  {...Value} vals 对比值集，可选
     * @return {void|reject}
     */
    end( evo, ...vals ) {
        let _v = evo.data;

        if ( vals.length ) {
            _v = vals.includes( _v );
        }
        if ( _v ) return Promise.reject();
    },

    __end: 1,


    /**
     * 无条件结束。
     * 与end类似，但没有条件检测。
     * 注：这通常在配合jump指令时很有用。
     */
    exit() {
        return Promise.reject();
    },

    __exit: null,


    /**
     * 阻止事件默认行为。
     * 目标：暂存区1项。
     * 如果目标非空，则真值停止，否则无条件阻止。
     * back为执行之后的返回值（入栈），如果未执行则忽略。
     * 注：
     * - 该指令需要在异步指令之前使用。
     * - 如果调用链包含元素方法调用（如submit()），还应当在立即Promise之前调用。
     * 例：
     * - push(1) pop avoid('ok') 目标值1为真，停止并入栈 'ok'
     * - push(0) avoid('ok') 目标为空，无条件停止，入栈 'ok'
     *
     * @param  {Value} back 执行后结果，可选
     * @return {void|back}
     */
    avoid( evo, back ) {
        let _v = evo.data;

        if ( _v === undefined || _v ) {
            evo.event.preventDefault();
            return back;
        }
    },

    __avoid: -1,


    /**
     * 停止事件冒泡。
     * 目标：暂存区1项。
     * 如果目标非空，则真值执行，否则无条件执行。
     * back为执行之后的返回值，如果未执行则忽略。
     * 注：该指令需要在异步指令之前使用。
     * @param  {Value} back 执行后结果，可选
     * @return {void|back}
     */
    stop( evo, back ) {
        let _v = evo.data;

        if ( _v === undefined || _v ) {
            evo.event.stopPropagation();
            return back;
        }
    },

    __stop: -1,


    /**
     * 停止事件冒泡并阻止本事件其它处理器的执行。
     * 目标：暂存区1项。
     * 如果目标非空，则真值执行，否则无条件执行。
     * back为执行之后的返回值，如果未执行则忽略。
     * 注：该指令需要在异步指令之前使用。
     * @param  {Value} back 执行后结果，可选
     * @return {void|back}
     */
    stopAll( evo, back ) {
        let _v = evo.data;

        if ( _v === undefined || _v ) {
            evo.event.stopImmediatePropagation();
            return back;
        }
    },

    __stopAll: -1,


    /**
     * 循环执行启动。
     * 从entry指令定义的入口处执行。
     * 目标：暂存区/栈顶1项。
     * 目标值用于判断是否继续循环（假值终止）。
     * 传送的入栈值ival效果类似于entry指令的返回值。
     * @param {Value} ival 起始入栈值
     */
    loop( evo, ival ) {
        if ( DEBUG ) {
            propectLoop( 0, '[loop] too many cycles.' );
        }
        evo.data && evo.entry( ival );
    },

    __loop: 1,


    /**
     * 动效循环启动。
     * 从entry指令定义的入口处执行。
     * 目标：暂存区/栈顶1项。
     * 说明参考上面loop指令。
     * 每次执行受限于硬件刷新率。
     * @param  {Value} ival 起始入栈值
     * @return {void}
     */
    effect( evo, ival ) {
        if ( DEBUG ) {
            propectLoop( 1, '[effect] too many cycles.' );
        }
        evo.data && requestAnimationFrame( () => evo.entry(ival) );
    },

    __effect: 1,



    // 暂存区赋值。
    // 目标：无。
    // 特权：是，自行操作数据栈。
    // @return {void}
    //-----------------------------------------------------

    /**
     * 弹出栈顶n项。
     * 弹出n项压入暂存区，无实参调用视为1项。
     * n负值无用（自动忽略）。
     * @param {Stack} stack 数据栈
     * @param {Number} n 弹出的条目数
     */
    pop( evo, stack, n = 1 ) {
        n == 1 ? stack.tpop() : stack.tpops( n );
    },

    __pop_x: true,


    /**
     * 剪取数据栈目标位置条目（单项）。
     * idx从0开始，负值从栈顶算起（-1即为栈顶项）。
     * 结合push指令，可用于交换栈顶条目位置。
     * 例：
     * pick(-1) 同 pop
     * pick(-2) 取栈顶之下1项。
     * (val) pick(-2) push 剪取栈顶之下1项后入栈（交换栈顶2项）。
     * pick(0)  取出栈底第一项。
     * @temp: Value
     * @param {Stack} stack 数据栈
     * @param {Number} idx 位置下标（支持负数）
     */
    pick( evo, stack, idx ) {
        stack.tpick( idx );
    },

    __pick_x: true,


    /**
     * 剪取数据栈任意区段。
     * 结合push指令，可交换栈顶条目位置：
     * 例：
     * (val) clip(-3, 2) push(_)  剪取栈顶-3和-2项，展开入栈。
     * (val) clip(-3, 2) push     同上剪取，但结果作为单项入栈。
     * @temp: [Value]
     * @param {Stack} stack 数据栈
     * @param {Number} idx 起始位置
     * @param {Number} cnt 移除计数，可选
     */
    clip( evo, stack, idx, cnt = 1 ) {
        stack.tsplice( idx, cnt );
    },

    __clip_x: true,


    /**
     * 引用数据栈目标位置项。
     * 如果传入数组表示目标位置，则视为一个范围。
     * 下标位置支持负数从末尾算起。
     * 注意：非法的下标位置会导入一个null值。
     * @param {Stack} stack 数据栈
     * @param {...Number} ns 位置下标序列
     */
    index( evo, stack, ...ns ) {
        let _v1 = ns[0];

        if ( $.isArray(_v1) ) {
            // return undefined
            return stack.tslice( _v1[0], _v1[1] );
        }
        stack.tindex( _v1, ...ns );
    },

    __index_x: true,


    /**
     * 直接暂存值。
     * 这是 push(val) pop 指令序列的简化版。
     * @param {Stack} stack 数据栈
     * @param {...Value} vals 目标值序列
     */
    tmp( evo, stack, ...vals ) {
        stack.tpush( ...vals );
    },

    __tmp_x: true,



    // 数据栈操作。
    //-----------------------------------------------------

    /**
     * 空值入栈。
     * 压入特殊值undefined。
     * 目标：暂存区1项可选。
     * 特权：是，特殊操作。
     * 如果目标有值，则为判断入栈逻辑：
     * - 真值入栈 undefined。
     * - 假值入栈候选值 val。
     * - 如果未传递val，条件假不会入栈值（返回的undefined被忽略）。
     * 可用于向栈内填充无需实参的占位值。
     * @param  {Stack} stack 数据栈
     * @param  {Value} val 候补值，可选
     * @return {Value|void}
     */
    nil( evo, stack, val ) {
        if ( evo.data === undefined ) {
            return stack.undefined();
        }
        return evo.data ? stack.undefined() : val;
    },

    __nil: -1,
    __nil_x: true,


    /**
     * 数据直接入栈。
     * 目标：暂存区条目可选。
     * 特权：是，自行入栈。
     * 多个实参会自动展开入栈，数组实参视为单个值。
     * 如果目标有值，会附加（作为单一值）在实参序列之后。
     * 例：
     * - push('abc', 123)  // 分别入栈字符串'abc'和数值123两个值
     * - pop(3) push(true) // 入栈布尔值true和暂存区条目（3项一体）两个值
     * 友好：
     * 系统支持空名称指代，即：('hello') => push('hello') 相同。
     * 这让数据入栈更简洁（如果无需明确的push表意）。
     * @param  {Stack} stack 数据栈
     * @param  {...Value} vals 值序列
     * @return {void} 自行入栈
     */
    push( evo, stack, ...vals ) {
        if ( evo.data !== undefined ) {
            vals.push( evo.data );
        }
        if ( vals.length > 0 ) stack.push( ...vals );
    },

    __push: 0,
    __push_x: true,


    /**
     * 栈顶复制（浅）。
     * 复制栈顶项入栈，支持复制多份。
     * 目标：无。
     * 特权：是，自行入栈。
     * 注记：不会取出栈顶项，因此复制1份时栈顶即有2份。
     * @param  {Stack} stack 数据栈
     * @param  {Number} cnt 复制份数，可选
     * @return {void}
     */
    dup( evo, stack, cnt = 1 ) {
        let _val = stack.tops(1)[0];
        while ( cnt-- > 0 ) stack.push( _val );
    },

    __dup_x: true,


    /**
     * 栈顶复制（浅）。
     * 复制栈顶n项并入栈（原样展开）。
     * 目标：无。
     * 特权：是，灵活取栈&自行入栈。
     * 例：
     * dups(1) 与 dup(1) 效果相同。
     * @param  {Stack} stack 数据栈
     * @param  {Number} n 条目数，可选
     * @return {void}
     */
    dups( evo, stack, n = 1 ) {
        if ( n > 0 ) {
            stack.push( ...stack.tops(n) );
        }
    },

    __dups_x: true,


    /**
     * 栈顶条目打包封装。
     * 取出栈顶的n项打包为一个数组入栈。
     * 目标：无。
     * 特权：是，自行操作数据栈。
     * 始终返回一个数组，负条目数返回一个空数组。
     * @param  {Stack} stack 数据栈
     * @param  {Number} n 条目数
     * @return {[Value]}
     */
    pack( evo, stack, n = 1 ) {
        return n > 0 ? stack.pops( n ) : [];
    },

    __pack_x: true,


    /**
     * 任意片段移动到栈顶。
     * 片段内的条目原样展开。
     * 目标：无。
     * 特权：是，灵活取栈&自行入栈。
     * 注：
     * 相当于 clip(...) push spread 指令序列。
     * @param {Stack} stack 数据栈
     * @param {Number} idx 起始位置
     * @param {Number} cnt 移除计数，可选
     */
    move( evo, stack, idx, cnt = 1 ) {
        stack.push(
            ...stack.splice( idx, cnt )
        );
    },

    __move_x: true,


    /**
     * 任意片段打包（克隆到栈顶）。
     * 目标：无。
     * 特权：是，自行操作数据栈。
     * 两个位置下标支持负值从末尾倒算。
     * @param  {Stack} stack 数据栈
     * @param  {Number} beg 起始位置，可选
     * @param  {Number} end 结束位置（不含），可选
     * @return {[Value]}
     */
    part( evo, stack, beg, end ) {
        return stack.slice( beg, end );
    },

    __part_x: true,


    /**
     * 将条目展开入栈。
     * 目标：暂存区/栈顶1项。
     * 特权：是，自行入栈。
     * 目标中的undefined值会被丢弃。
     * 容错单值展开（无效果）。
     * @data: [Value]|Value
     * @param {Stack} stack 数据栈
     */
    spread( evo, stack ) {
        let x = evo.data;
        stack.push( ...( $.isArray(x) ? x : [x] ) );
    },

    __spread: 1,
    __spread_x: true,


    /**
     * 丢弃栈顶多余的项。
     * 主要用于无用返回值自动入栈的情况。
     * 负的n值会从栈底算起（绝对值下标开始）。
     * @param {Stack} stack 数据栈
     * @param  {Number} n 项数
     * @return {void}
     */
    vain( evo, stack, n = 1 ) {
        n == 1 ? stack.pop() : stack.pops( n );
    },

    __vain_x: true,



    // 简单值操作。
    //-----------------------------------------------------

    /**
     * 设置/获取全局变量。
     * 目标：无。
     * 存储值非空时为设置，否则为取值入栈。
     * 传递val为null时为删除目标值。
     * 注记：
     * undefined值无法入栈，因此返回null，这与设置时的null值功能相符。
     * @param  {String} name 键名
     * @param  {Value} val 存储值，可选
     * @return {Value|void}
     */
    env( evo, name, val ) {
        if ( val === undefined ) {
            let _v = Globals.get(name);
            return _v === undefined ? null : _v;
        }
        val === null ? Globals.delete(name) : Globals.set(name, val);
    },

    __env: null,


    /**
     * 设置/取值浏览器会话数据。
     * 目标：无。
     * val非空时为设置，否则为取值入栈。
     * val传递null可清除name项的值。
     * 传递name为null，可清除整个Storage存储（谨慎）。
     * 注意：
     * 存储的值会被自动转换为字符串。
     * @param  {String} name 存储键名
     * @param  {Value} val 存储值，可选
     * @return {Value|void}
     */
    sess( evo, name, val ) {
        if ( val === undefined ) {
            return window.sessionStorage.getItem(name);
        }
        storage( window.sessionStorage, name, val );
    },

    __sess: null,


    /**
     * 设置/取值浏览器本地数据。
     * 目标：无。
     * 说明：参考sess指令。
     * @param  {String} name 存储键名
     * @param  {Value} val 存储值，可选
     * @return {Value|void}
     */
    local( evo, name, val ) {
        if ( val === undefined ) {
            return window.localStorage.getItem(name);
        }
        storage( window.localStorage, name, val );
    },

    __local: null,


    /**
     * 条件判断传值。
     * 目标：暂存区/栈顶1项。
     * 如果目标值为真（广义），val入栈，否则elseval入栈。
     * @param  {Value} val 为真传值
     * @param  {Boolean} elseval ELSE传值，可选
     * @return {Value}
     */
    $if( evo, val, elseval ) {
        return evo.data ? val : elseval;
    },

    __$if: 1,


    /**
     * CASE分支比较。
     * 目标：暂存区/栈顶1项。
     * 目标与实参一一相等（===）比较，结果入栈。
     * 需要在$switch指令之前先执行。
     * @param  {...Value} vals 实参序列
     * @return {[Boolean]} 结果集
     */
    $case( evo, ...vals ) {
        return vals.map( v => v === evo.data );
    },

    __$case: 1,


    /**
     * SWITCH分支判断。
     * 目标：暂存区/栈顶1项。
     * 测试目标集内某一成员是否为真，是则取相同下标的vals成员返回。
     * 目标通常是$case执行的结果，但也可以是任意值集。
     * 注：
     * 仅取首个真值对应的实参值入栈。
     * 实参序列通常与目标集长度相同，若末尾多出一个，视为无匹配时的默认值。
     * 无任何匹配时，返回null值。
     * @data: [Boolean]
     * @param  {...Value} vals 入栈值候选
     * @return {Value|null}
     */
    $switch( evo, ...vals ) {
        let i, b;

        for ( [i, b] of evo.data.entries() ) {
            if ( b ) return vals[ i ];
        }
        let _v = vals[ i+1 ];

        return _v === undefined ? null : _v;
    },

    __$switch: 1,


    /**
     * 假值替换。
     * 目标：暂存区/栈顶1项。
     * 如果目标为假，返回传递的替换值。
     * 如果传递对比值，目标必须与对比值全等才满足条件。
     * @param  {Value} val 替换值
     * @param  {Value} eqv 对比值（===）
     * @return {Value} 替换值或原始值
     */
    or( evo, val, eqv ) {
        if ( eqv !== undefined ) {
            return evo.data === eqv ? val : evo.data;
        }
        return evo.data || val;
    },

    __or: 1,


    /**
     * 真值替换。
     * 目标：暂存区/栈顶1项。
     * 如果目标为真，返回传递的替换值。
     * 如果传递对比值，目标必须与对比值全等才满足条件。
     * @param  {Value} val 替换值
     * @param  {Value} eqv 对比值（===）
     * @return {Value} 替换值或原始值
     */
    and( evo, val, eqv ) {
        if ( eqv !== undefined ) {
            return evo.data === eqv ? val : evo.data;
        }
        return evo.data && val;
    },

    __and: 1,


    /**
     * 取集合中首个真值成员。
     * 如果arr实参为真，表示执行数组成员判断，空数组为假。
     * 如果没有真值成员，返回null。
     * @data: [Value]|Iterator
     * @param  {Boolean} arr 扩展对比，可选
     * @return {Value|[Value]|null}
     */
    vtrue( evo, arr ) {
        for ( const v of evo.data ) {
            if ( v && (!arr || v.length > 0) ) {
                return v;
            }
        }
        return null;
    },

    __vtrue: 1,

};



//
// 计算&加工类。
// 仅用于 On/By/To:Next 三个域。
//
const _Process = {

    // 集合处理。
    //-----------------------------------------------------
    // 另见末尾部分接口。

    /**
     * 集合成员去重&排序。
     * 目标：暂存区/栈顶1项。
     * 集合如果不是Collector，可为对象（取其值集），返回一个数组。
     * 默认为去重功能，如果传递comp实参则增加排序能力。
     * comp:
     * - true DOM节点排序
     * - null 默认排序规则，适用非节点数据
     * comp接口：function(a, b): Boolean
     * @param  {Function|true|null} comp 排序函数，可选
     * @return {[Value]|Collector}
     */
    unique( evo, comp ) {
        return $.isCollector(evo.data) ?
            evo.data.unique(evo.data, comp) : $.unique(evo.data, comp);
    },

    __unique: 1,


    /**
     * 集合排序。
     * 目标：暂存区/栈顶1项。
     * 对于元素Collector集合，comp应当为空获得默认的排序算法。
     * 对于普通值Collector集合，comp可传递null获得JS环境默认排序规则。
     * 排序不影响原集合。
     * comp接口：function(a, b): Boolean
     * @param  {Function|null} comp 排序函数，可选
     * @return {[Value]|Collector}
     */
    sort( evo, comp ) {
        return $.isCollector(evo.data) ?
            evo.data.sort(comp) : Array.from(evo.data).sort(comp);
    },

    __sort: 1,


    /**
     * 集合成员序位反转。
     * 目标：暂存区/栈顶1项。
     * 反转不影响原始集合。
     * 兼容动画对象上的同名方法（无返回值）。
     * @return {[Value]|Collector|void}
     */
    reverse( evo ) {
        let x = evo.data;

        if ( $.isArray(x) ) {
            return $.isCollector(x) ? x.reverse() : Array.from(x).reverse();
        }
        // 动画对象。
        return x.reverse();
    },

    __reverse: 1,


    /**
     * 集合混合。
     * 目标：无。
     * 特权：是，自行取项。
     * 多个数组按相同下标取值的子数组构成二维数组。
     * 即：各数组成员平行对应（取值为一个子数组），以首个数组的大小为大小。
     * 默认取暂存区全部成员。
     * @data: [Array]
     * @param  {Stack} stack 数据栈
     * @param  {Number} n 取项数量，可选
     * @return {[ArrayN]} n项二维数组
     */
    mix( evo, stack, n = 0 ) {
        if ( n < 0 ) {
            throw new Error( `[${n}] must be a positive integer.` );
        }
        let _as = stack.data( n );

        return _as[0].map( (_, i) => _as.map( a => a[i] ) );
    },

    __mix_x: true,


    /**
     * 合计集合成员的值。
     * 目标：无。
     * 特权：是，手动取栈数据。
     * 如果未传递取栈数量，默认取暂存区全部成员。
     * 如果取栈数量为多个，集合成员也可以是数组，会被扁平化。
     * @data: [Number]
     * @param  {Number} n 取栈数量，可选
     * @param  {Number} deep 扁平化深度，可选
     * @return {Number}
     */
    sum( evo, stack, n = 0, deep = 1 ) {
        if ( n < 0 ) {
            throw new Error( `[${n}] must be a positive integer.` );
        }
        let _ns = stack.data( n );

        return _ns.flat( deep ).reduce( (sum, n) => sum + n, 0 );
    },

    __sum_x: true,


    /**
     * 对象属性清理。
     * 检查对象内与目标值相等的属性条目，替换或移除。
     * 如果替换值未传递（undefined），表示移除该属性条目。
     * 不传递任何实参会移除值为undefined的条目。
     * 支持多层次嵌套的对象数组。
     * 注意：
     * 操作会影响传入的流程数据本身。
     * @data: Object|[Object]
     * @param  {Value} val 匹配值，可选
     * @param  {Value} rep 替换值，可选
     * @return {Object|[Object]} 流程数据
     */
    clean( evo, val, rep ) {
        let _fun = $.isArray( evo.data ) ?
            cleanObjs :
            cleanObj;

        return _fun( evo.data, val, rep );
    },

    __clean: 1,


    /**
     * 格式化日期/时间。
     * 默认返回规范的 yyyy-MM-dd hh:mm 格式。
     * @data: Date|Number
     * @param  {String} fmt 格式定义，可选
     * @return {String}
     */
    datetime( evo, fmt = 'yyyy-MM-dd hh:mm' ) {
        return format( evo.data, fmt );
    },

    __datetime: 1,


    /**
     * 提取日期对象的时间部分。
     * 默认为智能格式：
     * 如果秒数为零，则省略秒数，否则显示秒数。
     * @data: Date|Number
     * @param  {Boolean} second 是否显示秒数，可选
     * @return {String}
     */
    time( evo, second ) {
        if ( second === undefined ) {
            second = !!evo.data.getSeconds();
        }
        return format( evo.data, second ? 'hh:mm:ss' : 'hh:mm' );
    },

    __time: 1,



    // 数学运算。
    // 多数方法有一个集合版（对成员计算）。
    //-----------------------------------------------------

    /**
     * 加运算。
     * 同时适用数值和字符串。
     * 目标：暂存区/栈顶1项
     * 注记：Collector的同名方法没有被使用。
     * @param  {Number|String} y 第二个操作数
     * @return {Number|[Number]|String|[String]}
     */
    add( evo, y ) {
        return mapCall( evo.data, x => x + y );
    },

    __add: 1,


    /**
     * 减运算。
     * 目标：暂存区/栈顶1项。
     * @param  {Number} y 第二个操作数
     * @return {Number|[Number]}
     */
    sub( evo, y ) {
        return mapCall( evo.data, x => x - y );
    },

    __sub: 1,


    /**
     * 乘运算。
     * 目标：暂存区/栈顶1项。
     * @param  {Number} y 第二个操作数
     * @return {Number|[Number]}
     */
    mul( evo, y ) {
        return mapCall( evo.data, x => x * y );
    },

    __mul: 1,


    /**
     * 除运算。
     * 目标：暂存区/栈顶1项。
     * @param  {Number} y 第二个操作数
     * @return {Number|[Number]}
     */
    div( evo, y ) {
        return mapCall( evo.data, x => x / y );
    },

    __div: 1,


    /**
     * 整除运算。
     * 目标：暂存区/栈顶1项。
     * 注：简单的截断小数部分。
     * @param  {Number} y 第二个操作数
     * @return {Number|[Number]}
     */
    idiv( evo, y ) {
        return mapCall( evo.data, x => parseInt(x/y) );
    },

    __idiv: 1,


    /**
     * 模运算。
     * 目标：暂存区/栈顶1项。
     * @param  {Number} y 第二个操作数
     * @return {Number|[Number]}
     */
    mod( evo, y ) {
        return mapCall( evo.data, x => x % y );
    },

    __mod: 1,


    /**
     * 幂运算。
     * 目标：暂存区/栈顶1项。
     * @param  {Number} y 第二个操作数
     * @return {Number|[Number]}
     */
    pow( evo, y ) {
        return mapCall( evo.data, x => x ** y );
    },

    __pow: 1,


    /**
     * 数值取负。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    neg( evo ) {
        return mapCall( evo.data, n => -n );
    },

    __neg: 1,


    /**
     * 逻辑取反。
     * 目标：暂存区/栈顶1项。
     * @return {Boolean|[Boolean]}
     */
    vnot( evo ) {
        return mapCall( evo.data, v => !v );
    },

    __vnot: 1,


    /**
     * 除并求余。
     * 目标：暂存区/栈顶1项
     * 注记：|商| * |y| + |余| == |x|
     * @param  {Number} y 第二个操作数
     * @return {[Number, Number]|[[Number, Number]]} [商数, 余数]
     */
    divmod( evo, y ) {
        return mapCall( evo.data, x => [parseInt(x/y), x%y] );
    },

    __divmod: 1,


    // Math大部分方法。
    // @data: Number|[Number]
    /////////////////////////////////////////////


    /**
     * 计算绝对值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    abs( evo ) {
        return mapCall( evo.data, n => Math.abs(n) );
    },

    __abs: 1,


    /**
     * 返回向上取整后的值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    ceil( evo ) {
        return mapCall( evo.data, n => Math.ceil(n) );
    },

    __ceil: 1,


    /**
     * 返回小于目标的最大整数。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    floor( evo ) {
        return mapCall( evo.data, n => Math.floor(n) );
    },

    __floor: 1,


    /**
     * 返回目标四舍五入后的整数。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    round( evo ) {
        return mapCall( evo.data, n => Math.round(n) );
    },

    __round: 1,


    /**
     * 返回实参的整数部分。
     * 目标：暂存区/栈顶1项。
     * 与 Get:int 方法稍有不同，空串的结果为数值0。
     * @return {Number|[Number]}
     */
    trunc( evo ) {
        return mapCall( evo.data, n => Math.trunc(n) );
    },

    __trunc: 1,


    /**
     * 返回自然对数（logE，即ln）。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    log( evo ) {
        return mapCall( evo.data, n => Math.log(n) );
    },

    __log: 1,


    /**
     * 返回以2为底数的对数。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    log2( evo ) {
        return mapCall( evo.data, n => Math.log2(n) );
    },

    __log2: 1,


    /**
     * 返回以10为底数的对数。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    log10( evo ) {
        return mapCall( evo.data, n => Math.log10(n) );
    },

    __log10: 1,


    /**
     * 计算正弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    sin( evo ) {
        return mapCall( evo.data, n => Math.sin(n) );
    },

    __sin: 1,


    /**
     * 计算余弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    cos( evo ) {
        return mapCall( evo.data, n => Math.cos(n) );
    },

    __cos: 1,


    /**
     * 计算正切值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    tan( evo ) {
        return mapCall( evo.data, n => Math.tan(n) );
    },

    __tan: 1,


    /**
     * 计算平方根。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    sqrt( evo ) {
        return mapCall( evo.data, n => Math.sqrt(n) );
    },

    __sqrt: 1,


    /**
     * 计算立方根。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    cbrt( evo ) {
        return mapCall( evo.data, n => Math.cbrt(n) );
    },

    __cbrt: 1,


    /**
     * 计算双曲正弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    sinh( evo ) {
        return mapCall( evo.data, n => Math.sinh(n) );
    },

    __sinh: 1,


    /**
     * 计算双曲余弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    cosh( evo ) {
        return mapCall( evo.data, n => Math.cosh(n) );
    },

    __cosh: 1,


    /**
     * 计算双曲正切值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    tanh( evo ) {
        return mapCall( evo.data, n => Math.tanh(n) );
    },

    __tanh: 1,


    /**
     * 计算反余弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    acos( evo ) {
        return mapCall( evo.data, n => Math.acos(n) );
    },

    __acos: 1,


    /**
     * 计算反双曲余弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    acosh( evo ) {
        return mapCall( evo.data, n => Math.acosh(n) );
    },

    __acosh: 1,


    /**
     * 计算反正弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    asin( evo ) {
        return mapCall( evo.data, n => Math.asin(n) );
    },

    __asin: 1,


    /**
     * 计算反双曲正弦值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    asinh( evo ) {
        return mapCall( evo.data, n => Math.asinh(n) );
    },

    __asinh: 1,


    /**
     * 计算反正切值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    atan( evo ) {
        return mapCall( evo.data, n => Math.atan(n) );
    },

    __atan: 1,


    /**
     * 计算反双曲正切值。
     * 目标：暂存区/栈顶1项。
     * @return {Number|[Number]}
     */
    atanh( evo ) {
        return mapCall( evo.data, n => Math.atanh(n) );
    },

    __atanh: 1,


    /**
     * 创建伪随机数。
     * 目标：无。
     * 如果未传递max值，返回一个 [0,1) 区间的随机数。
     * 注：随机数不包含上限值。
     * @param  {Number} max 上限值，可选
     * @param  {Number} n 创建个数，可选
     * @return {Number|[Number]}
     */
    random( evo, max, n = 1 ) {
        if ( n > 1 ) {
            return randoms( n, max );
        }
        if ( max === undefined ) {
            return Math.random();
        }
        return Math.floor( Math.random() * Math.floor(max) );
    },

    __random: null,


    /**
     * 取最大值。
     * 目标：暂存区/栈顶1项。
     * 目标本身可为数值或单值。
     * @param  {...Number} vs 参与值序列
     * @return {Number}
     */
    max( evo, ...vs ) {
        return Math.max( ...vs.concat(evo.data) );
    },

    __max: 1,


    /**
     * 取最小值。
     * 目标：暂存区/栈顶1项。
     * 目标本身可为数值或单值。
     * @param  {...Number} vs 对比值序列
     * @return {Number}
     */
    min( evo, ...vs ) {
        return Math.min( ...vs.concat(evo.data) );
    },

    __min: 1,



    // 比较运算。
    // 目标：暂存区/栈顶1项。
    // 模板传递的实参为比较操作的第二个操作数。
    // @data: Value|[Value]
    // @return {Boolean|[Boolean]}
    //-----------------------------------------------------


    /**
     * 相等比较（===）。
     */
    eq( evo, val ) {
        return mapCall( evo.data, x => x === val );
    },

    __eq: 1,


    /**
     * 不相等比较（!==）。
     */
    neq( evo, val ) {
        return mapCall( evo.data, x => x !== val );
    },

    __neq: 1,


    /**
     * 小于比较。
     */
    lt( evo, val ) {
        return mapCall( evo.data, x => x < val );
    },

    __lt: 1,


    /**
     * 小于等于比较。
     */
    lte( evo, val ) {
        return mapCall( evo.data, x => x <= val );
    },

    __lte: 1,


    /**
     * 大于比较。
     */
    gt( evo, val ) {
        return mapCall( evo.data, x => x > val );
    },

    __gt: 1,


    /**
     * 大于等于比较。
     */
    gte( evo, val ) {
        return mapCall( evo.data, x => x >= val );
    },

    __gte: 1,


    /**
     * 数组相等比较。
     * 目标：暂存区/栈顶1项。
     * 数组长度相同且成员相等（===）即为相等。
     * @param {[Value]} arr 对比数组
     */
    eqarr( evo, arr ) {
        if ( evo.data.length != arr.length ) {
            return false;
        }
        return evo.data.every( (v, i) => v === arr[i] );
    },

    __eqarr: 1,


    /**
     * 是否为一个NaN值。
     * @return {Boolean|[Boolean]}
     */
    isNaN( evo ) {
        return mapCall( evo.data, v => isNaN(v) );
    },

    __isNaN: 1,


    /**
     * 测试是否包含。
     * 目标：暂存区/栈顶2项。
     * 前者是否为后者的上级容器元素。
     * @data: [Element, Node]
     * @param  {Boolean} strict 是否严格子级约束
     * @return {Boolean}
     */
    contains( evo, strict ) {
        return $.contains( evo.data[0], evo.data[1], strict );
    },

    __contains: 2,


    /**
     * 匹配测试。
     * @data: RegExp
     * @param {String} str 测试串
     */
    test( evo, str ) {
        return evo.data.test( str );
    },

    __test: 1,



    // 逻辑运算
    //-----------------------------------------------------

    /**
     * 是否在[min, max]之内（含边界）。
     * 目标：暂存区/栈顶1项。
     * 注：全等（===）比较。
     * @param  {Number} min 最小值
     * @param  {Number} max 最大值
     * @return {Boolean}
     */
    within( evo, min, max ) {
        return min <= evo.data && evo.data <= max;
    },

    __within: 1,


    /**
     * 目标是否在实参序列中。
     * 目标：暂存区/栈顶1项。
     * 注：与其中任一值相等（===）。
     * @data: Value 待比较值
     * @param  {...Value} vals 实参序列
     * @return {Boolean}
     */
    inside( evo, ...vals ) {
        return vals.includes( evo.data );
    },

    __inside: 1,


    /**
     * 是否两者为真。
     * 目标：暂存区/栈顶2项。
     * @param  {Boolean} strict 严格相等比较（===）
     * @return {Boolean}
     */
    both( evo, strict ) {
        let [x, y] = evo.data;
        return strict ? x === true && y === true : !!(x && y);
    },

    __both: 2,


    /**
     * 是否任一为真。
     * 目标：暂存区/栈顶2项。
     * @param  {Boolean} strict 严格相等比较（===）
     * @return {Boolean}
     */
    either( evo, strict ) {
        let [x, y] = evo.data;
        return strict ? x === true || y === true : !!(x || y);
    },

    __either: 2,


    /**
     * 是否每一项都为真。
     * 目标：暂存区/栈顶1项。
     * 测试函数可选，默认非严格真值测试。
     * test接口：function(value, key, obj): Boolean
     *
     * @data: Array|Object|Collector|[.entries]
     * @param  {Function} test 测试函数，可选
     * @return {Boolean}
     */
    every( evo, test ) {
        return $.every( evo.data, test || (v => v), null );
    },

    __every: 1,


    /**
     * 是否有任一项为真。
     * 目标：暂存区/栈顶1项。
     * 说明参考every。
     * @param  {Function} test 测试函数，可选
     * @return {Boolean}
     */
    some( evo, test ) {
        return $.some( evo.data, test || (v => v), null );
    },

    __some: 1,


    /**
     * 对象内成员存在性（非undefined）测试。
     * 目标：暂存区/栈顶1项。
     * name为属性名，支持空格分隔的多个属性名指定。
     * name若为多个名称，返回一个Boolean值集。
     * @data: Object 目标对象
     * @param  {String} name 属性名/序列
     * @return {Boolean|[Boolean]}
     */
    exist( evo, name ) {
        if ( __reSpace.test(name) ) {
            return name.split(__reSpace).map( n => evo.data[n] !== undefined )
        }
        return evo.data[name] !== undefined;
    },

    __exist: 1,



    // String简单处理。
    // 目标：暂存区/栈顶1项。
    // @data: {String|[String]}
    //-----------------------------------------------

    /**
     * 空白修整。
     * where: {
     *      0   两端（trim）
     *      1   前端（trimStart）
     *     -1   后端（trimEnd）
     * }
     * @param  {Number} where 清理位置
     * @return {String|[String]}
     */
    trim( evo, where = 0 ) {
        return mapCall(
            evo.data,
            (ss, fn) => ss[ fn ](),
            trimFunc[ where ]
        );
    },

    __trim: 1,


    /**
     * 整体空白修剪。
     * 将字符串内连续的空白替换为指定的字符序列，
     * 首尾空白只会在传递 rch 为空串时才有清除的效果。
     * 默认替换为空白匹配序列的首个空白。
     * @param  {String|Function} rch 空白替换符，可选
     * @return {String|[String]}
     */
    trims( evo, rch = '$1' ) {
        return mapCall( evo.data, s => s.replace(__reSpace1n, rch) );
    },

    __trims: 1,


    /**
     * 提取子串。
     * 这是对.slice方法的封装（而不是 String.substr）。
     * 结束位置支持负数从末尾算起。
     * @param  {Number} start 起始位置下标
     * @param  {Number} end 结束位置下标，可选
     * @return {String}
     */
    substr( evo, start, end ) {
        return mapCall( evo.data, s => s.slice(start, end) );
    },

    __substr: 1,


    /**
     * 内容替换。
     * 对String:replace的简单封装但支持数组。
     * @param  {...Value} args 参数序列
     * @return {String|[String]}
     */
    replace( evo, ...args ) {
        return mapCall( evo.data, s => s.replace(...args) );
    },

    __replace: 1,


    /**
     * 切分字符串为数组。
     * 支持4子节Unicode字符空白切分。
     * @param  {String|RegExp} sep 分隔符，可选
     * @param  {Number} cnt 最多切分数量，可选
     * @param  {String} qs  在字符串格式内忽略（参考 $.Spliter）
     * @return {[String]|[[String]]}
     */
    split( evo, sep, cnt, qs ) {
        return mapCall( evo.data, s => $.split(s, sep, cnt, qs) );
    },

    __split: 1,


    /**
     * 字符串重复串连。
     * @param  {Number} cnt 重复数量
     * @return {String|[String]}
     */
    repeat( evo, cnt ) {
        return mapCall( evo.data, s => s.repeat(cnt) );
    },

    __repeat: 1,


    /**
     * 转为大写。
     * 目标：暂存区/栈顶1项。
     * @param  {Boolean|1} A 首字母大写，可选
     * @return {String}
     */
    caseUpper( evo, A ) {
        return mapCall( evo.data, s => upperCase(s, A) );
    },

    __caseUpper: 1,


    /**
     * 转为全小写。
     * 目标：暂存区/栈顶1项。
     * @return {String}
     */
    caseLower( evo ) {
        return mapCall( evo.data, s => s.toLowerCase() );
    },

    __caseLower: 1,


    /**
     * 函数型颜色值转换到 RGB 16进制。
     * 如果源串已经是6-8位16进制，则简单返回。
     * 3位安全色简化表示转换位6位。
     * #rgb => #rrggbb
     * rgb|rgba(n, n, n / a) => #rrggbbaa|#rrggbb
     * rgb|rgba(n, n, n, a) => #rrggbbaa|#rrggbb
     * @return {String|[String]}
     */
    rgb16( evo ) {
        let x = evo.data;

        if ( __reRGB16.test(x) ) {
            return x.length === 4 ? rgb3_6(x) : x;
        }
        return mapCall( x, s => rgb16str(s) );
    },

    __rgb16: 1,


    /**
     * 构造RGBA 16进制格式串。
     * 目标：暂存区/栈顶1项。
     * 目标为一个十六进制格式的颜色值串。
     * 如果目标串已经包含Alpha，则用实参的alpha替换。
     * 如果实参alpha非数值，则简单忽略。
     * @data: String
     * @param  {Number} alpha 透明度（0-255）
     * @return {String}
     */
    rgba( evo, alpha ) {
        if ( isNaN(alpha) ) {
            return evo.data;
        }
        return mapCall( evo.data, s => toRGBA(s, alpha) );
    },

    __rgba: 1,



    // 增强运算
    //-----------------------------------------------------

    /**
     * 函数执行。
     * 目标：暂存区/栈顶1项。
     * 视目标为函数，传递实参执行并返回结果。
     * @param  {...Value} args 实参序列
     * @return {Any}
     */
    exec( evo, ...args ) {
        return evo.data( ...args );
    },

    __exec: 1,


    /**
     * 表达式运算。
     * 目标：暂存区/栈顶1项。
     * 目标为源数据。
     * JS表达式支持一个默认的变量名$，源数据即为其实参。
     * 例：
     * push('123456') calc('$[0]+$[2]+$[4]') => '135'
     * @param  {String|Function} expr 表达式或函数
     * @return {Any}
     */
    calc( evo, expr ) {
        return new Function( '$', `return ${expr};` )( evo.data );
    },

    __calc: 1,



    // 实用工具
    //-----------------------------------------------------


    /**
     * 热键触发。
     * 目标：暂存区/栈顶1项。
     * 用法：
     *      <html on="keydown|(GHK) acmsk ev('key') hotKey(_2)">
     * 其中：
     * - keydown 捕获键盘按下事件（使得可屏蔽浏览器默认行为）。
     * - GHK 为操作目标，是一个 Hotkey 实例，创建：new HotKey().config(...)。
     * - acmsk ev('key') 为键序列和键值（辅助）实参。
     * @data: HotKey
     * @param  {String} key 快捷键序列
     * @param  {...Value} args 发送的数据或实参序列
     * @return {Boolean} 是否已捕获激发
     */
    hotKey( evo, key, ...args ) {
        return evo.data.fire( key, evo.event, ...args );
    },

    __hotKey: 1,


    /**
     * 选取范围记忆与提取。
     * 目标：暂存区1项可选。
     * 目标有值时为 Range 对象存储，否则为取值。
     * 通常绑定在离可编辑元素较近的容器元素上。
     * 如：
     * <main on="mouseup keyup input|sRange pop xRange stop">
     *      <p contenteditable>可编辑区域...</p>
     * </main>
     * @data: Range?
     * @param  {String|Symbol} key 存储键
     * @return {Range|void}
     */
    xRange( evo, key = __rngKey ) {
        if ( evo.data === undefined ) {
            return __tmpRanges[ key ];
        }
        if ( evo.data ) __tmpRanges[ key ] = evo.data;
    },

    __xRange: -1,


    /**
     * 将选取范围添加到浏览器全局Selection上。
     * 目标：暂存区/栈顶1项。
     * 目标为待添加的选取范围（Range）实例。
     * @param  {Boolean} clear 清除之前的选取，可选
     * @return {Range} 被添加的选区
     */
    addRange( evo, clear = true ) {
        let _sln = window.getSelection();

        if ( clear ) {
            _sln.removeAllRanges();
        }
        return _sln.addRange(evo.data), evo.data;
    },

    __addRange: 1,


    /**
     * 执行document命令。
     * 目标：暂存区1项可选。
     * 仅适用特性被设置为 contenteditable="true" 的可编辑元素。
     * 示例：
     * click(b)|evo(2) text xRange addRange edbox pop exeCmd('insertText', _1)
     * 说明：
     * - 从非活动区域插入焦点记忆处。
     * - 提取预先存储/记忆的选区，添加到全局Selection上。
     * - 激活选区所在可编辑容器元素，执行命令。
     * 示例：
     * paste|avoid clipboard html exeCmd('insertHTML', _1)"
     * 粘贴动作中直接提取剪贴板插入纯文本。
     * 注：
     * 插入的内容可进入浏览器自身撤销/重做栈。
     * 为避免换行引起的浏览器不兼容行为，先转换为HTML后插入。
     * @data: Element:contenteditable
     * @param  {String} name 命令名称
     * @param  {Value} data 待使用的数据
     * @return {Boolean} 是否支持目标命令
     */
    exeCmd( evo, name, data ) {
        evo.data && evo.data.focus();
        return document.execCommand( name, false, data );
    },

    __exeCmd: -1,


    /**
     * 剪贴板操作（取值/设置）。
     * 目标：暂存区1项可选。
     * 目标为待设置数据，有值时为设置，无值时为取值。
     * 提示：
     * - 取值适用粘贴（paste）事件。
     * - 设置适用复制或剪切（copy|cut）事件。
     * 注记：
     * 仅支持在直接的事件调用链中使用。
     * @data: Value|void
     * @param  {String} fmt 数据类型，可选（默认纯文本）
     * @return {String|void}
     */
    clipboard( evo, fmt = 'text/plain' ) {
        if ( evo.data === undefined ) {
            return evo.event.clipboardData.getData( fmt );
        }
        evo.event.clipboardData.setData( fmt, evo.data );
    },

    __clipboard: -1,

};



//
// Collector操作。
// 目标：暂存区/栈顶1项。
// 目标必须是 Collector 实例才会调用实例的版本，
// 否则为 tQuery.xxx 版。
// 注：
// map、each方法操作的目标支持Object。
//////////////////////////////////////////////////////////////////////////////
[
    'not',      // ( fltr?: String|Function )
    'has',      // ( slr?: String )
    'filter',   // ( fltr?: String|Function )
    'map',      // ( proc?: Function )
    'each',     // ( proc?: Function )
]
.forEach(function( meth ) {
    /**
     * @param  {...} arg 模板实参，可选
     * @return {[Value]|Collector}
     */
    _Process[meth] = function( evo, arg ) {
        return $.isCollector(evo.data) ?
            evo.data[meth]( arg ) : $[meth]( evo.data, arg );
    };

    _Process[`__${meth}`] = 1;

});


//
// 数组操作（兼容Collector）。
// 目标：暂存区/栈顶1项。
// 目标已经为数组或Collector实例。
// 注记：pop/push 方法被数据栈处理占用。
//////////////////////////////////////////////////////////////////////////////
[
    'slice',    // (beg, end?: Number): Array | Collector
    'flat',     // (deep?: Number|true): Array | Collector
    'concat',   // (...Value): Array | Collector
    'splice',   // (start, delcnt, ...): Array
]
.forEach(function( meth ) {
    /**
     * @param  {...Value} args 模板实参序列
     * @return {[Value]|Collector}
     */
    _Process[meth] = function( evo, ...args ) {
        return evo.data[meth]( ...args );
    };

    _Process[`__${meth}`] = 1;

});



//
// 工具函数
///////////////////////////////////////////////////////////////////////////////


/**
 * 单值/集合调用封装。
 * @param  {Value|[Value]} data 数据/集
 * @param  {Function} handle 调用句柄
 * @param  {...Value} rest 剩余实参序列
 * @return {Value|[Value]}
 */
function mapCall( data, handle, ...rest ) {
    if ( $.isArray(data) ) {
        return data.map( v => handle(v, ...rest) );
    }
    return handle( data, ...rest );
}


/**
 * 创建n个伪随机数。
 * 如果max值为null或undefined，随机数在 [0,1) 区间。
 * 注：随机数不包含上限值。
 * @param  {Number} n 数量
 * @param  {Number} max 上限值，可选
 * @return {[Number]}
 */
function randoms(n, max) {
    let _ns = new Array(n).fill();

    if (max == null) {
        return _ns.map(() => Math.random());
    }
    return _ns.map(() => Math.floor(Math.random() * Math.floor(max)));
}


/**
 * 本地存储（sessionStorage|localStorage）。
 * 值传递null会清除目标值。
 * 名称传递null会清除全部存储！
 * @param  {Storage} buf 存储器
 * @param  {String|null} name 存储键
 * @param  {Value|null} val 存储值
 * @return {void}
 */
function storage( buf, name, its ) {
    if ( name === null) {
        return buf.clear();
    }
    if ( its === null ) {
        return buf.removeItem( name );
    }
    buf.setItem( name, its );
}


/**
 * 获取之后第n个指令。
 * @param  {Cell} cell 起始指令单元
 * @param  {Number} n 指令数量
 * @return {Cell|null} 待衔接指令单元
 */
function lastCell( cell, n ) {
    while ( n-- && cell ) cell = cell.next;
    return cell;
}


/**
 * 字符串大写。
 * @param  {String} str 字符串
 * @param  {Boolean|1} first 仅首字母
 * @return {String}
 */
function upperCase( str, first ) {
    return first ?
        str.replace( /^[a-z]/g, c => c.toUpperCase() ) :
        str.toUpperCase();
}


/**
 * 合成RGBA格式串。
 * 如：#369 => #33669980
 * @param  {String} c16 十六进制颜色值串
 * @param  {Number} alpha 透明度值（0-1）
 * @return {String}
 */
function toRGBA( c16, alpha ) {
    if ( c16.length === 4 ) {
        c16 = rgb3_6( c16 );
    }
    else if ( c16.length === 9 ) {
        c16 = c16.substring(0, 7);
    }
    return c16 + n16c2( alpha );
}


/**
 * 3位安全色转到6位值。
 * 如：#369 => #336699
 * @param  {String} str 3位颜色串值
 * @return {String}
 */
function rgb3_6( str ) {
    return '#' +
        str.substring(1).split('').map( c => c+c ).join('');
}


/**
 * 获取RGB 16进制值。
 * 主要用于设置颜色控件（input:color）的有效值。
 * rgb(n, n, n) => #rrggbb。
 * rgba(n, n, n, n) => #rrggbbaa
 * @param  {String} val 颜色值
 * @return {String}
 */
function rgb16str( val ) {
    let _vs = null;

    for ( const re of __reRGBfx ) {
        _vs = val.match( re );
        if ( _vs ) break;
    }
    return _vs && rgb16val( ..._vs.slice(1) );
}


/**
 * RGBA 16进制值构造。
 * 透明度a实参是一个百分数或 0-1 的小数。
 * @param  {String} r Red
 * @param  {String} g Green
 * @param  {String} b Blue
 * @param  {String} a 透明度，可选
 * @return {String}
 */
function rgb16val( r, g, b, a = '' ) {
    if ( a ) {
        let _n = parseFloat( a );
        a = (a.includes('%') ? _n/100 : _n) * 255;
    }
    return `#${n16c2(+r)}${n16c2(+g)}${n16c2(+b)}` + ( a && n16c2(a) );
}


/**
 * 转为16进制字符串。
 * 注：两位字符，不足2位前置0。
 * @param  {Number} n 数值（可为浮点数）
 * @return {String}
 */
function n16c2( n ) {
    n = Math.floor( n );
    return n < 16 ? `0${n.toString(16)}` : n.toString(16);
}


/**
 * 对象集成员清理。
 * 移除属性值在 vals 中的属性条目。
 * 如果成员为数组，会递进清理其成员。
 * @param  {[Object]} objs 对象集
 * @param  {Value} val 匹配值，可选
 * @param  {Value} rep 替换值，可选
 * @return {[Object]} objs
 */
function cleanObjs( objs, val, rep ) {
    for ( const its of objs ) {
        if ( $.isArray(its) ) {
            cleanObjs( its, val, rep );
        } else {
            cleanObj( its, val, rep );
        }
    }
    return objs;
}


/**
 * 对象成员清理。
 * 移除属性值在 vals 中的属性条目。
 * @param  {Object} obj 清理目标
 * @param  {Value} val 匹配值，可选
 * @param  {Value} rep 替换值，可选
 * @return {Object} obj
 */
function cleanObj( obj, val, rep ) {
    for ( const k of Object.keys(obj) ) {
        if ( obj[k] !== val ) {
            continue;
        }
        obj[k] = rep;
        obj[k] === undefined && delete obj[k];
    }
    return obj;
}



//
// 特殊指令（Control）。
// this: {Cell} （无预绑定）
///////////////////////////////////////////////////////////////////////////////


/**
 * 延迟并跳跃。
 * 这会让执行流的连续性中断，跳过当前的事件处理流。
 * 这在摆脱事件流的连贯性时有用。
 * 也可用于简单的延迟某些UI表达（如延迟隐藏）。
 * 注记：
 * 在当前指令单元（Cell）上暂存计数器。
 * @param  {Number} ms 延时毫秒数
 * @return {void}
 */
function delay( evo, ms = 1 ) {
    return new Promise(
        resolve => {
            window.clearTimeout( this._delay );
            this._delay = window.setTimeout( resolve, ms );
        }
    );
}

// delay[EXTENT] = null;


/**
 * 指令序列截断。
 * 后续指令会自然执行一次。
 */
function prune() {
    this._prev.next = null;
}

prune[PREVCELL] = true;
// prune[EXTENT] = null;



const
    // 保护计数器。
    __propectLoop = [0, 0],

    // 保护上限值。
    __propectMax = 1 << 16;


/**
 * 跳过指令序列段。
 * 目标：暂存区/栈顶1项。
 * 目标值为真时，执行cn/dn两个实参的配置。
 * 用于模拟代码中的 if 分支执行逻辑。
 * 注记：
 * 跳过后移除栈顶的数据是必要的，因为它们通常需要由跳过的那些指令处理。
 * this: Cell
 * @param  {Stack} stack 数据栈
 * @param  {Number} cn 跳过的指令数
 * @param  {Number} dn 从栈顶移除的条目数
 * @return {void}
 */
function jump( evo, stack, cn, dn ) {
    if ( !evo.data ) {
        this.next = this._next;
        return;
    }
    if ( dn > 0 ) {
        stack.pops( dn );
    }
    this.next = lastCell( this._next, cn );
}

jump[EXTENT] = 1;
jump[ACCESS] = true;
jump[JUMPCELL] = true;


/**
 * 创建入口。
 * 目标：无。
 * 在执行流中段创建一个入口，使得可以从该处启动执行流。
 * 可用于动画类场景：前阶收集数据，至此开启循环迭代。
 * 模板用法：
 *      entry       // 设置入口。
 *      effect(...) // 从entry处开始执行。
 * 注：
 * 一个effect之前应当只有一个入口（或最后一个有效）。
 * @return {void}
 */
function entry( evo ) {
    if ( DEBUG ) {
        __propectLoop[0] = 0;
        __propectLoop[1] = 0;
    }
    evo.entry = this.call.bind( this.next, evo );
}

// entry[EXTENT] = null;


/**
 * 循环保护。
 * 避免loop/effect指令执行时间过长。
 * @param {Number} i 计数位置（0|1）
 * @param {String} msg 抛出的信息
 */
function propectLoop( i, msg ) {
    if ( __propectLoop[i]++ < __propectMax ) {
        return;
    }
    throw new Error( msg );
}


/**
 * 控制台信息打印。
 * 传递消息为false，显示信息并中断执行流。
 * 传递消息为true，设置断点等待继续。
 * 特殊：是，this为Cell实例，查看调用链。
 * 目标：无。
 * 特权：是，数据栈显示。
 * 注：该指令在To段的使用仅限于Next-Stage部分。
 * @param  {Value|false|true} msg 显示消息，传递false中断执行流
 * @return {void|reject}
 */
function debug( evo, stack, msg = '' ) {
    window.console.info( msg, {
        ev: evo.event,
        evo,
        next: this.next,
        tmp: stack._tmp.slice(),
        buf: stack._buf.slice()
    });
    if ( msg === true ) {
        // eslint-disable-next-line no-debugger
        debugger;
    }
    if ( msg === false ) return Promise.reject();
}

debug[ACCESS] = true;
debug[EXTENT] = null;



//
// 合并/导出
///////////////////////////////////////////////////////////////////////////////

//
// 控制集。
//
const Control = $.assign( {}, _Control, bindMethod );

//
// 特殊控制。
// 无预绑定处理。this:{Cell}
//
Control.delay = delay;
Control.prune = prune;
Control.jump  = jump;
Control.entry = entry;
Control.debug = debug;


//
// 计算/加工集。
// @proto: Control
//
const Process = $.proto(
    $.assign({}, _Process, bindMethod), Control
);


export { Process, debug };
