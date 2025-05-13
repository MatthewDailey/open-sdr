/**
 * @fileoverview This file contains the logic for running the SDR agent loop
 * with a prompt.
 */

import chalk from 'chalk'
import { doAgentLoop } from './agent'
import { startClientAndGetTools } from './mcp'

/**
 * Runs the SDR agent with the provided prompt
 * @param prompt The prompt to send to the AI agent
 */
export async function runSdrAgent(prompt: string): Promise<void> {
  try {
    // Load MCP tools before starting the agent loop
    console.log('Loading MCP tools...')
    const { tools } = await startClientAndGetTools()
    console.log('MCP tools loaded successfully.')

    await doAgentLoop(
      prompt,
      (step) => {
        // Handle tool calls with a nice representation
        if (step.toolCalls.length > 0) {
          for (let i = 0; i < step.toolCalls.length; i++) {
            const toolCall = step.toolCalls[i]
            const toolResult = step.toolResults[i]
            console.log(chalk.yellow('\n====== ' + toolCall.toolName + ' ======'))
            for (const [key, value] of Object.entries(toolCall.args)) {
              console.log(chalk.yellow(`${key}: ${value}`))
            }
            console.log(chalk.yellow('\n======  Result  ======'))
            console.log(chalk.yellow(JSON.stringify(toolResult, null, 2)))
            console.log(chalk.yellow('=======================\n'))
          }
        }
      },
      (chunk) => {
        // Stream text to console in green
        process.stdout.write(chalk.green(chunk))
      },
      tools, // Pass the MCP tools to the agent loop
    )
    console.log('\n') // Add a newline after completion
  } catch (error) {
    console.error(chalk.red('Error running SDR agent:'), error)
    process.exit(1)
  }
}
