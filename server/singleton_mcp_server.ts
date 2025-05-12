/**
 * @fileoverview Provides a singleton instance of the MCP (Managed Component Platform) tools. Uses `startClientAndGetTools` to lazily initialize and cache the `tools` object, which is a `Record<string, Tool>`. The `getToolsLazy` function returns the cached tools.
 */

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
