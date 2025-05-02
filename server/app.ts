/**
 * @fileoverview Sets up an Express server with CORS, JSON parsing, and a ping endpoint. Serves either the Vite development server or static production files.
 */

import express from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'
import { doAgentLoop } from '../command/agent'
import { SDR } from '../command/linkedin'

export async function createApp() {
  const app = express()
  const isDev = process.env.NODE_ENV !== 'production'
  console.log('isDev', isDev)

  app.use(
    '/api',
    cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  app.use(express.json())

  app.get('/api/ping', (req, res) => {
    console.log('Received ping.')
    return res.send('pong')
  })

  app.all('/api/mcp', async (req, res) => {
    const sdr = new SDR()
    const { server, transport } = await sdr.startMcpServer()
    transport.handleRequest(req, res, req.body)
    res.on('close', () => {
      transport.close()
      server.close()
    })
  })

  // Chat endpoint with SSE for streaming responses
  app.get('/api/chat', (req, res) => {
    const prompt = req.query.prompt as string

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Function to send SSE events
    const sendEvent = (eventType: string, data: any) => {
      res.write(`event: ${eventType}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // Tool tracking
    const toolCalls = new Map<string, any>()

    // Run the agent loop
    doAgentLoop(
      prompt,
      // onStep callback - handle tool calls and results
      (step) => {
        console.log('Agent step:', step.status)

        if (step.status === 'thinking') {
          sendEvent('message', {
            type: 'text',
            content: '🤔 Thinking...',
          })
        }

        if (step.status === 'tool_call') {
          const toolCall = {
            tool: step.toolCall.name,
            args: step.toolCall.args,
          }

          // Store the tool call for later reference
          toolCalls.set(step.id, toolCall)

          sendEvent('message', {
            type: 'tool_call',
            content: `Calling tool: ${step.toolCall.name}`,
            toolCall,
          })
        }

        if (step.status === 'tool_result') {
          // Update the stored tool call with the result
          const toolCall = toolCalls.get(step.id)
          if (toolCall) {
            toolCall.result = step.result

            sendEvent('message', {
              type: 'tool_result',
              content: `Got result from tool: ${toolCall.tool}`,
              toolCall,
            })
          }
        }
      },
      // onTextChunk callback - stream text as it's generated
      (chunk) => {
        sendEvent('message', {
          type: 'text',
          content: chunk,
        })
      },
    )
      .then(() => {
        // Send done event when complete
        sendEvent('done', { complete: true })
        res.end()
      })
      .catch((error) => {
        console.error('Error in agent loop:', error)
        sendEvent('error', { error: error.message })
        res.end()
      })
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
