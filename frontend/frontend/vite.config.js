import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // atau '@vitejs/plugin-vue' kalau pakai Vue

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // sesuaikan dengan framework
  server: {
    proxy: {
      // Setiap request yang depannya '/api' akan diteruskan ke Flask
      '/api': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})