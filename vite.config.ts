import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function versionPlugin() {
  return {
    name: 'version-plugin',
    closeBundle() {
      const version = { buildTime: Date.now() }
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/version.json'),
        JSON.stringify(version)
      )
    }
  }
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
})
