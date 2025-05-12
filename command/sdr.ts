/**
 * @fileoverview Sales Development Representative automation tools.
 */

import { LinkedIn, type Profile } from './linkedin.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { gatherCompanyBackground, type CompanyBackground } from './background.js'

export type SDRResult<T> = {
  text: string
  data: T
}

/**
 * Class for Sales Development Representative automation
 */
export class SDR {
  private linkedin: LinkedIn

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

    let text = `==== COMPANY BACKGROUND ====\n\n`
    text += `Name: ${data.name}\n`
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
      text: `Company background for ${companyName}`,
      data,
    }
  }

  /**
   * Starts an MCP server as a background process using StreamableHTTPServerTransport
   * @returns URL of the MCP server
   */
  async startMcpServer(): Promise<{ server: McpServer; transport: StreamableHTTPServerTransport }> {
    try {
      const server = new McpServer({
        name: 'open-sdr',
        version: '0.0.1',
      })

      server.tool(
        'findLinkedinConnectionsAt',
        'Find connections at a specific company with specified connection degree with LinkedIn',
        {
          companyName: z.string().describe('The company name to search for'),
          degree: z.enum(['first', 'second']).describe('Connection degree (first or second)'),
        },
        async ({ companyName, degree }) => {
          const profiles = await this.findConnectionsAtCompany(companyName, degree)
          return {
            content: [
              {
                type: 'text',
                text: profiles.text,
              },
            ],
          }
        },
      )

      server.tool(
        'findProfile',
        'Find a LinkedIn profile by name',
        {
          personName: z.string().describe('The person name to search for'),
          companyName: z.string().optional().describe('Optional company name to filter results'),
        },
        async ({ personName, companyName }) => {
          const profiles = await this.findProfile(personName, companyName)
          return {
            content: [
              {
                type: 'text',
                text: profiles.text,
              },
            ],
          }
        },
      )

      server.tool(
        'findMutualConnections',
        'Find mutual connections with a person on LinkedIn',
        {
          personName: z.string().describe('The person name to search for'),
          companyName: z
            .string()
            .optional()
            .describe('Optional (but very helpful!) company name to filter results'),
        },
        async ({ personName, companyName }) => {
          const connections = await this.findMutualConnections(personName, companyName)
          return {
            content: [
              {
                type: 'text',
                text: connections.text,
              },
            ],
          }
        },
      )

      server.tool(
        'researchCompany',
        'Gather comprehensive background information about a company',
        {
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
        async ({ companyName, companyContext, peopleGuidance }) => {
          const companyData = await this.gatherCompanyBackground(companyName, {
            companyContext,
            peopleGuidance,
          })

          return {
            content: [
              {
                type: 'text',
                text: companyData.text,
              },
            ],
          }
        },
      )

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // disables session management
      })
      await server.connect(transport)

      return { server, transport }
    } catch (error) {
      console.error('Error starting MCP server:', error)
      throw error
    }
  }
}
