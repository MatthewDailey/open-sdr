#!/usr/bin/env node

/**
 * @fileoverview This file defines a command-line interface using yargs. It provides commands
 * for various SDR (Sales Development Representative) operations including an AI agent loop.
 */

import chalk from 'chalk'
import dotenv from 'dotenv'
import fs from 'fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startMcpServer } from './server.js'
import { SDR } from './sdr.js'
import { runSdrAgent } from './sdr_agent.js'

if (fs.existsSync('.env')) {
  console.log('Loading environment variables from .env file')
  dotenv.config({ override: true })
} else {
  console.log('No .env file found')
}

yargs(hideBin(process.argv))
  .command('login', 'Login to LinkedIn and save cookies', {}, async (argv) => {
    const sdr = new SDR()
    await sdr.login()
  })
  .command(
    'agent <promptFilePath>',
    'Run the AI agent with a prompt from the specified file',
    (yargs) => {
      return yargs.positional('promptFilePath', {
        describe: 'Path to the file containing the prompt for the AI agent',
        type: 'string',
        demandOption: true,
      })
    },
    async (argv) => {
      const promptFilePath = argv.promptFilePath as string
      const prompt = fs.readFileSync(promptFilePath, 'utf8')
      await runSdrAgent(prompt, { logToConsole: true })
      console.log('\n\nDone. Ctrl-C to exit.')
    },
  )
  .command('server', 'Start the MCP server', {}, async () => {
    await startMcpServer()
  })
  .command('tools', 'Run various SDR tools', (yargs) => {
    return yargs
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
        'message <name> <profileUrl> <messageText>',
        'Draft a message to a LinkedIn connection',
        (yargs) => {
          return yargs
            .positional('name', {
              describe: 'The person name to search for',
              type: 'string',
              demandOption: true,
            })
            .positional('profileUrl', {
              describe: 'The person name to search for',
              type: 'string',
              demandOption: true,
            })
            .positional('messageText', {
              describe: 'The message text to draft',
              type: 'string',
              demandOption: true,
            })
        },
        async (argv) => {
          const name = argv.name as string
          const profileUrl = argv.profileUrl as string
          const messageText = argv.messageText as string

          const sdr = new SDR()
          const result = await sdr.draftMessage(name, profileUrl, messageText)
          console.log(result.text)
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

          console.log(`Gathering background information for: ${company}`)
          if (companyContext) {
            console.log(`Company context: ${companyContext}`)
          }
          if (peopleGuidance) {
            console.log(`People focus: ${peopleGuidance}`)
          }
          console.log(`Settings: Depth=${maxDepth}, Time Limit=${timeLimit}s, Max URLs=${maxUrls}`)

          const sdr = new SDR()
          const backgroundData = await sdr.gatherCompanyBackground(company, {
            maxDepth,
            timeLimit,
            maxUrls,
            verbose,
            companyContext,
            peopleGuidance,
          })

          console.log(backgroundData.text)
          // Save results to file if requested
          if (outputPath) {
            fs.writeFileSync(outputPath, backgroundData.text, 'utf8')
            console.log(`\nResults saved to: ${outputPath}`)
          }
        },
      )
      .command(
        'research <query>',
        'Perform deep research on a topic using the SDR class',
        (yargs) => {
          return yargs
            .positional('query', {
              describe: 'The research query or topic to investigate',
              type: 'string',
              demandOption: true,
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
          const query = argv.query as string
          const maxDepth = argv.depth as number
          const timeLimit = argv['time-limit'] as number
          const maxUrls = argv['max-urls'] as number
          const outputPath = argv.output as string | undefined

          console.log(`Performing deep research on: "${query}"`)
          console.log(`Settings: Depth=${maxDepth}, Time Limit=${timeLimit}s, Max URLs=${maxUrls}`)

          const sdr = new SDR()
          const researchData = await sdr.performResearch(query, {
            maxDepth,
            timeLimit,
            maxUrls,
            onActivity: (activity) => {
              const depthPrefix = `[Depth ${activity.depth}]`
              const typePrefix = `[${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}]`
              console.log(chalk.yellow(`${depthPrefix} ${typePrefix} ${activity.message}`))
            },
          })

          console.log(chalk.green('\n==== RESEARCH COMPLETE ====\n'))
          console.log(researchData.text)

          if (outputPath) {
            fs.writeFileSync(outputPath, researchData.text, 'utf8')
            console.log(`\nResults saved to: ${outputPath}`)
          }
        },
      )
      .demandCommand(1, 'You must specify a tool to use')
      .help()
  })
  .demandCommand(1)
  .help().argv
