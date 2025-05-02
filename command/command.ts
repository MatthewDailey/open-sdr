/**
 * @fileoverview This file defines a command-line interface using yargs. It provides commands
 * for various SDR (Sales Development Representative) operations including an AI agent loop.
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { SDR } from './linkedin'
import { doAgentLoop } from './agent'
import { startClientAndGetTools } from './mcp'
import chalk from 'chalk'

yargs(hideBin(process.argv))
  .command('hello', 'Say hello', {}, (argv) => {
    console.log('Hello, world!')
  })
  .command('login', 'Login to LinkedIn and save cookies', {}, async (argv) => {
    const sdr = new SDR()
    await sdr.login()
  })
  .command(
    'connections <company>',
    'Find LinkedIn connections at a specific company',
    (yargs) => {
      return yargs
        .positional('company', {
          describe: 'The company name to search for',
          type: 'string',
          demandOption: true,
        })
        .option('degree', {
          describe: 'Connection degree (first or second)',
          type: 'string',
          choices: ['first', 'second'],
          default: 'first',
        })
    },
    async (argv) => {
      const company = argv.company as string
      const degree = argv.degree as 'first' | 'second'

      console.log(`Searching for ${degree} degree connections at ${company}...`)
      const sdr = new SDR()
      await sdr.findConnectionsAt(company, degree)
    },
  )
  .command(
    'sdr <prompt>',
    'Run the AI agent with the given prompt',
    (yargs) => {
      return yargs.positional('prompt', {
        describe: 'The prompt to send to the AI agent',
        type: 'string',
        demandOption: true,
      })
    },
    async (argv) => {
      const prompt = argv.prompt as string

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
    },
  )
  .demandCommand(1)
  .help().argv
