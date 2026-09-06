# 0.1.0 release candidate

## Review before publication

The GitHub repository and npm package are publication targets, not proof of an existing release. Confirm owner/package availability immediately before publishing. Use only the clean public branch, not local predecessor history or all refs/tags. Run offline tests, package tests and the public history audit on the final tree. Review the tarball file list, integrity and size.

Publishing requires explicit maintainer approval. GitHub/npm authentication belongs to the maintainer; do not send tokens through chat or issue templates. After approved GitHub publication, wait for the Windows/macOS/Linux by Node 24.5/26 CI matrix and fix failures before treating those combinations as supported. Update verification labels to reflect actual outcomes.

Publish only the reviewed tarball as version 0.1.0. Remove the README candidate warning only when its npm installation commands really work. Tag that public release commit, never a private predecessor commit. Do not publish every local branch or push with --mirror.

server.json is draft MCP Registry metadata with matching package mcpName. After npm is available, follow the [official Registry flow](https://modelcontextprotocol.io/registry/quickstart); revalidate its schema at that time. Do not install a publisher tool or register automatically during local preparation.

## Release notes draft

Agent X Search brings native X evidence to your local MCP client: one default search tool, original-post links, existing Grok login reuse, explicit API billing and optional CLI research. It has zero runtime dependencies, no build/server deployment, six config formats, and offline tests of the installed package using the official MCP SDK.

API-key mode is experimental pending live verification. The subscription proxy may change. Historical model timings are examples, not an implementation speed claim. Check the compatibility matrix for tested configurations.

## Launch copy draft — not posted

I built a small MCP for agents that need original X posts as evidence. It reuses an existing Grok CLI login or an explicitly selected xAI API key. The default path avoids launching a full coding agent; optional CLI research is separate. Installation/config examples, package measurements and limitations are in the repository. I would especially like feedback on first-install problems and useful real-world searches.

## Feedback-driven follow-up

Prioritize installation failures, sources users can actually use, and repeat workflows. Maintain a dated compatibility table and improve docs from issues. Prepare targeted submissions to relevant MCP directories and community channels only after release and authorization. Do not buy stars, imply endorsements or claim unsupported benchmarks. Use case examples: verify an announcement, locate developer discussion, trace an original claim. No default telemetry; downloads/stars are secondary to working installs and outside contributions.
