/**
 * @fileoverview This file defines a command-line interface using yargs. It provides commands
 * for various SDR (Sales Development Representative) operations including an AI agent loop.
 */

import chalk from 'chalk'
import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { doAgentLoop } from './agent'
import { gatherCompanyBackground } from './background'
import type { Activity } from './firecrawl'
import { createFirecrawlClient } from './firecrawl'
import { startClientAndGetTools } from './mcp'
import { SDR } from './sdr'
import dotenv from 'dotenv'

dotenv.config()
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
      const result = await sdr.findConnectionsAtCompany(company, degree)
      console.log(result.text)
    },
  )
  .command(
    'mutuals <person>',
    'Find mutual connections with a person on LinkedIn',
    (yargs) => {
      return yargs
        .positional('person', {
          describe: 'The person name to search for',
          type: 'string',
          demandOption: true,
        })
        .option('company', {
          describe: 'Optional company name to filter results',
          type: 'string',
        })
    },
    async (argv) => {
      const person = argv.person as string
      const company = argv.company as string | undefined

      console.log(
        `Searching for mutual connections with ${person}${company ? ` at ${company}` : ''}...`,
      )
      const sdr = new SDR()
      const connections = await sdr.findMutualConnections(person, company)
      console.log(connections.text)
    },
  )
  .command(
    'profile <person>',
    'Find a LinkedIn profile by name',
    (yargs) => {
      return yargs
        .positional('person', {
          describe: 'The person name to search for',
          type: 'string',
          demandOption: true,
        })
        .option('company', {
          describe: 'Optional company name to filter results',
          type: 'string',
        })
    },
    async (argv) => {
      const person = argv.person as string
      const company = argv.company as string | undefined

      console.log(`Searching for profile of ${person}${company ? ` at ${company}` : ''}...`)
      const sdr = new SDR()
      const profile = await sdr.findProfile(person, company)
      console.log(profile.text)
    },
  )
  .command(
    'background <company>',
    'Gather comprehensive background information about a company',
    (yargs) => {
      return yargs
        .positional('company', {
          describe: 'The company name to research',
          type: 'string',
          demandOption: true,
        })
        .option('company-context', {
          describe:
            'Additional context about the company to help with research (e.g., "AI tool builder")',
          type: 'string',
        })
        .option('people-guidance', {
          describe:
            'Guidance on what types of people to focus on (e.g., "engineers" or "marketing leaders")',
          type: 'string',
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
        .option('verbose', {
          describe: 'Show detailed progress information',
          type: 'boolean',
          default: false,
          alias: 'v',
        })
    },
    async (argv) => {
      const company = argv.company as string
      const companyContext = argv['company-context'] as string | undefined
      const peopleGuidance = argv['people-guidance'] as string | undefined
      const maxDepth = argv.depth as number
      const timeLimit = argv['time-limit'] as number
      const maxUrls = argv['max-urls'] as number
      const verbose = argv.verbose as boolean
      const outputPath = argv.output as string | undefined

      console.log(chalk.blue(`Gathering background information for: ${company}`))
      if (companyContext) {
        console.log(chalk.blue(`Company context: ${companyContext}`))
      }
      if (peopleGuidance) {
        console.log(chalk.blue(`People focus: ${peopleGuidance}`))
      }
      console.log(
        chalk.blue(`Settings: Depth=${maxDepth}, Time Limit=${timeLimit}s, Max URLs=${maxUrls}`),
      )

      try {
        // Gather company background information
        const backgroundData = await gatherCompanyBackground(company, {
          maxDepth,
          timeLimit,
          maxUrls,
          verbose,
          companyContext,
          peopleGuidance,
        })

        // Display research results
        console.log(chalk.green('\n==== COMPANY BACKGROUND ====\n'))

        // Display company name and URLs
        console.log(chalk.cyan('Name:'), backgroundData.name)
        console.log(chalk.cyan('Website:'), backgroundData.homepageUrl)
        console.log(chalk.cyan('LinkedIn:'), backgroundData.linkedinUrl)
        console.log('')

        // Display product info
        console.log(chalk.cyan('Product/Service:'))
        console.log(backgroundData.productDescription)
        console.log('')

        // Display recent news
        console.log(chalk.cyan('Recent News:'))
        console.log(backgroundData.recentNews)
        console.log('')

        // Display funding info
        console.log(chalk.cyan('Funding:'))
        console.log(backgroundData.funding)
        console.log('')

        // Display key people
        console.log(chalk.cyan(`Key People (${backgroundData.people.length}):`))
        backgroundData.people.forEach((person, index) => {
          console.log(`[${index + 1}] ${person.name} - ${person.role}`)
          if (person.linkedinUrl) console.log(`    ${person.linkedinUrl}`)
        })

        // Save results to file if requested
        if (outputPath) {
          try {
            // Convert to YAML and save
            const yamlContent = yaml.dump(backgroundData, {
              indent: 2,
              lineWidth: 120,
              noRefs: true,
            })
            fs.writeFileSync(outputPath, yamlContent, 'utf8')

            console.log(chalk.green(`\nResults saved to: ${outputPath}`))
          } catch (error: any) {
            console.error(chalk.red(`Error saving results: ${error.message}`))
          }
        }
      } catch (error: any) {
        console.error(chalk.red('Error gathering company background:'), error.message)
        process.exit(1)
      }
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
      let inputFilePath: string | undefined

      // Determine query source - either from command line or from file
      if (argv.file) {
        try {
          inputFilePath = path.resolve(argv.file as string)
          console.log(chalk.blue(`Loading query from file: ${inputFilePath}`))
          query = fs.readFileSync(inputFilePath, 'utf8').trim()

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
      let outputPath = argv.output as string | undefined

      // If input file was used but no output specified, create default output path
      if (inputFilePath && !outputPath) {
        const inputDir = path.dirname(inputFilePath)
        const inputBasename = path.basename(inputFilePath, path.extname(inputFilePath))
        outputPath = path.join(inputDir, `${inputBasename}.results.yaml`)
      }

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

            // Convert to YAML and save
            const yamlContent = yaml.dump(outputContent, {
              indent: 2,
              lineWidth: 120,
              noRefs: true,
            })
            fs.writeFileSync(outputPath, yamlContent, 'utf8')

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
