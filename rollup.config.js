import { terser } from 'rollup-plugin-terser'

export default {
    input: 'tpb.js',
    output: {
        file: '../articlejs/base/tpb/tpb.esm.js',
        format: 'esm',
        banner: '/*! Tpb/tQuery v0.4.1 | (c) zhliner@gmail.com 2021.12.05 | MIT License */',
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
