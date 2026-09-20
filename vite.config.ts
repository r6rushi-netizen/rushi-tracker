import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', 
      devOptions: {
        enabled: true 
      },
      manifest: {
        name: 'Rushi Tracker',
        short_name: 'Rushi',
        description: 'Cardio, Yoga & Meditation Tracker',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg', // आपण इथे आधीपासून असलेला डिफॉल्ट लोगो वापरत आहोत
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})