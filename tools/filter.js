//! $ID: filter.js 2019.09.17 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  渲染过滤器（Render:Filter）
//
//  用于渲染赋值表达式中对计算的结果做进一步过滤处理。
//  过滤处理器支持管道式多层递进处理，前一阶处理的结果作为下一阶的源数据。
//
//  约定：被处理的数据作为过滤器函数的首个参数存在。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { format } from "./date.js";

const $ = (this || window).$;


//
// 过滤器集合。
//
const Filter = {
    /**
     * 文本截断。
     * - 按视觉字节（单字节）计算，全角字符记为2个字节；
     * - 若有截断，尾部跟随的标志串长度计算在内（误差1）；
     * @param  {String} data 待处理数据
     * @param  {Number} len 单字节长度
     * @param  {String} fix 截断标志串
     * @return {String}
     */
    cut( data, len, fix = '..' ) {
        let _chs = [];

        for ( let ch of data ) {
            len -= viewByte(ch);
            if (len < 0) break;
            _chs.push(ch);
        }
        return len < 0 ? viewEndpad(_chs, fix) : _chs.join('');
    },


    /**
     * 解码HTML。
     * 源数据中的HTML实体翻译为文本，如：&lt; 到 <。
     * @param  {String} data 待处理数据
     * @return {String}
     */
    text( data ) {
        return $.text( data );
    },


    /**
     * 转为HTML代码。
     * 源数据中的特殊文本转为HTML实体，如：< 到 &lt;
     * @param  {String} data 待处理数据
     * @return {String}
     */
    html( data ) {
        return $.html( data );
    },


    /**
     * 格式化日期和时间。
     * 格式：{
     *      yy|yyyy 年
     *      M|MM    月
     *      d|dd    日
     *      h|hh    时
     *      m|mm    分
     *      s|ss    秒
     *      S       毫秒
     * }
     * @param  {String|Number|Date} date 日期表达
     * @param  {String} fmt 格式串
     * @return {String}
     */
    date( date, fmt ) {
        return format( date, fmt );
    },


    /**
     * 首尾空白清除。
     */
    trim( data ) {
        return data.trim();
    },


    /**
     * 空白清理（减为单个空格）。
     */
    clean( data ) {
        return data.trim().replace(/\s+/g, ' ');
    },


    /**
     * 节点封装（通用）。
     * 不指定标签名时创建一个文本节点。
     * @param  {String|Object} data 待处理源数据
     * @param  {String} tag 元素标签名
     * @return {Element|TextNode}
     */
    node( data, tag ) {
        return tag ? $.Element( tag, data ) : $.Text( data );
    },

};


// 友好：
// 内联元素封装（也可由node创建）
[
    'strong',
    'em',
    'q',
    'abbr',
    'cite',
    'small',
    'time',
    'del',
    'ins',
    'sub',
    'sup',
    'mark',
    'code',
    'dfn',
    'samp',
    'kbd',
    's',
    'u',
    'var',
    'bdo',
    'b',
    'i',
].forEach(function( name ) {
    Filter[name] = data => $.Element( name, data );
});


// cut文本截断辅助。
const
    /**
     * 计算字符的视觉字节。
     * 全角字符记为2个字节。
     * @return {Number}
     */
    viewByte = ch => ch.codePointAt() < 0xff ? 1 : 2,

    /**
     * 计算字符串看起来的字节数。
     * 全角字符按2字节计算，可以正确处理4字节字符。
     * @return {Number}
     */
    viewBytes = str => [...str].reduce( (n, ch) => n + viewByte(ch), 0 );


/**
 * 末尾截断填充。
 * - 按视觉字节计算（单字节）；
 * - 最少截断原则（字符完整）；
 * @param  {Array} chs  字符序列
 * @param  {String} fix 填充字符串
 * @return {String}
 */
function viewEndpad( chs, fix ) {
    let _fix = viewBytes(fix);

    for ( let i = chs.length - 1; i >= 0; i-- ) {
        _fix -= viewByte(chs[i]);
        if (_fix < 0) break;
        chs.pop();
    }
    return chs.join('') + fix;
}


export { Filter };
