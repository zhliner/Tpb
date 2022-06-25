//! $ID: core.js 2019.08.19 Tpb.Base $
// +++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2017 - 2019 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  OBT 解析器。
//
//  完成元素（单个）的OBT逻辑，
//  包括：
//  - On/By/To配置解析。
//  - 创建调用链绑定到元素事件定义。
//  - 存储延迟绑定的调用链。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import $, { ACCESS, EXTENT, JUMPCELL, PREVCELL, UPDATEX, HEADCELL, DEBUG, ChainStore } from "./config.js";
import { Util } from "./tools/util.js";
import { Spliter, UmpString, UmpCaller, UmpChars } from "./tools/spliter.js";


const
    // 数据栈输出标识名。
    // 在浏览器控制台设置该变量为true，即可显示数据入栈情况。
    __STACKX    = 'STACKDATA',

    // OBT构建完成事件
    // 可便于共享的预定义调用链及时绑定。
    __obtDone   = 'obted',

    // 标识字符
    __chrDlmt   = ';',  // 并列分组
    __chrCmd    = ' ',  // 指令/事件名并列分隔
    __chrZero   = '-',  // 空白占位符
    __chrPipe   = '|',  // 进阶分隔（事件名|指令链）

    // 事件名标识
    __evnOnce   = '^',  // 绑定单次处理
    __evnStore  = '@',  // 调用链预定义存储

    // To
    __toqOrig   = '~',  // 事件起始元素（evo.target）
    __toqCurr   = '=',  // 事件当前元素（evo.current）
    __tosAttr   = '@',  // 特性指定
    __tosProp   = '$',  // 属性指定
    __tosCSS    = '%',  // 样式指定
    __tosToggle = '^',  // 特性（Attribute）切换

    // 捕获标记。
    // 附加在委托选择器之后，可选。
    __capTrue   = '!true',    // 捕获阶段
    __capFalse  = '!false',   // 冒泡阶段

    // To:Update
    // 友好方法名映射。
    __updateMethod = {
        [__tosAttr]:    'attr',
        [__tosProp]:    'prop',
        [__tosCSS]:     'css',
        [__tosToggle]:  'toggleAttr',
    },

    // 空名称指代。
    // 仅限于调用（Call）指令。
    __zeroName  = 'push',

    // 并列分组切分器。
    // 属性选择器内分号不可用（故无需排除）。
    __dlmtSplit = new Spliter( __chrDlmt, new UmpCaller(), new UmpString() ),

    // 指令切分器。
    // 多出的空格被切分为空串。
    __cmdSplit  = new Spliter( __chrCmd, new UmpCaller() ),

    // 进阶定义切分器。
    // 属性选择器和调用式内可能包含|字符，因此排除。
    // 注记：
    // 字符串不在属性值或调用式之外，故无需例外。
    __pipeSplit = new Spliter( __chrPipe, new UmpCaller(), new UmpChars('[', ']') ),


    // On事件定义模式。
    // 事件名支持字母、数字和 [._:-] 字符。
    // 支持事件名前置 @ 或 ^ 标识符表示存储和单次行为。
    // 注意：
    // - 冒号应当仅用于事件名和标识ID分隔（多个事件名存储时）。
    // - 委托选择器无引号包围。
    __onEvent   = /^[@^]?(\w[\w.:-]*)(?:\(([^]*?)\))?$/,

    // 调用模式匹配。
    // 方法名支持字母、数字和 [$._-] 字符。
    // 参数段支持任意字符（包括换行），可选。
    // 特例：允许空名称（之后应当为括号）。
    // 注记：暂不支持调用链的跨行定义，以避免 On/ByTo 对应混乱。
    __obtCall   = /^(^|[$\w][$\w.-]*)(?:\(([^]*)\))?$/,

    // To:Query
    // 多元素检索表达式。
    // 由一对小括号包围选择器，后跟可选的过滤部分。
    // 选择器部分可包含任意字符。
    __toQuery   = /^\(([^]*?)\)\s*([([{][^]+[)\]}])?$/,

    // To:Query
    // 不匹配选择器：(selector)。
    // 取值：[1]
    __toExclude = /^\(([^]*?)\)$/,

    // To:Query
    // 数值定位匹配：[x:y] 或 [m,n,...]。
    // 取值：[1]
    __toNumber  = /^\[([\d:,\s]*)\]$/,

    // 范围分隔符（:）
    __toRange   = /\s*:\s*/,

    // To:Query
    // 集合过滤表达式匹配：{expression}。
    // 取值：[1]
    __toFilter  = /^\{([^]*)\}$/,

    // To:Update
    // 更新方法调用模式，名称仅为简单单词。
    __toUpdate  = /^(\w+)(?:\(([^]*)\))?$/,

    // 从流程中获取实参的标记（key）。
    // 用于模板中的取值表达（最后一个实参）。
    __fromStack = {
        _:  Symbol(0),  // 取流程数据1项（展开）。
        _1: Symbol(1),  // 取流程数据1项。
        _2: Symbol(2),  // 取流程数据2项。
        _3: Symbol(3),  // ...
        _4: Symbol(4),  // ...
        _5: Symbol(5),  // ...
        _6: Symbol(6),  // ...
        _7: Symbol(7),  // ...
        _8: Symbol(8),  // ...
        _9: Symbol(9),  // ...
    },

    // 流程数据取项数量映射：
    // Object {
    //  Symbol(0): 0,
    //  Symbol(1): 1,
    //  ......
    // }
    __flowCnts = Object.keys(__fromStack)
    .reduce( (o, k) => (o[__fromStack[k]] = +k.substring(1), o), {} );



//
// 元素OBT解析器。
//
const Parser = {
    /**
     * 提取分组对应集。
     * 以On为前置依据，By/To依赖于On的存在。
     * 返回值：单组 {
     *      on: String
     *      by: String
     *      to: String
     * }
     * @param  {Object3} conf OBT配置集（{on,by,to}）
     * @return {Iterator<Object3>} 单组配置迭代器
     */
    *obts( conf ) {
        let bys = [...__dlmtSplit.split(conf.by)],
            tos = [...__dlmtSplit.split(conf.to)],
            i = 0;

        // 及时提醒。
        if ( !__dlmtSplit.ready() ) {
            throw new Error( `{\nby: ${conf.by}\nto: ${conf.to}\n} has something bad.` );
        }

        for ( let on of __dlmtSplit.split(conf.on) ) {
            on = zeroPass( on );
            // 容错末尾;
            if ( !on ) continue;
            yield {
                on: on,
                by: zeroPass( bys[i] ),
                to: zeroPass( tos[i] ),
            };
            i++;
        }
    },


    /**
     * On解析。
     * 格式：evn(slr) evn|call(...) call...
     * 返回值：[
     *      [Evn]       // 事件名定义集
     *      [Call]|''   // 指令调用定义集
     * ]
     * @param  {String} fmt On配置串
     * @return {Array2}
     */
    on( fmt ) {
        let [_evn, _call] = __pipeSplit.split(fmt, 1);

        return [
            this.evns( _evn ),
            this.calls( zeroPass(_call) )
        ];
    },


    /**
     * By解析。
     * @param  {String} fmt By配置串
     * @return {[Call]|''}
     */
    by( fmt ) {
        return this.calls( fmt );
    },


    /**
     * To解析。
     * 注：空串合法但无用。
     * @param  {String} fmt To配置串
     * @return {[Query, [Update]|'', [Call]|'']|''}
     */
    to( fmt ) {
        if ( !fmt ) return '';

        let [_q, _w, _n] = [...__pipeSplit.split(fmt, 2)].map( zeroPass );

        return [
            new Query( _q ),
            this.updates( _w ),
            this.calls( _n ),
        ];
    },


    /**
     * 分解事件名定义。
     * @param  {String} fmt 事件名定义序列
     * @return {[Evn]}
     */
    evns( fmt ) {
        if ( !fmt ) {
            throw new Error( `Missing event name definition.` );
        }
        return this._parse( fmt, Evn );
    },


    /**
     * 解析调用指令定义。
     * @param  {String} fmt 指令调用序列
     * @return {[Call]|''}
     */
    calls( fmt ) {
        return fmt && this._parse( fmt, Call );
    },


    /**
     * 解析更新指令定义。
     * @param  {String} fmt 更新指令序列
     * @return {[Update]|''}
     */
    updates( fmt ) {
        return fmt && this._parse( fmt, Update );
    },


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 解析构建目标类型实例集。
     * @param  {String} fmt 调用定义串
     * @param  {Class} T 目标类型
     * @return {[Class]}
     */
    _parse( fmt, T ) {
        let _buf = [];

        for (const s of __cmdSplit.split(fmt)) {
            // 忽略多余空格
            if ( s ) _buf.push( new T(s) );
        }
        return _buf;
    },

}



//
// OBT 构造器。
// 用法：
// 外部创建一个实例后，即可应用任意元素。
//
class Builder {
    /**
     * 创建一个OBT构造器。
     * 基础库 pbs: {
     *      on:     Object,
     *      by:     Object,
     *      update: Object,
     *      next:   Object,
     * }
     * @param {Object} pbs OBT指令集
     */
    constructor( pbs ) {
        this._pbson = pbs.on;
        this._pbsby = pbs.by;
        this._pbst2 = pbs.update;
        this._pbst3 = pbs.next;
    }


    /**
     * 构建OBT逻辑（元素/对象自身）
     * OBT解析、创建调用链、绑定，存储预定义等。
     * 返回已解析绑定好的原始元素。
     * 注：
     * 构建完毕后会向元素发送完成事件obted，不冒泡不可取消。
     * 并列的多个事件定义指向同一条调用链（共享）。
     * @param  {Element|Object} obj 绑定目标
     * @param  {Object3} conf OBT配置集（{on,by,to}）
     * @return {Element|Object} obj
     */
    build( obj, conf ) {
        if ( !conf.on ) {
            throw new Error( `OBT must be from "on"` );
        }
        for (const obt of Parser.obts(conf) ) {
            let _on = Parser.on( obt.on ),
                _by = Parser.by( obt.by ),
                _to = Parser.to( obt.to ),
                _stack = new Stack();

            this.binds(
                obj,
                _on[0],
                _stack,
                this.chain( _stack, _on[1], _by, _to[0], _to[1], _to[2] )
            );
        }
        $.trigger( obj, __obtDone, null, false, false );

        return obj;
    }


    /**
     * 事件定义集绑定。
     * @param {Element|Object} its 绑定目标
     * @param {[Evn]} evns 事件定义实例集
     * @param {Stack} stack 调用链数据栈实例（共享）
     * @param {Cell} chain  调用链首个指令（调用段，不含事件定义部分）
     */
    binds( its, evns, stack, chain ) {
        for ( const evn of evns ) {
            let _start = Evn.apply( new Cell(stack), evn );
            _start.next = chain;

            this.bind( its, evn, _start );
        }
    }


    /**
     * 绑定事件到调用链。
     * 可能多个事件名定义对应一个调用链。
     * 注：
     * 此处的绑定不支持额外配置选项（{passive, signal}），
     * 如果需要，用户可以在执行流中完成（bind()|on()）。
     * @param  {Element|Object} its 绑定目标
     * @param  {Evn} evn 事件定义实例
     * @param  {Cell} chain 调用链起始指令（事件定义指令）
     * @return {void}
     */
    bind( its, evn, chain ) {
        if ( evn.store ) {
            return storeChain( its, chain );
        }
        let _fn = evn.once ?
            'one' :
            'on';
        $[_fn]( its, evn.name, evn.selector, chain, evn.capture );
    }


    /**
     * 构建调用链。
     * 除事件定义之外的调用序列部分。
     * 这样方便多个事件定义指令指向同一个调用链。
     * @param  {Stack} stack 调用链数据栈实例
     * @param  {[Call]} ons  On调用序列（事件定义之后部分）
     * @param  {[Call]} bys  By调用序列
     * @param  {Query} query To查询配置实例
     * @param  {[Update]} updates To更新调用序列
     * @param  {[Call]} nexts To下一阶调用序列
     * @return {Cell} 调用链首个指令单元（不含事件定义部分）
     */
    chain( stack, ons, bys, query, updates, nexts ) {
        let _hold = new Cell( stack ),
            _prev = this._on( _hold, stack, ons );

        _prev = this._by( _prev, stack, bys );
        _prev = this._query( _prev, stack, query );
        _prev = this._update( _prev, stack, updates );
        this._nextStage( _prev, stack, nexts );

        return _hold.next;  // 首个实际指令
    }


    //-- 私有辅助 -------------------------------------------------------------

    /**
     * On构建。
     * 返回最后一个Cell实例，接续By/To。
     * @param  {Cell} prev 前一个指令单元（首个）
     * @param  {Stack} stack 数据栈实例
     * @param  {[Call]} calls 调用配置序列
     * @return {Cell} 下一阶前导指令单元
     */
    _on( prev, stack, calls ) {
        if ( calls ) {
            for (const call of calls) {
                prev = call.apply( new Cell(stack, prev), this._pbson, prev );
            }
        }
        return prev;
    }


    /**
     * By构建。
     * 返回最后一个Cell实例，接续To。
     * @param  {Cell} prev 前一个指令单元
     * @param  {Stack} stack 数据栈实例
     * @param  {[Call]} calls 调用配置序列
     * @return {Cell} 下一阶前导指令单元
     */
    _by( prev, stack, calls ) {
        if ( calls ) {
            for (const call of calls) {
                prev = call.apply( new Cell(stack, prev), this._pbsby, prev );
            }
        }
        return prev;
    }


    /**
     * To:Query构造。
     * 返回最后一个Cell实例，接续To:Update。
     * @param  {Cell} prev 前一个指令单元
     * @param  {Stack} stack 数据栈实例
     * @param  {Query} query To查询配置实例
     * @return {Cell} 下一阶前导指令单元
     */
    _query( prev, stack, query ) {
        return query ?
            query.apply( new Cell(stack, prev) ) : prev;
    }


    /**
     * To:Update构造。
     * 返回最后一个Cell实例，接续To:Next。
     * @param  {Cell} prev 前一个指令单元
     * @param  {Stack} stack 数据栈实例
     * @param  {[Update]} updates To更新配置实例集
     * @return {Cell} 下一阶前导指令单元
     */
    _update( prev, stack, updates ) {
        if ( updates ) {
            for (const update of updates) {
                prev = update.apply( new Cell(stack, prev), this._pbst2 );
            }
        }
        return prev;
    }


    /**
     * To:Stage构造。
     * 返回最后一个Cell实例（结束）。
     * @param  {Cell} prev 前一个指令单元
     * @param  {Stack} stack 数据栈实例
     * @param  {[Call]} nexts To下一阶实例集
     * @return {Cell} 下一阶前导指令单元
     */
    _nextStage( prev, stack, nexts ) {
        if ( nexts ) {
            for (const ns of nexts) {
                prev = ns.apply( new Cell(stack, prev), this._pbst3, prev );
            }
        }
        return prev;
    }

}


//
// 流程数据栈。
// 每一个执行流包含一个数据栈实例。
//
class Stack {

    constructor() {
        this._buf = []; // 数据栈
        this._tmp = []; // 暂存区
    }


    /**
     * 通用取值。
     * 暂存区：按正序（队列）取值。
     * 数据栈：按逆序（栈顶）取值。
     * n：{
     *  0   暂存区有值则取出全部，不自动取栈
     *  1   暂存区有值则取出1项，否则取栈顶1项
     *  n   暂存区有值则取出n项（可能不足n项），否则取栈顶n项
     * -n   暂存区有值则取出n项（可能不足n项），不自动取栈
     * }
     * 注：n大于1时，确定返回一个数组（可能为空）。
     *
     * @param  {Number} n 取栈条目数
     * @return {Value|[Value]} 值/值集
     */
    data( n ) {
        if ( n === 0 ) {
            return this._tmpall();
        }
        if ( this._tmp.length ) {
            return this._tmpval(n);
        }
        // 负值不取栈。
        if ( n > 0 ) {
            return n > 1 ? this._buf.splice(-n) : this._buf.pop();
        }
    }


    /**
     * 指令调用返回值入栈。
     * 注：undefined 表示无返回值，不入栈。
     * @param {...Value} vals 入栈数据
     */
    push( ...vals ) {
        vals.forEach ( v => v !== undefined && this._buf.push(v) );

        //:debug
        // 控制台设置标识变量为真。
        // 会显示调用链每一个指令的前入值（含undefined）。
        window[__STACKX] && window.console.info( ...vals );
        //:end
    }


    /**
     * 压入一个undefined。
     * 注：正常的入栈不包含undefined。
     * @return {void}
     */
    undefined() {
        this._buf.push( undefined );
    }


    /**
     * 栈顶多项引用。
     * 注：始终返回一个集合。
     * @param  {Number} n 条目数
     * @return {[Value]}
     */
    tops( n ) {
        return this._buf.slice( -n );
    }


    /**
     * 复制特定范围的成员。
     * @param  {Number} beg 起始位置
     * @param  {Number} end 结束位置（不含）
     * @return {[Value]}
     */
    slice( beg, end ) {
        return this._buf.slice( beg, end );
    }


    /**
     * 数据栈片段移除。
     * @param  {Number} idx 起始下标
     * @param  {Number} cnt 移除数量
     * @return {[Value]}
     */
    splice( idx, cnt ) {
        return this._buf.splice( idx, cnt );
    }


    /**
     * 弹出数据栈顶1项。
     */
    pop() {
        return this._buf.pop();
    }


    /**
     * 弹出数据栈顶n项。
     * @param  {Number} n 栈顶项数
     * @return {Array} 被删除集
     */
    pops( n ) {
        return this._buf.splice( -n );
    }


    /**
     * 数据栈重置。
     * 用于执行流再次开启前使用。
     */
    reset() {
        this._buf.length = 0;
        this._tmp.length = 0;
    }


    //-- 暂存区赋值 -----------------------------------------------------------
    // 按顺序添加到暂存区队列中。
    // @return {void}


    /**
     * 弹出栈顶单项。
     * 如果数据栈已为空，会压入一个undefined值。
     * 注记：
     * 与.tindex()和.tpick()不同，这是一种有意的区分，
     * 如果用户需要undefined值时会有用。
     */
    tpop() {
        this._tmp.push( this._buf.pop() );
    }


    /**
     * 弹出栈顶n项。
     * 小于2的值无效。
     * 实际压入的项数可能不足（数据栈不足），用户需要自行注意。
     * @param {Number} n 弹出数量
     */
    tpops( n ) {
        if ( n > 1 ) {
            this._tmp.push( ...this._buf.splice(-n) );
        }
    }


    /**
     * 剪取目标位置条目。
     * i值支持负数从末尾算起。
     * 注：无效的位置下标会导入一个null值。
     * @param {Number} i 位置下标
     */
    tpick( i ) {
        let _v = this._buf.splice(i, 1)[0];
        this._tmp.push( _v === undefined ? null : _v );
    }


    /**
     * 引用特定目标位置值。
     * 下标值支持负数从末尾算起。
     * 注：非法的下标位置会导入一个null值。
     * @param {...Number} ns 位置序列
     */
    tindex( ...ns ) {
        this._tmp.push( ...ns.map( i => this._index(i) ) );
    }


    /**
     * 截取数据栈任意段。
     * 下标支持负值从末尾算起。
     * @param {Number} idx 起始下标
     * @param {Number} cnt 移除计数
     */
    tsplice( idx, cnt ) {
        this._tmp.push( ...this._buf.splice(idx, cnt) );
    }


    /**
     * 引用数据栈任意段。
     * @param {Number} beg 起始位置
     * @param {Number} end 结束位置（不含），可选
     */
    tslice( beg, end ) {
        this._tmp.push( ...this._buf.slice(beg, end) );
    }


    /**
     * 直接向暂存区赋值。
     * @param {...Value} vals 目标值序列
     */
    tpush( ...vals ) {
        this._tmp.push( ...vals );
    }


    //-- 私有辅助 -------------------------------------------------------------

    /**
     * 获取目标位置值。
     * 支持负值下标从末尾算起。
     * @param {Number} i 下标位置
     */
    _index( i ) {
        let _v = this._buf[
            i < 0 ? this._buf.length+i : i
        ];
        return _v === undefined ? null : _v;
    }


    /**
     * 暂存区取值。
     * n负值合法，在此与正值同义。
     * 如果|n|大于1，返回一个数组，否则返回一个值。
     * 注：
     * |n|大于1时取出的成员可能不足n项。
     * 从头部顺序取值。
     * @param  {Number} n 取出数量
     * @return {Value|[Value]}
     */
    _tmpval( n ) {
        if ( n < 0 ) n = -n;
        return n > 1 ? this._tmp.splice(0, n) : this._tmp.shift();
    }


    /**
     * 取出暂存区全部成员。
     * 如果只有1项或为空，返回其值或undefined。
     * @return {Value|[Value]|undefined}
     */
    _tmpall() {
        let _v = this._tmp.splice(0);
        return _v.length > 1 ? _v : _v[0];
    }
}


// 保护Stack实例。
const _SID = Symbol('stack-key');


//
// 指令调用单元。
// 包含一个单向链表结构，实现执行流的链式调用逻辑。
// 调用的方法大多是一个bound-function。
// 另有一个count值指定取栈数量。
//
class Cell {
    /**
     * 构造指令单元。
     * @param {Stack} stack 当前链数据栈
     * @param {Cell} prev 前一个单元
     */
    constructor( stack, prev = null ) {
        this.next = null;

        this[_SID] = stack;
        this._meth = null;

        // 惰性成员（按需添加）：
        // this._args   // 实参序列
        // this._want   // 取项数量
        // this._rest   // 补充模板实参数量
        // this._extra  // 初始启动传值
        // this._next   // 原始.next（jump指令需要）
        // this._prev   // 前阶指令存储

        // 链头指令专有
        // this[HEADCELL]: {Evn}

        if (prev) prev.next = this;
    }


    /**
     * 事件处理器接口。
     * 即：EventListener.handleEvent()
     * 返回同步序列最后一个指令单元调用的返回值。
     * @param  {Event} ev 事件对象
     * @param  {Object} elo 事件关联对象
     * @return {Value}
     */
    handleEvent( ev, elo ) {
        this[_SID].reset();

        elo.event = ev;
        elo.chain = this;

        return this.call( elo, this._extra );
    }


    /**
     * 设置初始值。
     * 注：仅绑定类指令（bind）可能会传递该值。
     * @param  {Value} val 初始值
     * @return {this}
     */
    setInit( val ) {
        if ( val !== undefined ) {
            this._extra = val;
        }
        return this;
    }


    /**
     * 从流程取模板实参配置。
     * 处理模板实参中 _[n] 标识名。
     * @param  {Array} args 参数序列
     * @return {this}
     */
    setRest( args ) {
        if ( !args ) {
            return this;
        }
        let _rest = __flowCnts[ args[args.length-1] ];

        if ( _rest !== undefined ) {
            args.pop();
            // 0 ~ 9
            this._rest = _rest;
        }
        return this;
    }


    /**
     * 设置跳跃指令的原始下阶指令。
     * true用于标记当前指令为jump，
     * 然后用于下阶指令中做真实的设置。
     * @param  {Cell|true} cell 下阶指令或确认标记
     * @return {Cell|true}
     */
    setJUMP( cell ) {
        if ( cell !== undefined ) {
            this._next = cell;
        }
        return this._next;
    }


    /**
     * 设置方法/参数。
     * 特权方法的数据栈对象自动插入到实参序列首位。
     * @param  {Array|null} args 模板配置的参数序列
     * @param  {Function} meth 目标方法
     * @param  {Boolean} isx 是否为特权方法。
     * @param  {Number} n 取条目数，可选
     * @return {this}
     */
    build( args, meth, isx, n ) {
        if ( isx ) {
            args = [this[_SID]].concat(args ? args : []);
        }
        this._meth = meth;

        // 惰性添加。
        if ( args ) {
            this._args = args;
        }
        // 友好：null|undefined 等效
        if ( n != null ) {
            this._want = n;
        }
        return this.setRest( this._args );
    }


    /**
     * 承接前阶结果，调用当前。
     * val是前阶方法执行的结果，将被压入数据栈。
     * @param  {Object} evo 事件相关对象
     * @param  {Value} val 上一指令的结果
     * @return {Value}
     */
    call( evo, val ) {
        this[_SID].push( val );

        val = this._meth(
            evo,
            ...this.args(evo, this._args || [], this._rest)
        );
        return this.nextCall( evo, val );
    }


    /**
     * 获取最终模板实参序列。
     * 处理 _[n] 标识从流程数据中补充模板实参。
     * @param  {Object} evo 数据引用
     * @param  {Array} args 原实参集
     * @param  {Number|undefined} rest 提取项数
     * @return {Array} 最终实参集
     */
    args( evo, args, rest ) {
        if ( rest === 0 ) {
            args = args.concat( this[_SID].pop() );
        }
        else if ( rest > 0 ) {
            args = args.concat( this[_SID].pops(rest) );
        }
        // maybe undefined
        evo.data = this.data( this._want );

        return args;
    }


    /**
     * 下一阶方法调用。
     * @param  {Object} evo 事件相关对象
     * @param  {Value|Promise} val 当前方法执行的结果
     * @return {Value|void}
     */
    nextCall( evo, val ) {
        if ( !this.next ) {
            return val;
        }
        if ( !(val instanceof Promise) ) {
            // 保持线性，避免后续avoid无效。
            return this.next.call(evo, val);
        }
        val.then( v => this.next.call(evo, v), rejectInfo );
    }


    /**
     * 从暂存区/数据栈获取流程数据。
     * 如果要从流程取实参，非零项数取值仅为1项（模板用户负责打包）。
     * 注：无取值项数指令也可取值。
     * @param  {Number|null} n 取值项数
     * @return {Value|[Value]|undefined}
     */
    data( n ) {
        if ( n != null ) return this[_SID].data( n );
    }


    /**
     * 克隆当前指令实例。
     * 浅克隆，方法的实参（._args）只是一个原值引用。
     * 部分成员重写，以保持正确的链式逻辑。
     * @param  {Stack} stack 关联数据栈
     * @param  {Cell} prev 新链上的前一个指令单元。
     * @return {Cell} 新实例
     */
    clone( stack, prev ) {
        let _cell = Object.assign( new Cell(), this );

        // 部分成员重写。
        _cell[_SID] = stack;

        if ( this._prev ) {
            _cell.prev = prev;
        }
        if ( this._next ) {
            _cell._next = true;
        }
        if ( prev ) {
            prev.next = _cell;
            if ( prev._next === true ) prev._next = _cell;
        }
        return _cell;
    }

}


//
// On事件名定义。
// 针对单个事件的定义，可包含委托选择器和捕获标记。
// 捕获标记：
//      !true   明确指定绑定到捕获阶段。
//      !false  明确指定绑定到冒泡阶段。
// 无附加标记时，系统智能判断（不冒泡的事件绑定在捕获阶段）。
// 例：
// - click(!true)   绑定click事件到捕获阶段，无委托选择器
// - click(b!false) 绑定click事件到冒泡阶段，委托选择器为 'b'
// - click(b)       无捕获标记，实际上效果同上。
//
class Evn {
    /**
     * 解析格式化事件名。
     * - 前置 ^ 表示绑定单次执行。
     * - 前置 @ 表示预存储事件处理器（调用链）。
     * - 支持括号内指定委托选择器。
     * @param {String} name 格式化名称
     */
    constructor( name ) {
        let _vs = name.match( __onEvent );
        if ( !_vs ) {
            throw new Error(`[${name}] is invalid`);
        }
        this.name     = _vs[1];
        this.selector = null;
        this.capture; // undefined

        if ( _vs[2] ) {
            this.slrcap( _vs[2].trim() );
        }
        this.once  = name[0] == __evnOnce;
        this.store = name[0] == __evnStore;
    }


    /**
     * 提取选择器&捕获模式。
     * 事件名之后的括号内为委托选择器，可附带捕获标识（!true|!false）。
     * 即：
     * 用户可以指定事件绑定是否为捕获阶段。
     * @param  {String} str 匹配串
     * @return {void}
     */
    slrcap( str ) {
        if ( str.endsWith(__capTrue) ) {
            this.capture = true;
            str = str.slice( 0, -5 );
        }
        else if ( str.endsWith(__capFalse) ) {
            this.capture = false;
            str = str.slice( 0, -6 );
        }
        this.selector = str || null;
    }


    /**
     * 起始指令对象绑定。
     * 设置链头 HEADCELL 属性值为本实例，可枚举以便于克隆。
     * @param  {Cell} cell 指令单元
     * @param  {Evn} evn 事件定义实例
     * @return {Cell} cell
     */
    static apply( cell, evn ) {
        Reflect.defineProperty(cell, HEADCELL, {
            value: evn,
            enumerable: true,
        });
        return cell.build( null, empty );
    }

}


// 空占位函数。
function empty() {}


//
// 通用调用定义解析。
// 模板中指令/方法调用的配置解析存储。
//
class Call {
    /**
     * call支持句点引用子集成员。
     * 如：x.math.abs()
     * @param {String} fmt 调用格式串
     */
    constructor( fmt ) {
        let _vs = fmt.match( __obtCall );
        if ( !_vs ) {
            throw new Error( `[${fmt}] is invalid calling.` );
        }
        // 特例：
        // 友好支持空名称为push指令。
        this._meth = _vs[1] || __zeroName;
        this._args = arrArgs( _vs[2] );
    }


    /**
     * 应用到指令集。
     * 通用标记：
     * - [EXTENT] 自动取栈条目数
     * - [ACCESS] 可访问数据栈（特权）
     * 特殊标记：
     * - [JUMPCELL] jump专用标识。
     * - [PREVCELL] 设置前阶指令标记。
     * @param  {Cell} cell 指令单元
     * @param  {Object} pbs 指令集
     * @param  {Cell} prev 前阶指令
     * @return {Cell} cell
     */
    apply( cell, pbs, prev ) {
        let _f = methodSelf(this._meth, pbs);
        if ( !_f ) {
            throw new Error(`${this._meth} is not in pbs:calls.`);
        }
        if ( _f[JUMPCELL] ) {
            // 初次标记自身。
            cell.setJUMP( true );
        }
        if ( prev.setJUMP() ) {
            // 此为jump跟随指令。
            prev.setJUMP( cell );
        }
        if ( cell[PREVCELL] ) {
            cell._prev = prev;
        }
        return cell.build( this._args, _f, _f[ACCESS], _f[EXTENT] );
    }

}


//
// To查询配置。
// 格式 {
//      xxx   // 单元素检索：$.get(...): Element | null
//      (xxx) // 小括号包围，多元素检索：$(...): Collector
//
//      (xxx)( Number, Number )       // 范围：slice()
//      (xxx)[ Number, Number, ... ]  // 定点取值：[n]
//      (xxx){ Filter-Expression }    // 过滤表达式：(v:Element, i:Number, o:Collector): Boolean
//
//      ~   // 事件起始元素（evo.target）
//      #   // 事件当前元素（evo.current）
// }
// 起点元素：支持暂存区1项可选（可为任意值），否则为事件绑定/委托元素。
//
class Query {
    /**
     * 构造查询配置。
     * 注：空值合法（目标将为起点元素）。
     * @param {String} qs 查询串
     */
    constructor( qs ) {
        this._slr = qs;
        this._one = true;
        this._flr = null;

        this._matchMore( qs.match(__toQuery) );
    }


    /**
     * 应用查询。
     * 绑定指令的方法和参数序列。
     * @param  {Cell} cell 指令单元
     * @return {Cell} cell
     */
    apply( cell ) {
        // n:-1 支持暂存区1项可选
        return cell.build( [this._slr, this._one, this._flr], query, false, -1 );
    }


    /**
     * 多检索匹配处理。
     * 需要处理进阶成员提取部分的定义。
     * @param {Array} result 多检索选择器匹配结果
     */
     _matchMore( result ) {
        if ( result ) {
            this._slr = result[1];
            this._flr = this._handle( result[2] );
            this._one = false;
        }
    }


    /**
     * 创建提取函数。
     * 接口：function( all:Collector ): Collector|[Element]
     * @param  {String} fmt 格式串
     * @return {Function} 取值函数
     */
    _handle( fmt ) {
        if ( !fmt ) return null;

        if ( __toExclude.test(fmt) ) {
            return this._exclude( fmt.match(__toExclude)[1] );
        }
        if ( __toNumber.test(fmt) ) {
            return this._number( fmt.match(__toNumber)[1] );
        }
        if ( __toFilter.test(fmt) ) {
            return this._filter( fmt.match(__toFilter)[1] );
        }
    }


    /**
     * 匹配排除过滤。
     * @param  {String} slr 选择器
     * @return {Function}
     */
    _exclude( slr ) {
        return all => all.filter( el => !$.is(el, slr) );
    }


    /**
     * 数值定位提取。
     * @param  {String} fmt 定位串：[x:y]|[m,n,...]
     * @return {Function}
     */
    _number( fmt ) {
        let _vs = fmt.split(__toRange);

        if ( _vs.length > 1 ) {
            return this._range( _vs );
        }
        _vs = JSON.parse( `[${fmt}]` );

        // 越界下标的值被滤除。
        return all => _vs.map( i => all[i] ).filter( v => v );
    }


    /**
     * 按范围提取。
     * @param  {String} beg 起始下标，可选
     * @param  {String} end 终点下标，可选
     * @return {Function}
     */
    _range( [beg, end] ) {
        beg = Math.trunc( beg ) || 0;
        end = end.trim() ? Math.trunc( end ) : undefined;

        return all => all.slice( beg, end );
    }


    /**
     * 过滤器提取。
     * @param  {String} fmt 过滤表达式
     * @return {Function}
     */
    _filter( fmt ) {
        let _fn = new Function(
                'v', 'i', 'c', `return ${fmt};`
            );
        return all => all.filter( _fn );
    }
}


//
// To:Update配置。
// 大多数方法为简单的规范名称，如：before, after, wrap, height 等。
// 特性/属性/样式三种配置较为特殊，采用前置标志字符表达：{
//      @   特性（attribute），如：@title => $.attr(el, 'title', ...)
//      &   属性（property），如：&value => $.prop(el, 'value', ...)
//      %   样式（css）， 如：%font-size => $.css(el, 'font-size', ...)
//      ^   特性切换，如：^-val => $.toggleAttr(el, '-val', ...)
// }
// 注记：
// Updata方法取值条目数强制为1，不适用集成控制指令集。
//
class Update {
    /**
     * 构造设置器。
     * @param {String} fmt 定义格式串
     */
    constructor( fmt ) {
        let _vs = this.methArgs(fmt);

        this._meth = _vs[0];
        this._args = arrArgs(_vs[1]);
    }


    /**
     * 应用更新设置。
     * @param  {Cell} cell 指令单元
     * @param  {Object} pbs 更新方法集
     * @return {Cell} cell
     */
    apply( cell, pbs ) {
        let _f = methodSelf( this._meth, pbs );
        if ( !_f ) {
            throw new Error(`${this._meth} is not in pbs:Update.`);
        }
        // pass|end|debug
        // 无取栈数量要求，不自动取流程数据。
        if ( _f[UPDATEX] ) {
            return cell.build( this._args, _f, _f[ACCESS] );
        }
        // bound update:
        // function( Element|Collector, dataValue, ...rest ): Value|void
        return cell.build( this._args, update.bind(null, _f), _f[ACCESS], 1 );
    }


    /**
     * 提取更新方法及实参序列。
     * 友好方法：{
     *      @   特性（attr）
     *      &   属性（prop）
     *      %   样式（css）
     *      ^   特性切换（toggleAttr）
     * }
     * @param  {String} fmt 调用格式串
     * @return {[meth, args]}
     */
    methArgs( fmt ) {
        let _m = __updateMethod[ fmt[0] ];

        if ( _m ) {
            return [ _m, `'${fmt.substring(1)}'` ];
        }
        // :result[1~]
        return fmt.match(__toUpdate).slice(1);
    }
}



//
// 工具函数。
///////////////////////////////////////////////////////////////////////////////


/**
 * 占位字符处理。
 * 如果原字符串为假或占位符，则返回空串，
 * 否则返回一个清理首尾空白（trim）后的字符串。
 * @param  {String} chr 原字符串
 * @return {String}
 */
function zeroPass( chr ) {
    chr = chr && chr.trim();
    return !chr || chr == __chrZero ? '' : chr;
}


/**
 * 解析模板参数序列。
 * 支持模板实参“_[n]”特别标识名表示从流程数据取值。
 * @param  {String} args 参数序列串
 * @return {Array|null}
 */
function arrArgs( args ) {
    if ( !args ) return null;

    return new Function( ...Object.keys(__fromStack), `return [${args}]` )(
        ...Object.values(__fromStack)
    );
}


//
// 获取对象方法自身。
// 方法名支持句点（.）分隔的多级引用。
// 仅能获取已经存在的成员。
//
function methodSelf( name, obj ) {
    name = name.split( '.' );
    return name.length > 1 ? Util.subObj( name, obj ) : obj[ name[0] ];
}


/**
 * 存储调用链。
 * @param {Element} to 存储到目标
 * @param {Cell} cell 调用链起始指令实例
 */
function storeChain( to, cell ) {
    let _map = ChainStore.get( to );

    if ( !_map ) {
        _map = new Map();
        ChainStore.set( to, _map );
    }
    _map.set( cell[HEADCELL].name, cell );
}


/**
 * 调用链克隆。
 * 会创建一条新的调用链，包括一个新的数据栈。
 * 但指令内的PB方法的实参只是一个引用，共享相同的数据源。
 * @param  {Cell} cell 调用链起始指令实例
 * @return {Cell} 新链起始指令实例
 */
function chainClone( cell ) {
    let _stack = new Stack(),
        _first = cell.clone( _stack ),
        _prev = _first;

    while ( (cell = cell.next) ) {
        _prev = cell.clone( _stack, _prev );
    }
    return _first;
}



/**
 * Promise失败显示。
 * 按前置标志字符串识别层级。
 * 注：无信息不显示。
 * @param {String} msg 显示的消息
 */
function rejectInfo( msg ) {
    if ( !msg || !DEBUG ) {
        return;
    }
    if ( typeof msg !== 'string' ) {
        return window.console.dir( msg );
    }
    if ( msg.startsWith('warn:') ) {
        return window.console.warn( msg.substring(5) );
    }
    if ( msg.startsWith('err:') ) {
        return window.console.error( msg.substring(4) );
    }
    window.console.info( msg );
}


/**
 * To：目标检索方法。
 * 支持二阶检索和相对ID属性（见 Util.find）。
 * 支持暂存区1项为检索起点（由前阶末端指令取出），
 * 否则检索起点元素为事件绑定/委托元素。
 * @param  {Object} evo 事件关联对象
 * @param  {String} slr 选择器串（二阶支持）
 * @param  {Boolean} one 是否单元素版
 * @param  {Function} flr 进阶过滤提取
 * @return {void}
 */
function query( evo, slr, one, flr ) {
    let _beg = evo.data;

    if ( _beg === undefined ) {
        _beg = evo.delegate;
    }
    evo.updated = evo.primary = query2(evo, slr, _beg, one, flr);
}


/**
 * To：元素检索（辅助）。
 * 从起点元素上下检索目标元素（集）。
 * 进阶过滤：function( Collector ): Collector
 * 注记：
 * beg可能从暂存区取值为一个集合，已要求slr部分为空，因此代码工作正常。
 *
 * @param  {Object} evo 事件关联对象
 * @param  {String} slr 双阶选择器
 * @param  {Element|null} beg 起点元素
 * @param  {Boolean} one 是否单元素查询
 * @param  {Function} flr 进阶过滤函数
 * @return {Element|Collector}
 */
function query2( evo, slr, beg, one, flr ) {
    switch ( slr ) {
        case __toqOrig: return evo.target;
        case __toqCurr: return evo.current;
    }
    let _v = Util.find( slr, beg, one );

    return one ? _v : ( flr ? flr(_v) : _v );
}


/**
 * To：更新方法（单个）。
 * 非undefined返回值会更新目标自身。
 * @param  {Function} func To更新函数
 * @param  {Object} evo 事件关联对象
 * @param  {...Value} rest 剩余实参序列（最终）
 * @return {void|Promise.reject}
 */
function update( fun, evo, ...rest ) {
    let _val = fun(
        evo.updated, evo.data, ...rest
    );
    if ( _val !== undefined ) evo.updated = _val;
}



//
// 导出
///////////////////////////////////////////////////////////////////////////////


export { Builder, chainClone, storeChain }
