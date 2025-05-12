
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
- people: [{}]



# TODO

[x] clean up hackathon stuff
[x] try firecrawl deep research
  [x] add a new cli command to
  [x] try one big prompt to find all -> too short, didn't look far enough
  [x] try single companny -> worked pretty well! but quite long. need to have gemini synthesize
[x] try openai deep research
  [x] try on big prompt -> slow, and manual means less interesting to build
  [x] try single company -> actually less useful than firecrawl version 
[] SDR.gatherCompanyBackground(companyName)
[] SDR.findConnectionsToPerson(personName)
[] add puppeteer stealth mode
[] add a 'list-tools' cli command
[] update mcp config to allow including only sepecific tools
[] generalize linkedin connection search
[] given a person, find people i know who know them
[] write file tool
[] rename "Chrome for Testing" to "Chrome for OpenSDR"
[] publishing
  [] generate landing page
  [] update commands to `sdr` and `server`
  [] delete the hackathon web app