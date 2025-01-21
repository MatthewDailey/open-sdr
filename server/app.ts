/**
 * @fileoverview Sets up an Express server with CORS, JSON parsing, and a ping endpoint. Serves either the Vite development server or static production files.
 */

import express from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'

export async function createApp() {
  const app = express()
  const isDev = process.env.NODE_ENV !== 'production'
  console.log('isDev', isDev)

  app.use('/api', cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  app.use(express.json())

  app.get('/api/ping', (req, res) => {
    console.log('Received ping.')
    return res.send('pong')
  })

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
    app.get('*', (req, res, next) => {
      if (!req.url.startsWith('/api')) {
        vite.middlewares(req, res, next)
      } else {
        next()
      }
    })
  } else {
    app.use(express.static('dist'))
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: './dist' })
    })
  }

  return app
}
