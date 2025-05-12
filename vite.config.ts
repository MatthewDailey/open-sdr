/**
 * @fileoverview Configures the Vite build process for the Open SDR project. This file defines the Vite configuration using `defineConfig`, including the React plugin with styled-jsx support and a proxy for the `/api` endpoint.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['styled-jsx/babel']
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})