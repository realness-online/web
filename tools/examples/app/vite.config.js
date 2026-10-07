import { defineConfig as define_config } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative base so the build works from any folder, including /s/<id>/.
export default define_config({ base: './', plugins: [vue()] })
