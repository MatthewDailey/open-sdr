
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


# TODO

[x] clean up hackathon stuff
[] try firecrawl deep research
  [] add a new cli command to hit it directly
  [] try with MCP
[] add a 'list-tools' cli command
[] update mcp config to allow including only sepecific tools
[] generalize linkedin connection search
[] given a person, find people i know who know them
[] write file tool
[] delete the web app? -> replace with something more useful