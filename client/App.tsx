import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

// Types for our response chunks
type ToolCall = {
  tool: string
  args: Record<string, any>
  result?: any
}

// Instead of having separate chunks, we'll maintain a single response that gets updated
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
    isComplete: false
  })
  const responseEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when response updates
  useEffect(() => {
    if (responseEndRef.current) {
      responseEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [response])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    setResponse({
      text: '',
      toolCalls: [],
      isComplete: false
    })

    try {
      const eventSource = new EventSource(`/api/chat?prompt=${encodeURIComponent(prompt)}`)
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        setResponse(prev => {
          switch (data.type) {
            case 'text':
              // Append new text to existing text
              return {
                ...prev,
                text: prev.text + data.content
              }
            case 'tool_call':
              // Add new tool call to the array
              return {
                ...prev,
                toolCalls: [...prev.toolCalls, data.toolCall]
              }
            case 'tool_result':
              // Update the matching tool call with its result
              const updatedToolCalls = prev.toolCalls.map(tc =>
                tc.tool === data.toolCall.tool ? data.toolCall : tc
              )
              return {
                ...prev,
                toolCalls: updatedToolCalls
              }
            default:
              return prev
          }
        })
      }
      
      eventSource.onerror = () => {
        eventSource.close()
        setIsLoading(false)
        setResponse(prev => ({ ...prev, isComplete: true }))
      }
      
      eventSource.addEventListener('done', () => {
        eventSource.close()
        setIsLoading(false)
        setResponse(prev => ({ ...prev, isComplete: true }))
      })
    } catch (error) {
      console.error('Error sending prompt:', error)
      setIsLoading(false)
      setResponse(prev => ({ 
        ...prev, 
        error: 'Error processing request', 
        isComplete: true 
      }))
    }
  }

  // Render a tool call with special UI
  const renderToolCall = (toolCall: ToolCall, index: number) => {
    return (
      <div key={index} className="tool-call">
        <div className="tool-call-header">
          <span className="tool-name">{toolCall.tool}</span>
          <span className="tool-status">{toolCall.result ? 'completed' : 'called'}</span>
        </div>
        <div className="tool-call-content">
          <pre>{JSON.stringify(toolCall.args, null, 2)}</pre>
        </div>
        {toolCall.result && (
          <div className="tool-call-result">
            <pre>{JSON.stringify(toolCall.result, null, 2)}</pre>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="chat-container">
        {/* Input section at the top */}
        <div className="input-section">
          <form onSubmit={handleSubmit}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              disabled={isLoading}
              rows={3}
            />
            <button type="submit" disabled={isLoading || !prompt.trim()}>
              {isLoading ? 'Processing...' : 'Send'}
            </button>
          </form>
        </div>

        {/* Response section below */}
        <div className="response-section">
          {/* Tool calls section */}
          {response.toolCalls.length > 0 && (
            <div className="tool-calls-section">
              {response.toolCalls.map((tc, i) => renderToolCall(tc, i))}
            </div>
          )}

          {/* Markdown response */}
          {response.text && (
            <div className="markdown-response">
              <ReactMarkdown>{response.text}</ReactMarkdown>
            </div>
          )}

          {isLoading && <div className="loading">Thinking...</div>}
          {response.error && <div className="error">{response.error}</div>}
          <div ref={responseEndRef} />
        </div>
      </div>

      <style jsx>{`
        .app {
          height: 100vh;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .input-section {
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .input-section form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          font-size: 16px;
          resize: none;
          font-family: inherit;
        }

        textarea:focus {
          outline: none;
          border-color: #4dabf7;
          box-shadow: 0 0 0 2px rgba(77, 171, 247, 0.2);
        }

        button {
          padding: 12px 24px;
          background: #228be6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        button:hover:not(:disabled) {
          background: #1c7ed6;
        }

        button:disabled {
          background: #adb5bd;
          cursor: not-allowed;
        }

        .response-section {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .markdown-response {
          line-height: 1.6;
          color: #343a40;
        }

        .markdown-response :global(h1),
        .markdown-response :global(h2),
        .markdown-response :global(h3) {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
        }

        .markdown-response :global(p) {
          margin-bottom: 16px;
        }

        .markdown-response :global(pre) {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
        }

        .markdown-response :global(code) {
          font-family: monospace;
          font-size: 14px;
        }

        .tool-call {
          border: 1px solid #e9ecef;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .tool-call-header {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f1f3f5;
          border-bottom: 1px solid #e9ecef;
        }

        .tool-name {
          font-weight: 600;
          color: #228be6;
        }

        .tool-status {
          color: #868e96;
          font-size: 14px;
        }

        .tool-call-content,
        .tool-call-result {
          padding: 16px;
        }

        .tool-call-result {
          background: #f8f9fa;
          border-top: 1px dashed #e9ecef;
        }

        .loading {
          color: #868e96;
          font-style: italic;
          text-align: center;
          padding: 12px;
        }

        .error {
          color: #e03131;
          text-align: center;
          padding: 12px;
          background: #fff5f5;
          border-radius: 6px;
        }

        pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      `}</style>
    </div>
  )
}

export default App