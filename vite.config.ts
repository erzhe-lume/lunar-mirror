import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 官方接口不保证浏览器直连的 CORS，开发与本地预览都通过同源代理转发。
// 部署时请用 VITE_QWEN_BASE / VITE_OPENAI_BASE / VITE_ANTHROPIC_BASE /
// VITE_GEMINI_BASE / VITE_DEEPSEEK_BASE 指向自己的服务端代理。
const proxy = {
  '/api/qwen': {
    target: 'https://dashscope.aliyuncs.com',
    changeOrigin: true,
    rewrite: (path: string) =>
      path.replace(/^\/api\/qwen/, '/compatible-mode/v1'),
  },
  '/api/openai': {
    target: 'https://api.openai.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/openai/, '/v1'),
  },
  '/api/anthropic': {
    target: 'https://api.anthropic.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/anthropic/, ''),
  },
  '/api/gemini': {
    target: 'https://generativelanguage.googleapis.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/gemini/, '/v1beta'),
  },
  '/api/deepseek': {
    target: 'https://api.deepseek.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/deepseek/, '/v1'),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
