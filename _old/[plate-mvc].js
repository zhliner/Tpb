/* $Id: sample.js 2013.06.17 [App].Plate $
*******************************************************************************
			Copyright (c) 黔原小屋 2015 - 2017 GNU LGPL

				@Project: jcEd v0.5.1
				@Author:  风林子 zhliner@gmail.com
*******************************************************************************

	板块的4分层逻辑。

	Entry
	- 响应用户事件，收集数据，进行一些原始的处理；
	- 直接用返回值的方式传递数据，不提供异步能力；
	- 定义是可选的，未定义时原流程数据直接向Control层传递；
	- 如果此处有定义但无返回值（undefined），表示终止流程；
	- this绑定为targets.current元素：
	  委托时：	委托匹配元素；
	  非委托时：	绑定事件的元素；

	Control
	- 综合性杂项事务，比如一些全局状态或浏览器本地存储；
	- 通过承诺对象回调传递数据，因此支持异步操作；
	- 定义是可选的，未定义时前阶数据直接向Model层传递；
	- this绑定为Control集合自身；

	Model
	- 业务逻辑的处理。一般在此与服务器进行数据交互；
	- 与Control相同，通过承诺对象回调传递数据；
	- 定义是可选的，未定义时前阶数据向后续传至Update；
	- this绑定为Model集合自身；

	Update
	- 处理模型层来的数据，一般为节点渲染；
	- 仅提供渲染后的数据，具体更新方式由模板层定义（To）；
	- 定义可选，未定义时原数据自动处理（直接用于To更新）；
	- this绑定为Update集合自身；

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function( $, X ) {


//-- 入口参数 -------------------------------------------------------------
// => Control
// 入口数据控制，可选。
// - 主要为提取用户数据，处理后递送给控制层。
// - this已绑定为事件当前元素（targets.current）；
// - 如果此处无定义或为null，原流程数据直接向后续传；
// - 若定义后无返回值，则会终止执行流；
//
// @param  {Event} ev 原生事件对象
// @param  {Array|null} args 模板中的参数序列
// @param  {Mixed} data 流程数据（PB-On）
// @return {Mixed} 结果参数
//
X.Entry = {
	/**
	 * 示例
	 */
	handle( ev, args, data ) {
		// return ...;
	},

};



//-- 本地控制 ---------------------------------------------------------------
// View =>
// 综合性事务处理。可选。
// - 如果未定义或设为null，原参数向后续传；
// - this为父对象本身（Control）；
//
// @param {Mixed} args 入口层来的参数
// @param {Function} resolve 成功回调
// @param {Function} reject  失败回调
X.Control = {
	/**
	 * 示例
	 */
	handle( args, resolve, reject ) {
		// resolve(data); 成功
		// reject(error); 失败
	},

};



//-- 模型逻辑 -------------------------------------------------------------
// Control =>
// 具体的业务处理。
// - 若此处无定义（通常不会），跳过执行；
// - this为父对象本身（Model）；
//
// @param {Mixed} data 控制层来的数据
// @param {Function} resolve 成功回调
// @param {Function} reject  失败回调
//
X.Model = {
	/**
	 * 示例
	 */
	handle( data, resolve, reject ) {
		// resolve(dict); 成功
		// reject(error); 失败
	},

};



//-- UI更新 ---------------------------------------------------------------
// Model =>
// 节点渲染更新。
// - 如果未定义，模型数据直接向后传递；
// - this为父对象本身（Update）；
//
// @param {Mixed} dict 模型层来的数据
// @param {Function} resolve 成功回调
// @param {Function} reject  失败回调
//

// 基本工具。
const
	Render  = Tpb.Render,
	tplNode = name => T.Config.Templater.get(name);


X.Update = {
	/**
	 * 示例
	 */
	handle( dict, resolve, reject ) {
		// resolve(value); 成功
		// reject(error); 失败
	},

};


})( tQuery, jcEd.Plate.Sample = {} );