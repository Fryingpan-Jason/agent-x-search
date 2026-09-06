# Engineering and evidence

Implementation: Node >=24.5, ESM, zero runtime dependencies. settings handles flags/environment, credentials handles auth/redaction, search handles Responses, runner handles optional CLI, transport handles stdio, command exposes serve/doctor/config. src/server.mjs is a compatibility entry for existing fixed-path registrations. Runtime modules never import the development SDK.

Development commands: `npm ci --ignore-scripts`, `npm test`, `npm run test:package`, `npm run bench`, `npm run audit:release`. All are inference-free. Test scratch defaults to OS temp; AGENT_X_SEARCH_TEST_TMP can select an external non-Git test directory. Reports and installed-package checks are generated under ignored `.artifacts/`. Private predecessor evidence is retained locally, not in public history.

## Verification levels

| Check | Status |
| --- | --- |
| Windows / Node 26.8.1 source tests | 28 passed; includes owned-process timeout/cancellation |
| Official MCP SDK | Default and opt-in discovery plus injected-provider calls passed |
| API-key billing route | Offline contracts only; experimental, no live paid call |
| Subscription direct / CLI | Historical predecessor live success, dated in demo/performance; current candidate makes no new inference calls |
| Actual Codex | Candidate saved-config migration parsed by Codex CLI; official SDK initialized the exact saved command, found both locally enabled tools, rejected invalid calls without inference (54.134 ms) |
| Other five applications | Config shape provided/checked, application verification pending |
| macOS/Linux and Node 24.5 | Six-job CI workflow prepared; not executed before repository publication |

Package and benchmark commands produce machine-readable reports. Package tests install the tarball with no dev dependencies, execute the installed bin shim, initialize the installed production entry, and call shipped modules with an injected fake provider using the SDK. They do not claim to validate xAI credentials.

The release audit checks tracked files, package file selection, budgets, and (with --history) every reachable public commit. AGENT_X_SEARCH_AUDIT_AUTH_FILE optionally enables exact comparison with an existing local auth file; no values or that path are saved in the report. CI uses pattern checks without any credential file.

Local package verification passed: 14 shipped files, 18,216 bytes compressed, no runtime dependencies; installed Windows command shim, installed production entry, shipped-module fake-provider calls, six configuration formats, and installed/source file hashes checked. The tarball SHA-256 is recorded in the release handoff. Registry metadata validated against the official 2025-12-11 schema on 2026-09-06; it has not been submitted. Registry schema validation was a documentation request, not inference.

The earlier complete real-user Codex app-server diagnostic timed out before initialize; saved-command transport and separate Codex-client discovery were passing checks. Do not replace that history with a claim that every application path passed.

No live test runs automatically. Original account-specific request allowances are exhausted; new live checks require explicit capped authorization, and API-key spend requires its own authorization. Unknown usage fields stay null. The package has no install/publish hooks that run code or change client settings.
