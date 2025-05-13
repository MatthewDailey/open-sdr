/**
 * @fileoverview Company background research functionality using Firecrawl and Google AI.
 */

import { z } from 'zod'
import { createFirecrawlClient } from './firecrawl'
import { GoogleAI } from './google'
import chalk from 'chalk'

// Schema for person information
const PersonSchema = z.object({
  name: z.string().describe('Full name of the person'),
  role: z.string().describe('Current role/position at the company'),
  linkedinUrl: z.string().optional().describe('LinkedIn profile URL if available'),
})

// Schema for company background information
const CompanyBackgroundSchema = z.object({
  name: z.string().describe('Official company name'),
  homepageUrl: z.string().describe('Company homepage URL'),
  linkedinUrl: z.string().describe('Company LinkedIn page URL'),
  productDescription: z.string().describe("Description of the company's main products or services"),
  recentNews: z.string().describe('Recent news or updates about the company'),
  funding: z
    .string()
    .describe("Information about the company's funding rounds or financial status"),
  people: z.array(PersonSchema).describe('Key people at the company (executives, founders, etc.)'),
})

// Type for company background information
export type CompanyBackground = z.infer<typeof CompanyBackgroundSchema>

/**
 * Gather comprehensive background information about a company
 * @param companyName Name of the company to research
 * @param firecrawlApiKey Firecrawl API key
 * @param googleApiKey Google AI API key
 * @param options Additional options for research
 * @returns Promise with structured company background information
 */
export async function gatherCompanyBackground(
  companyName: string,
  options: {
    maxDepth?: number
    timeLimit?: number
    maxUrls?: number
    verbose?: boolean
    companyContext?: string
    peopleGuidance?: string
  } = {},
): Promise<CompanyBackground> {
  const {
    maxDepth = 5,
    timeLimit = 180,
    maxUrls = 15,
    verbose = false,
    companyContext = '',
    peopleGuidance = '',
  } = options
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!firecrawlApiKey || !googleApiKey) {
    throw new Error('FIRECRAWL_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY are required')
  }

  const logVerbose = (message: string) => {
    if (verbose) console.log(chalk.blue(message))
  }

  // Step 1: Use Firecrawl for deep research
  logVerbose(`Starting deep research on ${companyName}...`)

  // Build the research prompt with optional context
  let contextInfo = ''
  if (companyContext) {
    contextInfo += `\nAdditional context about the company: ${companyContext}`
  }

  let peopleInfo = '7. Key executives, founders, and leadership'
  if (peopleGuidance) {
    peopleInfo += ` - especially focus on ${peopleGuidance}`
  }

  const researchPrompt = `
    Perform comprehensive research on the company "${companyName}".${contextInfo}
    
    I need detailed information about:
    1. Official company name and website
    2. Their LinkedIn page
    3. What products or services they offer
    4. Any recent news or developments
    5. Funding information and history
    ${peopleInfo}
    
    Be thorough in your research and provide URLs for all information sources.
  `

  const firecrawl = createFirecrawlClient(firecrawlApiKey)
  const researchResult = await firecrawl.deepResearch(
    {
      query: researchPrompt,
      maxDepth,
      timeLimit,
      maxUrls,
    },
    5000,
    verbose
      ? (activity) => {
          const depthPrefix = `[Depth ${activity.depth}]`
          const typePrefix = `[${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}]`
          console.log(chalk.yellow(`${depthPrefix} ${typePrefix} ${activity.message}`))
        }
      : undefined,
  )

  // Step 2: Use Google AI to structure the data
  logVerbose('Processing research data with Google AI...')

  const finalAnalysis = researchResult.finalAnalysis || ''

  // Add the sources to the prompt for more context
  const sourcesText = researchResult.sources
    .map((source, i) => `[${i + 1}] ${source.title}: ${source.url}`)
    .join('\n')

  const googleAI = new GoogleAI(googleApiKey)

  // Add people guidance to the structuring prompt if provided
  let peopleGuidanceInfo = ''
  if (peopleGuidance) {
    peopleGuidanceInfo = `For the "people" field, please focus on ${peopleGuidance}.`
  }

  const structuringPrompt = `
    Based on the following research about ${companyName}, extract and structure the information according to the schema.
    
    RESEARCH ANALYSIS:
    ${finalAnalysis}
    
    SOURCES:
    ${sourcesText}
    
    ${peopleGuidanceInfo}
    
    Extract only factual information that's supported by the research. If any field has no clear information, provide your best estimate but mark it with "(estimated)" or indicate "Unknown" if there is no basis for estimation.
  `

  try {
    const companyData = await googleAI.generateStructuredData(
      structuringPrompt,
      CompanyBackgroundSchema,
    )

    logVerbose('Successfully structured company background data')
    return companyData
  } catch (error) {
    console.error(chalk.red('Error structuring company data:'), error)
    throw new Error(`Failed to structure company data: ${error}`)
  }
}
