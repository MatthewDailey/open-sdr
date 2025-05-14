/**
 * @fileoverview This file defines and starts MCP (Model Context Protocol) clients using `experimental_createMCPClient` and `StdioClientTransport` for a set of predefined commands. The `startClientAndGetTools` function creates clients, retrieves their `Tool` definitions, and returns a record of all tools, prefixed by the client name.
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { experimental_createMCPClient, type Tool } from 'ai'

const mcpCommands: { name: string; command: string[]; env?: Record<string, string> }[] = [
  {
    name: 'rime',
    command: ['npx', '-y', 'rime-mcp'],
  },
  // Add more MCP server commands here.
]

/**
 * Starts MCP clients for the predefined commands and returns the clients and their tools.
 *
 * @returns A promise that resolves to an object containing the MCP clients and their tools.
 */
export async function startClientAndGetTools(): Promise<{
  tools: Record<string, Tool>
}> {
  const allTools: Record<string, Tool> = {}

  // Create a client for each MCP command
  for (const { name, command, env } of mcpCommands) {
    const baseEnv = { ...process.env, NODE_ENV: 'development' }

    // Create a client with the appropriate transport
    const client = await experimental_createMCPClient({
      transport: new StdioClientTransport({
        command: command[0],
        args: command.slice(1),
        env: env ? { ...baseEnv, ...env } : baseEnv,
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
