import { playwrightLauncher } from '@web/test-runner-playwright'
import { esbuildPlugin } from '@web/dev-server-esbuild'
import { specReporter } from './test/spec-reporter.mjs'

export default {
  files: 'test/**/*.test.ts',
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  plugins: [esbuildPlugin({ ts: true })],
  reporters: [specReporter()],
  testFramework: {
    config: {
      reporter: 'spec',
    },
  },
}
