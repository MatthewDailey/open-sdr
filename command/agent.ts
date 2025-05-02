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

/**
 * Example usage with a weather tool
 */
/* 
const weatherTool = {
  description: 'Get the current weather in a given location',
  parameters: z.object({
    location: z.string().describe('The city and state, e.g., San Francisco, CA'),
  }),
  execute: async ({ location }) => {
    // In a real implementation, this would call a weather API
    console.log(`Getting weather for ${location}`);
    return {
      temperature: '72°F',
      condition: 'Sunny',
      humidity: '45%',
      location
    };
  },
};

// Example of calling the agent with a tool
const response = await doAgentLoop(
  'What\'s the weather like in San Francisco?',
  (step) => {
    console.log('Step:', step);
  },
  (chunk) => {
    process.stdout.write(chunk);
  },
  { weatherTool }
);
*/
