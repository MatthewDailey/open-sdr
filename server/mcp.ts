/**
 * @fileoverview A minimal Express server that provides only the MCP endpoint.
 */

import cors from 'cors'
import express from 'express'
import { SDR } from '../command/sdr'

export async function createMcpApp() {
  const app = express()

  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  app.use(express.json())

  app.all('/mcp', async (req, res) => {
    const sdr = new SDR()
    const { server, transport } = await sdr.startMcpServer()
    transport.handleRequest(req, res, req.body)
    res.on('close', () => {
      transport.close()
      server.close()
    })
  })

  return app
}

export async function startMcpServer() {
  const app = await createMcpApp()
  const port = process.env.MCP_PORT || 3000

  const server = app.listen(port, () => {
    console.log(`MCP server running at http://localhost:${port}/mcp (open-sdr config below)\n`)

    const config = {
      'open-sdr': {
        command: 'npx',
        args: ['-y', 'mcp-remote@0.1.0-0', `http://localhost:${port}/mcp`],
      },
    }
    console.log(JSON.stringify(config, null, 2))
    console.log('\nPress Ctrl+C to stop the server')
  })

  return server
}

// Allow direct execution from command line
// Using ES module compatible approach
const moduleUrl = import.meta.url
const isMainModule = moduleUrl === `file://${process.argv[1]}`

if (isMainModule) {
  startMcpServer()
}
