# Current release handoff

0.1.0 release candidate ready for review. Public name: agent-x-search; intended GitHub owner: Fryingpan-Jason. Public GitHub/npm/Registry publication and public posts are not authorized by preparation alone and have not happened.

Implemented: explicit auth modes, portable configuration, one default tool, opt-in CLI research, response/cancellation limits, six config formats, offline doctor, package metadata, official SDK tests and CI. Final source tests: 28/28 on Windows / Node 26.8.1. Installed-tarball tests and local credential/file/package audit passed. Exact saved Codex command passed official SDK handshake/discovery/invalid-input checks after migration; local fixed-path registration keeps deep mode explicitly enabled. No new inference calls.

Old local history remains available for rollback and must not be pushed. The clean release branch is public-main; its initial tree excludes private reports and machine-specific artifacts. Audit that branch with npm run audit:release -- --history, not the private predecessor branches. Private baseline evidence is not part of the npm package or public history.

Artifact: agent-x-search-0.1.0.tgz, 18,216 bytes, 14 files, SHA-256 ea854c8a442752c7e2e6f6a87f2ccc1183f1eaba1d0bbf76b978f68efe5f1874. Generated reports are local artifacts rather than committed CI claims. Default tool definitions: 1,218 bytes. Startup p50 51.922 ms; mock roundtrip p50 0.370 ms; methodology and the non-speedup comparison are in performance.md. Registry draft passed the official 2025-12-11 schema.

Limitations: no new model calls in this preparation; API-key path remains experimental, and non-Windows CI/application checks remain pending. The historical demo is explicitly dated. No speedup guarantee or star-count claim.

Next after candidate review and explicit publication authorization: recheck repository/npm name availability, publish only the clean public branch, run remote CI, review its results, then publish the reviewed npm tarball. Registry registration follows npm and is optional for first release. Maintainer completes account login themselves.
