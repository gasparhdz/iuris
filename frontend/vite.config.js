import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Redirige bookmarks viejos (/lex, /iuris) a la raíz.
const legacyRedirectPlugin = () => {
  const middleware = (req, res, next) => {
    const [pathname, queryString] = req.url.split('?')
    const query = queryString ? `?${queryString}` : ''

    if (pathname === '/lex' || pathname === '/lex/') {
      res.writeHead(301, { Location: `/${query}` })
      res.end()
      return
    }

    if (pathname.startsWith('/lex/')) {
      res.writeHead(301, { Location: `/${pathname.slice('/lex/'.length)}${query}` })
      res.end()
      return
    }

    if (pathname === '/iuris' || pathname === '/iuris/') {
      res.writeHead(301, { Location: `/${query}` })
      res.end()
      return
    }

    if (pathname.startsWith('/iuris/')) {
      res.writeHead(301, { Location: `/${pathname.slice('/iuris/'.length)}${query}` })
      res.end()
      return
    }

    next()
  }

  return {
    name: 'legacy-redirect',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  base: '/',
  publicDir: 'public',
  plugins: [react(), legacyRedirectPlugin()],
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
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
})
