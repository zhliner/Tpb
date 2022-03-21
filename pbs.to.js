//! $ID: pbs.to.js 2019.08.19 Tpb.Base $
// +++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  OBT:To 方法集。
//
//  - Update 由 core.js/update 封装，取值数量默认固定为 1。
//  - Next 依然可前置双下划线定义取栈条目数，大多数无返回值。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import $, { DataStore, ChainStore, evnidDlmt, ACCESS, HEADCELL, UPDATEX } from "./config.js";
import { bindMethod } from "./base.js";
import { Get } from "./pbs.get.js";
import { chainClone, storeChain } from "./core.js";

import { Render } from "./tools/render.js";
import { Util } from "./tools/util.js";


const
    // 空白字符。
    // 用于bind()事件名ID序列分隔。
    __reSpace = /\s+/,

    // 消息定时器存储键。
    __TIMER = Symbol('tips-timer'),

    // 节点内容变化方法集。
    __methods = new Set([
        'before', 'after', 'prepend', 'append', 'fill', 'replace',
        'wrap', 'wrapInner',
        'html', 'text',
        'empty', 'unwrap',
    ]);



//
// 目标更新方法集。
// 目标：由Query部分检索获取。
// 内容：由流程数据中的单项提供。
// 非undefined返回值会更新To目标（evo.updated）。
// 模板实参从第三个参数算起，依然支持 _n 系列从数据栈取实参。
///////////////////////////////////////////////////////////////////////////////

const _Update = {
    /**
     * 绑定预定义调用链。
     * 从目标元素自身提取预存储的调用链并绑定到目标自身。
     * evn支持空格分隔多个事件名，假值表示通配（目标上的全部存储）。
     * 如果目标是一个集合，分别各自提取并绑定，但相同的事件名/选择器/初始数据被应用。
     * 提示：
     * 如果需要绑定其它元素的调用链，可提取后使用on/one接口。
     * @to: {Element|Collector} to 目标元素/集
     * @data: {Value|[Value]} ival 链头初始赋值
     * @param  {String} evnid 事件名ID/序列，可选
     * @param  {Object} opts 额外选项（{passive, signal}），可选
     * @return {void}
     */
    bind( to, ival, evnid, opts ) {
        bindsChain( 'on', to, ival, evnid, opts );
    },


    /**
     * 绑定单次触发（当前元素）。
     * 注：说明参考 bind。
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Value|[Value]} ival 链头初始赋值
     * @param  {String} evnid 事件名ID/序列，可选
     * @return {void}
     */
    once( to, ival, evnid ) {
        bindsChain( 'one', to, ival, evnid );
    },


    /**
     * 事件处理器绑定。
     * 目标为一个集合时返回Collector实例，
     * 否则无返回值。
     * @to:   Element|[Element] to 目标元素（集）
     * @data: EventListener|Function|false|null handler 事件处理器
     * @param  {String} evn 事件名
     * @param  {String|null} slr 委托选择器，可选
     * @param  {Boolean} cap 是否在捕获阶段，可选
     * @param  {Object} opts 额外选项（{passive, signal}），可选
     * @return {Collector|void}
     */
    on( to, handler, evn, slr, cap, opts ) {
        if ( $.isArray(to) ) {
            return $(to).on( evn, slr, handler, cap, opts );
        }
        $.on( to, evn, slr, cap, opts );
    },


    /**
     * 事件处理器绑定。
     * 目标为一个集合时返回Collector实例，
     * 否则无返回值。
     * @to:   Element|[Element] to 目标元素（集）
     * @data: EventListener|Function|false|null handler 事件处理器
     * @param  {String} evn 事件名
     * @param  {String|null} slr 委托选择器，可选
     * @param  {Boolean} cap 是否在捕获阶段，可选
     * @return {Collector|void}
     */
    one( to, handler, evn, slr, cap ) {
        if ( $.isArray(to) ) {
            return $(to).one( evn, slr, handler, cap );
        }
        $.one( to, evn, slr, cap );
    },


    /**
     * 事件处理器绑定。
     * 目标为一个集合时返回Collector实例，
     * 否则无返回值。
     * @to:   Element|[Element] to 目标元素（集）
     * @data: EventListener|Function|false|null handler 事件处理器
     * @param  {String} evn 事件名
     * @param  {String|null} slr 委托选择器，可选
     * @param  {Boolean} cap 是否在捕获阶段，可选
     * @return {Collector|void}
     */
    off( to, handler, evn, slr, cap ) {
        if ( $.isArray(to) ) {
            return $(to).off( evn, slr, handler, cap );
        }
        $.off( to, evn, slr, cap );
    },


    /**
     * 发送定制事件。
     * 如果目标是一个集合，相同的值发送到所有元素。
     * 空集静默忽略。
     * @data: 待发送值
     * @param  {Element|Collector} to 待激发元素/集
     * @param  {Value|[String, Value]} data 内容数据
     * @param  {String} evn 目标事件名
     * @param  {Boolean} bubble 是否可冒泡，可选（默认不冒泡）
     * @param  {Boolean} cancelable 是否可取消，可选（默认可取消）
     * @return {void}
     */
    trigger( to, data, evn, bubble = false, cancelable = true ) {
        if ( $.isArray(to) ) {
            return to.forEach( el => $.trigger(el, evn, data, bubble, cancelable) );
        }
        $.trigger( to, evn, data, bubble, cancelable );
    },


    /**
     * 发送定制事件。
     * 此为多元素分别对应不同的发送值版（内容需为一个数组）。
     * @data: 发送值序列
     * @param  {[Element]|Collector} tos 待激发元素集
     * @param  {[Value]} data 内容数据集
     * @param  {String} evn 目标事件名
     * @param  {Boolean} bubble 是否可冒泡，可选
     * @param  {Boolean} cancelable 是否可取消，可选
     * @return {void}
     */
    triggers( tos, data, evn, bubble = false, cancelable = true ) {
        tos.forEach(
            (el, i) => $.trigger( el, evn, data[i], bubble, cancelable )
        );
    },


    /**
     * 预存储调用链克隆存储。
     * 因为预存储的调用链严格关联存储到的容器元素，
     * 所以克隆是必要的，否则难以复用。
     * 事件名标识支持空格分隔的多个名称以用于过滤，只有匹配的才会克隆。
     * 若未传递evids，视为克隆源元素上的全部。
     * @to: {Element|Collector} to 目标元素（集）
     * @data: {Element} src 存储源元素
     * @param  {String} evids 事件名ID序列，可选
     * @return {void}
     */
    cloneChains( to, src, evids ) {
        let _map = ChainStore.get( src );

        if ( !_map ) {
            return window.console.warn( `chains of pre-store is empty on [${src}]` );
        }
        chainStores(
            $.isArray(to) ? to : [to],
            _map,
            evids ? evids.trim().split(__reSpace) : [..._map.keys()]
        );
    },


    /**
     * 事件处理器克隆。
     * 将内容元素上的事件处理器克隆到目标元素（集）上。
     * 事件名可为空格分隔的多个名称。
     * 如果目标为一个集合，源也为集合时，则为一一对应关系。
     * 注记：
     * 需要同时克隆源元素上预存储的调用链实例，
     * 因为预存储的调用链只能绑定到作为存储键的目标元素。
     * @param  {Element|Collector} to 目标元素（集）
     * @param  {Element|[Element]} src 事件源元素（集）
     * @param  {String|Function} evns 事件名序列或过滤函数，可选
     * @return {void}
     */
    cloneEvents( to, src, evns ) {
        if ( $.isArray(to) ) {
            if ( $.isArray(src) ) {
                return to.forEach( (el, i) => $.cloneEvents(el, src[i], evns) );
            }
            return to.forEach( el => $.cloneEvents( el, src, evns ) );
        }
        $.cloneEvents( to, src, evns );
    },


    /**
     * 集合包裹。
     * 注：tos视为一个整体作为待插入的内容。
     * @param  {Element|Collector} to 检索目标
     * @param  {Element|String} box 包裹容器
     * @param  {Boolean} clone 包裹容器是否克隆（深层）
     * @param  {Boolean} event 是否克隆事件处理器
     * @param  {Boolean} eventdeep 是否克隆子元素事件处理器
     * @return {Collector} 包裹容器的Collector封装
     */
    wrapAll( to, box, clone, event, eventdeep ) {
        return $(to).wrapAll( box, clone, event, eventdeep );
    },


    /**
     * 设置滚动条位置。
     * 内容为位置（数组）或对象。
     * - Object2: {left, top}
     * - Array2:  [left, top]
     * - Number:  top 单个数值时指垂直滚动条位置。
     * 注记：不影响未设置方向的现有位置。
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Array2|Object2|Number} pos 位置配置
     * @param  {Boolean} smooth 是否平滑滚动，可选
     * @return {Collector|void}
     */
    scroll( to, pos, smooth ) {
        pos = scrollObj( pos );

        if ( $.isArray(to) ) {
            to = $( to );
            requestAnimationFrame( () => to.scroll(pos, smooth) );
        } else {
            requestAnimationFrame( () => $.scroll(to, pos, smooth) );
        }
    },


    /**
     * 节点修改。
     * 与append|after|replace等明确的调用不同，这提供一种动态指定方法的能力。
     * 注：仅限于tQuery中改变节点内容的方法。
     * @param  {Element|Collector} to 检索目标
     * @param  {Value} data 内容数据
     * @param  {String} meth 方法名（__methods[...]）
     * @param  {...Value} rest 额外参数
     * @return {Collector|Node|[Node]}
     */
    nodex( to, data, meth, ...rest ) {
        if ( !__methods.has(meth) ) {
            throw new Error( `[${meth}] is not a valid method` );
        }
        if ( $.isArray(to) ) {
            return $(to)[meth]( data, ...rest );
        }
        return $[meth]( to, data, ...rest );
    },


    /**
     * 渲染目标元素/集。
     * 如果目标是多个元素，它们采用相同的源数据渲染。
     * 目标元素可能不是模板根元素，此时为局部渲染。
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Object|Array} data 内容：渲染源数据
     * @return {void}
     */
    render( to, data ) {
        if ( $.isArray(to) ) {
            return to.forEach( el => Render.update(el, data) );
        }
        Render.update( to, data );
    },


    /**
     * 设置目标成员值。
     * name支持空格分隔的多个名称。
     * 如果名称为多个，值应当是一个序列且与名称一一对应。
     * 如果目标支持set方法，则直接调用，否则用赋值语法设置。
     * 注：单一目标。
     * @param  {String} name 名称/序列
     * @return {void}
     */
    set( to, data, name ) {
        name = name.split( __reSpace );

        if ( name.length === 1 ) {
            return setObj( to, name[0], data );
        }
        name.forEach( (n, i) => setObj(to, n, data[i]) );
    },


    /**
     * 添加成员值。
     * 简单执行目标的.add()方法。
     * 如果目标是数组，添加的值也需要是一个值集，且一一对应。
     * @param  {...Value} rest 额外的实参序列
     * @return {void}
     */
    add( to, data, ...rest ) {
        if ( $.isArray(to) ) {
            return to.forEach( (o, i) => o.add(data[i], ...rest) );
        }
        to.add( data, ...rest );
    },


    /**
     * 添加多个成员值。
     * 简单调用目标的.add()方法。
     * 内容数据需要是一个集合（支持.forEach）。
     * 注记：
     * 多个目标会添加相同的值序列。
     * 考虑简单性，不支持单值版本的额外参数序列。
     * @return {void}
     */
    adds( to, vals ) {
        if ( $.isArray(to) ) {
            return to.forEach( o => vals.forEach( v => o.add(v) ) );
        }
        vals.forEach( v => to.add(v) );
    },


    /**
     * 应用目标的方法。
     * @param  {String} meth 方法名
     * @param  {...Value} rest 除内容之外的更多实参序列
     * @return {void}
     */
    apply( to, data, meth, ...rest ) {
        if ( $.isArray(to) ) {
            return to.forEach( o => o[meth]( data, ...rest ) );
        }
        to[ meth ]( data, ...rest );
    },


    /**
     * 多次应用目标的方法。
     * 内容应当是一个实参组，每次调用提取一个成员传入。
     * 实参组成员如果是一个子数组，会被展开传入，
     * 因此如果实参本来就需要一个数组，就需要预先封装（三维）。
     * 注记：
     * 多个目标会经历相同的调用和实参传递。
     * @param  {String} meth 方法名
     * @return {void}
     */
    applies( to, args, meth ) {
        if ( $.isArray(to) ) {
            return to.forEach( o => args.forEach( as => o[meth]( ...[].concat(as) ) ) );
        }
        args.forEach( as => to[meth]( ...[].concat(as) ) );
    },


    /**
     * 发送提示消息。
     * 内容为发送的消息，显示为元素内的文本（fill）。
     * 持续时间由long定义，0表示永久。
     * long单位为秒，支持浮点数。
     * @param  {Number} long 持续时间（秒）
     * @param  {String} msg 消息文本，可选
     * @return {void}
     */
    tips( to, msg, long ) {
        if ( $.isArray(to) ) {
            return to.forEach( el => message(el, msg, long) );
        }
        message( to, msg, long );
    },


    /**
     * 类名独占设置。
     * 清除源元素集内name类名之后设置目标元素类名。
     * 可用于选单中的排他性选取表达。
     * 注：支持目标是一个集合。
     * @param  {Element|[Element]} to 目标元素/集
     * @param  {[Element]} els 源元素集
     * @param  {String} name 类名称
     * @return {void}
     */
    only( to, els, name ) {
        if ( !$.isArray(to) ) {
            to = [to];
        }
        els.forEach(
            el => to.includes(el) || $.removeClass(el, name)
        );
        to.forEach( el => $.addClass(el, name) );
    },


    /**
     * 关联数据存储。
     * name支持空格分隔的名称序列。
     * 如果名称为多个且关联数据是一个数组，会与名称一一对应存储。
     * 如果目标是一个集合，相同的键/值会存储到所有目标元素。
     * @param  {Element|Collector} to 存储元素（集）
     * @param  {[Value]} data 内容数据集
     * @param  {String} name 名称序列（空格分隔）
     * @return {void}
     */
    data( to, data, name ) {
        if ( !$.isArray(to) ) to = [to];

        if ( __reSpace.test(name) ) {
            return setData(
                to,
                name.split(__reSpace),
                data,
                $.isArray(data) ? dataVals : dataVal
            );
        }
        to.forEach( el => getMap(DataStore, el).set(name, data) );
    },

};



//
// 节点操作。
// 内容：Node|[Node]|Collector|Set|Iterator|Function
//=========================================================
[
    'before',
    'after',
    'prepend',
    'append',
    'fill',
    'replace',

    // 内容：Element|String|[Element|String] 包裹容器（集）
    // 注：克隆实参序列仅在内容为元素时有用。
    'wrap',
    'wrapInner',
]
.forEach(function( meth ) {
    /**
     * 如果目标是一个数组，返回新插入节点集的Collector封装。
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Node|[Node]|Collector|Set|Iterator|Function} data 数据内容
     * @param  {Boolean} clone 节点是否克隆
     * @param  {Boolean} event 元素上的事件处理器是否克隆
     * @param  {Boolean} eventdeep 元素子元素上的事件处理器是否克隆
     * @return {Collector|Node|[Node]} 新插入的节点/集
     */
    _Update[meth] = function( to, data, clone, event, eventdeep ) {
        if ( $.isArray(to) ) {
            return $(to)[meth](data, clone, event, eventdeep);
        }
        return $[meth]( to, data, clone, event, eventdeep );
    };

});


//
// 节点操作。
// 内容：{String|[String]|Node|[Node]|Function|.values}
//---------------------------------------------------------
[
    'html',
    'text',
]
.forEach(function( meth ) {
    /**
     * 目标为数组时返回新插入节点集的Collector封装。
     * 注：
     * 如果不希望更新目标，可用特性更新接口（@text|@html）。
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Value} data 数据内容
     * @param  {...Value} args 额外参数
     * @return {Collector|Node|[Node]} 新插入的节点/集
     */
    _Update[meth] = function( to, data, where, sep ) {
        if ( data === undefined ) {
            return;
        }
        if ( $.isArray(to) ) {
            return $(to)[meth]( data, where, sep );
        }
        return $[meth]( to, data, where, sep );
    };

});


//
// 自我修改。
// 集合版返回的是二维数组。
// 内容：{Boolean|String}
// @return {[Node]|Collector}
//===============================================
[
    'empty',    // (clean?)
    'unwrap',   // (clean?)
    'remove',   // (slr?) 集合版有效
]
.forEach(function( meth ) {

    _Update[meth] = function( to, arg ) {
        if ( $.isArray(to) ) {
            return $( to )[meth]( arg );
        }
        return $[meth]( to, arg );
    };

});


//
// 逆向设置。
// 内容：{Node|Element} 插入参考点。
// 当前检索为内容，流程数据为插入参考目标。
//---------------------------------------------------------
[
    ['beforeWith',   'insertBefore'],
    ['afterWith',    'insertAfter'],
    ['prependWith',  'prependTo'],
    ['appendWith',   'appendTo'],
    ['replaceWith',  'replaceAll'],
    ['fillWith',     'fillTo'],
]
.forEach(function( fns ) {
    /**
     * 如果为克隆，返回新插入的克隆节点集，
     * 否则返回参考节点的Collector封装。
     * @param  {Element|Collector} els 检索元素/集（数据）
     * @param  {Node|Element} ref 插入参考点或容器
     * @param  {Boolean} clone 数据节点是否克隆
     * @param  {Boolean} event 元素上的事件处理器是否克隆
     * @param  {Boolean} eventdeep 元素子元素上的事件处理器是否克隆
     * @return {Collector} 参考节点的封装，或新插入节点集（如果克隆）的封装
     */
    _Update[ fns[0] ] = function( els, ref, clone, event, eventdeep  ) {
        ref = $(els)[fns[1]]( ref, clone, event, eventdeep );
        return clone ? ref.end(1) : ref;
    };

});



//
// 特性/属性/样式设置。
//=========================================================
[
    'attr',
    'attribute',
    'prop',
    'property',
    'css',
    'cssSets',
]
.forEach(function( meth ) {
    /**
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Value|[Value]|Function|null} val 内容
     * @param  {String} name 名称/序列
     * @return {void}
     */
    _Update[meth] = function( to, val, name ) {
        if ( $.isArray(to) ) {
            $(to)[meth]( name, val );
        } else {
            $[meth]( to, name, val );
        }
    };

});


//
// 其它特性操作。
// 内容：单一数据。
// 多余实参无副作用。
//---------------------------------------------------------
[
    'val',          // val:{Value|[Value]|Function}
    'offset',       // val:{top:Number, left:Number}|null
    'scrollTop',    // val:Number, inc, smooth:Boolean
    'scrollLeft',   // val:Number, inc, smooth:Boolean
    'addClass',     // name:{String|Function}
    'removeClass',  // name:{String|Function}
    'toggleClass',  // name:{String|Function|Boolean}, (force:Boolean)
    'removeAttr',   // name:{String|Function}
]
.forEach(function( meth ) {
    /**
     * 注记：
     * 部分方法有取值逻辑，
     * 预防用户错误使用，故此不返回Collector封装。
     * @param  {Element|Collector} to 目标元素/集
     * @param  {Value} data 数据内容
     * @param  {...Value} args 额外参数
     * @return {void}
     */
    _Update[meth] = function( to, data, ...args ) {
        if ( $.isArray(to) ) {
            $(to)[meth]( data, ...args );
        } else {
            $[meth]( to, data, ...args );
        }
    };

});


//
// 优化：布局类。
// 调用requestAnimationFrame()以缓解闪烁。
//---------------------------------------------------------
[
    'width',
    'height',
]
.forEach(function( meth ) {
    let _sum = 0,
        _ani = false;
    /**
     * 单帧单次执行：
     * - 单帧内增量积累，用于下一帧一次性设置。
     * - 单帧执行期间返回false，如果后续存在执行流且依赖于每次执行，
     *   则可能需要判断是否中断（pass|end），因为这里并没有实际执行（只是累计）。
     * @to: Element|Collector 目标元素（集）
     * @data: Number 宽高像素值
     * @param  {Boolean} inc 是否为增量设置
     * @return {false|void}
     */
    _Update[meth] = function( to, val, inc ) {
        _sum += val;
        if ( _ani ) return false;

        _ani = true;
        if ( inc ) val = _sum;

        if ( $.isArray(to) ) {
            requestAnimationFrame(
                () => to.forEach( el => $[meth](el, val, inc) ) || ( _sum = _ani = false )
            );
        } else {
            requestAnimationFrame( () => $[meth](to, val, inc) && (_sum = _ani = false) );
        }
    }
});


//
// 注意名值参数顺序。
// 无取值逻辑，故集合版友好返回Collector封装。
//---------------------------------------------------------
[
    'toggleAttr',   // ignore
    'toggleStyle',  // equal
]
.forEach(function( meth ) {
    /**
     * @to: Element|Collector 目标元素（集）
     * @data: Value val 特性值
     * @param  {String} name 特性名
     * @param  {Boolean} arg 额外参数（ignore|equal）
     * @return {Collector|void}
     */
    _Update[meth] = function( to, val, name, arg ) {
        if ( $.isArray(to) ) {
            return $(to)[meth]( name, val, arg );
        }
        $[meth]( to, name, val, arg );
    }
});



//
// PB专项设置。
///////////////////////////////////////////////////////////////////////////////
[
    'pbo',
    'pba',
]
.forEach(function( name ) {

    // 内容：[String]
    // 目标为多个元素时，仅支持设置为相同的值。
    // @return {void}
    _Update[name] = function( els, its ) {
        if ( $.isArray(els) ) {
            return els.forEach( el => Util[name](el, its) );
        }
        Util[name]( els, its );
    };

});


//
// 元素自身表现。
// 支持值数组与元素集成员一一对应。
// 状态标识 s：
//      1|true  状态执行，默认
//      0|false 状态取消
//      2       状态切换
// 注记：
// 与Get部分同名方法功能相同，但目标为Query的结果。
// 且状态标识由流程数据提供。
//===============================================
[
    ['hide',     'hidden'],
    ['lose',     'lost'],
    ['disable',  'disabled'],
    ['fold',     'folded'],
    ['truncate', 'truncated'],
    ['full',     'fulled'],
]
.forEach(function( names ) {
    // @return {void}
    _Update[ names[0] ] = function( els, s ) {
        if ( $.isArray(els) ) {
            return $.isArray(s) ?
                eachState2( els, s, names[1] ) : eachState(els, s, names[1]);
        }
        oneState( els, s, names[1] );
    };

});



//
// 下一阶处理。
// 普通的调用逻辑，但仅在To部分有效。
// @return {void}
///////////////////////////////////////////////////////////////////////////////

const _Next = {
    /**
     * 获取To目标。
     * - 0  primary
     * - 1  updated 默认
     * @param  {Number} 标识值（0|1），可选
     * @return {Element|[Element]|Collector}
     */
    target( evo, n = 1 ) {
        return n > 0 ? evo.updated : evo.primary;
    },

    __target: null,


    /**
     * 执行流跳转。
     * 跳转到目标事件绑定的调用链（仅限当前元素）。
     * 内容：暂存区1项可选。
     * 如果内容有值，则为发送的内容。
     * 注：跳转的事件不冒泡。
     * @param {String} name 事件名
     */
    goto( evo, name ) {
        $.trigger( evo.delegate, name, evo.data, false );
    },

    __goto: -1,


    /**
     * 延迟激发事件。
     * 内容：暂存区1项可选。
     * 如果内容有值，则为激发事件附带的数据。
     * rid 支持如下数字值：
     * - 1  事件起始元素（evo.target）
     * - 2  事件当前元素（evo.current）
     * - 3  事件委托元素（evo.delegate）
     * - 10 原始检索结果（evo.primary）
     * - 11 更新后的结果（evo.updated）
     * 默认延迟，可设置具体的时间或0值（不延迟）。
     * 如果传递选择器，检索的结果是一个集合，这可能需要注意。
     * 注记：
     * 激发的事件默认冒泡，与通常的事件触发行为一致。
     * 因为这里就是想表达“触发另外的事”，应当冒泡以便于处理。
     * @param {String|Value} rid 目标指示或选择器
     * @param {String} name 事件名
     * @param {Number} delay 延迟时间（毫秒），可选
     * @param {Boolean} bubble 是否冒泡，可选。默认冒泡
     * @param {Boolean} cancelable 是否可取消，可选。默认可取消
     */
    fire( evo, rid, name, delay = 1, bubble = true, cancelable = true ) {
        let _to = _target( evo, rid );
        // window.console.info( _to, name );
        Util.fireEvent( $(_to), name, delay, evo.data, bubble, cancelable );
    },

    // 待发送数据。
    __fire: -1,


    /**
     * 变化事件激发。
     * 内容：暂存区1项可选。
     * 如果内容有值，则作为事件发送的数据。
     * 默认目标为更新的结果/集（evo.updated），如果传递选择器，默认单个目标检索。
     * 注记：
     * 与click等系列事件逻辑类似，保持向上冒泡。
     * @param {String|Number} rid 目标选择标识，可选
     * @param {Boolean} much 是否检索多个目标，可选
     */
    change( evo, rid = 11, much ) {
        $( _target(evo, rid, !much) ).trigger( 'change', evo.data, true );
    },

    // 待发送数据。
    __change: -1,


    /**
     * 检查表单控件值改变并通知。
     * 内容：暂存区1项可选。
     * 如果内容有值，则为激发事件附带的数据。
     * 行为：
     * 检查表单控件值是否不再为默认值，激发目标控件上的changed事件，
     * 如果都没有改变，不会激发事件。
     * 注记：
     * 表单上需要监听changed事件来接收值改变的控件通知。
     * 可用于表单重置时，发现值已经被改变的控件（外部调用本方法来检查并通知），
     * 如绑定表单的reset事件，在事件处理中调用本方法。
     * @param {String} rid 表单元素选择器
     * @param {Boolean} much 是否检索多个目标，可选
     */
    changes( evo, rid = 11, much ) {
        let _frm = _target( evo, rid, !much );
        for ( const frm of $(_frm) ) $.changes( frm, evo.data );
    },

    // 待发送数据。
    __changes: -1,


    /**
     * 选取元素或其内容。
     * 选择器只支持单个目标元素。
     * 注：容错Query部分目标为一个集合形式。
     * @param {String} rid 目标元素选择器，可选
     * @param  {Boolean} self 选取元素自身（而非其内容），可选
     * @return {Collector|void}
     */
    select( evo, rid = 11, self ) {
        $( evo.data || _target(evo, rid, true) ).select( self );
    },

    __select: -1,


    /**
     * 目标规范化。
     * @param {String} rid 表单元素选择器
     * @param {Boolean} much 是否检索多个目标，可选
     */
    normalize( evo, rid = 11, much ) {
        $( _target(evo, rid, !much) ).normalize();
    },

    __normalize: null,


    /**
     * 清理目标集。
     * @param {String} rid 表单元素选择器
     * @param {Boolean} much 是否检索多个目标，可选
     */
    clear( evo, rid = 11, much ) {
        $( _target(evo, rid, !much) )
        .forEach(
            it => it.nodeType === 1 ? $.val(it, null) : it.clear()
        );
    },

    __clear: null,


    /**
     * 滚动到当前视口。
     * y, x 值说明参考On部分同名接口。
     * rid默认匹配evo.updated。
     * @param {Number|String|true|false} y 垂直位置标识
     * @param {Number} x 水平位置标识
     * @param {Boolean} smooth 平滑模式
     * @param {String|Number} 目标元素标识，可选
     * @param {Boolean} much 是否检索多个目标，可选
     */
    intoView( evo, y, x, smooth, rid = 11, much ) {
        $( _target(evo, rid, !much) ).forEach( el => $.intoView( el, y, x, smooth ) );
    },

    __intoView: null,

};


//
// 原生事件/方法调用。
// 如果内容有值，则作为事件触发的目标元素。
// 覆盖On部分同名方法。
// 理解：重在“激发”。
//===============================================
[
    'click',
    'blur',
    'focus',
    'load',
    'play',
    'pause',
    'reset',
    // 'select',  // 定制
    'submit',
    'finish',
    'cancel',

    // On存在同名集合方法，故此无效。
    // 'reverse',
]
.forEach(function( meth ) {
    /**
     * 默认目标为更新的结果/集（evo.updated），
     * 如果传递选择器字符串，默认单个目标检索。
     * 注：
     * 只有在rid为选择器时，much才有意义，否则目标是否为一个集合由目标自身决定。
     * 注意暂存区数据为假时会被忽略，因而会定位到rid的目标，
     * 这可能是一个友好的副作用，但需要注意。
     * @param  {String|Value} rid 目标选择标识，可选
     * @param  {Boolean} much 是否检索多个目标，可选
     * @return {void}
     */
    _Next[meth] = function( evo, rid = 11, much ) {
        $( evo.data || _target(evo, rid, !much) )[ meth ]();
    };

    // 触发目标。
    _Next[`__${meth}`] = -1;

});



//
// 工具函数
///////////////////////////////////////////////////////////////////////////////


/**
 * 获取存储集。
 * 如果存储池中不存在目标键的存储集，会自动新建。
 * @param  {Map|WeakMap} pool 存储池
 * @param  {Object} key 存储键
 * @return {Map}
 */
 function getMap( pool, key ) {
    let _map = pool.get(key);

    if ( !_map ) {
        pool.set( key, _map = new Map() );
    }
    return _map;
}


/**
 * 多名称值集存储。
 * 数据值集成员与名称成员一一对应。
 * @param {Map} map 存储集
 * @param {[String]} names 名称集
 * @param {[Value]} vals 数据值集
 */
function dataVals( map, names, vals ) {
    names.forEach(
        (n, i) => vals[i] !== undefined && map.set(n, vals[i])
    );
}


/**
 * 多名称单值存储。
 * @param {Map} map 存储集
 * @param {[String]} names 名称集
 * @param {Value} val 数据值
 */
function dataVal( map, names, val ) {
    names.forEach( n => map.set(n, val) );
}


/**
 * 设置元素关联数据。
 * @param {[Element]} els 元素集
 * @param {[String]} names 名称集
 * @param {Value|[Value]} data 数据值/值集
 * @param {Function} handle 设置函数
 */
function setData( els, names, data, handle ) {
    els.forEach(
        el => handle( getMap(DataStore, el), names, data )
    );
}


/**
 * 绑定指定存储。
 * 注意：切分事件名和附加ID以首个冒号为分界。
 * @param  {Element} el 绑定目标
 * @param  {Map} map 存储集
 * @param  {[String]} evnids 事件名&ID序列
 * @param  {Object} opts 额外选项（{passive, signal}）
 * @param  {Value} ival 初始传入值（共享）
 * @param  {String} type 绑定方式
 * @return {void}
 */
function bindEvns( el, map, evnids, opts, ival, type ) {
    if ( !evnids ) {
        evnids = [ ...map.keys() ];
    }
    for ( const eid of evnids ) {
        let _cell = map.get( eid ),
            _evno = _cell && _cell[ HEADCELL ];

        if ( !_evno ) {
            window.console.warn( `have not chain by "${eid}"` );
            continue;
        }
        $[type](
            el,
            eid.split( evnidDlmt, 1 )[0],
            _evno.selector,
            _cell.setInit( ival ),
            _evno.capture,
            opts
        );
    }
}


/**
 * 调用链绑定到事件。
 * 从延迟绑定存储中检索调用链并绑定到目标事件。
 * 重复绑定是无效的（tQuery特性）。
 * 注记：
 * src和to实际上是同一个元素（当前实现）。
 * @param  {String} type 绑定方式（on|one）
 * @param  {Element} el 取值&绑定元素
 * @param  {Value} ival 初始传入值（内容）
 * @param  {String} evnid 事件名ID/序列，可选
 * @param  {Object} opts 额外选项（{passive, signal}），可选
 * @return {void}
 */
function bindChain( type, el, ival, evnid, opts ) {
    let _map = ChainStore.get( el );

    if ( !_map ) {
        return window.console.warn( `have not storage on:`, el );
    }
    return bindEvns( el, _map, evnid && evnid.split(__reSpace), opts, ival, type );
}


/**
 * 调用链绑定到事件（集合版）。
 * 从延迟绑定存储中检索调用链并绑定到目标事件。
 * 注：重复绑定是无效的（tQuery特性）。
 * @param  {String} type 绑定方式（on|one）
 * @param  {Element|[Element]} to 绑定目标元素（集）
 * @param  {Value} ival 初始传入数据
 * @param  {String} evnid 事件名标识
 * @param  {Object} opts 额外选项（{passive, signal}），可选
 * @return {void}
 */
function bindsChain( type, to, ival, evnid, opts ) {
    if ( $.isArray(to) ) {
        return to.forEach( el => bindChain(type, el, ival, evnid, opts) );
    }
    bindChain( type, to, ival, evnid, opts );
}


/**
 * 存储调用链。
 * 在每一个目标元素上存储新的调用链集。
 * @param  {[Element]} els 目标元素集
 * @param  {Map<String, Cell>} map 源调用链存储集
 * @param  {[String]} keys 存储目标标识集
 * @return {void}
 */
function chainStores( els, map, keys ) {
    for ( const eid of keys ) {
        let _head = map.get( eid );

        if ( !_head ) {
            window.console.warn( `pre-store chain is unfound with [${eid}]` );
            continue;
        }
        els.forEach( el => storeChain(el, chainClone(_head)) );
    }
}


/**
 * 设置对象成员值。
 * 支持对象上的原生.set()接口，否则用赋值语法设置。
 * @param  {Object} to 目标对象
 * @param  {String} key 键名
 * @param  {Value} data 键值
 * @return {void}
 */
function setObj( to, key, data ) {
    $.isFunction( to.set ) ? to.set( key, data ) : to[key] = data;
}


/**
 * 在元素上显示消息。
 * 仅支持纯文本显示（非html方式）。
 * @param  {Element} el 目标元素
 * @param  {String} msg 消息文本
 * @param  {Number} long 持续时间（秒）
 * @return {void}
 */
function message( el, msg, long ) {
    if ( long > 0 ) {
        clearTimeout( el[__TIMER] );
        el[__TIMER] = setTimeout( () => $.empty(el), long * 1000 );
    }
    el.textContent = msg;
}


/**
 * 构造scroll位置对象。
 * @param  {Number|Object2|Array} pos 位置对象
 * @return {Object2}
 */
function scrollObj( pos ) {
    if ( $.type(pos) == 'Object' ) {
        return pos;
    }
    if ( typeof pos == 'number' ) {
        return { top: pos };
    }
    return { left: pos[0], top: pos[1] };
}


//
// 状态标识符。
//
const __uiState = [ '-', '', '^' ];


/**
 * PBO状态单个设置。
 * @param  {Element} el 目标元素
 * @param  {Boolean} s 状态标识
 * @param  {String} name 状态特性名
 * @return {void}
 */
function oneState( el, s, name ) {
    Util.pbo( el, [`${__uiState[ +s ]}${name}`] );
}


/**
 * PBO状态逐一设置。
 * @param  {[Element]} els 元素集
 * @param  {Boolean} s 状态标识
 * @param  {String} name 状态特性名
 * @return {void}
 */
function eachState( els, s, name ) {
    els.forEach( el => oneState( el, s, name ) );
}


/**
 * PBO状态逐一设置。
 * 值集与元素集成员一一对应。
 * @param  {[Element]} els 元素集
 * @param  {[Boolean]} ss 状态标识集
 * @param  {String} name 状态特性名
 * @return {void}
 */
function eachState2( els, ss, name ) {
    els.forEach(
        (el, i) =>
        ss[i] !== undefined && oneState( el, ss[i], name )
    );
}


/**
 * 获取操作目标。
 * rid 支持如下数字值：
 * - 1  事件起始元素（evo.target）
 * - 2  事件当前元素（evo.current）
 * - 3  事件委托元素（evo.delegate）
 * - 10 原始检索结果（evo.primary）
 * - 11 更新后的结果（evo.updated）
 * 如果rid不是字符串或合法的数字，返回rid本身（如为元素）。
 * one仅在rid传递字符串选择器时有意义。
 * @param  {String|Value} rid 目标标识，可选
 * @param  {Boolean} one 是否单元素检索，可选
 * @return {Element|Collector}
 */
function _target( evo, rid, one ) {
    switch ( +rid ) {
        case 1:  return evo.target;
        case 2:  return evo.current;
        case 3:  return evo.delegate;
        case 10: return evo.primary;
        case 11: return evo.updated;
    }
    return typeof rid === 'string' ? Util.find( rid, evo.delegate, one ) : rid;
}



//
// Update特殊指令。
///////////////////////////////////////////////////////////////////////////////


/**
 * 通过性检查。
 * 检查Update的更新值是否为真（非假）或为实参序列之一（===），
 * 结果为假会中断执行流。
 * 注：无需Cell实例，故预绑定null。
 * @data: void
 * @param  {...Value} vals 对比值集，可选
 * @return {void|reject}
 */
const pass_ =
(function pass( evo, ...vals ) {
    let _v = evo.updated

    if ( vals.length ) {
        _v = vals.includes(_v);
    }
    if ( !_v ) return Promise.reject();
})
.bind( null );

pass_[ UPDATEX ] = true;


/**
 * 流程结束。
 * 检查Update的更新值是否为真（非假）或为实参序列之一（===），
 * 结果为真会结束执行流。
 * 注：无需Cell实例，故预绑定null。
 * @data: void
 * @param  {...Value} vals 对比值集，可选
 * @return {void|reject}
 */
const end_ =
(function end( evo, ...vals ) {
    let _v = evo.updated;

    if ( vals.length ) {
        _v = vals.includes(_v);
    }
    if ( _v ) return Promise.reject();
})
.bind( null );

end_[ UPDATEX ] = true;


/**
 * 调试显示。
 * 注记：
 * 与Get.debug相同，但新建一个以设置UPDATEX标志，
 * 这在Update段指令构建时需要。
 * @param  {Stack} stack 数据栈实例
 * @param  {String|Boolean} msg 显示消息，传递false中断执行流
 * @return {void|Promise.reject}
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
debug[UPDATEX] = true;



//
// 预处理&导出。
///////////////////////////////////////////////////////////////////////////////


//
// To空间。
// 由两个子集表达。
//
const To = {
    // 不继承任何基础指令集
    Update: $.assign( {}, _Update, bindMethod ),

    // @proto: Get < Process < Control
    Next:   $.proto( $.assign({}, _Next, bindMethod), Get )
};


// 纳入集合
To.Update.pass = pass_;
To.Update.end = end_;
To.Update.debug = debug;


export { To };
