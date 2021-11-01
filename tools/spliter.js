//! $ID: spliter.js 2019.08.19 Tpb.Tools $
// +++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  字符序列切分器。
//  按指定的分隔符切分字符序列，但忽略特定语法内的分隔符。
//
//  - UmpString 识别字符串语法（单双引号和撇号）。
//  - UmpCaller 识别调用格式（小括号包围）。
//  - UmpChars  识别定制包围字符（如中括号的属性/数组语法），通用。
//  - Spliter   切分器。支持上面三种实例（接口满足）。
//
//  局限：分隔符只是单个字符，但支持4字节Unicode码点。
//
///////////////////////////////////////////////////////////////////////////////
//

//
// 字符串判断。
//
class UmpString {
    /**
     * 切分器构造。
     */
    constructor() {
        this._qch = '';
        this._esc = false;
    }


    /**
     * 判断处理。
     * 引号包含：双引号/单引号/模板字符串撇号。
     * @param  {string} ch 当前字符
     * @return {Boolean}
     */
    umpire( ch ) {
        if (ch == '"' || ch == "'" || ch == '`') {
            return this._quote(ch);
        }
        return this._escape(ch), !!this._qch;
    }


    reset() {
        this._qch = '';
        this._esc = false;
    }


    ready() {
        return this._qch === '' && !this._esc;
    }


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 设置引号。
     * @param {String} ch 当前字符
     */
    _quote( ch ) {
        if ( !this._esc ) {
            // 开始
            if (this._qch == '') this._qch = ch;
            // 结束
            else if (this._qch == ch) this._qch = '';
        }
        return true;
    }


    /**
     * 处理转义字符。
     * @param {String} ch 当前字符
     */
    _escape( ch ) {
        if ( !this._qch || ch !== '\\' ) {
            return this._esc = false;
        }
        if ( ch === '\\' ) this._esc = !this._esc;
    }
}


//
// 方法调用判断。
// 以最外围的括号为判断依据，嵌套的括号为子域（应当对称）。
// 注意：
// 调用实参内如果包含数组，数组成员也可能为箭头函数。
//
class UmpCaller {
    /**
     * 构造切分器。
     */
    constructor() {
        // 括号嵌套计数
        this._cnt = 0;
    }


    /**
     * 判断处理。
     * @param  {String} ch 当前字符
     * @return {Boolean} 是否在调用式之内
     */
    umpire( ch ) {
        if (ch === '(') {
            return !!(this._cnt += 1);
        }
        if (ch === ')') {
            return !(this._cnt -= 1);
        }
        return !!this._cnt;
    }


    reset() {
        this._cnt = 0;
    }


    ready() {
        return this._cnt === 0;
    }
}


//
// 通用判断。
// 定制包围字符，如：[] {} 等等。
// 注意：包围的开始和结束字符不能相同。
//
class UmpChars {
    /**
     * 构造切分器。
     * @param {String} beg 包围前字符
     * @param {String} end 包围后字符
     */
    constructor( beg, end ) {
        this._ch1 = beg;
        this._ch2 = end;
        this._cnt = 0;
    }


    /**
     * 判断处理。
     * @param  {String} ch 当前字符
     * @return {Boolean}
     */
    umpire( ch ) {
        if (ch === this._ch1) {
            return !!(this._cnt += 1);
        }
        if (ch === this._ch2) {
            return !(this._cnt -= 1);
        }
        return !!this._cnt;
    }


    reset() {
        this._cnt = 0;
    }


    ready() {
        return this._cnt === 0;
    }
}


//
// 通用切分器。
// 操作满足如下接口的实例：
// function umpire(ch:String): Boolean
// function reset(): void
//
class Spliter {
    /*
     * 构造切分器。
     * 仅使用.part()方法时无需分隔符。
     * 判断实例的顺序：
     * - 只要在任一域内，就会忽略后续其它域的检测计算，
     * - 因此大域在前小域在后会更有效率（如调用域就比字符串域大）。
     * @param {String} sep 切分字符
     * @param {...Interface} umps 判断实例
     */
   constructor( sep, ...umps ) {
       this._sep = sep;
       this._umps = umps;
   }


   /**
    * 按分隔符切分。
    * 可以限制切分的最大次数，如：1次两片，2次3片。
    * @param  {String} fmt 格式串
    * @param  {Number} cnt 切分的最大计数，可选
    * @return {Iterator} 切分迭代器
    */
    *split( fmt = '', cnt = Infinity ) {
       let _ss = '',
           _ew = fmt.endsWith(this._sep);

       while ( fmt && cnt-- ) {
           [_ss, fmt] = this._pair(fmt, this._sep);
           yield _ss;
       }
       if ( fmt || _ew ) yield fmt;
   }


    /**
     * 按区段切分。
     * 把普通区段和忽略区段分隔开来。
     * @param  {String} fmt 格式串
     * @param  {Number} cnt 切分的最大计数，可选
     * @return {Iterator} 切分迭代器
     */
    *part( fmt = '', cnt = Infinity ) {
        let _val = '',
            _beg = '',
            _inc = false;

        while ( fmt && cnt-- ) {
            [_val, _beg, fmt, _inc] = this._part(fmt, _beg, _inc);
            yield _val;
        }
        // 末尾遗漏字符。
        if ( _beg ) yield _beg;
    }


    /**
     * 判断器重置。
     * 用于出错之后的状态恢复。
     * @return {this}
     */
    reset() {
        this._umps.forEach(
            ump => ump.reset()
        );
        return this;
    }


    /**
     * 是否为就绪状态。
     * 非此则为解析未完成，不应启动新的解析。
     * @return {Boolean}
     */
    ready() {
        return this._umps.every( ump => ump.ready() );
    }


    //-- 私有辅助 ----------------------------------------------------------------


    /**
     * 简单的2片切分。
     * - 检查起点在字符串之外，因此无需检查转义（\x）。
     * - 可以正确处理4字节Unicude码点。
     * @param  {String} fmt 格式串
     * @param  {String} sep 分隔符
     * @return {[String, String]} 前段和后段
     */
    _pair( fmt, sep ) {
        let _len = 0;

        for ( let ch of fmt ) {
            if ( !this._inside(ch) && ch === sep ) {
                break;
            }
            _len += ch.length;
        }
        return [ fmt.substring(0, _len), fmt.substring(_len+sep.length) ];
    }


    /**
     * 区段切分。
     * 可用于提取特定类型的区段。
     * @param  {String} fmt 格式串
     * @param  {String} beg 上阶起始字符
     * @param  {Boolean} inc 在语法段内
     * @return {[String, String, Booleam]}
     */
     _part( fmt, beg, inc ) {
        let _pch = '',
            _len = 0,
            _inc = inc;

        for ( let ch of fmt ) {
            inc = this._inside(ch);
            _pch = ch;
            if ( _inc != inc ) break;
            _len += ch.length;
        }
        // 同区结束
        if ( _inc == inc ) _pch = '';

        return [ beg+fmt.substring(0, _len), _pch, fmt.substring(_len+_pch.length), inc ];
    }


    /**
     * 是否在语法块内。
     * 注记：
     * 各语法块为嵌套方式，因此仅需测试最先进入者。
     * @param  {string} ch 当前字符
     * @return {Boolean}
     */
    _inside( ch ) {
        return this._umps.some( ump => ump.umpire(ch) );
    }
}


export { Spliter, UmpString, UmpCaller, UmpChars };
