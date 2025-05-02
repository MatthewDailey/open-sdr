import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

// Types for our response chunks
type ToolCall = {
  tool: string
  args: Record<string, any>
  result?: any
}

interface ChatState {
  text: string
  toolCalls: ToolCall[]
  isComplete: boolean
  error?: string
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<ChatState>({
    text: '',
    toolCalls: [],
    isComplete: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    setResponse({
      text: '',
      toolCalls: [],
      isComplete: false,
    })

    try {
      const eventSource = new EventSource(`/api/chat?prompt=${encodeURIComponent(prompt)}`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        setResponse((prev) => {
          switch (data.type) {
            case 'text':
              return {
                ...prev,
                text: prev.text + data.content,
              }
            case 'tool_call':
              return {
                ...prev,
                toolCalls: [...prev.toolCalls, data.toolCall],
              }
            case 'tool_result':
              const updatedToolCalls = prev.toolCalls.map((tc) =>
                tc.tool === data.toolCall.tool ? data.toolCall : tc,
              )
              return {
                ...prev,
                toolCalls: updatedToolCalls,
              }
            default:
              return prev
          }
        })
      }

      eventSource.onerror = () => {
        eventSource.close()
        setIsLoading(false)
        setResponse((prev) => ({ ...prev, isComplete: true }))
      }

      eventSource.addEventListener('done', () => {
        eventSource.close()
        setIsLoading(false)
        setResponse((prev) => ({ ...prev, isComplete: true }))
      })
    } catch (error) {
      console.error('Error sending prompt:', error)
      setIsLoading(false)
      setResponse((prev) => ({
        ...prev,
        error: 'Error processing request',
        isComplete: true,
      }))
    }
  }

  // Simple renderer for tool results
  const renderToolResult = (toolCall: ToolCall) => {
    if (!toolCall.result) return null

    return (
      <div className="tool-result">
        <div className="tool-name">{toolCall.tool}</div>
        <pre className="tool-data">{JSON.stringify(toolCall.result, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        {/* Input section */}
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything..."
            disabled={isLoading}
            rows={4}
          />
          <button type="submit" disabled={isLoading || !prompt.trim()}>
            {isLoading ? 'Processing...' : 'Send'}
          </button>
        </form>

        {/* Response section */}
        <div className="response-area">
          {response.error && <div className="error">{response.error}</div>}

          {/* Text response */}
          {response.text && (
            <div className="text-response">
              <ReactMarkdown>{response.text}</ReactMarkdown>
            </div>
          )}

          {/* Tool results */}
          {response.toolCalls.map((toolCall, index) => (
            <div key={index}>{renderToolResult(toolCall)}</div>
          ))}

          {isLoading && <div className="loading">Processing...</div>}
        </div>
      </div>

      <style>
        {`
          .app {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          
          form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
            font-size: 16px;
          }
          
          button {
            padding: 10px 16px;
            background: #228be6;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            align-self: flex-end;
          }
          
          button:disabled {
            background: #adb5bd;
            cursor: not-allowed;
          }
          
          .response-area {
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-height: 200px;
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 16px;
            background: #f9f9f9;
          }
          
          .text-response {
            white-space: pre-wrap;
            line-height: 1.5;
          }
          
          .tool-result {
            padding: 12px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-top: 8px;
          }
          
          .tool-name {
            font-weight: bold;
            margin-bottom: 8px;
            color: #666;
          }
          
          .tool-data {
            background: #f5f5f5;
            padding: 8px;
            overflow-x: auto;
            border-radius: 2px;
            margin: 0;
          }
          
          .error {
            color: #e03131;
            padding: 12px;
            background: #fff5f5;
            border-radius: 4px;
          }
          
          .loading {
            color: #868e96;
            font-style: italic;
          }
        `}
      </style>
    </div>
  )
}

export default App
