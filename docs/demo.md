# Recorded workflow: finding an original announcement

This is a replay of an actual **2026-09-06** subscription-backed local predecessor run. It is not a fresh search, not a recording of the new release candidate, and not a promise that the same post is still the latest announcement. No new model call was made to prepare this page.

Read this walkthrough in about 30 seconds; the original model call itself took 32.794 seconds.

**Request**

```json
{
  "query": "Find one recent official Grok feature announcement on X. Give its date and exact original post URL.",
  "include_handles": ["SpaceXAI"],
  "count": 1
}
```

**Recorded answer excerpt**

> **24 Aug 2026 (20:34 GMT)** — official @SpaceXAI announcement that Grok Voice Think Fast 2.0 is #1 on the Artificial Analysis Speech-to-Speech Index (same thread: now available via API / Agent Builder).
>
> Original post: https://x.com/SpaceXAI/status/2091987538999197752

The answer distinguished this announcement from a newer outage notice. That is useful task behavior, not an independently verified fact about the ranking.

**Recorded metadata:** CLI backend, Grok 4.6, subscription OAuth, medium reasoning, one model round, end_turn, one final-answer citation, 32,794 ms. The local predecessor had two default tools; 0.1.0 makes CLI research opt-in. Multi-round behavior and every platform were not tested by this run.

**Try after installation**

Use ordinary `x_search` to find product announcements, locate developer discussion, or trace a claim to an original post. Request `x_deep_search` only after enabling it and explicitly wanting CLI research. Verify the linked posts yourself; X content and availability change.

Candidate tests instead use a fake provider and are visibly marked offline. They test packaging/protocol behavior without using your account. We do not present those fixtures as a live demo.
