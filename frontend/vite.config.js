import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Redirecciona rutas HTML al base path de la app en desarrollo y producción.
const redirectBasePlugin = () => {
  const middleware = (req, res, next) => {
    const [pathname, queryString] = req.url.split('?')
    const query = queryString ? `?${queryString}` : ''
    const acceptsHtml = req.headers.accept?.includes('text/html')
    const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(pathname)
    const isViteInternal = pathname.startsWith('/@') || pathname.startsWith('/src/') || pathname.startsWith('/node_modules/')
    const isPublicAsset = pathname.startsWith('/icons/') || pathname === '/manifest.json' || pathname === '/sw.js' || pathname === '/vite.svg'

    if (pathname === '/lex') {
      res.writeHead(301, { Location: `/lex/${query}` })
      res.end()
      return
    }

    if (
      acceptsHtml
      && !pathname.startsWith('/lex/')
      && !hasFileExtension
      && !isViteInternal
      && !isPublicAsset
    ) {
      res.writeHead(302, { Location: `/lex${pathname === '/' ? '/' : pathname}${query}` })
      res.end()
      return
    }

    next()
  }

  return {
    name: 'redirect-base',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  base: '/lex/',
  publicDir: 'public',
  plugins: [react(), redirectBasePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      host: '192.168.100.183',
      protocol: 'ws',
      port: 5173,
    },
    proxy: {
      '/lex/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lex\/api/, '/api/v1'),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    proxy: {
      '/lex/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lex\/api/, '/api/v1'),
      },
    },
  },
})
