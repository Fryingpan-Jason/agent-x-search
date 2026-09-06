# Client setup and verification

All targets connect to the same local stdio server. They are not separate plugins. Config generation does not modify files or authenticate.

From npm: `npx -y agent-x-search@0.1.0 config --client CLIENT`. From a source checkout: `node bin/agent-x-search.mjs config --client CLIENT`. Add `--local` when generating a fixed installed-path command. Add `--auth api-key` explicitly for API billing, or `--enable-deep` for optional subscription CLI research.

| Client | Target | Where / official source | Verification at candidate preparation |
| --- | --- | --- | --- |
| Codex | `codex` | User config.toml or `codex mcp add`; [official MCP docs](https://developers.openai.com/codex/mcp) | Config parsed by installed CLI; saved-command handshake. Full app-server had an earlier timeout. |
| Claude Code | `claude-code` | `.mcp.json` / `claude mcp add`; [official docs](https://code.claude.com/docs/en/mcp) | Generated JSON checked; application not tested |
| Cursor | `cursor` | `.cursor/mcp.json`; [official docs](https://prod.cursor.com/docs/mcp) | Generated JSON checked; application not tested |
| VS Code / Copilot | `vscode` | `.vscode/mcp.json`, uses `servers`; [official docs](https://code.visualstudio.com/docs/agent-customization/mcp-servers) | Generated JSON checked; application not tested |
| OpenCode | `opencode` | opencode.json, uses `mcp` and a command array; [official docs](https://opencode.ai/v2/docs/mcp-servers) | Generated JSON checked; application not tested |
| Cline | `cline` | MCP Servers > Configure, uses `mcpServers`; [official docs](https://docs.cline.bot/mcp/mcp-overview) | Generated JSON checked; application not tested |

All protocol tests also use the official TypeScript MCP client SDK as a development-only dependency. This is protocol evidence, not evidence that six applications were operated. Cloud-only clients cannot launch a server on your local machine. Configure the runtime and credentials in the environment where a remote agent actually executes; copying a local config does not transfer your login.

Portable generated examples live in `examples/clients/`. For native Windows clients that cannot launch the npm command shim, use the fixed-path Node configuration. This avoids shell-wrapper differences and supports paths with spaces through structured command/args arrays.

Long tool calls need an adequate client timeout. Generated Codex, OpenCode and Cline configs request 300 seconds; for other clients use their own timeout setting. A first npx download can need more startup time than an installed local package.

## Settings

Flags > environment > defaults. No writable project config file is required.

| Flag | Environment | Default |
| --- | --- | --- |
| `--auth` | `AGENT_X_SEARCH_AUTH` | `oauth` |
| `--model` | `AGENT_X_SEARCH_MODEL` | `grok-4.6` |
| `--enable-deep` | `AGENT_X_SEARCH_ENABLE_DEEP` | off; accept 0/1/false/true |
| `--grok-home` | `AGENT_X_SEARCH_GROK_HOME`, then `GROK_HOME` | current user's `.grok` |
| `--grok-cli` | `AGENT_X_SEARCH_GROK_CLI` | official home executable, then PATH |
| `--temp-dir` | `AGENT_X_SEARCH_TEMP_DIR` | OS temp / `agent-x-search` |

Path overrides must be absolute. Node fetch follows HTTP_PROXY/HTTPS_PROXY/NO_PROXY when launched with `--use-env-proxy`; SOCKS-only ALL_PROXY is not supported by this Node fetch setup. No system proxy setting changes. The npm bin shebang supplies the Node flag; direct Node launches must include it.

In API-key mode make XAI_API_KEY available to the MCP server, not just to an unrelated terminal. GUI clients may inherit a different environment; use their documented secret/environment facility. The config generator never prints an existing key or writes credentials.

Deep mode requires Grok CLI. It refuses executable hooks, plugins, MCP and LSP integrations discovered by the CLI; direct search does not need this discovery. Do not weaken your unrelated tooling just for an ordinary search: use default direct mode instead. A missing or unsupported CLI setup is an error, never a switch to API billing.
