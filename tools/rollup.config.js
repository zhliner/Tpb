import { terser } from 'rollup-plugin-terser'

export default {
    input: [ 'date.js', 'ease.js', 'filter.js', 'hotkey.js', 'render.js', 'spliter.js', 'templater.js', 'tloader.js', 'util.js' ],
    output: {
        format: 'esm',
        dir: '../release/tools',
        preserveModules: true,
        sourcemapExcludeSources: true,
    },
    plugins: [ terser() ],

    // 排除上级配置文件（templater.js）
    external: [ '../config.js' ]
}
