# Open-SDR

A tool for sales development representatives (SDRs) that leverages AI workflows to automate and enhance lead generation and outreach processes.

## Features

- **Workflow-based AI interactions**: Run predefined workflows for common SDR tasks
- **Web interface**: User-friendly interface for selecting workflows and viewing results
- **MCP Integration**: Leverages the Model Context Protocol to connect with various tools
- **Command line interface**: Run commands directly from the terminal

## Stack details

- React for frontend
- Express for backend API
- TypeScript throughout
- Vite for bundling and dev server (including HMR)
- Vitest for testing
- Model Context Protocol (MCP) for AI tool integration
- CLI support with yargs

## Development

```
npm install
npm run dev     # Starts dev server with hot reload
npm run cli     # Run CLI commands
npm run test    # Run tests
npm run check   # TypeScript checks
npm run format  # Format code with prettier
```

## Workflows

The application comes with predefined workflows in `workflows.yml`:

- **Find Leads**: Search for companies and find connections that match criteria
- **Find Connections**: Discover connections at specific companies
- **Gather Background**: Collect information about companies and prepare reports

Custom workflows can be added by modifying the `workflows.yml` file.

## MCP Tools

The application integrates with various MCP-compatible tools:

- Perplexity for search
- Notion for database operations
- Apify for web scraping
- Rime for text-to-speech

