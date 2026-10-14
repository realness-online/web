import { defineConfig as define_config } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { readFileSync as read_file_sync } from 'node:fs'
import { product_paths } from '#root/src/settings/layout.js'
import { frontend_out } from '#root/src/settings/output.js'

const project_root = file_url_to_path(new URL('.', import.meta.url))
const { app: app_root } = product_paths()
const package_json = JSON.parse(
  read_file_sync(path.join(project_root, '..', 'package.json'), 'utf8')
)

export default define_config({
  resolve: {
    alias: {
      '@': app_root
    },
    extensions: ['.js', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      stylus: {
        imports: [path.join(app_root, 'style/base-line.styl')]
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
    ssr: path.join(app_root, 'prerender/entry-server.js'),
    outDir: frontend_out('server'),
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
    noExternal: true
  }
})
