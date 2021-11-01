// $ID: ease.js 2020.09.14 Tpb.Tools $
// +++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2020 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  缓动器
//
//  用于动画中获取特定缓动曲线的当前值。
//
//  启动事件：
//  - 创建并初始化一个缓动实例。
//  - 创建循环入口（PB:entry）。
//  - 提取缓动实例，如果存在则继续。
//  - 提取当前值，执行相关的计算。
//  - 对目标实施改变。
//  - 流程重入（PB:loop => PB:entry）。
//
//  干扰事件：
//  - 提取目标缓动实例。
//  - 重置计数值或设置相关标识。
//
//  终止事件：
//  - 移除目标缓动实例。
//
//  注记：
//  每一个缓动器需要记录状态，因此需要作为单独的实例存在。
//
//
///////////////////////////////////////////////////////////////////////////////
//

export class Ease {
    /**
     * @param {String} name 缓动名（如 Cubic）
     * @param {String} kind 缓动方式（如 InOut）
     * @param {Number} total 迭代总次数
     */
    constructor( name, kind, total ) {
        let _o = Easings[name];

        this._total = total;
        this._count = 0;
        this._call = _o[kind].bind(_o);
    }


    /**
     * 返回当前的比率值。
     * @return {Number}
     */
    value() {
        let _v = this._call(
            this._count++,
            this._total
        )
        this._count %= this._total;
        return _v;
    }


    /**
     * 获取/重置总迭代次数。
     * 提供一种中途改变基数的能力。
     * @param  {Number} n 总迭代次数，可选
     * @return {Number}
     */
    total( n ) {
        if ( n === undefined ) {
            return this._total;
        }
        this._total = n;
    }
}


//
// From jQuery.easing 1.3:
// Open source under the BSD License.
// Copyright © 2008 George McGinley Smith
// http://gsgd.co.uk/sandbox/jquery/easing/
//
// X轴为迭代次数（时间），Y轴为曲线比值（0-1）。
//
// @param  {Number} t 当前计次
// @param  {Number} d 迭代总次数
// @return {Number} 当前点曲线比值（Y, 0-1），浮点数
//
// 注记：
// 去掉了引用原代码中的b和c参数，b可外部处理，c固定为 1。
// b：初始基数值
// c：变化量
//
//////////////////////////////////////////////////////////////////////////////

const Easings = {

    Linear: {
        In(t, d) {
            return t / d;
        }
    },

    Quad: {
        In(t, d) {
            return (t /= d) * t;
        },

        Out(t, d) {
            return -(t /= d) * (t - 2);
        },

        InOut(t, d) {
            if ((t /= d / 2) < 1) {
                return 0.5 * t * t;
            }
            return -0.5 * ((--t) * (t - 2) - 1);
        },
    },

    Cubic: {
        In(t, d) {
            return (t /= d) * t * t;
        },
        Out(t, d) {
            return (t = t / d - 1) * t * t + 1;
        },
        InOut(t, d) {
            if ((t /= d / 2) < 1) {
                return 0.5 * t * t * t;
            }
            return 0.5 * ((t -= 2) * t * t + 2);
        },
    },

    Quart: {
        In(t, d) {
            return (t /= d) * t * t * t;
        },

        Out(t, d) {
            return -((t = t / d - 1) * t * t * t - 1);
        },

        InOut(t, d) {
            if ((t /= d / 2) < 1) {
                return 0.5 * t * t * t * t;
            }
            return -0.5 * ((t -= 2) * t * t * t - 2);
        },
    },

    Quint: {
        In(t, d) {
            return (t /= d) * t * t * t * t;
        },

        Out(t, d) {
            return (t = t / d - 1) * t * t * t * t + 1;
        },

        InOut(t, d) {
            if ((t /= d / 2) < 1) {
                return 0.5 * t * t * t * t * t;
            }
            return 0.5 * ((t -= 2) * t * t * t * t + 2);
        },
    },

    Sine: {
        In(t, d) {
            return -Math.cos(t / d * (Math.PI / 2)) + 1;
        },

        Out(t, d) {
            return Math.sin(t / d * (Math.PI / 2));
        },

        InOut(t, d) {
            return -0.5 * (Math.cos(Math.PI * t / d) - 1);
        },
    },

    Expo: {
        In(t, d) {
            return (t === 0) ? 0 : Math.pow(2, 10 * (t / d - 1));
        },

        Out(t, d) {
            return (t == d) ? 1 : (-Math.pow(2, -10 * t / d) + 1);
        },

        InOut(t, d) {
            if (t === 0) return 0;
            if (t == d) return 1;

            if ((t /= d / 2) < 1) {
                return 0.5 * Math.pow(2, 10 * (t - 1));
            }
            return 0.5 * (-Math.pow(2, -10 * --t) + 2);
        },
    },

    Circ: {
        In(t, d) {
            return -(Math.sqrt(1 - (t /= d) * t) - 1);
        },

        Out(t, d) {
            return Math.sqrt(1 - (t = t / d - 1) * t);
        },

        InOut(t, d) {
            if ((t /= d / 2) < 1) {
                return -0.5 * (Math.sqrt(1 - t * t) - 1);
            }
            return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
        },
    },

    Elastic: {
        In(t, d, s = 1.70158, a = 1, p = 0) {
            if (t === 0) return 0;
            if ((t /= d) == 1) return 1;
            if (!p) {
                p = d * 0.3;
            }
            if (a < 1) {
                a = 1;
                s = p / 4;
            } else {
                s = p / (2 * Math.PI) * Math.asin(1 / a);
            }
            return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p));
        },

        Out(t, d, s = 1.70158, a = 1, p = 0) {
            if (t === 0) return 0;
            if ((t /= d) == 1) return 1;
            if (!p) {
                p = d * 0.3;
            }
            if (a < 1) {
                a = 1;
                s = p / 4;
            } else {
                s = p / (2 * Math.PI) * Math.asin(1 / a);
            }
            return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + 1;
        },

        InOut(t, d, s = 1.70158, a = 1, p = 0) {
            if (t === 0) return 0;
            if ((t /= d / 2) == 2) return 1;
            if (!p) {
                p = d * (0.3 * 1.5);
            }
            if (a < 1) {
                a = 1;
                s = p / 4;
            } else {
                s = p / (2 * Math.PI) * Math.asin(1 / a);
            }
            if (t < 1) {
                return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p));
            }
            return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * 0.5 + 1;
        },
    },

    Back: {
        In(t, d, s = 1.70158) {
            return (t /= d) * t * ((s + 1) * t - s);
        },

        Out(t, d, s = 1.70158) {
            return (t = t / d - 1) * t * ((s + 1) * t + s) + 1;
        },

        InOut(t, d, s = 1.70158) {
            if ((t /= d / 2) < 1) {
                return 0.5 * (t * t * (((s *= 1.525) + 1) * t - s));
            }
            return 0.5 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2);
        },
    },

    Bounce: {
        In(t, d) {
            return 1 - this.Out(d - t, d);
        },

        Out(t, d) {
            if ((t /= d) < (1 / 2.75)) {
                return 7.5625 * t * t;
            }
            else if (t < (2 / 2.75)) {
                return 7.5625 * (t -= (1.5 / 2.75)) * t + 0.75;
            }
            else if (t < (2.5 / 2.75)) {
                return 7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375;
            }
            else {
                return 7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375;
            }
        },

        InOut(t, d) {
            if (t < d / 2) {
                return this.In(t * 2, d) * 0.5;
            }
            return this.Out(t * 2 - d, d) * 0.5 + 0.5;
        }
    },
};
