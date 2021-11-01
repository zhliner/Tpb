//! $ID: hotkey.js 2020.04.06 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  快捷键映射处理。
//
//  支持一个或多个键标识映射到一个指令序列，用户按下的键序列触发对应的指令执行。
//  多个键标识以数组表示，指令序列则以空格分隔多个指令。
//
//  键标识是任意的，但通常在模板中用 PB:acmsk() 构造出来。
//
//  配置结构：{
//      key:[String]    触发键标识，支持数组定义多对一（可通过发送数据区分）
//      command:String  指令标识序列（空格分隔）
//      exclude:String  排除选择器，匹配则不触发。可选
//  }
//
//  注记：
//  如果需要限定触发目标，可采用委托绑定的形式（这里不提供when逻辑），
//  或者在指令的委托绑定中指定匹配的选择器。
//
//  如果需要同一键序列映射到不同的目标&行为，应当创建一个新的实例/配置来处理。
//  这样的简化设计更容易分区控制，且效率较高。
//
//
///////////////////////////////////////////////////////////////////////////////
//

const
    $ = (this || window).$,

    __reSpace = /\s+/;


//
// 通用热键处理器。
// 把目标指令视为待激发的事件绑定到元素上，
// 通过激发指令（事件）调用用户定义的处理逻辑。
//
// 这样的逻辑很简明，但需要每个指令对应到一个处理器绑定。
//
export class HotKey {

    constructor() {
        // key: {
        //      commands: [command],
        //      match:    {Function|null}
        // }
        this._map = new Map();
    }


    /**
     * 键映射配置。
     * 注：在事件触发之前调用即可。
     * @param  {[Object]} list 映射配置集
     * @return {this}
     */
    config( list ) {
        for (const its of list) {
            let _ks = its.key;

            if ( !$.isArray(_ks) ) {
                _ks = [_ks];
            }
            _ks.forEach(
                key => this.bind(key, its.command, its.exclude)
            );
        }
        return this;
    }


    /**
     * 绑定键映射。
     * cmd支持空格分隔的多个指令标识序列。
     * 注：可用于外部用户配置定制覆盖。
     * @param  {String} key 键序列（单个）
     * @param  {String} cmd 指令标识/序列
     * @param  {String} exclude 排除选择器，可选
     * @return {this}
     */
    bind( key, cmd, exclude = null ) {
        this._map.set(
            this._key(key),
            {
                commands: cmd.trim().split( __reSpace ),
                match: exclude && ( el => !$.is(el, exclude) )
            }
        );
        return this;
    }


    /**
     * 检查键序列是否匹配。
     * 可用于排除某子区域不触发快捷键指令。
     * OBT：(HKObj) ev('key') evo(1) call('will', _2) pop stop;
     * 检测并终止事件向上传递。
     * @param  {String} key 键序列
     * @param  {Element} target 目标元素
     * @return {Boolean}
     */
    will( key, target ) {
        return !!this._matches( key, target );
    }


    /**
     * 检索键序列并激发指令。
     * 键序列存在匹配就会激发目标指令，
     * 默认情况下，会取消该快捷键在浏览器的默认行为（除非明确禁止），
     * 注意：
     * 激发指令不表示指令就会执行，指令的绑定委托会进一步限定指令。
     * @param  {String} key 键序列
     * @param  {Event} ev 事件对象
     * @param  {Value} extra 附加数据
     * @param  {Boolean} prevent 阻止默认行为，默认阻止
     * @return {Boolean} 是否激发
     */
    fire( key, ev, extra, prevent = true ) {
        let _cmds = this._matches(key, ev.target);

        if ( _cmds ) {
            for ( const cmd of _cmds ) {
                $.trigger( ev.target, cmd, extra, true, true );
            }
            if ( prevent ) ev.preventDefault();
        }
        return !!_cmds;
    }


    //-- 私有辅助 ----------------------------------------------------------------


    /**
     * 获取匹配的指令集。
     * @param  {String} key 触发键序列
     * @param  {Element} target 目标元素
     * @return {[command]} 指令标识集
     */
    _matches( key, target ) {
        let _cmo = this._map.get(key);
        return _cmo && (!_cmo.match || _cmo.match(target)) && _cmo.commands;
    }


    /**
     * 规范化键序列表示。
     * - 去除空白。
     * - 全小写。
     * - 空格占位符（Space）转为空格。
     * @param  {String} ss 键序列
     * @return {String}
     */
    _key( ss ) {
        return ss.replace( /\s+/g, '' )
            .toLowerCase()
            .replace( /\bspace\b/g, ' ' );
    }

}


//
// 热键对象式处理器。
// 热键直接激发对象的方法调用。
// 这便于集中处理热键的激发逻辑（无需大量的绑定）。
// 即：
// command 映射到对象内的方法名。
//
export class ObjKey extends HotKey {
    /**
     * @param {Object} obj 操作集
     * @param {Boolean} prevent 阻止默认行为，默认阻止
     */
    constructor( obj, prevent = true ) {
        super();
        this._obj = obj;
        this._prd = prevent;
    }


    /**
     * 覆盖：检索键序列并激发调用。
     * @param  {String} key 键序列
     * @param  {Event} ev 事件对象
     * @param  {...Value} args 实参序列
     * @return {Boolean} 是否激发
     */
    fire( key, ev, ...args ) {
        let _cmds = this._matches(key, ev.target);

        if ( _cmds ) {
            for ( const cmd of _cmds ) {
                this._obj[cmd]( ...args );
            }
            if ( this._prd ) ev.preventDefault();
        }
        return !!_cmds;
    }
}
