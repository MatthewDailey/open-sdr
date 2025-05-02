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

// Types for workflows
interface Workflow {
  description: string
  input: string
  steps: string[]
}

interface WorkflowsState {
  [key: string]: Workflow
}

// Types for workflow validation
interface Capability {
  description: string
  isCapable: boolean
}

interface ValidationResult {
  workflowSupported: boolean
  capabilities?: Capability[]
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<ChatState>({
    text: '',
    toolCalls: [],
    isComplete: false,
  })
  const [workflows, setWorkflows] = useState<WorkflowsState>({})
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const [workflowError, setWorkflowError] = useState('')

  // Validation states
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  // Fetch workflows on component mount
  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    setIsLoadingWorkflows(true)
    setWorkflowError('')

    try {
      const response = await fetch('/api/workflows')
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`)
      }
      const data = await response.json()
      setWorkflows(data)
    } catch (error) {
      console.error('Error fetching workflows:', error)
      setWorkflowError('Failed to load workflows. Please try again.')
    } finally {
      setIsLoadingWorkflows(false)
    }
  }

  // Validate workflow when selected
  const validateWorkflow = async (workflowName: string) => {
    setIsValidating(true)
    setValidationResult(null)

    try {
      const workflowToValidate = { [workflowName]: workflows[workflowName] }
      const response = await fetch('/api/validate_workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowToValidate),
      })

      if (!response.ok) {
        throw new Error(`Failed to validate workflow: ${response.statusText}`)
      }

      const result = await response.json()
      setValidationResult(result)
    } catch (error) {
      console.error('Error validating workflow:', error)
      setValidationResult({
        workflowSupported: false,
        capabilities: [
          {
            description: 'Error validating workflow',
            isCapable: false,
          },
        ],
      })
    } finally {
      setIsValidating(false)
    }
  }

  // Handle workflow selection
  const handleWorkflowSelect = (workflowName: string) => {
    setSelectedWorkflow(workflowName)
    validateWorkflow(workflowName)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isLoading || !selectedWorkflow) return

    // Prepare the message with workflow context
    const fullPrompt = `Using the "${selectedWorkflow}" workflow:
Description: ${workflows[selectedWorkflow]?.description}
Input: ${workflows[selectedWorkflow]?.input}
Steps:
${workflows[selectedWorkflow]?.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

User provided input: ${prompt}`

    setIsLoading(true)
    setResponse({
      text: '',
      toolCalls: [],
      isComplete: false,
    })

    try {
      const eventSource = new EventSource(`/api/chat?prompt=${encodeURIComponent(fullPrompt)}`)

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

  // Render validation results
  const renderValidationResults = () => {
    if (isValidating) {
      return (
        <div className="validating">
          Validating workflow capabilities... <span className="spinner"></span>
        </div>
      )
    }

    if (!validationResult) return null

    return (
      <div
        className={`validation-result ${validationResult.workflowSupported ? 'supported' : 'unsupported'}`}
      >
        <div className="validation-status">
          {validationResult.workflowSupported ? (
            <div className="supported-message">
              <span className="emoji">✅</span> This workflow is fully supported!
            </div>
          ) : (
            <div className="unsupported-message">
              <span className="emoji">❌</span> This workflow cannot be completed with current
              capabilities
            </div>
          )}
        </div>

        {!validationResult.workflowSupported && validationResult.capabilities && (
          <div className="capabilities-table">
            <h4>Capability Assessment</h4>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Capability</th>
                </tr>
              </thead>
              <tbody>
                {validationResult.capabilities.map((capability, index) => (
                  <tr key={index}>
                    <td className="status-cell">
                      <span className="emoji">{capability.isCapable ? '✅' : '❌'}</span>
                    </td>
                    <td>{capability.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // Render workflow selection or the chat interface based on selection state
  return (
    <div className="app">
      <div className="container">
        {/* Workflow Selection */}
        {!selectedWorkflow && (
          <div className="workflow-selection">
            <h2>Select a Workflow</h2>

            {isLoadingWorkflows && <div className="loading">Loading workflows...</div>}

            {workflowError && <div className="error">{workflowError}</div>}

            {!isLoadingWorkflows && !workflowError && Object.keys(workflows).length === 0 && (
              <div className="error">No workflows available.</div>
            )}

            {!isLoadingWorkflows && Object.keys(workflows).length > 0 && (
              <div className="workflow-list">
                {Object.entries(workflows).map(([name, workflow]) => (
                  <div
                    key={name}
                    className="workflow-item"
                    onClick={() => handleWorkflowSelect(name)}
                  >
                    <h3>{name}</h3>
                    <p>{workflow.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Interface */}
        {selectedWorkflow && (
          <>
            <div className="selected-workflow">
              <h2>{selectedWorkflow}</h2>
              <p>{workflows[selectedWorkflow]?.description}</p>
              <button
                className="back-button"
                onClick={() => {
                  setSelectedWorkflow('')
                  setPrompt('')
                  setResponse({
                    text: '',
                    toolCalls: [],
                    isComplete: false,
                  })
                  setValidationResult(null)
                }}
              >
                ← Back to workflows
              </button>
            </div>

            {renderValidationResults()}

            <form onSubmit={handleSubmit}>
              <label htmlFor="prompt">{workflows[selectedWorkflow]?.input}:</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Enter ${workflows[selectedWorkflow]?.input.toLowerCase()}...`}
                disabled={
                  isLoading || (validationResult !== null && !validationResult.workflowSupported)
                }
                rows={4}
              />
              <button
                type="submit"
                disabled={
                  isLoading ||
                  !prompt.trim() ||
                  (validationResult !== null && !validationResult.workflowSupported)
                }
              >
                {isLoading ? 'Processing...' : 'Send'}
              </button>
            </form>

            {/* Response section */}
            {(response.text || response.toolCalls.length > 0 || response.error) && (
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
            )}
          </>
        )}
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

          .back-button {
            align-self: flex-start;
            background: #495057;
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
            padding: 12px;
          }

          .workflow-selection {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .workflow-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .workflow-item {
            padding: 16px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .workflow-item:hover {
            background: #f1f3f5;
            border-color: #adb5bd;
          }

          .workflow-item h3 {
            margin: 0 0 8px 0;
            color: #212529;
          }

          .workflow-item p {
            margin: 0;
            color: #495057;
          }

          .selected-workflow {
            padding: 16px;
            background: #e7f5ff;
            border-radius: 4px;
            margin-bottom: 16px;
          }

          .selected-workflow h2 {
            margin: 0 0 8px 0;
            color: #1971c2;
          }

          .selected-workflow p {
            margin: 0 0 16px 0;
            color: #495057;
          }

          label {
            font-weight: 500;
            margin-bottom: 4px;
          }
          
          /* Validation styles */
          .validation-result {
            padding: 16px;
            border-radius: 4px;
            margin-bottom: 16px;
            animation: fadeIn 0.3s ease-in;
          }
          
          .validation-result.supported {
            background: #ebfbee;
            border: 1px solid #40c057;
          }
          
          .validation-result.unsupported {
            background: #fff5f5;
            border: 1px solid #fa5252;
          }
          
          .validation-status {
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
          }
          
          .supported-message {
            color: #2b8a3e;
          }
          
          .unsupported-message {
            color: #e03131;
          }
          
          .capabilities-table {
            margin-top: 16px;
          }
          
          .capabilities-table h4 {
            margin: 0 0 12px 0;
            color: #495057;
          }
          
          .capabilities-table table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #dee2e6;
            background: white;
          }
          
          .capabilities-table th,
          .capabilities-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
          }
          
          .capabilities-table th {
            background: #f1f3f5;
            font-weight: 600;
            color: #495057;
          }
          
          .status-cell {
            text-align: center;
            width: 60px;
          }
          
          .emoji {
            font-size: 18px;
          }
          
          .validating {
            padding: 16px;
            background: #e7f5ff;
            border-radius: 4px;
            color: #1c7ed6;
            display: flex;
            align-items: center;
            margin-bottom: 16px;
          }
          
          .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-left: 10px;
            border: 3px solid rgba(0, 123, 255, 0.3);
            border-radius: 50%;
            border-top-color: #0077ff;
            animation: spin 1s ease-in-out infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  )
}

export default App
