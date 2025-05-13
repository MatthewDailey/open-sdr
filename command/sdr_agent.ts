/**
 * @fileoverview This file contains the logic for running the SDR agent loop
 * with a prompt.
 */

import chalk from 'chalk'
import { doAgentLoop } from './agent'
import { startClientAndGetTools } from './mcp'
import { GoogleAI } from './google'
import { z } from 'zod'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

export type SDRAgentResult = {
  chatLog: string
  synthesis: string
}

/**
 * Runs the SDR agent with the provided prompt
 * @param prompt The prompt to send to the AI agent
 * @returns The complete chat log as a string
 */
export async function runSdrAgent(prompt: string): Promise<SDRAgentResult> {
  let chatLog = ''

  try {
    // Log to chatLog instead of console
    chatLog += 'Loading MCP tools...\n'
    const { tools } = await startClientAndGetTools()
    chatLog += 'MCP tools loaded successfully.\n'

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
            chatLog += `\n====== ${toolCall.toolName} ======\n`
            for (const [key, value] of Object.entries(toolCall.args)) {
              chatLog += `${key}: ${value}\n`
            }
            chatLog += '\n======  Result  ======\n'
            chatLog += JSON.stringify(toolResult, null, 2) + '\n'
            chatLog += '=======================\n\n'
          }
        }
      },
      (chunk) => {
        // Append text chunks to chatLog instead of streaming to console
        chatLog += chunk
      },
      tools, // Pass the MCP tools to the agent loop
    )
    chatLog += '\n' // Add a newline after completion

    const synthesis = await generateText({
      model: google('gemini-2.0-flash'),
      prompt: `Synthesize the chat log into a concise summary.
      Chat log: ${chatLog}`,
    })

    return { chatLog, synthesis: synthesis.text }
  } catch (error) {
    chatLog += `Error running SDR agent: ${error}\n`
    throw error
  }
}

export type SDRAgentResultWithCompany = SDRAgentResult & {
  company: string
}

export async function runSdrAgentOnEachCompany(
  prompt: string,
): Promise<SDRAgentResultWithCompany[]> {
  const { companies, task } = await getCompaniesAndTask(prompt)
  const results = []

  for (const company of companies) {
    const result = await runSdrAgent(`\n\nCompany: ${company}\n\nTask: ${task}`)
    results.push({ ...result, company })
  }

  return results
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
