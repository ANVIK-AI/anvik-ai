import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@ui/components": path.resolve(__dirname, "./src/ui/components"),
      "@": path.resolve(__dirname, "src"),
    },
  },
})