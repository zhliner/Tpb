概要
----
- 模板驱动，支持 On/By/To 三个逻辑层次；
- core.js中实现核心逻辑（解析、绑定），app.js实现App的MVC逻辑，render.js为支持节点渲染的工具（支持for|each|if|elseif|else|scope|var语法）
- 模板渲染作为一个独立的工具附件存在；


模板属性
--------
- On PB-UI

- By 板块调用（MVC）

- To 数据输出目标定义


依赖
----
    tQuery


注记
----
- 脱胎于jcEd开发过程中的一个内部框架，基于「模板驱动」设计。
- App层次包含子模板逻辑，可延迟载入，同时支持本地化。
