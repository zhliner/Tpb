import { terser } from 'rollup-plugin-terser'

export default {
    input: 'tpb.js',
    output: {
        file: '../articlejs/base/tpb/tpb.min.js',
        format: 'esm',
        banner: '/*! Tpb/tQuery v0.4.0 | (c) zhliner@gmail.com 2021.10.26 | MIT License */',
        sourcemapExcludeSources: true,
    },
    plugins: [
        terser()
    ],
    // 排除工具集和配置文件捆绑。
    external: [
        './config.js',
        /\/tools\/\w+\.js/,
    ],
}
