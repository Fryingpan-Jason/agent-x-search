# Contributing

Read AGENTS.md and the existing docs. Use project-local `npm ci --ignore-scripts`; the official MCP SDK is test-only. Run `npm test`, `npm run test:package`, `npm run bench`, and `npm run audit:release`.

Use fake credentials and injected providers. Never add a production mock switch, login system, automatic billing fallback or live CI call. Real evidence must state model/auth mode/date/request allowance/limitations. Do not commit credentials or private prompts.

Keep the default tool surface small. New client support needs its official config source, an example and an honest verification level. Bugs need focused regression tests; features need a concrete user workflow.

Separate local overhead from network/model time. Compare equivalent models/queries/settings; a single sample is not p95. Do not fabricate testimonials or advertise unmeasured improvements.

Publishing is a maintainer action after review. Pull requests should explain behavior and relevant tests. Use the issue form without secrets or personal machine inventories.

## Branches and releases

- `main` is the single active integration branch, locally and on GitHub. It may contain changes newer than the latest release; a release is identified by its version tag, not the branch name.
- Small maintainer changes may be committed directly to `main` after relevant checks. Use a short-lived `codex/feat-<topic>`, `codex/fix-<topic>` or `codex/docs-<topic>` branch when isolation or review helps. Start from current `main`, merge back after verification, and delete merged task branches. A PR is optional unless repository rules require one.
- Local `archive/local-prototype` and `archive/release-prep-v0.1.0` preserve pre-publication history. They are not development or release branches. Never push them, merge their history into `main`, or use `git push --all` / `--mirror`.
- Use `MAJOR.MINOR.PATCH` package versions and matching `vMAJOR.MINOR.PATCH` Git tags. Fixes use a patch increment; backward-compatible features use a minor increment; breaking changes use a major increment after 1.0. Before 1.0, breaking changes use a minor increment and must be clearly documented. Documentation-only changes do not require a new package release.
- If a prerelease is needed, use `X.Y.Z-rc.1` and tag `vX.Y.Z-rc.1`; mark it as a GitHub prerelease and use the npm `next` dist-tag. No permanent release branch is needed for the current single maintained version line.
- Before publishing, update package/runtime/registry metadata and install examples together, record changes in CHANGELOG.md, and run the relevant source, package and release checks. Tag the verified commit and publish the same tested archive to GitHub and npm. Existing release tags and package versions are immutable; a correction requires a new version.
- Record GitHub and npm publication status separately in docs/build-log.md. A successful merge or push does not itself publish a release. Publishing still requires maintainer authorization.
