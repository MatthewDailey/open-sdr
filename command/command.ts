/**
 * @fileoverview This file defines a command-line interface using yargs. It provides commands
 * for various SDR (Sales Development Representative) operations including an AI agent loop.
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { SDR } from './linkedin'
import { doAgentLoop } from './agent'
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
      )
      console.log('\n') // Add a newline after completion
    },
  )
  .demandCommand(1)
  .help().argv
