# Contributing

Read AGENTS.md and the existing docs. Use project-local `npm ci --ignore-scripts`; the official MCP SDK is test-only. Run `npm test`, `npm run test:package`, `npm run bench`, and `npm run audit:release`.

Use fake credentials and injected providers. Never add a production mock switch, login system, automatic billing fallback or live CI call. Real evidence must state model/auth mode/date/request allowance/limitations. Do not commit credentials or private prompts.

Keep the default tool surface small. New client support needs its official config source, an example and an honest verification level. Bugs need focused regression tests; features need a concrete user workflow.

Separate local overhead from network/model time. Compare equivalent models/queries/settings; a single sample is not p95. Do not fabricate testimonials or advertise unmeasured improvements.

Publishing is a maintainer action after review. Pull requests should explain behavior and relevant tests. Use the issue form without secrets or personal machine inventories.
