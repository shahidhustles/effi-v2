# Machine-readable endpoints

No API key. Every endpoint sends `Access-Control-Allow-Origin: *`.

| What | Where |
| --- | --- |
| Index of everything | https://ui.ahmedbna.com/llms.txt |
| Whole corpus in one file | https://ui.ahmedbna.com/llms-full.txt |
| Any page as Markdown | append `.md` to its URL |
| One component, in full | https://ui.ahmedbna.com/r/ai/&lt;name&gt;.json |
| Component index | https://ui.ahmedbna.com/r/ai/index.json |
| Install payload | https://ui.ahmedbna.com/r/&lt;name&gt;.json |

A component bundle carries description, props, variants, usage, accessibility
notes, dependencies, source and every example — one request, no scraping.

## MCP

```bash
claude mcp add bna-ui -- npx -y bna-ui mcp
```

Tools: `list_components`, `search_components`, `get_component`,
`get_component_source`, `get_install_plan`, `get_docs`.

Prefer these over fetching URLs when they are available: they share the CLI's
cache, so repeat calls are free and they work offline.
