import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 8090,
    cors: true,
    https: {
      key: './localhost-key.pem',
      cert: './localhost.pem',
    },
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: './src/index.ts',
      name: 'Functional Element',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      output: {
        preserveModules: false
      }
    }
  }
})
