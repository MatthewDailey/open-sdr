/**
 * @fileoverview A wrapper for Firecrawl's deep research API.
 * This module provides functionality to perform AI-powered deep research
 * and analysis on any topic using Firecrawl's services.
 */

import axios, { AxiosError } from 'axios'

// Base URL for Firecrawl API
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1'

/**
 * Firecrawl API error response
 */
interface FirecrawlErrorResponse {
  error?: string
  message?: string
}

/**
 * Activity types in the research process
 */
export type ActivityType = 'search' | 'extract' | 'analyze' | 'reasoning' | 'synthesis' | 'thought'

/**
 * Status of an activity or research job
 */
export type Status = 'processing' | 'completed' | 'failed' | 'in_progress' | 'error'

/**
 * Output format options
 */
export type FormatType = 'markdown' | 'json'

/**
 * Interface for research activity
 */
export interface Activity {
  type: ActivityType
  status: Status | string
  message: string
  timestamp: string
  depth: number
}

/**
 * Interface for source information
 */
export interface Source {
  url: string
  title: string
  description: string
  favicon?: string
}

/**
 * JSON output options
 */
export interface JsonOptions {
  schema?: Record<string, any>
  systemPrompt?: string
  prompt?: string
}

/**
 * Parameters for deep research request
 */
export interface DeepResearchParams {
  query: string
  maxDepth?: number
  timeLimit?: number
  maxUrls?: number
  analysisPrompt?: string
  systemPrompt?: string
  formats?: FormatType[]
  jsonOptions?: JsonOptions
}

/**
 * Response for initiating deep research
 */
export interface DeepResearchInitResponse {
  success: boolean
  id: string
}

/**
 * Data in deep research status response
 */
export interface DeepResearchData {
  finalAnalysis?: string
  json?: Record<string, any>
  activities: Activity[]
  sources: Source[]
  status: Status
  error?: string
  expiresAt: string
  currentDepth: number
  maxDepth: number
  totalUrls: number
}

/**
 * Deep research status response
 */
export interface DeepResearchStatusResponse {
  success: boolean
  data: DeepResearchData
  status: Status
  currentDepth: number
  maxDepth: number
  expiresAt: string
}

/**
 * Callback function type for activity updates
 */
export type OnActivityCallback = (activity: Activity) => void

/**
 * Firecrawl client for interacting with the deep research API
 */
export class Firecrawl {
  private apiKey: string

  /**
   * Create a new Firecrawl client
   * @param apiKey - Your Firecrawl API key
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Start a deep research job
   * @param params - Research parameters
   * @returns Promise with the research job ID
   */
  async startDeepResearch(params: DeepResearchParams): Promise<string> {
    try {
      const response = await axios.post<DeepResearchInitResponse>(
        `${FIRECRAWL_API_URL}/deep-research`,
        params,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.data.success) {
        throw new Error('Failed to start deep research')
      }

      return response.data.id
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<FirecrawlErrorResponse>
        const errorMessage =
          axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          axiosError.message
        throw new Error(`Firecrawl API error: ${errorMessage}`)
      }
      throw error
    }
  }

  /**
   * Check the status of a deep research job
   * @param id - Research job ID
   * @returns Promise with the research status data
   */
  async checkDeepResearchStatus(id: string): Promise<DeepResearchStatusResponse> {
    try {
      const response = await axios.get<DeepResearchStatusResponse>(
        `${FIRECRAWL_API_URL}/deep-research/${id}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      )

      if (!response.data.success) {
        throw new Error('Failed to get deep research status')
      }

      return response.data
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<FirecrawlErrorResponse>
        const errorMessage =
          axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          axiosError.message
        throw new Error(`Firecrawl API error: ${errorMessage}`)
      }
      throw error
    }
  }

  /**
   * Run deep research with polling for completion
   * @param params - Research parameters
   * @param pollingInterval - Interval in ms to check status (default: 5000ms)
   * @param onActivity - Optional callback for activity updates
   * @returns Promise with the final research data
   */
  async deepResearch(
    params: DeepResearchParams,
    pollingInterval = 5000,
    onActivity?: OnActivityCallback,
  ): Promise<DeepResearchData> {
    // Start the research job
    const jobId = await this.startDeepResearch(params)

    // Track seen activities to avoid duplicate notifications
    const seenActivityHashes = new Set<string>()

    // Poll until completion
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const statusResponse = await this.checkDeepResearchStatus(jobId)

          // Process activities if callback provided
          if (onActivity && statusResponse.data.activities) {
            for (const activity of statusResponse.data.activities) {
              // Create a simple hash of activity to avoid duplicates
              const activityHash = `${activity.type}-${activity.message}-${activity.depth}`

              if (!seenActivityHashes.has(activityHash)) {
                seenActivityHashes.add(activityHash)
                onActivity(activity)
              }
            }
          }

          // Check if research is complete
          if (statusResponse.status === 'completed') {
            resolve(statusResponse.data)
            return
          }

          // Check if research failed
          if (statusResponse.status === 'failed') {
            reject(new Error(statusResponse.data.error || 'Research failed'))
            return
          }

          // Continue polling
          setTimeout(poll, pollingInterval)
        } catch (error: unknown) {
          reject(error)
        }
      }

      // Start polling
      poll()
    })
  }
}

// Export a factory function to create the client
export function createFirecrawlClient(apiKey: string): Firecrawl {
  return new Firecrawl(apiKey)
}
