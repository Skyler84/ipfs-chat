import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }]
  },
  build: {
    minify: false,
    sourcemap: true,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // One chunk per package
            return id
              .split("node_modules/")[1]
              .split("/")[0];
          }
        },

        compact: false,
      },
    },
    minify: false,
    sourcemap: true,
    commonjsOptions: {
      sourcemap: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // One chunk per package
            return id
              .split("node_modules/")[1]
              .split("/")[0];
          }
        },
        preserveModules: true,

        compact: false,
      },
    },
  },
})
