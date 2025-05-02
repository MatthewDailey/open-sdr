import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Avatar from '@radix-ui/react-avatar'
import { Theme, ThemePanel } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'

// Types for our response chunks
type ToolCall = {
  tool: string
  args: Record<string, any>
  result?: any
}

type Chunk =
  | {
      type: 'text'
      content: string
    }
  | {
      type: 'tool_call'
      content: ToolCall
    }
  | {
      type: 'tool_result'
      content: ToolCall
    }
interface ChatState {
  chunks: Chunk[]
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

// Person card interface for special tool responses
interface PersonInfo {
  name: string
  role: string
  imageURL?: string
  profileLink?: string
  company?: string
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<ChatState>({
    chunks: [],
    isComplete: false,
  })
  const [workflows, setWorkflows] = useState<WorkflowsState>({})
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const [workflowError, setWorkflowError] = useState('')

  // Validation states
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  // State to track which tool calls are expanded
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({})

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
      chunks: [],
      isComplete: false,
    })
    // Reset expanded tools state
    setExpandedTools({})

    try {
      const eventSource = new EventSource(`/api/chat?prompt=${encodeURIComponent(fullPrompt)}`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        setResponse((prev) => {
          switch (data.type) {
            case 'text':
              return {
                ...prev,
                chunks: [...prev.chunks, { type: 'text', content: data.content }],
              }
            case 'tool_call':
              return {
                ...prev,
                chunks: [...prev.chunks, { type: 'tool_call', content: data.toolCall }],
              }
            case 'tool_result':
              return {
                ...prev,
                chunks: [...prev.chunks, { type: 'tool_result', content: data.toolCall }],
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

  // Function to toggle the expanded state of a tool
  const toggleToolExpansion = (index: number) => {
    setExpandedTools((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  // Function to detect if a tool result contains person information
  const isPersonInfoResult = (result: any): boolean => {
    if (!result?.content) return false

    const content = result.content.find((item: any) => item.type === 'text')?.text || ''
    return (
      content.includes('Name:') &&
      (content.includes('Role:') ||
        content.includes('Company:') ||
        content.includes('Profile Link:'))
    )
  }

  // Parse person info from the tool result text
  const parsePersonInfo = (result: any): PersonInfo | null => {
    if (!isPersonInfoResult(result)) return null

    const content = result.content.find((item: any) => item.type === 'text')?.text || ''
    const lines = content.split('\n')

    const personInfo: PersonInfo = {
      name: '',
      role: '',
    }

    lines.forEach((line: string) => {
      if (line.startsWith('Name:')) {
        personInfo.name = line.replace('Name:', '').trim()
      } else if (line.startsWith('Role:')) {
        personInfo.role = line.replace('Role:', '').trim()
      } else if (line.startsWith('ImageURL:')) {
        personInfo.imageURL = line.replace('ImageURL:', '').trim()
      } else if (line.startsWith('Profile Link:')) {
        personInfo.profileLink = line.replace('Profile Link:', '').trim()
      } else if (line.startsWith('Company:')) {
        personInfo.company = line.replace('Company:', '').trim()
      }
    })

    return personInfo.name ? personInfo : null
  }

  // Render a person card for special tool results
  const renderPersonCard = (personInfo: PersonInfo) => {
    return (
      <div className="person-card">
        <div className="person-avatar">
          <Avatar.Root className="avatar-root">
            <Avatar.Image
              className="avatar-image"
              src={personInfo.imageURL}
              alt={personInfo.name}
            />
            <Avatar.Fallback className="avatar-fallback">
              {personInfo.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </Avatar.Fallback>
          </Avatar.Root>
        </div>
        <div className="person-info">
          <div className="person-name">{personInfo.name}</div>
          <div className="person-role">{personInfo.role}</div>
          {personInfo.profileLink && (
            <a
              href={personInfo.profileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-link"
            >
              View Profile
            </a>
          )}
        </div>
      </div>
    )
  }

  // Render tool results
  const renderToolResult = (toolCall: ToolCall, index: number) => {
    if (!toolCall.result) return null

    const isExpanded = expandedTools[index] || false
    const personInfo = parsePersonInfo(toolCall.result)

    return (
      <Collapsible.Root
        className={`tool-result ${isExpanded ? 'expanded' : 'collapsed'}`}
        open={isExpanded}
      >
        <div className="tool-header" onClick={() => toggleToolExpansion(index)}>
          <div className="tool-name">{toolCall.tool}</div>
          <button className="expand-button">{isExpanded ? '−' : '+'}</button>
        </div>

        <Collapsible.Content className="tool-content">
          {personInfo ? (
            renderPersonCard(personInfo)
          ) : (
            <pre className="tool-data">{JSON.stringify(toolCall.result, null, 2)}</pre>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
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

  const coallesceText = (chunks: Chunk[]): Chunk[] => {
    // Combine adjacent text chunks into a single text chunk
    const result: Chunk[] = []

    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i]

      // If this is a text chunk and the previous chunk was also text, combine them
      if (
        currentChunk.type === 'text' &&
        result.length > 0 &&
        result[result.length - 1].type === 'text'
      ) {
        // Append the current text to the previous text chunk
        result[result.length - 1].content += currentChunk.content
      } else {
        // Otherwise, add the chunk as is
        result.push({ ...currentChunk })
      }
    }

    return result
  }
  // Render workflow selection or the chat interface based on selection state
  return (
    <Theme>
      <div className="app">
        {/* Workflow Selection */}
        {!selectedWorkflow && (
          <div className="workflow-selection">
            <h2 style={{ textAlign: 'center' }}>OpenSDR</h2>

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
                    chunks: [],
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
                className="submit-button"
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
            {(response.chunks.length > 0 || response.error) && (
              <div className="response-area">
                {coallesceText(response.chunks).map((chunk, index) => {
                  switch (chunk.type) {
                    case 'text':
                      return (
                        <div key={index} className={`text-response ${chunk.type}`}>
                          {chunk.content}
                        </div>
                      )
                    case 'tool_call':
                      return (
                        <div key={index} className={`tool-call-wrapper ${chunk.type}`}>
                          {renderToolResult(chunk.content, index)}
                        </div>
                      )
                    case 'tool_result':
                      return (
                        <div key={index} className={`tool-result ${chunk.type}`}>
                          {renderToolResult(chunk.content, index)}
                        </div>
                      )
                  }
                })}
                {response.error && <div className="error">{response.error}</div>}
                {isLoading && <div className="loading">Processing...</div>}
              </div>
            )}
          </>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .app {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          
          form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            resize: vertical;
            font-family: inherit;
            font-size: 16px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          
          button {
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .submit-button {
            align-self: flex-end;
            background: #2563eb;
            color: white;
          }
          
          .submit-button:hover {
            background: #1d4ed8;
          }
          
          button:disabled {
            background: #94a3b8;
            cursor: not-allowed;
          }

          .back-button {
            align-self: flex-start;
            background: #f1f5f9;
            color: #475569;
          }

          .back-button:hover {
            background: #e2e8f0;
          }
          
          .response-area {
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-height: 200px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            background: #f8fafc;
          }
          
          .text-response {
            white-space: pre-wrap;
            line-height: 1.5;
            color: #1e293b;
          }
          
          .tool-result {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-top: 8px;
            overflow: hidden;
            transition: all 0.2s ease;
          }
          
          .tool-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            cursor: pointer;
            user-select: none;
            background: #f8fafc;
            transition: background 0.2s ease;
          }

          .tool-header:hover {
            background: #e2e8f0;
          }
          
          .tool-name {
            font-weight: 500;
            color: #475569;
          }
          
          .expand-button {
            border: none;
            background: transparent;
            color: #64748b;
            font-size: 18px;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          
          .tool-content {
            padding: 0;
            overflow: hidden;
          }
          
          .tool-data {
            margin: 0;
            padding: 16px;
            overflow-x: auto;
            font-size: 14px;
            line-height: 1.5;
            color: #334155;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
          }
          
          .error {
            color: #dc2626;
            padding: 12px;
            background: #fef2f2;
            border-radius: 8px;
            border: 1px solid #fecaca;
          }
          
          .loading {
            color: #64748b;
            font-style: italic;
            padding: 12px;
          }

          .workflow-selection {
            display: flex;
            flex-direction: column;
            gap: 16px;
            justify-content: center;
            padding-bottom: 20vh;
            min-height: 100vh;
          }

          .workflow-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
          }

          .workflow-item {
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: white;
          }

          .workflow-item:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }

          .workflow-item h3 {
            margin: 0 0 8px 0;
            color: #0f172a;
          }

          .workflow-item p {
            margin: 0;
            color: #475569;
            font-size: 14px;
          }

          .selected-workflow {
            padding: 16px;
            background: #f0f9ff;
            border-radius: 8px;
            margin-bottom: 16px;
            border: 1px solid #bae6fd;
          }

          .selected-workflow h2 {
            margin: 0 0 8px 0;
            color: #0369a1;
          }

          .selected-workflow p {
            margin: 0 0 16px 0;
            color: #475569;
          }

          label {
            font-weight: 500;
            margin-bottom: 4px;
            color: #334155;
          }
          
          /* Person card styles */
          .person-card {
            display: flex;
            gap: 16px;
            padding: 16px;
            background: white;
            align-items: center;
          }
          
          .person-avatar {
            flex-shrink: 0;
          }
          
          .avatar-root {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
            overflow: hidden;
            user-select: none;
            width: 64px;
            height: 64px;
            border-radius: 100%;
            background-color: #e2e8f0;
          }

          .avatar-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: inherit;
          }

          .avatar-fallback {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #4f46e5;
            color: white;
            font-size: 16px;
            font-weight: 500;
          }
          
          .person-info {
            display: flex;
            flex-direction: column;
          }
          
          .person-name {
            font-weight: 600;
            font-size: 18px;
            color: #0f172a;
          }
          
          .person-role {
            color: #475569;
            font-size: 14px;
            margin-top: 4px;
          }
          
          .profile-link {
            margin-top: 8px;
            color: #2563eb;
            font-size: 14px;
            text-decoration: none;
          }
          
          .profile-link:hover {
            text-decoration: underline;
          }
          
          /* Validation styles */
          .validation-result {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            animation: fadeIn 0.3s ease-in;
          }
          
          .validation-result.supported {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
          }
          
          .validation-result.unsupported {
            background: #fef2f2;
            border: 1px solid #fecaca;
          }
          
          .validation-status {
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
          }
          
          .supported-message {
            color: #16a34a;
          }
          
          .unsupported-message {
            color: #dc2626;
          }
          
          .capabilities-table {
            margin-top: 16px;
          }
          
          .capabilities-table h4 {
            margin: 0 0 12px 0;
            color: #475569;
          }
          
          .capabilities-table table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e2e8f0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .capabilities-table th,
          .capabilities-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .capabilities-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #475569;
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
            background: #f0f9ff;
            border-radius: 8px;
            color: #0369a1;
            display: flex;
            align-items: center;
            margin-bottom: 16px;
            border: 1px solid #bae6fd;
          }
          
          .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-left: 10px;
            border: 3px solid rgba(3, 105, 161, 0.3);
            border-radius: 50%;
            border-top-color: #0369a1;
            animation: spin 1s ease-in-out infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `,
        }}
      />
    </Theme>
  )
}

export default App
