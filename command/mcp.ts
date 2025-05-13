/**
 * @fileoverview This file defines and starts MCP (Model Context Protocol) clients using `experimental_createMCPClient` and `StdioClientTransport` for a set of predefined commands. The `startClientAndGetTools` function creates clients, retrieves their `Tool` definitions, and returns a record of all tools, prefixed by the client name.
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { experimental_createMCPClient } from 'ai'
import { type Tool } from 'ai'
import { SDR } from './sdr'

const mcpCommands = [
  ////////////////////////////////
  // Used for the hackathon.
  // {
  //   name: 'perplexity',
  //   command: ['npx', '-y', 'server-perplexity-ask'],
  // },
  // {
  //   name: 'notion',
  //   command: ['npx', '-y', '@notionhq/notion-mcp-server'],
  // },
  // {
  //   name: 'ref-tools',
  //   command: ['npx', '-y', 'ref-tools-mcp'],
  // },
  // {
  //   name: 'firecrawl',
  //   command: ['npx', '-y', 'firecrawl-mcp'],
  // },
  ////////////////////////////////
  {
    name: 'rime',
    command: ['npx', '-y', 'rime-mcp'],
  },
  {
    name: 'open-sdr',
    command: ['npx', '-y', 'mcp-remote@0.1.0-0', 'http://localhost:3000/mcp'],
  },
]

export enum OpenSdrMode {
  REMOTE = 'remote',
  LOCAL = 'local',
}

/**
 * Starts MCP clients for the predefined commands and returns the clients and their tools.
 *
 * @returns A promise that resolves to an object containing the MCP clients and their tools.
 */
export async function startClientAndGetTools(
  openSdrMode: OpenSdrMode = OpenSdrMode.REMOTE,
): Promise<{
  tools: Record<string, Tool>
}> {
  const allTools: Record<string, Tool> = {}

  // Create a client for each MCP command
  for (const { name, command } of mcpCommands) {
    if (name === 'open-sdr' && openSdrMode !== OpenSdrMode.REMOTE) {
      continue
    }

    // Create a client with the appropriate transport
    const client = await experimental_createMCPClient({
      transport: new StdioClientTransport({
        command: command[0],
        args: command.slice(1),
        env: { ...process.env, NODE_ENV: 'development' },
      }),
    })

    const clientTools = await client.tools()

    const prefixedClientTools = Object.fromEntries(
      Object.entries(clientTools).map(([key, tool]) => [name + '_' + key, tool]),
    )
    Object.assign(allTools, prefixedClientTools)

    console.log(`Added tools from ${name}: ${Object.keys(prefixedClientTools).join(', ')}\n`)
  }

  return { tools: allTools }
}
