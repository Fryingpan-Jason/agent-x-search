# Product scope

Unofficial local MCP for agents that need X evidence with original-post citations. First release: one default native search tool, optional CLI research, portable installation and six client configuration formats.

Approved 0.1.0 behavior: OAuth first, explicit API-key alternative, no automatic billing switch or inference retry. Grok 4.6 is a configurable default. Deep mode is subscription-only, explicitly enabled and capped at four model rounds. Count/detail guide output; native handles/date/media follow the current xAI contract. Unknown usage is not zero.

Release acceptance: compressed package <=100 KiB, zero runtime dependencies, default tool definitions <=4 KiB; official SDK interoperability; installed-package tests, auth boundaries, cancellation/body/frame limits and safe errors; Windows/macOS/Linux by Node 24.5/26 CI; clear separation of mock, historical and current live evidence.

Distribution: GitHub and npm, MIT, English/Chinese README, examples and a candid comparison. Demand is tested through successful installs and useful sourced answers, not guaranteed stars. Registry listing follows npm publication.

Not in this release: hosted HTTP, containers, independent login, general web search, monitoring, provider failover, persistent result cache or one plugin per agent. Implementation and CI use zero new model calls unless separately authorized. API-key mode remains experimental until live verification is explicitly funded.
