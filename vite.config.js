import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Allow Cloudflare + LocalTunnel external links
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'oil-shipped-wan-vital.trycloudflare.com',
      '.trycloudflare.com',
      '.loca.lt'
    ]
  }
})

