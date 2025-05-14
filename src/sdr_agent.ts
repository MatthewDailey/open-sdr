/**
 * @fileoverview This file contains the logic for running the SDR agent loop
 * with a prompt.
 */

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import chalk from 'chalk'
import { z } from 'zod'
import { doAgentLoop } from './agent.js'
import { GoogleAI } from './google.js'
import { startClientAndGetTools } from './mcp.js'
import { SDR } from './sdr.js'

export type SDRAgentResult = {
  chatLog: string
  synthesis: string
}

/**
 * Runs the SDR agent with the provided prompt
 * @param prompt The prompt to send to the AI agent
 * @returns The complete chat log as a string
 */
export async function runSdrAgent(
  prompt: string,
  options: { logToConsole: boolean },
): Promise<SDRAgentResult> {
  console.log(chalk.yellow(`\n\n<start_sdr_agent>\n${prompt}\n</start_sdr_agent>\n`))

  let chatLog = ''

  try {
    const { tools } = await startClientAndGetTools()

    const sdrTools = await new SDR().getTools()
    Object.assign(tools, sdrTools)
    await doAgentLoop(
      {
        system:
          'You are a helpful assistant that can use tools to help the user. You are given a task and complete that without a conversation or asking questions.',
        user: prompt,
      },
      (step) => {
        // Handle tool calls with a nice representation
        if (step.toolCalls.length > 0) {
          for (let i = 0; i < step.toolCalls.length; i++) {
            const toolCall = step.toolCalls[i]
            const toolResult = step.toolResults[i] as { result: string }
            const toolLogEntry = `\n====== ${toolCall.toolName} ======\n`
            chatLog += toolLogEntry
            if (options.logToConsole) console.log('\n' + toolLogEntry.trim())

            for (const [key, value] of Object.entries(toolCall.args)) {
              const argLogEntry = `${key}: ${value}\n`
              chatLog += argLogEntry
              if (options.logToConsole) console.log(argLogEntry.trim())
            }

            if (toolResult) {
              const resultHeader = '\n======  Result  ======\n'
              chatLog += resultHeader
              if (options.logToConsole) console.log(resultHeader.trim())

              if (toolResult.result && typeof toolResult.result === 'string') {
                const resultStr = toolResult.result + '\n'
                chatLog += resultStr
                if (options.logToConsole) console.log(resultStr.trim())
              } else {
                const resultJson = JSON.stringify(toolResult, null, 2) + '\n'
                chatLog += resultJson
                if (options.logToConsole) console.log(resultJson.trim())
              }

              const separator = '=====================\n\n'
              chatLog += separator
              if (options.logToConsole) console.log(separator.trim())
            }
          }
        }
      },
      (chunk) => {
        // Append text chunks to chatLog instead of streaming to console
        chatLog += chunk
        if (options.logToConsole) process.stdout.write(chalk.green(chunk))
      },
      tools, // Pass the MCP tools to the agent loop
    )
    chatLog += '\n' // Add a newline after completion

    const synthesis = await generateText({
      model: google('gemini-2.0-flash'),
      prompt: `Synthesize the chat log into a concise summary. Make sure to include all key findings, every detail and especially urls and links.
      Chat log: ${chatLog}`,
    })

    return { chatLog, synthesis: synthesis.text }
  } catch (error) {
    chatLog += `Error running SDR agent: ${error}\n`
    if (options.logToConsole) console.error(`Error running SDR agent: ${error}`)
    throw error
  }
}

export type SDRAgentResultWithCompany = SDRAgentResult & {
  company: string
}

export async function runSdrAgentOnEachCompany(
  prompt: string,
): Promise<SDRAgentResultWithCompany[]> {
  const { listItems, task } = await extractListAndTasks(prompt)
  const results = []

  for (const listItem of listItems) {
    const result = await runSdrAgent(`Name: ${listItem}\n\nTask: ${task}`, {
      logToConsole: true,
    })
    results.push({ ...result, company: listItem })
  }

  return results
}

async function extractListAndTasks(prompt: string): Promise<{ listItems: string[]; task: string }> {
  try {
    const googleAI = new GoogleAI()
    const schema = z.object({
      listItems: z
        .array(z.string().min(1))
        .min(1)
        .describe('The list of items (eg companies) to process'),
      task: z
        .string()
        .min(1)
        .describe(
          'The main task to complete with all additional instructions. Should be verbatim the user prompt except to edit out the companies.',
        ),
    })

    // Extract companies and task from the prompt
    const result = await googleAI.generateStructuredData(
      `You are provided a prompt that asks to do some task for each element of a list. Extract the list of elements and the main task from the following prompt. The task should be verbatim the user prompt except to edit out the companies.
      
      Prompt: \n${prompt}`,
      schema,
    )

    return result
  } catch (error) {
    console.error('Error extracting companies and task:', error)
    // Return empty defaults in case of error
    return { listItems: [], task: '' }
  }
}
