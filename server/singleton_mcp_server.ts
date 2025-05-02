import type { Tool } from 'ai'
import { startClientAndGetTools } from '../command/mcp'

let tools: Record<string, Tool> | undefined

export async function getToolsLazy(): Promise<Record<string, Tool>> {
  if (tools) {
    return tools
  }
  const { tools: newTools } = await startClientAndGetTools()
  tools = newTools
  return tools
}
