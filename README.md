

<img src="images/opensdr-wordmark.png" alt="Open-SDR Logo" width="500"/>

OpenSDR helps you research companies and find people on LinkedIn, automating the tedious aspects of lead generation.

## Getting Started

OpenSDR is a commandline tool you'll run from Terminal and you need to install it with `npm`. 

Note: these instructions are for Mac OSX. OpenSDR should work on non-Mac systems but you'll need to adapt the instructions.

**0.  Dependencies**

In a Terminal, run:
```
npm -v
```
If this prints a number like `10.8.2`, you're good to go! If not, you need to [download and install Node.js](https://nodejs.org/en/download)


**1. Install OpenSDR**
```
npm install -g open-sdr
```

**2. Login to LinkedIn**
```
sdr login
```
This will open LinkedIn in a browser for you to login. Open-SDR will use this browser session for its operations.

**3. Set up API keys:**
   
Create a `.env` file with your API keys and run `sdr` in the same directory. In Terminal `cd ~` will move you to your home directory, something like `/Users/matt`.
```
FIRECRAWL_API_KEY=<your key>            (for research)
GOOGLE_GENERATIVE_AI_API_KEY=<your key> (for processing and scraping)
ANTHROPIC_API_KEY=<your key>            (for the primary agent loop)
RIME_API_KEY=<>                         (for TTS to notify of progress, optional, disable in mcp.ts)
```

- [Get a Firecrawl API Key](https://docs.firecrawl.dev/introduction)
- [Get a Google AI API Key](https://ai.google.dev/gemini-api/docs/api-key)
- [Get an Anthropic API Key](https://docs.anthropic.com/en/api/getting-started)
- [Get a Rime API key](https://www.rime.ai/)

## How to use OpenSDR

OpenSDR can be used in 2 ways:
- `sdr agent <promptFilePath>` - A stand-alone agent via commandline interface (CLI) that is an MCP client. You provide the agent a task like researching a list of companies and it gets to work.
- `sdr server` - An MCP server that gives tools for research and lead generation to other MCP clients like Claude Desktop.


### Available Tool Commands

All of the tools OpenSDR agent has are available via `sdr tools <command>`. You can provide these tools to another MCP client using `sdr server`.

**findLinkedinConnectionsAt**: Find first or second-degree connections at a specific company
  ```
  sdr tools findLinkedinConnectionsAt --companyName="Company Name" --degree="first|second"
  ```

**findProfile**: Find a LinkedIn profile by name, optionally filtered by company
  ```
  sdr tools findProfile --personName="Person Name" [--companyName="Company Name"]
  ```

**findMutualConnections**: Find mutual connections with a person on LinkedIn
  ```
  sdr tools findMutualConnections --personName="Person Name" [--companyName="Company Name"]
  ```

**draftMessage**: Open browser to draft a message to a LinkedIn connection
  ```
  sdr tools draftMessage --profileUrl="https://linkedin.com/in/profile" --message="Your message"
  ```

**researchCompany**: Gather comprehensive background information about a company
  ```
  sdr tools researchCompany --companyName="Company Name" [--companyContext="They are an AI startup"] [--peopleGuidance="Focus on engineers"]
  ```

**deepResearch**: Perform deep research on a topic using Firecrawl
  ```
  sdr tools deepResearch --query="Research topic" [--maxDepth=5] [--timeLimit=180] [--maxUrls=15]
  ```

**runAgentOnEachCompany**: Run the SDR agent for each company mentioned in a prompt
  ```
  sdr tools runAgentOnEachCompany --prompt="Your prompt with multiple companies"
  ```

**writeSdrNotes**: Write markdown content to a file in the SDR notes directory
  ```
  sdr tools writeSdrNotes --content="Markdown content" [--filename="notes"] [--subdirectory="research"]
  ```

## Standalone Agent

Open-SDR provides several command-line tools:

```
sdr tools <command> # Run specific tools directly
sdr agent <promptFile>  # Run an agent with a prompt file
```

There are sample prompts in the `sample_prompts` directory.


### Agent Architecture

The OpenSDR agent will operate in a single context and can spawn sub-agents per company to ensure comprehensive research and efficient use of context.

<img src="images/agent-arch.png" alt="Agent Architecture" width="400"/>

### MCP Client

The standalone agent is an MCP which means it can integrate tons of other capabilities. See [PulseMCP](https://www.pulsemcp.com/) to find example servers.

This is configurable from `src/mcp.ts` by updating the `mcpCommands`. EnvVars will be read from `.env` and your local environment.

By default the agent comes with  **Rime** installed for text-to-speech to notify of progress but this can be disabled.

### Potential Integrations ideas

Open-SDR could be extended to work with:

- **Apollo**: Add email enrichment
- **Notion**: Store and organize research findings
- **Slack**: Share briefings and research summaries

## MCP Server

Open-SDR implements the Model Context Protocol (MCP) server, allowing you to use its tools with compatible AI systems.

To start the server:
```
sdr server
```

This will output an MCP config JSON object you can use to configure an MCP client. 

[Claude Desktop](https://modelcontextprotocol.io/quickstart/user) is a great MCP client to get started with. This will allow you to make requests of OpenSDR like any other LLM tool without using the terminal.

## Note taking

By default OpenSDR will takes notes to a sub-directory `./sdr_notes` from whereever you run it. You can prompt it not to take notes of course.

## How does it work?

OpenSDR accesses Linkedin using [Puppeteer](https://pptr.dev/) to manage a browser that the user logs into.

Research capabilities are provided by [Firecrawl](https://www.firecrawl.dev/)

## Built with Ref

Built with [ref.tools](https://ref.tools)

## License

MPL 2.0

