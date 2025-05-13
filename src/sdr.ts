/**
 * @fileoverview Sales Development Representative automation tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { writeMarkdown } from './write'
import { gatherCompanyBackground, type CompanyBackground } from './background.js'
import { createFirecrawlClient, type Activity, type DeepResearchData } from './firecrawl.js'
import { LinkedIn, type Profile } from './linkedin.js'
import { runSdrAgentOnEachCompany, type SDRAgentResult } from './sdr_agent'
import { tool } from 'ai'

export type SDRResult<T> = {
  text: string
  data: T
}

// Unified tool definitions
type ToolDefinition = {
  name: string
  description: string
  parameters: Record<string, z.ZodTypeAny>
  execute: (params: any) => Promise<any>
}

/**
 * Class for Sales Development Representative automation
 */
export class SDR {
  private linkedin: LinkedIn
  private static readonly toolDefinitions: ToolDefinition[] = [
    {
      name: 'findLinkedinConnectionsAt',
      description:
        'Find connections at a specific company with specified connection degree with LinkedIn',
      parameters: {
        companyName: z.string().describe('The company name to search for (not the product name)'),
        degree: z.enum(['first', 'second']).describe('Connection degree (first or second)'),
      },
      execute: async function (this: SDR, { companyName, degree }) {
        const profiles = await this.findConnectionsAtCompany(companyName, degree)
        return profiles.text
      },
    },
    {
      name: 'findProfile',
      description: 'Find a LinkedIn profile by name',
      parameters: {
        personName: z.string().describe('The person name to search for'),
        companyName: z
          .string()
          .optional()
          .describe('Optional company name to filter results (not the product name)'),
      },
      execute: async function (this: SDR, { personName, companyName }) {
        const profile = await this.findProfile(personName, companyName)
        return profile.text
      },
    },
    {
      name: 'findMutualConnections',
      description: 'Find mutual connections with a person on LinkedIn',
      parameters: {
        personName: z.string().describe('The person name to search for'),
        companyName: z
          .string()
          .optional()
          .describe(
            'Optional (but very helpful!) company name to filter results (not the product name)',
          ),
      },
      execute: async function (this: SDR, { personName, companyName }) {
        const connections = await this.findMutualConnections(personName, companyName)
        return connections.text
      },
    },
    {
      name: 'draftMessage',
      description: 'Draft a message to a LinkedIn connection',
      parameters: {
        name: z.string().describe('Name of the person to message'),
        profileUrl: z.string().describe("URL of the person's LinkedIn profile"),
        message: z.string().describe('Message text to draft'),
      },
      execute: async function (this: SDR, { name, profileUrl, message }) {
        const result = await this.draftMessage(name, profileUrl, message)
        return result.text
      },
    },
    {
      name: 'researchCompany',
      description: 'Gather comprehensive background information about a company',
      parameters: {
        companyName: z.string().describe('The company name to research'),
        companyContext: z
          .string()
          .optional()
          .describe(
            'Additional context about the company to help with research (eg "they are a startup", "they are in AI")',
          ),
        peopleGuidance: z
          .string()
          .optional()
          .describe(
            'Specific focus for researching people at the company (eg "business founders", "software engineers"',
          ),
      },
      execute: async function (this: SDR, { companyName, companyContext, peopleGuidance }) {
        const companyData = await this.gatherCompanyBackground(companyName, {
          companyContext,
          peopleGuidance,
        })
        return companyData.text
      },
    },
    {
      name: 'deepResearch',
      description: 'Perform deep research on a topic',
      parameters: {
        query: z.string().describe('The research query or topic to investigate'),
        maxDepth: z.number().optional().describe('Maximum research depth (1-10)'),
        timeLimit: z.number().optional().describe('Time limit in seconds (30-300)'),
        maxUrls: z.number().optional().describe('Maximum URLs to analyze'),
      },
      execute: async function (this: SDR, { query, maxDepth, timeLimit, maxUrls }) {
        const researchData = await this.performResearch(query, {
          maxDepth,
          timeLimit,
          maxUrls,
        })
        return researchData.text
      },
    },
    {
      name: 'runAgentOnEachCompany',
      description:
        'Run the SDR agent for each company mentioned in the prompt. This should be used when the user wants something done for multiple companies to make sure each is handled completely.',
      parameters: {
        prompt: z
          .string()
          .describe(
            'The prompt containing companies and task information. This should be verbatim the user prompt.',
          ),
      },
      execute: async function (this: SDR, { prompt }) {
        const result = await this.runAgentOnEachCompany(prompt)
        return result.text
      },
    },
    {
      name: 'writeSdrNotes',
      description:
        'Write markdown content to a file in the SDR notes directory. This should be used for the agent to output a summary of its work or when requested to save a file.',
      parameters: {
        content: z.string().describe('The markdown content to write to the file'),
        filename: z
          .string()
          .optional()
          .describe('Optional filename (without extension) to use for the file'),
        subdirectory: z
          .string()
          .optional()
          .describe('Optional subdirectory within SDR notes to store the file'),
      },
      execute: async function (this: SDR, { content, filename, subdirectory }) {
        const result = await writeMarkdown(content, { filename, subdirectory })
        return `Successfully wrote markdown to file: ${result.filePath}`
      },
    },
  ]

  constructor(cookiesPath?: string) {
    this.linkedin = new LinkedIn(cookiesPath)
  }

  /**
   * Opens a headed browser to LinkedIn for login
   * Saves cookies when the browser is closed by the user
   */
  async login(): Promise<void> {
    return this.linkedin.login()
  }

  /**
   * Find connections at a specific company with specified connection degree
   * @param companyName Company to search for
   * @param degree Connection degree (first or second)
   */
  async findConnectionsAtCompany(
    companyName: string,
    degree: 'first' | 'second',
  ): Promise<SDRResult<Profile[]>> {
    const data = await this.linkedin.findConnectionsAtCompany(companyName, degree)
    let text = `Found ${data.length} ${degree} degree connections at ${companyName}`
    if (data.length === 0) {
      text = `No ${degree} degree connections found at ${companyName}`
    } else {
      text += `:\n${data.map((profile) => `* ${profile.name} (${profile.role} at ${profile.company}) - ${profile.profileUrl}`).join('\n')}`
    }
    return {
      text,
      data,
    }
  }

  /**
   * Find mutual connections between two people
   * @param personName Name of the person to search for
   * @param companyName Company to search for
   */
  async findMutualConnections(
    personName: string,
    companyName?: string,
  ): Promise<SDRResult<{ mutuals: Profile[]; person: Profile }>> {
    const data = await this.linkedin.findMutualConnections(personName, companyName)
    let text = `Found ${data.mutuals.length} mutual connections with ${data.person.name} (${data.person.role} at ${data.person.company}) ${data.person.profileUrl}`
    if (data.mutuals.length === 0) {
      text = `No mutual connections found with ${personName}`
    } else {
      text += `:\n${data.mutuals.map((profile) => `* ${profile.name} (${profile.role} at ${profile.company}) - ${profile.profileUrl}`).join('\n')}`
    }
    return {
      text,
      data,
    }
  }
  /**
   * Find a profile by name and company
   * @param personName Name of the person to search for
   * @param companyName Company to search for
   */
  async findProfile(personName: string, companyName?: string): Promise<SDRResult<Profile>> {
    const data = await this.linkedin.findProfile(personName, companyName)
    return {
      text: `Found: ${data.name} (${data.role} at ${data.company}) ${data.profileUrl}`,
      data,
    }
  }

  /**
   * Draft a message to a LinkedIn connection
   * @param name Name of the person to message
   * @param profileUrl URL of the person's LinkedIn profile
   * @param message Message to draft
   */
  async draftMessage(name: string, profileUrl: string, message: string): Promise<SDRResult<void>> {
    await this.linkedin.draftMessage(name, profileUrl, message)
    return {
      text: `Opened draft message to ${name}: "${message}"`,
      data: undefined,
    }
  }

  /**
   * Gather comprehensive background information about a company
   * @param companyName Name of the company to research
   * @param firecrawlApiKey Firecrawl API key
   * @param googleApiKey Google AI API key
   * @param options Additional options for research
   * @returns Promise with structured company background information
   */
  async gatherCompanyBackground(
    companyName: string,
    options: {
      maxDepth?: number
      timeLimit?: number
      maxUrls?: number
      verbose?: boolean
      companyContext?: string
      peopleGuidance?: string
    } = {},
  ): Promise<SDRResult<CompanyBackground>> {
    const data = await gatherCompanyBackground(companyName, options)

    let text = `==== COMPANY BACKGROUND ====\n`
    text += `Company: ${data.companyName}\n`
    text += `Product: ${data.productName}\n`
    text += `Website: ${data.homepageUrl}\n`
    text += `LinkedIn: ${data.linkedinUrl}\n\n`
    text += `Product/Service:\n${data.productDescription}\n\n`
    text += `Recent News:\n${data.recentNews}\n\n`
    text += `Funding:\n${data.funding}\n\n`
    text += `Key People (${data.people.length}):\n`
    data.people.forEach((person, index) => {
      text += `[${index + 1}] ${person.name} - ${person.role}\n`
      if (person.linkedinUrl) text += `    ${person.linkedinUrl}\n`
    })

    return {
      text,
      data,
    }
  }

  /**
   * Perform deep research on a topic using Firecrawl
   * @param query The research query or topic to investigate
   * @param options Additional options for research
   * @returns Promise with research results
   */
  async performResearch(
    query: string,
    options: {
      maxDepth?: number
      timeLimit?: number
      maxUrls?: number
      onActivity?: (activity: Activity) => void
    } = {},
  ): Promise<SDRResult<DeepResearchData>> {
    const { maxDepth = 5, timeLimit = 180, maxUrls = 15, onActivity } = options

    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) throw new Error('Firecrawl API key is required')
    if (!query) throw new Error('Query is required')

    const fc = createFirecrawlClient(apiKey)

    const data = await fc.deepResearch(
      {
        query,
        maxDepth,
        timeLimit,
        maxUrls,
      },
      5000,
      onActivity,
    )

    let text = `==== RESEARCH RESULTS ====\n\n`
    text += `# Query: ${query}\n\n`
    if (data.finalAnalysis) {
      text += `# Final Analysis:\n${data.finalAnalysis}\n\n`
    }
    text += `# Sources (${data.sources.length}):\n`
    data.sources.forEach((source, index) => {
      text += `[${index + 1}] ${source.title || 'Untitled'}\n`
      text += `    ${source.url}\n`
      if (source.description) text += `    ${source.description}\n`
    })

    return {
      text,
      data,
    }
  }

  /**
   * Run the SDR agent for each company mentioned in the prompt
   * @param prompt The prompt containing companies and task information
   */
  async runAgentOnEachCompany(prompt: string): Promise<SDRResult<SDRAgentResult[]>> {
    const results = await runSdrAgentOnEachCompany(prompt)
    const text = results
      .map((result) => {
        return `===== RESULTS FOR AGENT RUNNING ON ${result.company} ======\n${result.synthesis}\n============================`
      })
      .join('\n\n\n')
    return {
      text,
      data: results,
    }
  }

  /**
   * Starts an MCP server as a background process using StreamableHTTPServerTransport
   * @returns URL of the MCP server
   */
  async startMcpServer(): Promise<McpServer> {
    const server = new McpServer({
      name: 'open-sdr',
      version: '0.0.1',
    })

    for (const toolDef of SDR.toolDefinitions) {
      server.tool(toolDef.name, toolDef.description, toolDef.parameters, async (params) => {
        const result = await toolDef.execute.call(this, params)
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        }
      })
    }

    return server
  }

  /**
   * Returns Vercel AI SDK tools that match the tools in the MCP server
   * @returns Object containing Vercel AI SDK tools
   */
  async getTools() {
    const tools: Record<string, any> = {}

    for (const toolDef of SDR.toolDefinitions) {
      const thisTool = toolDef
      tools[toolDef.name] = tool({
        description: toolDef.description,
        parameters: z.object(toolDef.parameters),
        execute: (params) => thisTool.execute.call(this, params),
      })
    }

    return tools
  }
}
