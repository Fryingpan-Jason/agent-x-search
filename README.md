# Agent X Search

**Give your agent native X search, with original-post citations and transparent usage.**

[中文](README.zh-CN.md) · [Client setup](docs/clients.md) · [Recorded walkthrough](docs/demo.md) · [Measured overhead](docs/performance.md)

An unofficial, local **stdio MCP server**. Existing Grok subscription login by default; explicitly selected xAI API keys are also supported. No browser automation, HTTP server, background service, build step or runtime dependencies.

**0.1.0 is available on [npm](https://www.npmjs.com/package/agent-x-search)** and [GitHub Releases](https://github.com/Fryingpan-Jason/agent-x-search/releases/tag/v0.1.0), with the same installable package archive. API-key mode is experimental and has not been live-tested. [Verification matrix](docs/engineer.md).

## A 30-second walkthrough

Ask your agent:

> Find one recent official Grok feature announcement on X. Include its date and original post URL.

A recorded subscription CLI run returned:

> **24 Aug 2026** — Grok Voice Think Fast 2.0 announcement.
>
> Original post: https://x.com/SpaceXAI/status/2091987538999197752

That call took **32.794 seconds**, one model round. This is historical output from the local predecessor, not a speed promise or a new run of this candidate. [Provenance and transcript replay](docs/demo.md).

## Connect

Requires **Node.js 24.5+**, a local MCP client, network access, and an eligible Grok subscription session or xAI API key. Zero runtime dependencies does not mean zero account requirements or free searches.

Quick start:

```sh
codex mcp add agent-x-search -- npx -y agent-x-search@0.1.0 serve
claude mcp add --transport stdio agent-x-search -- npx -y agent-x-search@0.1.0 serve
```

Set your client's tool timeout to 300 seconds for long searches. Generate a complete config without changing files:

```sh
npx -y agent-x-search@0.1.0 config --client codex
```

Other targets: `claude-code`, `cursor`, `vscode`, `opencode`, `cline`. One package, not six plugins. [Client setup and verification levels](docs/clients.md).

### Fixed-path installation

Avoid runtime npx lookups by installing into a directory you choose:

```sh
npm install --prefix /absolute/path/to/agent-tools --omit=dev --ignore-scripts agent-x-search@0.1.0
node --use-env-proxy /absolute/path/to/agent-tools/node_modules/agent-x-search/bin/agent-x-search.mjs config --client codex --local
```

On Windows, use your own absolute path and quote paths containing spaces. Paste the generated config into your client. It starts the installed file directly; no global npm installation or OS startup item is needed. To install the GitHub archive, use the downloaded `agent-x-search-0.1.0.tgz` instead of the package name.

From source: `node --use-env-proxy bin/agent-x-search.mjs serve`. Only contributors running tests need `npm ci`.

## Authentication and billing

**Default OAuth:** install and sign in with the [official Grok CLI](https://docs.x.ai/build/overview), then run `grok models` to populate its metadata. This package reads that existing session into memory, implements no login, and copies no tokens. If expired, official `grok models` handles refresh. Ordinary searches do not launch the CLI.

The subscription proxy is an internal compatibility surface, not a guaranteed public third-party API. Eligibility, quota and protocol behavior can change. This project is not affiliated with xAI or X and does not promise unlimited or free access.

**Explicit API-key mode:** use `serve --auth api-key` with `XAI_API_KEY` in the MCP server environment. It calls the official xAI Responses endpoint and incurs API charges; no Grok CLI is required. This path has offline contract coverage, not live validation. Never put a key in a prompt or issue.

There is **no automatic billing switch**. Setting `XAI_API_KEY` alone does not change OAuth mode. Failed or uncertain requests are never retried or sent to another backend.

```sh
npx -y agent-x-search@0.1.0 doctor
npx -y agent-x-search@0.1.0 doctor --auth api-key
```

Doctor only reads local state. It does not search, refresh tokens, or validate credentials against xAI.

## Tools

| Tool | Behavior |
| --- | --- |
| `x_search` | Default and normally the only tool. One Responses request; xAI may perform several internal searches. |
| `x_deep_search` | Opt in with `--enable-deep`. Custom subscription-only CLI research, up to four model rounds. Not the official DeepSearch product; filters are prompt guidance. |

Both default to Grok 4.6; `--model MODEL` selects another model available to your auth mode without a discovery request. API-key mode rejects `--enable-deep` to avoid mixing billing modes.

Inputs: `query`, `include_handles` **or** `exclude_handles`, inclusive `from_date`/`to_date`, desired `count` (1–20), `media` (`none`, `images`, `videos`, `both`), and `detail` (`brief`, `standard`, `detailed`). Count/detail are guidance, not retrieval guarantees. [Native parameter contract](https://docs.x.ai/developers/tools/x-search).

Results retain `answer`, `x_citations`, `citation_count`, `citation_status`, `backend`, `model`, `elapsed_ms`; add `auth_mode`, `usage`, and `incomplete`. Missing usage is unknown, not zero. Verify claims against original posts. MCP structured content includes a JSON text fallback for compatibility; client handling determines actual context usage.

## Configure and troubleshoot

Flags override environment variables, then defaults. No project config file is needed. [All settings and errors](docs/clients.md#settings).

- `reauth_required`: use official `grok models` or `grok login`.
- `cli_metadata_required`: run `grok models`; version headers come from its cache.
- `cli_unavailable`: install official Grok CLI or set `--grok-cli`; direct API-key search does not need it.
- `unsafe_cli_integrations`: deep mode refuses your discovered hooks/plugins/MCP/LSP integrations; direct search is independent of that toolset.
- `rate_limited`: wait for quota availability; no retry occurred.
- `request_uncertain`: a timeout may already have consumed quota or API spend. Do not assume it was free.
- Startup/discovery failure: run doctor as the same OS user, check Node/paths, then the client's MCP diagnostics. No model call is needed to diagnose transport.
- Connection timeout around ten seconds: your MCP client may not inherit terminal proxy variables. Explicitly configure HTTP_PROXY/HTTPS_PROXY/NO_PROXY in its server environment and reload the connection. Source checkout adds opt-in proxy config export and `doctor --network`; see [proxy setup](docs/clients.md#settings). These new flags are not in npm 0.1.0. Directly connected networks need no proxy configuration.

No telemetry or persistent result cache. Grok may retain its normal CLI session metadata. See [engineering evidence](docs/engineer.md), [architecture and limits](docs/architecture.md), and [contributing](CONTRIBUTING.md). MIT licensed.
