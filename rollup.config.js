import { babel } from '@rollup/plugin-babel'
import cleanup from 'rollup-plugin-cleanup'
import { terser } from 'rollup-plugin-terser'
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';

const minifiedOutputs = [
  {
    file: pkg.exports['.'].import,
    format: 'esm',
    plugins: [
      terser({ format: { comments: false } }),
    ],
  },
  {
    file: pkg.exports['.'].require,
    format: 'cjs',
    plugins: [
      terser({ format: { comments: false } }),
    ],
  },
];

const unMinifiedOutputs = minifiedOutputs.map(({ file, ...rest }) => ({
  ...rest,
  file: file.replace('.min.', '.'),
}));

const config = {
  input: './src/index.ts',
  output: [...unMinifiedOutputs, ...minifiedOutputs],
  plugins: [
    typescript({
      tsconfig: false,
      target: "es2019",
      rootDir: './src',
      include: ['**/*'],
      outDir: './dist',
      module: "esnext",
      declaration: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true
    }),
    babel({ babelHelpers: 'bundled' }),
    cleanup(),
  ],
}

export default config
