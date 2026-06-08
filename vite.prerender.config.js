import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const project_root = fileURLToPath(new URL('.', import.meta.url))
const package_json = JSON.parse(
  readFileSync(path.join(project_root, 'package.json'), 'utf8')
)

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(project_root, './src')
    },
    extensions: ['.js', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      stylus: {
        imports: [path.resolve(project_root, './src/style/variables.styl')]
      }
    }
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(package_json.version),
    'import.meta.env.VITE_ADMIN_ID': JSON.stringify(
      process.env.VITE_ADMIN_ID || '/+10000000000'
    ),
    'import.meta.env.PROD': 'true',
    'import.meta.env.SSR': 'true',
    'import.meta.env.DEV': 'false'
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('stripe-')
        }
      }
    })
  ],
  build: {
    ssr: 'src/prerender/entry-server.js',
    outDir: 'dist/server',
    emptyOutDir: true,
    target: 'node20',
    rollupOptions: {
      output: {
        entryFileNames: 'entry-server.js',
        format: 'es'
      }
    }
  },
  ssr: {
    noExternal: ['marked', 'marked-gfm-heading-id']
  }
})
