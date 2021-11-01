/* $Id: easing.js 2017.03.16 Tpb.Libs $
*******************************************************************************
			Copyright (c) 铁皮工作室 2017 MIT License

				@Project: Tpb v0.3.1
				@Author:  风林子 zhliner@gmail.com
*******************************************************************************

	缓动函数库。

	from jQuery.easing.1.3:
	Open source under the BSD License.
	Copyright © 2008 George McGinley Smith
	http://gsgd.co.uk/sandbox/jquery/easing/


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function( T ) {

//
// 注：X轴为迭代次数（时间），Y轴为曲线比值（0-1）。
// 注记：
// - 去掉了引用原代码中的b和c参数，b可外部处理，c固定为1；
// - b：初始基数值，c：变化量；
//
const Easings = {
	/**
	 * 库扩展。
	 * - 不可覆盖，重名会简单提示并跳过；
	 * - 缓动效果名仅3种：In/Out/InOut，注意参数约定；
	 * - 类名一般首字母大写；
	 * @param  {String} kind 缓动类名
	 * @param  {Object} fns3 缓动3阶函数定义{In, Out, InOut}
	 * @return {this}
	 */
	extend( kind, fns3 ) {
		if (!this[kind]) {
			return this[kind] = fns3, this;
		}
		console.warn(`${kind} easing already exists.`);
	},


	//-- 算法集 ---------------------------------------------------------------
	// 参数约定：
	// @param  {Number} t 当前计次
	// @param  {Number} d 迭代总次数
	// @return {Number} 当前点曲线比值（Y, 0-1），浮点数


	Linear: {
		In: ( t, d ) => t/d,
	},

	Quad: {
		In( t, d ) {
			return (t /= d) * t;
		},

		Out( t, d ) {
			return -(t /= d) * (t - 2);
		},

		InOut( t, d ) {
			if ( (t /= d/2 ) < 1) {
				return 0.5 * t * t;
			}
			return -0.5 * ( (--t) * (t-2) - 1 );
		},
	},

	Cubic: {
		In( t, d ) {
			return (t /= d) * t*t;
		},
		Out( t, d ) {
			return (t = t/d - 1) * t*t + 1;
		},
		InOut( t, d ) {
			if ( (t /= d/2 ) < 1 ) {
				return 0.5 * t*t*t;
			}
			return 0.5 * ( (t-=2) * t*t + 2 );
		},
	},

	Quart: {
		In( t, d ) {
			return (t /= d) * t*t*t;
		},

		Out( t, d ) {
			return -( (t = t/d - 1) * t*t*t - 1 );
		},

		InOut( t, d ) {
			if ( (t /= d/2) < 1 ){
				return 0.5 * t*t*t*t;
			}
			return -0.5 * ( (t-=2) * t*t*t - 2 );
		},
	},

	Quint: {
		In( t, d ) {
			return (t /= d) * t*t*t* t;
		},

		Out( t, d ) {
			return (t = t/d - 1) * t*t*t*t + 1;
		},

		InOut( t, d ) {
			if ( (t /= d/2 ) < 1 ) {
				return 0.5 * t*t*t*t*t;
			}
			return 0.5 * ( (t-=2) * t*t*t*t + 2 );
		},
	},

	Sine: {
		In( t, d ) {
			return -Math.cos( t/d * (Math.PI/2) ) + 1;
		},

		Out( t, d ) {
			return Math.sin( t/d * (Math.PI/2) );
		},

		InOut( t, d ) {
			return -0.5 * ( Math.cos( Math.PI*t/d ) - 1 );
		},
	},

	Expo: {
		In( t, d ) {
			return (t === 0) ? 0 : Math.pow( 2, 10 * (t/d - 1) );
		},

		Out( t, d ) {
			return (t == d) ? 1 : (-Math.pow( 2, -10 * t/d ) + 1);
		},

		InOut( t, d ) {
			if (t === 0) return 0;
			if (t == d) return 1;

			if ( (t /= d/2) < 1 ) {
				return 0.5 * Math.pow( 2, 10 * (t - 1) );
			}
			return 0.5 * (-Math.pow( 2, -10 * --t ) + 2);
		},
	},

	Circ: {
		In( t, d ) {
			return -( Math.sqrt(1 - (t/=d)*t) - 1 );
		},

		Out( t, d ) {
			return Math.sqrt( 1 - (t = t/d -1) * t );
		},

		InOut( t, d ) {
			if ( (t /= d/2) < 1 ) {
				return -0.5 * (Math.sqrt(1 - t*t) - 1);
			}
			return 0.5 * (Math.sqrt(1 - (t-=2)*t) + 1);
		},
	},

	Elastic: {
		In( t, d, s = 1.70158, a = 1, p = 0 ) {
			if (t === 0) return 0;
			if ((t /= d) == 1) return 1;
			if (!p) {
				p = d * 0.3;
			}
			if (a < 1) {
				a = 1;
				s = p/4;
			} else {
				s = p/(2*Math.PI) * Math.asin(1/a);
			}
			return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p ));
		},

		Out( t, d, s = 1.70158, a = 1, p = 0 ) {
			if (t === 0) return 0;
			if ((t /= d) == 1) return 1;
			if (!p) {
				p = d * 0.3;
			}
			if (a < 1) {
				a = 1;
				s = p/4;
			} else {
				s = p/(2*Math.PI) * Math.asin (1/a);
			}
			return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + 1;
		},

		InOut( t, d, s = 1.70158, a = 1, p = 0 ) {
			if (t === 0) return 0;
			if ((t /= d/2) == 2) return 1;
			if (!p) {
				p = d * (0.3*1.5);
			}
			if (a < 1) {
				a = 1;
				s = p/4;
			} else {
				s = p/(2*Math.PI) * Math.asin (1/a);
			}
			if (t < 1) {
				return -0.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p ));
			}
			return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*0.5 + 1;
		},
	},

	Back: {
		In( t, d , s = 1.70158) {
			return (t/=d) * t * ((s+1)*t - s);
		},

		Out( t, d , s = 1.70158) {
			return (t=t/d-1) * t * ((s+1)*t + s) + 1;
		},

		InOut( t, d , s = 1.70158) {
			if ((t/=d/2) < 1) {
				return 0.5 * (t*t*(((s *= 1.525) + 1)*t - s));
			}
			return 0.5 * ((t -= 2) *t* (((s *= 1.525) + 1)*t + s) + 2);
		},
	},

	Bounce: {
		In( t, d ) {
			return 1 - Easings.Bounce.Out( d-t, d );
		},

		Out( t, d ) {
			if ( (t/=d) < (1/2.75) ) {
				return 7.5625 * t*t;
			}
			else if ( t < (2/2.75) ) {
				return 7.5625 * ( t -= (1.5/2.75) )*t + 0.75;
			}
			else if ( t < (2.5/2.75) ) {
				return 7.5625 * ( t -= (2.25/2.75) )*t + 0.9375;
			}
			else {
				return 7.5625 * ( t -= (2.625/2.75) )*t + 0.984375;
			}
		},

		InOut( t, d ) {
			if (t < d/2) {
				return Easings.Bounce.In( t*2, d ) * 0.5;
			}
			return Easings.Bounce.Out( t*2-d, d )*0.5 + 0.5;
		}
	},

};


//
// Expose
///////////////////////////////////////////////////////////////////////////////

T.Easing = Easings;


})( Tpb );