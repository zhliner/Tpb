//! $Id: spliter.js 2019.08.19 Tpb.Kits $
//
// 	Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
// 	Copyright (c) 2017 - 2019 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//	字符串序列切分器
//
//  格式串本身是字符串，但这里视它们为某种语法表达，包含了一些固定的逻辑：
//  - 字符串。单/双引号（"'）和撇号（`）包围。
//  - 参数段。小括号（()）包围。
//  - 属性/数组段。中括号（[]）包围。
//  - 语句块段。花括号（{}）包围。
//
//  解析由分隔符隔开的独立单元，需要理解上面的语法单元，它们不能被切分开。
//  认可哪些语法单元是可以配置的，但其中字符串属于天然不应切分，故没有提供配置。
//  即：
//  字符串内的分隔符是字面的，不会被视为分隔符。
//
//  另：支持按区段切分，如字符串、参数段、普通段等。
//
//  局限：分隔符只能是单个字符，但支持4字节Unicode字符。
//
///////////////////////////////////////////////////////////////////////////////
//


class Spliter {
    /**
     * 构造切分器。
     * @param {Boolean} args 参数段忽略（()）
     * @param {Boolean} attr 属性段忽略（[]）
     * @param {Boolean} block 块段忽略（{}）
     */
    constructor( args, attr, block ) {
        // 当前引号。
        // 初始为空，表示在引号外。
        this._qch = '';

        // 忽略集。
        let _buf = [];
        if (args)  _buf.push( this._inArgs.bind(this) );
        if (attr)  _buf.push( this._inAttr.bind(this) );
        if (block) _buf.push( this._inBlock.bind(this) );

        this._attr = false;
        this._args = false;
        this._block = false;

        this._test = _buf;
    }


    /**
     * 普通切分。
     * 可以传递一个进阶过滤函数处理当前切分的串。
     * 接口：function( s:String ): String
     * @param  {String} fmt 格式串
     * @param  {String} sep 切分字符
     * @param  {Function} fltr 进阶处理器
     * @return {Iterator} 切分迭代器
     */
    *split( fmt, sep, fltr ) {
        let _ss = '',
            _fs = this._test[0] && this._test || false;

        this.reset();

        while ( fmt ) {
            [_ss, fmt] = this._pair(fmt, sep, _fs);
            yield fltr ? fltr(_ss) : _ss;
        }
    }


    /**
     * 按区段切分。
     * - 把普通区段和忽略区段分隔开来。
     * - 忽略的不同区段被整体视为一个单元（不分彼此）。
     * @param  {String} fmt 格式串
     * @return {Iterator} 切分迭代器
     */
    *partSplit( fmt ) {
        let _ss = '',
            _fs = this._test[0] && this._test || false,
            _beg,
            _inc;
        this.reset();

        while ( fmt ) {
            [_ss, _beg, fmt, _inc] = this._part(fmt, _fs, _beg, _inc);
            // 忽略起始空白
            if ( !_ss ) {
                continue;
            }
            yield _ss;
        }
        // 末尾遗漏字符回收。
        if ( _beg ) yield _beg;
    }


    /**
     * 状态重置。
     * @return {this}
     */
     reset() {
        this._qch = '';
        this._args = this._attr = this._block = false;
        return this;
    }


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 简单的2片切分。
     * - 假定检查起点在字符串之外，因此无需检查转义字符（\x）。
     * - 可以正确处理4字节Unicude字符序列。
     * @param  {String} fmt 格式串
     * @param  {String} sep 分隔符
     * @param  {Array} test 测试集
     * @return [String, String] 前段和后段
     */
    _pair( fmt, sep, test ) {
        let _pch = '',
            _pos = 0;

        for ( let ch of fmt ) {
            let _inc = this._canSkip(_pch, ch, test);
            _pch = ch;
            if (_inc) {
                _pos += ch.length;
                continue;
            }
            if (ch == sep) break;
            _pos += ch.length;
        }

        return [ fmt.substring(0, _pos), fmt.substring(_pos + sep.length) ];
    }


    /**
     * 区段切分。
     * - 按区段切分出字符串、参数段、普通段等。
     * - 可用于提取或排除特定类型的字符串区段。
     * @param  {String} fmt  格式串
     * @param  {Array} test  测试集
     * @param  {Boolean} inc 在某类型段内
     * @return [String, String, Booleam]
     */
    _part( fmt, test, beg = '', inc = false ) {
        let _pch = beg,
            _pos = 0,
            _inc = inc;

        for ( let ch of fmt ) {
            _inc = this._canSkip(_pch, ch, test);
            _pch = ch;
            if (_inc != inc) break;
            _pos += ch.length;
        }
        // 末尾边界结束。
        if (_inc == inc) {
            _pch = '';
        }
        // 已到边界。
        return [ beg + fmt.substring(0, _pos), _pch, fmt.substring(_pos+1), _inc ];
    }


    /**
     * 可否忽略跳过。
     * @param  {String} prev 前一个字符
     * @param  {String} ch 当前字符
     * @param  {Array} test 测试集
     * @return {Booleam}
     */
    _canSkip( prev, ch, test ) {
        return this._inStr(prev, ch) || test && test.some( fn => fn(prev, ch) );
    }


    /**
     * 是否在字符串内。
     * - 会同时进行判断和处理。
     * - 引号包含：双引号/单引号/模板字符串撇号。
     * @param  {String} prev 前一个字符
     * @param  {string} ch 当前字符
     * @return {Boolean}
     */
    _inStr( prev, ch ) {
        if (ch == '"' || ch == "'" || ch == '`') {
            if (prev == '\\') {
                return !!this._qch;
            }
            // 开始
            if (this._qch == '') this._qch = ch;
            // 结束
            else if (this._qch == ch) this._qch = '';

            // 开始或末尾引号
            return true;
        }
        return !!this._qch;
    }


    /**
     * 是否在参数段内。
     * 连续的参数段视为一体。
     * @param  {String} prev 前一个字符
     * @param  {String} ch 当前字符
     * @return {Boolean}
     */
    _inArgs( prev, ch ) {
        if (ch == '(') {
            this._args = true;
        }
        else if (prev == ')') {
            this._args = false;
        }
        return this._args;
    }


    /**
     * 是否在属性段内。
     * @param  {String} prev 前一个字符
     * @param  {String} ch 当前字符
     * @return {Boolean}
     */
    _inAttr( prev, ch ) {
        if (ch == '[') {
            this._attr = true;
        }
        else if (prev == ']') {
            this._attr = false;
        }
        return this._attr;
    }


    /**
     * 是否在块段内。
     * @param  {String} prev 前一个字符
     * @param  {String} ch 当前字符
     * @return {Boolean}
     */
    _inBlock( prev, ch ) {
        if (ch == '{') {
            this._block = true;
        }
        else if (prev == '}') {
            this._block = false;
        }
        return this._block;
    }
}


export { Spliter };
