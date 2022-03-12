//! $ID: date.js 2021.06.27 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2021 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  日期/时间格式化工具。
//
//
///////////////////////////////////////////////////////////////////////////////
//

const
    // JSON日期格式
    // 2017-02-06T15:29:01.933Z
    __dateJSON = /^(\d{4})-(\d{2})-(\d{2})T(\d+):(\d+):(\d+)\.(\d+)Z$/,

    // 时区与UTC差（毫秒）
    __timeOffset = new Date().getTimezoneOffset() * 60000,

    // date格式合法词匹配
    __dateFormat = /\by+\b|\bM+\b|\bd+\b|\bh+\b|\bm+\b|\bs+\b|\bS\b/g,

    // 提取对象时间值
    // 容错：零值取UTC标准起点时间。
    getTime = obj => obj.getTime ? obj.getTime() : parseInt(obj) || __timeOffset;


/**
 * 分解提取Date各部分。
 * @param  {Number} tm 标准毫秒数
 * @return {Object} 各配置组成对象
 */
function dateCells( tm ) {
    tm -= __timeOffset;
    let [ _, yyyy, MM, dd, hh, mm, ss, S ] = new Date(tm).toJSON().match(__dateJSON);
    return {
        yyyy, yy: yyyy.slice(2),
        MM,   M:  +MM,
        dd,   d:  +dd,
        hh,   h:  +hh,
        mm,   m:  +mm,
        ss,   s:  +ss,
        S, _,
    };
}


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
 * 例：
 *   yyyy-MM-dd hh:mm:ss.S => 2017-02-08 16:49:09.643
 *   yy-M-d h:m:s => 17-2-8 16:49:9
 * 注记：
 * - 借用Date的JSON标准格式分解合成。
 * - 输出的是本地时间。JSON仅为借用。
 * @param  {String|Number|Date} date 日期表达
 * @param  {String} fmt 格式串
 * @return {String}
 */
export function format( date, fmt ) {
    let _ss = dateCells( getTime(date) );
    return fmt.replace( __dateFormat, w => _ss[w] || w );
}
