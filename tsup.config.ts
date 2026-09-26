import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/agent.ts', 'src/agent-tools.ts', 'src/agent-signals.ts'],
  format: 'esm',
  dts: true,
  minify: true,
  treeshake: true,
  target: 'es2022',
  // Each entry is one file. Entries import each other as siblings (./index.js)
  // rather than having shared code hoisted into hashed chunks.
  splitting: false,
  esbuildPlugins: [
    {
      name: 'sibling-entries',
      setup(build) {
        build.onResolve({filter: /^\.\/(index|agent)\.ts$/}, (args) =>
          args.kind === 'entry-point' ? undefined : {path: args.path.replace(/\.ts$/, '.js'), external: true},
        );
      },
    },
  ],
  esbuildOptions(options, context) {
    options.keepNames = false;
    options.legalComments = 'none';
    options.mangleProps = /^_/;
  },
});
