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
  prompt: string,
  onStep?: StreamTextOnStepFinishCallback<ToolSet>,
  onTextChunk?: OnTextChunkCallback,
  tools: ToolSet = {},
  steps: number = 10,
): Promise<string> {
  let completeText = ''

  const { textStream, fullStream } = streamText({
    model: anthropic('claude-3-7-sonnet-latest'),
    prompt,
    tools,
    maxSteps: steps,
    onStepFinish: onStep,
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
