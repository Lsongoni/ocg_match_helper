import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    injectRegister: null,
    includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
    manifest: {
      id: base,
      name: 'OCG 比赛助手',
      short_name: 'OCG 助手',
      description: '离线记录游戏王 OCG 比赛、模拟瑞士轮并生成战报',
      lang: 'zh-CN',
      start_url: base,
      scope: base,
      display: 'standalone',
      background_color: '#f6f7f3',
      theme_color: '#214d38',
      icons: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      navigateFallback: `${base}index.html`,
      cleanupOutdatedCaches: true,
    },
  })],
  base,
})
