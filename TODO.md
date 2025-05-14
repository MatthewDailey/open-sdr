# Plan 

"what if claude code were an SDR?"
- generalize "find me a warm intro to X company"
- illustrate workflow with deep research
- have a preset of which MCP servers to include

workflow:
1. find more companies or projects like these -> deep research (could automate: firecrawl)
  intput: prompt + list of companies
  output: list of companies or projects + descriptions + key developers (or founders, if small) names + urls
2. Find people I know at these companies and people 
  input: list of companies/projects
  output: list of people I know who work at or on those 
3. Save to markdown file

company_background(company or tool name) -> deep research + structured extract
- name
- urls (homepage, linkedin)
- product + billing
- recent funding
- people: [{name, url, }]



# TODO

[x] clean up hackathon stuff
[x] try firecrawl deep research
  [x] add a new cli command to
  [x] try one big prompt to find all -> too short, didn't look far enough
  [x] try single companny -> worked pretty well! but quite long. need to have gemini synthesize
[x] try openai deep research
  [x] try on big prompt -> slow, and manual means less interesting to build
  [x] try single company -> actually less useful than firecrawl version 
[x] add puppeteer stealth mode
[x] generalize Linkedin.findConnectionsAt(companyName) 
  [x] extract linkedinurls
  [x] screenshot and have gemini return the names and roles + the link as an object
[x] gatherCompanyBackground(companyName)
   [x] allow company context (eg ai tool builders)
   [x] allow people guidance (eg types of people to look for)
   [x] remove company size
[x] LinkedIn.findConnectionsToPerson(personName, companyName?) 
  - https://www.linkedin.com/search/results/people/?keywords=<name> <company name> -> scrape linkedin url
  - copy and open search link https://www.linkedin.com/search/results/people/?facetNetwork=%22F%22&facetConnectionOf=%22ACoAACQesNsB19Z7ZTj7LiGKB3bUqp6GBbo6TbQ%22&origin=MEMBER_PROFILE_CANNED_SEARCH&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base%3B1kJrr3YxQ%2FOwrzzN1FrKfg%3D%3D
  - open search and do same "open and get links" fn as findConnectionsAtd
[x] update findConnectionsAt(degree=second) to use findConnectionsToPerson to find the warm intro for second connection
[x] have research tools in SDR class and add to MCP
[x] add all MCP tools
[x] have all SDR functions return objects and markdown answer
[x] extract research tool
[x] organize commands
  - `sdr login`
  - `sdr tools <command>` 
  - `sdr server`
  - `sdr agent <prompt file>`
[x] loop over companies tool to ensure we hit every one 
  - spawn a sub-agent per company with a command and then aggregates the results
[x] test everything
[x] no remote server for cli agent
[x] connect a golden path workflow
[x] use gemini for agent loop to handle more tokens
  -> undo, seems bad
[x] make sure all workflow steps are passed through verbatim to the inner agent
[x] write file tool to save results (eg as csv)
[x] try "find a list of ai coding tool"
[x] try running it on a larger suite
[x] messaging workflow - given a profile, open message link to person? (have puppeteer open a dom node including background on this person)
  - aria-label message
[x] search often finds people that do not work at the company 
  - add a verify step for each person? or use the screenshot?
[x] make message more stable than using name (ex jay)
[x] make message not die if no message

[x] publishing
  [x] read env from .env (implemented, validate this)
  [x] add binary for global install
  [x] delete the hackathon web app
  [x] move my prompts to sample prompt area
  [x] unify tool definitions (try result: string from MCP ones with claude)
  [x] fix `npm warn` issues on install
  [] factor out MCP config
[x] login cli should have nicer messaging (eg you're now logged in)
  - hit enter to open linkedin in a browser to login, this is th browser that open-sdr will use. 
  - when done, close the browser
  - Done! you can run login again to open linkedin and verify open-sdr is logged in.
  
[] README with 
- /images/opensdr-logomark-vector.png
- description of what SDRs do: research and find people on linkedin
- get started 
  - login
  - firecrawl, gemini, anthropic api keys
- CLI tools
  - tool list
  - agetn architeture images/agent-arch.png
- MCP server
  -- instructions
- MCP client 
  -- rime example
  -- untested MCP ideas i'm sure you could make work: 
    - google sheets (company, person, warm intro) -> test via claude integration
    - try adding an email enrichment service -> apollo
    - try adding store to notion (after allowing filter tools)
    - slack to share briefings
- Built with ref.tools
- License MPL 2.0

[] client demo video 
[] server demo video - in claude show the tools,  "find everyone i'm connected to at Anysphere and draft a message to them each saying I want to talk about Cursor"

[] generate landing page (simpleanalytics) and figma sites! (link to ref at bottom)
[] list of tools provided (visual between these?)
[] landing page og: tags that work
[] note about test browser
[] visual agent architecture about spawning sub agents per company
[] "help! this seems useful but what is MCP?"