/**
 * @fileoverview This file defines a command-line interface using yargs. It provides commands
 * for various SDR (Sales Development Representative) operations including an AI agent loop.
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { SDR } from './linkedin'
import { doAgentLoop } from './agent'
import { startClientAndGetTools } from './mcp'
import { createFirecrawlClient } from './firecrawl'
import type { Activity } from './firecrawl'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

yargs(hideBin(process.argv))
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
    'research [query]',
    'Perform deep research on a topic using Firecrawl',
    (yargs) => {
      // Get API key from environment variable if available
      const envApiKey = process.env.FIRECRAWL_API_KEY || ''

      return yargs
        .positional('query', {
          describe: 'The research query or topic to investigate (or omit if using --file)',
          type: 'string',
        })
        .option('file', {
          describe: 'Path to a file containing the query text',
          type: 'string',
        })
        .check((argv) => {
          // Ensure either query or file is provided
          if (!argv.query && !argv.file) {
            throw new Error('Either a query argument or --file option must be provided')
          }
          return true
        })
        .option('api-key', {
          describe: 'Firecrawl API key (defaults to FIRECRAWL_API_KEY env variable)',
          type: 'string',
          default: envApiKey,
          demandOption: !envApiKey, // Only required if not in environment
        })
        .option('depth', {
          describe: 'Maximum research depth (1-10)',
          type: 'number',
          default: 5,
        })
        .option('time-limit', {
          describe: 'Time limit in seconds (30-300)',
          type: 'number',
          default: 180,
        })
        .option('max-urls', {
          describe: 'Maximum URLs to analyze',
          type: 'number',
          default: 15,
        })
        .option('output', {
          describe: 'Path to save research results to a file',
          type: 'string',
          alias: 'o',
        })
    },
    async (argv) => {
      let query: string

      // Determine query source - either from command line or from file
      if (argv.file) {
        try {
          const filePath = path.resolve(argv.file as string)
          console.log(chalk.blue(`Loading query from file: ${filePath}`))
          query = fs.readFileSync(filePath, 'utf8').trim()

          // If file content is too short, warn the user
          if (query.length < 5) {
            console.warn(chalk.yellow('Warning: Query file content is very short'))
          }
        } catch (error: any) {
          console.error(chalk.red(`Error reading query file: ${error.message}`))
          process.exit(1)
        }
      } else {
        query = argv.query as string
      }

      const apiKey = argv['api-key'] as string
      if (!apiKey) {
        console.error(
          chalk.red(
            'Error: Firecrawl API key is required. Set it using --api-key or the FIRECRAWL_API_KEY environment variable.',
          ),
        )
        process.exit(1)
      }

      const maxDepth = argv.depth as number
      const timeLimit = argv['time-limit'] as number
      const maxUrls = argv['max-urls'] as number
      const outputPath = argv.output as string | undefined

      console.log(chalk.blue(`Starting deep research: "${query}"`))
      console.log(
        chalk.blue(`Settings: Depth=${maxDepth}, Time Limit=${timeLimit}s, Max URLs=${maxUrls}`),
      )

      const firecrawl = createFirecrawlClient(apiKey)

      try {
        // Define activity callback to show progress
        const onActivity = (activity: Activity) => {
          const depthPrefix = `[Depth ${activity.depth}]`
          const typePrefix = `[${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}]`
          console.log(chalk.yellow(`${depthPrefix} ${typePrefix} ${activity.message}`))
        }

        // Start research
        const result = await firecrawl.deepResearch(
          {
            query,
            maxDepth,
            timeLimit,
            maxUrls,
          },
          5000, // Poll every 5 seconds
          onActivity,
        )

        // Display research results
        console.log(chalk.green('\n==== RESEARCH COMPLETE ====\n'))

        // Display final analysis
        if (result.finalAnalysis) {
          console.log(chalk.green('FINAL ANALYSIS:'))
          console.log(result.finalAnalysis)
          console.log('')
        }

        // Display sources
        console.log(chalk.green(`SOURCES (${result.sources.length}):`))
        result.sources.forEach((source, index) => {
          console.log(chalk.cyan(`[${index + 1}] ${source.title}`))
          console.log(`    ${source.url}`)
          if (source.description) console.log(`    ${source.description}`)
          console.log('')
        })

        // Save results to file if requested
        if (outputPath) {
          try {
            const outputContent = {
              query,
              finalAnalysis: result.finalAnalysis,
              sources: result.sources,
              activities: result.activities,
              metadata: {
                timestamp: new Date().toISOString(),
                depth: result.currentDepth,
                maxDepth: result.maxDepth,
                timeLimit,
                maxUrls,
                totalUrls: result.totalUrls,
              },
            }

            fs.writeFileSync(outputPath, JSON.stringify(outputContent, null, 2), 'utf8')

            console.log(chalk.green(`\nResults saved to: ${outputPath}`))
          } catch (error: any) {
            console.error(chalk.red(`Error saving results: ${error.message}`))
          }
        }
      } catch (error: any) {
        console.error(chalk.red('Error performing research:'), error.message)
        process.exit(1)
      }
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
