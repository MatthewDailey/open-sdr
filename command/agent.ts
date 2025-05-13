/**
 * @fileoverview This file defines the `doAgentLoop` function, which runs an AI agent loop using the Anthropic model with streaming responses and optional tool support. It utilizes the `StreamTextOnStepFinishCallback` and `OnTextChunkCallback` types for handling agent steps and text generation.
 */

import { anthropic } from '@ai-sdk/anthropic'
import { streamText, type StreamTextOnStepFinishCallback, type ToolSet } from 'ai'

/**
 * Callback function for text chunks
 */
type OnTextChunkCallback = (chunk: string) => void | Promise<void>

/**
 * Run an AI agent loop with streaming responses and tool support
 *
 * @param prompt - The user prompt to process
 * @param onStep - Callback function called on each agent step (thinking, tool calling, etc.)
 * @param onTextChunk - Callback function called when text is generated
 * @param tools - Optional array of tools the agent can use
 * @returns The complete text response from the agent
 */
export async function doAgentLoop(
  prompt: { system: string; user: string },
  onStep?: StreamTextOnStepFinishCallback<ToolSet>,
  onTextChunk?: OnTextChunkCallback,
  tools: ToolSet = {},
  steps: number = 10,
): Promise<string> {
  let completeText = ''

  console.log('Tools:', tools)
  const { textStream, fullStream } = streamText({
    model: anthropic('claude-3-5-sonnet-latest'),
    system: prompt.system,
    prompt: prompt.user,
    tools,
    maxSteps: steps,
    onStepFinish: onStep,
    onError: (error) => {
      console.error('Error:', error)
    },
  })

  for await (const chunk of textStream) {
    if (typeof chunk === 'string') {
      completeText += chunk
      if (onTextChunk) {
        await onTextChunk(chunk)
      }
    }
  }

  return completeText
}
