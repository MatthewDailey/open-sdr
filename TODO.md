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
[] clean up console output
[] have research tools in SDR class and add to MCP
[] sub-command all tools under `sdr tools <command>` and have a `sdr server` and `sdr agent`
[] connect a golden path workflow
[] update mcp config to allow including only sepecific tools for other servers

[] niceties
  [] rename "Chrome for Testing" to "Chrome for OpenSDR"
  [] login cli should have nicer messaging
[] MCP explorations
  [] write file tool to save results (eg as csv)
  [] google sheets
  [] try adding an email enrichment service
  [] try adding store to notion (after allowing filter tools)
[] publishing
  [] read env from .env
  [] clean up logs
  [] generate landing page (simpleanalytics) and figma sites!
  [] update commands to `sdr` and `server`
  [] delete the hackathon web app
  [] setup steps: firecrawl, gemini, anthropic