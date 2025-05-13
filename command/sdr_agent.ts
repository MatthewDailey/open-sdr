/**
 * @fileoverview This file contains the logic for running the SDR agent loop
 * with a prompt.
 */

import chalk from 'chalk'
import { doAgentLoop } from './agent'
import { startClientAndGetTools } from './mcp'
import { GoogleAI } from './google'
import { z } from 'zod'

/**
 * Runs the SDR agent with the provided prompt
 * @param prompt The prompt to send to the AI agent
 */
export async function runSdrAgent(prompt: string): Promise<void> {
  try {
    console.log('Loading MCP tools...')
    const { tools } = await startClientAndGetTools()
    console.log('MCP tools loaded successfully.')

    await doAgentLoop(
      {
        system: 'You are a helpful assistant that can use tools to help the user.',
        user: prompt,
      },
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

export async function runSdrAgentOnEachCompany(prompt: string) {
  const { companies, task } = await getCompaniesAndTask(prompt)
  for (const company of companies) {
    await runSdrAgent(`\n\nCompany: ${company}\n\nTask: ${task}`)
  }
}

async function getCompaniesAndTask(prompt: string): Promise<{ companies: string[]; task: string }> {
  try {
    // Create a new instance of GoogleAI
    const googleAI = new GoogleAI()

    // Define the schema for extracting companies and task
    const schema = z.object({
      companies: z.array(z.string().min(1)).min(1),
      task: z.string().min(1),
    })

    // Extract companies and task from the prompt
    const result = await googleAI.generateStructuredData(
      `Extract the list of companies and the main task from the following prompt. Make the task as specific as possible.
      If no companies are explicitly mentioned, return an empty array.
      
      Prompt: ${prompt}`,
      schema,
    )

    return result
  } catch (error) {
    console.error('Error extracting companies and task:', error)
    // Return empty defaults in case of error
    return { companies: [], task: '' }
  }
}
