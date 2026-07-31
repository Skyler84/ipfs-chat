import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'child_process'

function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf-8' }).trim()
  } catch (e) {
    return 'unknown'
  }
}
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }]
  },
  define: {
    __GIT_HASH__: JSON.stringify(git('rev-parse HEAD'))
  }
})
