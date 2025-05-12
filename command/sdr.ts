/**
 * @fileoverview Sales Development Representative automation tools.
 */

import { LinkedIn, type Profile } from './linkedin.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { gatherCompanyBackground, type CompanyBackground } from './background.js'

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
  ): Promise<Profile[]> {
    return this.linkedin.findConnectionsAtCompany(companyName, degree)
  }

  /**
   * Find mutual connections between two people
   * @param personName Name of the person to search for
   * @param companyName Company to search for
   */
  async findMutualConnections(personName: string, companyName?: string): Promise<Profile[]> {
    return this.linkedin.findMutualConnections(personName, companyName)
  }

  /**
   * Find a profile by name and company
   * @param personName Name of the person to search for
   * @param companyName Company to search for
   */
  async findProfile(personName: string, companyName?: string): Promise<Profile[]> {
    return this.linkedin.findProfile(personName, companyName)
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
    firecrawlApiKey: string,
    googleApiKey: string,
    options: {
      maxDepth?: number
      timeLimit?: number
      maxUrls?: number
      verbose?: boolean
      companyContext?: string
      peopleGuidance?: string
    } = {},
  ): Promise<CompanyBackground> {
    return gatherCompanyBackground(companyName, firecrawlApiKey, googleApiKey, options)
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
            content: profiles.map((profile) => ({
              type: 'text',
              text: `LINKEDIN\nName: ${profile.name}\nRole: ${profile.role}\nCompany: ${profile.company}\nProfile Link: ${profile.profileUrl}`,
            })),
          }
        },
      )

      server.tool(
        'researchCompany',
        'Gather comprehensive background information about a company',
        {
          companyName: z.string().describe('The company name to research'),
          companyContext: z.string().optional().describe('Additional context about the company'),
          peopleGuidance: z
            .string()
            .optional()
            .describe('Specific focus for researching people at the company'),
        },
        async ({ companyName, companyContext, peopleGuidance }) => {
          if (!process.env.FIRECRAWL_API_KEY || !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            throw new Error('FIRECRAWL_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY must be set')
          }

          const companyData = await this.gatherCompanyBackground(
            companyName,
            process.env.FIRECRAWL_API_KEY,
            process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            {
              companyContext,
              peopleGuidance,
            },
          )

          return {
            content: [
              {
                type: 'text',
                text: `COMPANY BACKGROUND\nName: ${companyData.name}\nWebsite: ${companyData.homepageUrl}\nLinkedIn: ${companyData.linkedinUrl}\n\nProduct: ${companyData.productDescription}\n\nRecent News: ${companyData.recentNews}\n\nFunding: ${companyData.funding}\n\nKey People:\n${companyData.people.map((person) => `- ${person.name}: ${person.role}${person.linkedinUrl ? ` (${person.linkedinUrl})` : ''}`).join('\n')}`,
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
