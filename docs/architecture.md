# Architecture

One Node ESM package, no build or runtime dependency. The MCP client manages its stdio process. The executable shebang and fixed-path examples enable Node's environment proxy support.

settings -> command -> transport/runtime -> credentials -> direct Responses or optional CLI runner. Provider endpoints are fixed by explicit auth mode, never by a query. API keys go only to the official API endpoint; subscription credentials only to the CLI subscription proxy. No redirects, retries or fallback. Tokens live in memory; official Grok handles refresh. Client version metadata comes from its existing cache, without a per-query CLI probe.

The small transport supports initialize, ping, tools/list, tools/call and cancellation notifications; it announces only tools capability. Each message is bounded, including fragmented messages; concatenated frames are legal. One active search makes ownership/spend predictable. Official SDK tests check interoperability. Broader protocol needs would justify reconsidering a runtime SDK; this is not a full MCP implementation.

Direct search issues one Responses POST with native x_search. The provider can perform multiple internal searches. Filters are native fields and not duplicated in the ordinary prompt. The response limit is 2 MiB; incomplete answers are flagged. Only final-answer URLs and attached citations count, deduplicated by post ID. Structured MCP content has a JSON text fallback; actual model context consumption depends on the client. CLI and Responses usage fields are provider-reported and may use different input-token accounting conventions.

Deep mode uses a unique non-Git temporary cwd, filtered child environment, API-key auth disabled, no retries or side-model summaries. It refuses discovered hooks/plugins/MCP/LSP integrations, removes unrelated tools, denies shell/file/MCP actions and subagents, and requests a read-only sandbox. Unknown/unsupported protection is an error; it never broadens permissions to succeed. Official Grok owns its normal global session state. Windows kernel protection is not independently proven. Cancellation terminates only the owned CLI process tree; cleanup validates the exact temporary path.

Tradeoffs: Node >=24.5 avoids a proxy dependency but excludes older runtimes. Subscription protocol and CLI filtering can change independently of the public xAI API. Account eligibility, handle aliasing, search coverage and post accuracy are upstream behavior. No cache or telemetry. Paths can be overridden, but credentials are never sent to arbitrary endpoint overrides.
