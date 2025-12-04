import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['ai.ts'],
  format: 'esm',
  dts: true,
  minify: true,
  treeshake: true,
  target: 'es2022',
  esbuildOptions(options, context) {
    options.keepNames = false;
    options.legalComments = 'none';
    options.mangleProps = /^_/;
  },
});
