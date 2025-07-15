import { exec } from 'child_process'
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  entry: {
    index: './src/index.ts',
  },
  format: ['esm'],
  dts: false,
  clean: !options.watch,
  treeshake: true,
  splitting: true,
  external: ['react', 'react-dom', '@solana/web3.js'],
  target: 'es6',
  cjsInterop: true,
  onSuccess: async () => {
    exec('tsc --emitDeclarationOnly --declaration', (err, stdout) => {
      if (err) {
        console.error(stdout)
        if (!options.watch) {
          process.exit(1)
        }
      }
    })
  },
}))
