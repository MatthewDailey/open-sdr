/**
 * @fileoverview Provides validation for workflows to determine if they are supported by available tools
 */

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { Tool } from 'ai'

// Define the validation result schema
const validationResultSchema = z.object({
  workflowSupported: z.boolean(),
  capabilities: z
    .array(
      z.object({
        description: z.string(),
        isCapable: z.boolean(),
      }),
    )
    .optional(),
})

type ValidationResult = z.infer<typeof validationResultSchema>

/**
 * Validates a workflow against available tools to determine if it can be executed
 *
 * @param workflow - The workflow object to validate
 * @param tools - The available tools
 * @returns A validation result indicating if the workflow is supported and any missing capabilities
 */
export async function validateWorkflow(
  workflow: Record<string, any>,
  tools: Record<string, Tool>,
): Promise<ValidationResult> {
  try {
    // Extract available tool names
    const availableTools = Object.keys(tools)

    // Use generateObject to analyze workflow and determine if it's supported
    const result = await generateObject({
      model: anthropic('claude-3-7-sonnet-latest'),
      schema: validationResultSchema,
      system: `You are an AI workflow validator. Your task is to analyze a given workflow and determine if it can be supported by the available tools.
      
      Available tools: ${availableTools.join(', ')}
      
      Analyze the workflow steps and determine if they can be executed using the available tools. For each capability that's needed,
      provide a description and whether the system is capable of supporting it.
      
      If all capabilities are supported, return { "workflowSupported": true }.
      If any capability is not supported, return { "workflowSupported": false, "capabilities": [...] } with at least one capability having isCapable: false.`,
      prompt: `Please analyze this workflow and determine if it's supported:
      
      ${JSON.stringify(workflow, null, 2)}`,
    })

    return result.object
  } catch (error) {
    console.error('Error validating workflow:', error)
    // Return a default error response
    return {
      workflowSupported: false,
      capabilities: [
        {
          description: 'Error processing workflow validation',
          isCapable: false,
        },
      ],
    }
  }
}
