# Bibliography Tooling

This tool is customized to the local AgentOS toolchain instead of using generic command indirection.

## Fixed toolchain contract

- AgentOS CLI: `/home/leslie/code/AgentOS/.venv/bin/agentos`
- AgentOS MCP server: `/home/leslie/code/AgentOS/.venv/bin/agentos-mcp`
- AgentOS config: `/home/leslie/code/AgentOS/.env`

## Checked capabilities

- `academic_search`
  - provided by `agentos search --mode academic`
- `zotero`
  - provided by `agentos zotero-search` and `agentos zotero-read`
  - expects `ZOTERO_USER_ID` and `ZOTERO_API_KEY`
- `mineru`
  - provided by AgentOS MinerU adapters
  - expects either `MINERU_API_TOKEN` or `MINERU_KIE_API_TOKEN` plus `MINERU_KIE_PIPELINE_ID`

## Stage requirements

- `plan`: AgentOS CLI
- `screening`: AgentOS CLI + academic search + Zotero
- `review`: AgentOS CLI + AgentOS MCP + Zotero + MinerU
- `decision`: AgentOS CLI + Zotero
- `evidence-pack`: AgentOS CLI
- `audit`: AgentOS CLI + Zotero
