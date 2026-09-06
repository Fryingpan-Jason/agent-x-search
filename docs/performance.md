# Performance: local overhead is not model latency

Windows, Node 26.8.1, 2026-09-06. Each local measurement uses 10 process launches and 100 fake-provider tool calls (10 calls per process). Timings include stdio and Node/provider/serialization work; exclude network, actual OAuth, Grok CLI, model inference and cold npm downloads. Quantiles from these small samples are descriptive, not service guarantees.

| Metric | Local predecessor | 0.1.0 candidate |
| --- | ---: | ---: |
| Startup + initialize/list p50 | 53.251 ms | 51.922 ms |
| Startup + initialize/list p95 | 58.953 ms | 59.501 ms |
| Mock request roundtrip p50 | 0.316 ms | 0.370 ms |
| Mock request roundtrip p95 | 1.929 ms | 2.127 ms |
| Default tool definitions, JSON UTF-8 | 2,504 bytes (two tools) | 1,218 bytes (one tool) |
| Runtime dependencies | 0 | 0 |
| Sampled process RSS maximum | Not collected | 65.0 MiB |

These results show similar-order local latency, not a convincing speed improvement. The tool-definition reduction is primarily from making the second tool opt-in, not a claim of halving every client's token use. RSS is sampled during mocked calls; it is not a lifetime maximum, an OS-neutral budget, or a measured improvement over the predecessor.

The first checked candidate archive was about 17.8 KiB compressed (14 files); final size/integrity are in the generated package report. The enforced ceilings are 100 KiB for the tarball and 4 KiB for default tool definitions. No binary, SDK runtime, source build or install hooks are shipped.

## Historical upstream samples

The local predecessor was tested on 2026-09-06 using subscription OAuth. Two direct samples used the same small query and low reasoning: Grok 4.5 returned two final-answer links in 60.619 s; Grok 4.6 returned two in 31.043 s. This comparison changes the model, so it does **not** establish that a wrapper is twice as fast. A different one-round CLI query with Grok 4.6 / medium reasoning took 32.794 s and returned one link. It is not a matched direct-vs-CLI comparison.

No new real search or paid API request was made for 0.1.0 preparation. We do not claim faster provider inference, better coverage, or reduced total bills. The direct path's structural advantage is avoiding a full CLI agent startup during normal requests; xAI may still make several internal searches per Responses request.

## Reproduce

Run `npm run bench` for fake-provider timings and `npm run test:package` for the installed tarball checks. JSON reports are written to ignored `.artifacts/`. The fixture alone injects a fake provider; production has no mock mode. Public tests do not depend on the private predecessor checkout. Maintain a dated baseline when benchmarking later versions.

For a future real comparison, authorize an explicit request/spend cap, fix query/model/reasoning/filter/count settings, record repeats and failures, and report upstream-request counts, returned token usage, total elapsed time and final-source quality separately. Missing usage is unknown; CLI and Responses accounting conventions may differ. Do not silently rerun uncertain requests or hide no-source responses.
