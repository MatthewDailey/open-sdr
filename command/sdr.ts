/**
 * @fileoverview Sales Development Representative automation tools.
 */

import { LinkedIn, type Profile } from './linkedin.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

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
              text: `LINKEDIN\nName: ${profile.name}\nRole: ${profile.role}\nImageURL: ${profile.image}\nProfile Link: ${profile.profileLink}`,
            })),
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
