import { babel } from '@rollup/plugin-babel'
import cleanup from 'rollup-plugin-cleanup'
import { terser } from 'rollup-plugin-terser'

const config = {
  input: 'src/index.js',
  output: {
    format: 'esm',
    file: 'dist/bundle.js',
    plugins: [terser()],
  },
  plugins: [
    babel({ babelHelpers: 'bundled' }),
    cleanup(),
  ],
}

export default config
