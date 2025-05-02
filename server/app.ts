/**
 * @fileoverview Sets up an Express server with CORS, JSON parsing, and a ping endpoint. Serves either the Vite development server or static production files.
 */

import express from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'
import { doAgentLoop } from '../command/agent'
import { SDR } from '../command/linkedin'
import { startClientAndGetTools } from '../command/mcp'
import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import { validateWorkflow } from './validate_workflow'
import { getToolsLazy } from './singleton_mcp_server'

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

  app.get('/api/workflows', (req, res) => {
    try {
      const workflowsPath = path.resolve(process.cwd(), 'workflows.yml')
      const fileContents = fs.readFileSync(workflowsPath, 'utf8')
      const workflows = yaml.load(fileContents)
      return res.json(workflows)
    } catch (error) {
      console.error('Error reading workflows:', error)
      return res.status(500).json({ error: 'Failed to read workflows file' })
    }
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

  app.post('/api/validate_workflow', async (req, res) => {
    try {
      const workflow = req.body

      if (!workflow) {
        return res.status(400).json({ error: 'Workflow is required' })
      }
      const validationResult = await validateWorkflow(workflow, await getToolsLazy())

      return res.json(validationResult)
    } catch (error) {
      console.error('Error validating workflow:', error)
      return res.status(500).json({
        error: 'Failed to validate workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Chat endpoint with SSE for streaming responses
  app.get('/api/chat', async (req, res) => {
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

    const toolCalls = new Map<string, any>()

    doAgentLoop(
      prompt,
      (step) => {
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (let i = 0; i < step.toolCalls.length; i++) {
            const toolCall = step.toolCalls[i]
            const toolResult = step.toolResults ? step.toolResults[i] : null

            const toolCallObj = {
              tool: toolCall.toolName,
              args: toolCall.args,
              result: toolResult,
            }

            toolCalls.set(toolCall.toolCallId, toolCallObj)

            sendEvent('message', {
              type: 'tool_call',
              content: `Calling tool: ${toolCall.toolName}`,
              toolCall: toolCallObj,
            })

            if (toolResult) {
              sendEvent('message', {
                type: 'tool_result',
                content: `Got result from tool: ${toolCall.toolName}`,
                toolCall: toolCallObj,
              })
            }
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
      await getToolsLazy(),
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
