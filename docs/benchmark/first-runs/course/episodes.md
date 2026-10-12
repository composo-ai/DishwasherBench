| Level | Player | Points | Share | Loaded of offered | Clean of loaded | Points loaded | At the edge | Actions | Queries charged | Refused | Verified (log / load / second wash) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tutorial | empty | 0 of 64 | 0.0 % | 0 of 12 | 0 of 0 | 0 | - | 0 | 0 | 0 | yes / no / no |
| tutorial | random | 20 of 64 | 31.3 % | 10 of 12 | 4 of 10 | 52 | 0 | 30 | 5 | 15 | yes / no / no |
| tutorial | careless | 58 of 64 | 90.6 % | 11 of 12 | 11 of 11 | 58 | 0 | 96 | 26 | 37 | yes / no / no |
| tutorial | careful | 64 of 64 | 100.0 % | 12 of 12 | 12 of 12 | 64 | 0 | 27 | 22 | 0 | yes / no / no |
| tutorial | openai:gpt-6.1-sol | 64 of 64 | 100.0 % | 12 of 12 | 12 of 12 | 64 | 0 | 16 | 13 | 0 | yes / yes / yes |
| breakfast | empty | 0 of 220 | 0.0 % | 0 of 37 | 0 of 0 | 0 | - | 0 | 0 | 0 | yes / no / no |
| breakfast | random | 43 of 220 | 19.5 % | 22 of 37 | 12 of 22 | 128 | 0 | 76 | 8 | 211 | yes / no / no |
| breakfast | careless | 117 of 220 | 53.2 % | 34 of 37 | 25 of 34 | 174 | 0 | 189 | 51 | 118 | yes / no / no |
| breakfast | careful | 174 of 220 | 79.1 % | 34 of 37 | 34 of 34 | 174 | 0 | 97 | 43 | 12 | yes / no / no |
| breakfast | openai:gpt-6-astra | 175 of 220 | 79.5 % | 36 of 37 | 32 of 36 | 208 | 0 | 59 | 25 | 17 | yes / yes / yes |
| breakfast | openai:gpt-6.1-sol | 190 of 220 | 86.4 % | 35 of 37 | 35 of 35 | 190 | 0 | 53 | 39 | 5 | yes / yes / yes |
| breakfast | openai:gpt-6.1-sol | 188 of 220 | 85.5 % | 36 of 37 | 34 of 36 | 202 | 0 | 56 | 35 | 3 | yes / yes / yes |
| dinner-party | empty | 0 of 367 | 0.0 % | 0 of 62 | 0 of 0 | 0 | - | 0 | 0 | 0 | yes / no / no |
| dinner-party | random | 99 of 367 | 27.0 % | 32 of 62 | 20 of 32 | 184 | 0 | 118 | 6 | 262 | yes / no / no |
| dinner-party | careless | 100 of 367 | 27.2 % | 51 of 62 | 27 of 51 | 281 | 0 | 268 | 74 | 182 | yes / no / no |
| dinner-party | careful | 250 of 367 | 68.1 % | 49 of 62 | 46 of 49 | 263 | 0 | 156 | 68 | 5 | yes / no / no |
| dinner-party | openai:gpt-6-astra | 274 of 367 | 74.7 % | 53 of 62 | 50 of 53 | 298 | 1 | 67 | 32 | 7 | yes / yes / yes |
| dinner-party | openai:gpt-6.1-sol | 260 of 367 | 70.8 % | 51 of 62 | 50 of 51 | 269 | 0 | 60 | 22 | 14 | yes / yes / yes |

| Level | Model | Turns | Tool calls | Refused | Folds (forced) | Pictures | Input: fresh | Input: read from cache | Input: written to cache | Input in all | Output | of it reasoning | Largest request | Loading | Wash | Ended by | Run with |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tutorial | openai:gpt-6.1-sol | 32 | 32 | 0 | 1 (0) | 3 | 96 | 615,120 | 31,606 | 646,822 | 2,040 | 745 | 24,853 | 2 min 55 s | 7 min 55 s | start_cycle | spotless-bench/0.2.0, tools 7bf26d30 |
| breakfast | openai:gpt-6-astra | 115 | 115 | 17 | 4 (0) | 11 | 345 | 2,672,275 | 83,676 | 2,756,296 | 8,902 | 3,969 | 30,697 | 12 min 06 s | 5 min 45 s | start_cycle | spotless-bench/0.2.0, tools 7bf26d30 |
| breakfast | openai:gpt-6.1-sol | 105 | 114 | 5 | 6 (0) | 22 | 315 | 2,380,134 | 122,160 | 2,502,609 | 12,765 | 8,004 | 28,732 | 13 min 20 s | 6 min 07 s | start_cycle | spotless-bench/0.2.0, tools 7bf26d30 |
| breakfast | openai:gpt-6.1-sol | 119 | 124 | 3 | 6 (0) | 16 | 357 | 2,730,151 | 102,395 | 2,832,903 | 13,278 | 7,871 | 28,797 | 14 min 47 s | 4 min 49 s | start_cycle | spotless-bench/0.2.0, tools 7f3a9b8d |
| dinner-party | openai:gpt-6-astra | 122 | 122 | 7 | 8 (0) | 16 | 366 | 3,084,136 | 135,030 | 3,219,532 | 9,497 | 4,107 | 32,487 | 12 min 29 s | 5 min 21 s | start_cycle | spotless-bench/0.2.0, tools 7bf26d30 |
| dinner-party | openai:gpt-6.1-sol | 114 | 114 | 14 | 7 (0) | 7 | 342 | 2,880,194 | 140,160 | 3,020,696 | 11,440 | 6,233 | 33,612 | 14 min 00 s | 6 min 10 s | start_cycle | spotless-bench/0.2.0, tools 7bf26d30 |
