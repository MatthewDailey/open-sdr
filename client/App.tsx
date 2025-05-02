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
    isComplete: false
  })

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
              return {
                ...prev,
                text: prev.text + data.content
              }
            case 'tool_call':
              return {
                ...prev,
                toolCalls: [...prev.toolCalls, data.toolCall]
              }
            case 'tool_result':
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

  // Render search-like results in a horizontal scrolling container
  const renderSearchResults = (results: any[]) => {
    return (
      <div className="results-scroll">
        <div className="results-container">
          {results.map((result, index) => (
            <div key={index} className="result-card">
              <h3>{result.title}</h3>
              <p>{result.snippet}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render tool results based on their type
  const renderToolResult = (toolCall: ToolCall) => {
    if (!toolCall.result) return null

    // If the result has a results array (like search results), render as cards
    if (Array.isArray(toolCall.result.results)) {
      return renderSearchResults(toolCall.result.results)
    }

    // For weather-like results, render as a single card
    return (
      <div className="single-result-card">
        {Object.entries(toolCall.result).map(([key, value]) => (
          <div key={key} className="result-item">
            <span className="result-label">{key}:</span>
            <span className="result-value">{value as string}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="content">
        {/* Input section */}
        <div className="input-section">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !prompt.trim()}>
              {isLoading ? 'Processing...' : 'Send'}
            </button>
          </form>
        </div>

        {/* Results section */}
        <div className="results-section">
          {/* Tool Results */}
          {response.toolCalls.length > 0 && (
            <div className="tool-results">
              {response.toolCalls.map((tc, i) => (
                <div key={i} className="tool-result">
                  {renderToolResult(tc)}
                </div>
              ))}
            </div>
          )}

          {/* Markdown response */}
          {response.text && (
            <div className="markdown-response">
              <ReactMarkdown>{response.text}</ReactMarkdown>
            </div>
          )}

          {isLoading && <div className="loading">Processing your request...</div>}
          {response.error && <div className="error">{response.error}</div>}
        </div>
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: #f8f9fa;
          padding: 2rem;
        }

        .content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .input-section {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        form {
          display: flex;
          gap: 1rem;
        }

        input {
          flex: 1;
          padding: 1rem 1.5rem;
          font-size: 1.1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          transition: all 0.2s;
        }

        input:focus {
          outline: none;
          border-color: #228be6;
          box-shadow: 0 0 0 3px rgba(34, 139, 230, 0.1);
        }

        button {
          padding: 0 2rem;
          background: #228be6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
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

        .results-section {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .tool-results {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .results-scroll {
          width: 100%;
          overflow-x: auto;
          padding: 0.5rem;
          -webkit-overflow-scrolling: touch;
        }

        .results-container {
          display: flex;
          gap: 1rem;
          padding: 0.5rem;
        }

        .result-card {
          flex: 0 0 300px;
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .result-card h3 {
          margin: 0 0 1rem 0;
          color: #1a1a1a;
          font-size: 1.1rem;
        }

        .result-card p {
          color: #666;
          font-size: 0.95rem;
          margin: 0;
        }

        .single-result-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .result-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #f1f3f5;
        }

        .result-item:last-child {
          border-bottom: none;
        }

        .result-label {
          color: #868e96;
          font-weight: 500;
          text-transform: capitalize;
        }

        .result-value {
          color: #1a1a1a;
          font-weight: 500;
        }

        .markdown-response {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          line-height: 1.6;
        }

        .markdown-response :global(h1),
        .markdown-response :global(h2),
        .markdown-response :global(h3) {
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          color: #1a1a1a;
        }

        .markdown-response :global(p) {
          margin-bottom: 1rem;
          color: #444;
        }

        .markdown-response :global(pre) {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .markdown-response :global(code) {
          font-family: monospace;
          font-size: 0.9rem;
        }

        .loading {
          text-align: center;
          color: #868e96;
          font-style: italic;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .error {
          text-align: center;
          color: #e03131;
          padding: 2rem;
          background: #fff5f5;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  )
}

export default App