import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { experimental_createMCPClient } from 'ai'
import { type Tool } from 'ai'

const mcpCommands = [
  {
    name: 'perplexity',
    command: ['npx', '-y', 'server-perplexity-ask'],
  },
  {
    name: 'notion',
    command: ['npx', '-y', '@notionhq/notion-mcp-server'],
  },
  {
    name: 'apify-web-scraper',
    command: ['npx', '-y', '@apify/actors-mcp-server', '--actors', 'apify/web-scraper'],
  },
  // {
  //   name: 'ref-tools',
  //   command: ['npx', '-y', 'ref-tools-mcp'],
  // },
  {
    name: 'rime',
    command: ['npx', '-y', 'rime-mcp'],
  },
  {
    name: 'open-sdr',
    command: ['npx', '-y', 'mcp-remote@0.1.0-0', 'http://localhost:3000/api/mcp'],
  },
]

/**
 * Starts MCP clients for the predefined commands and returns the clients and their tools.
 *
 * @returns A promise that resolves to an object containing the MCP clients and their tools.
 */
export async function startClientAndGetTools(): Promise<{
  tools: Record<string, Tool>
}> {
  console.log('Starting MCP clients...')

  const allTools: Record<string, Tool> = {}

  // Create a client for each MCP command
  for (const { name, command } of mcpCommands) {
    console.log(`-> ${name}`)

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
      Object.entries(clientTools).map(([key, tool]) => [name + '::' + key, tool]),
    )
    Object.assign(allTools, prefixedClientTools)

    console.log(`Added tools from ${name}: ${Object.keys(prefixedClientTools).join(', ')}`)
  }

  console.log('All MCP clients ready.')
  console.log('Available MCP tools:', Object.keys(allTools).join(', '))

  return { tools: allTools }
}
