> Estimates, not measurements. No Anthropic model was run. The prices are what the script assumed on 6 October 2026 and may be wrong or out of date; check the provider's price list. No prices were supplied for the other two models, so no comparison of cost can be read from this table.

| Load | Items | Requests | System prompt and tools | Largest request | Input tokens | Read from the cache | New |
|---|---|---|---|---|---|---|---|
| tutorial-careful | 12 | 54 | 13 k tokens | 25 k tokens | 1.15 M | 1.10 M | 48 k |
| weeknight-dinner-careful | 44 | 198 | 15 k tokens | 31 k tokens | 4.98 M | 4.75 M | 224 k |
| cooked-breakfast-2-careful | 57 | 314 | 18 k tokens | 34 k tokens | 8.93 M | 8.56 M | 374 k |
| iec-13-careful | 140 | 548 | 16 k tokens | 54 k tokens | 17.80 M | 16.14 M | 1.66 M |

| Load | Model | as rehearsed, terse (60 tokens out a turn) | twice the turns, thinking (400 tokens out a turn) | four times the turns, thinking hard (1500 tokens out a turn) |
|---|---|---|---|---|
| tutorial-careful | claude-haiku-5-5 | $0.019 | $0.056 | $0.230 |
| tutorial-careful | claude-sonnet-5-5 | $0.373 | $1.11 | $4.60 |
| tutorial-careful | claude-opus-5-5 | $0.525 | $1.78 | $8.32 |
| tutorial-careful | gpt-6.1-sol | no price given (1.15 M tokens in, 3240 out) | no price given (2.30 M tokens in, 43 k out) | no price given (4.60 M tokens in, 324 k out) |
| tutorial-careful | gpt-6-astra | no price given (1.15 M tokens in, 3240 out) | no price given (2.30 M tokens in, 43 k out) | no price given (4.60 M tokens in, 324 k out) |
| weeknight-dinner-careful | claude-haiku-5-5 | $0.082 | $0.230 | $0.896 |
| weeknight-dinner-careful | claude-sonnet-5-5 | $1.63 | $4.61 | $17.93 |
| weeknight-dinner-careful | claude-opus-5-5 | $2.31 | $7.31 | $32.05 |
| weeknight-dinner-careful | gpt-6.1-sol | no price given (4.98 M tokens in, 12 k out) | no price given (9.96 M tokens in, 158 k out) | no price given (19.92 M tokens in, 1.19 M out) |
| weeknight-dinner-careful | gpt-6-astra | no price given (4.98 M tokens in, 12 k out) | no price given (9.96 M tokens in, 158 k out) | no price given (19.92 M tokens in, 1.19 M out) |
| cooked-breakfast-2-careful | claude-haiku-5-5 | $0.142 | $0.390 | $1.47 |
| cooked-breakfast-2-careful | claude-sonnet-5-5 | $2.83 | $7.80 | $29.42 |
| cooked-breakfast-2-careful | claude-opus-5-5 | $3.96 | $12.18 | $52.00 |
| cooked-breakfast-2-careful | gpt-6.1-sol | no price given (8.93 M tokens in, 19 k out) | no price given (17.86 M tokens in, 251 k out) | no price given (35.73 M tokens in, 1.88 M out) |
| cooked-breakfast-2-careful | gpt-6-astra | no price given (8.93 M tokens in, 19 k out) | no price given (17.86 M tokens in, 251 k out) | no price given (35.73 M tokens in, 1.88 M out) |
| iec-13-careful | claude-haiku-5-5 | $0.385 | $0.957 | $3.12 |
| iec-13-careful | claude-sonnet-5-5 | $7.71 | $19.15 | $62.40 |
| iec-13-careful | claude-opus-5-5 | $12.19 | $31.84 | $111.90 |
| iec-13-careful | gpt-6.1-sol | no price given (17.80 M tokens in, 33 k out) | no price given (35.60 M tokens in, 438 k out) | no price given (71.20 M tokens in, 3.29 M out) |
| iec-13-careful | gpt-6-astra | no price given (17.80 M tokens in, 33 k out) | no price given (35.60 M tokens in, 438 k out) | no price given (71.20 M tokens in, 3.29 M out) |

Tokens are estimated (0.1647 a letter, 1.2025 a digit, 0.3443 a character of anything else, 703.4 a picture of 768 pixels square: the fit of packages/bench/src/measure.ts to the first real episodes). The prices assumed are US dollars per million tokens: claude-haiku-5-5: 0.1 in, 0.01 read from the cache, 0.125 written to it, 0.5 out; claude-sonnet-5-5: 2 in, 0.2 read from the cache, 2.5 written to it, 10 out; claude-opus-5-5: 4 in, 0.2 read from the cache, 5 written to it, 20 out; gpt-6.1-sol: none given; gpt-6-astra: none given.
