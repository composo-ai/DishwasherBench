# Running the Spotless benchmark

Spotless is a dishwasher-loading game played by models and by people. This page says how to run a
model against it, how to collect a human baseline, what is recorded, what each kind of player sees,
and which design decisions were taken how and which are still open. The design behind it is
`docs/research/benchmark.md`; the platform it runs on is `docs/design/platform.md`.

Everything below was run on the reference machine, a MacBook Pro (Apple M3 Pro, 18 GB), between
10 and 12 October 2026.

**The game washes with `anchored-v7.owner-capsule` on `spotless-sim 0.5.0 water-7`** (since
17:36 on 11 October): the machine with its upper basket corrected from the owner's floor-level
photograph, and the reference loads settled again on it (`docs/calibration/anchoring-v7.md`).
The scores of section 9 are of that set at the official tier. Older sets (`anchored-v4` to
`-v6`) are superseded: their files say so, and a wash refuses them unless stale sets are
accepted knowingly, in which case the report marks the set stale. What a score can be trusted
for is in `docs/validation/README.md` section 8; read it before reading a table.

On 11 October 2026 the tools' results and the standard harness were changed so that a model
can play a full level: an action answers with what it changed and not with the whole scene,
slot advice is a ranked list a screenful at a time, and the harness keeps a long
conversation short (sections 2, 3 and 7). Records and transcripts older than that
(`policy.settings.context.text: "full"`, prompt version 1) are in the shapes of before.

Since 2026-10-11 the game is scored on **Eco 50** with one capsule of the owner's detergent
(Finish Powerball Ultimate, 12.9 g): every level names it, the level card and the loading
guidance say so, and the results table has a column for it. Eco 50 is the only programme of
the game: no level card lists another, the page offers none, `start_cycle` refuses any other
(`unknown_programme`), and the harness refuses `--programme` with a programme a level does not
offer before it plays anything. The levels (a course of seven, each harder than the last by a
stated measure), their soils and the reference policies are described in
`docs/benchmark/levels.md`.

## 1. The pieces

| Piece | Package | What it is |
|---|---|---|
| Game server | `@spotless/server` | One session per episode: loading physics, budgets, action log, wash jobs, the render service, episode records. In benchmark mode (started with an admin token) only the harness creates episodes. |
| Render service | `@spotless/render/headless`, hooked in by `@spotless/server` | The `render` query and the pictures of `get_item`: the scene the web client draws, drawn to PNG in headless Chrome. |
| MCP server | `@spotless/mcp` | The agent's interface: one tool per action and query, bound to one episode. stdio and streamable HTTP. It shapes the game's answers for a player who pays for every character (`shape.ts`): an action answers with what it changed, not with the whole scene. |
| Harness | `@spotless/bench` | Runs episodes: creates them, lets a policy play through the MCP tools, waits for the wash, verifies by replay, writes episode records and the results table. |
| Web client | `apps/web` | The human interface: the same actions, the same views, the same texts. |

An episode is one player on one level: load, start the cycle once, get the report.

## 2. Run a model through the harness

```sh
# Run these from the root of the repository.
# Give --out as an absolute path: under "pnpm --filter" a relative one resolves inside packages/bench.

# Scripted reference policies (no model, no cost)
pnpm --filter @spotless/bench bench run \
  --levels tutorial,weeknight-dinner --policies empty,careful,careless,random \
  --tier fast --out "$PWD/.spotless/bench/first"

# A model through Anthropic's API (costs money: the key is read from ANTHROPIC_API_KEY).
# This path has never been run against the live API (see "Requests to Anthropic" below).
export ANTHROPIC_API_KEY=...
pnpm --filter @spotless/bench bench run \
  --levels tutorial --policies anthropic:claude-opus-5-5 --out "$PWD/.spotless/bench/opus"

# A model behind an OpenAI-compatible endpoint (costs money: address and key from .env, below)
pnpm --filter @spotless/bench bench run \
  --levels tutorial --policies openai:gpt-6.1-sol --tier fast \
  --max-input-tokens 2000000 --out "$PWD/.spotless/bench/sol"

# The same on a full level: give the limit of its size ("What an episode costs with a model")
pnpm --filter @spotless/bench bench run \
  --levels weeknight-dinner --policies openai:gpt-6.1-sol --tier fast \
  --max-input-tokens 12000000 --out "$PWD/.spotless/bench/sol-weeknight"

# The table of everything under a directory, again
pnpm --filter @spotless/bench bench table "$PWD/.spotless/bench"
```

`run` starts a game server in benchmark mode on a free port (or uses a running one:
`--server http://host:port --admin-token <token>`), and for every level, policy and seed:

1. creates the episode for (level, player) with the admin token;
2. connects the MCP server of that episode (`--transport memory` in the harness's process by
   default; `stdio` starts it as a child process, `http` serves it on a port);
3. lets the policy play through the MCP tools;
4. starts the cycle itself if the policy stopped without doing so (hitting a limit ends the
   episode with the load as it stands);
5. waits for the wash, starting it once more if it failed for a reason of the infrastructure
   (and up to four more times when the server gave no result because the simulation's source
   changed under the wash, which happens only on a checkout that is being worked on);
6. verifies the episode (section 6);
7. writes `<out>/<level>__<policy>__s<seed>__<id>/record.json`, the pictures the tools
   returned (`images/`), for a model the transcript (`transcript.json`), and the table
   (`<out>/results.md`, `results.json`).

Washes run at the **official** tier unless `--tier fast` is given; a fast wash is a **preview**
(its verdicts differ from the official tier's on some items of a full load) and is labelled so
on the command's first line, in every report (`verdicts.preview` and a note), in the record
(`score.preview`) and in the table. Scripted policies need no pictures; `--no-render` leaves
Chrome out.

The washes run with the parameters of the machine of the level (the current anchored set with
the owner's capsule) unless the command names others, with the options of the game server's own
command line, which are passed through to the server the command starts:

```sh
--wash-params <set.json>...           # parameter-set files laid over the registry defaults, in order
--detergent <set.json> --dose-g <g>   # the detergent's composition and its dose
--detergent-name <name>
--registry-defaults                   # the registry defaults and the machine's own dose
--accept-stale-params                 # wash with a set made for another state of the simulator
--programme <id>                      # another programme than the level's own. No level of the game offers one,
                                      # so this is refused before the first episode (exit 2, nothing played)
```

A wash with a stale parameter set fails unless `--accept-stale-params` is given (every report
then says that the result is provisional). With `--server` the tier and the parameters are
those of that server, and the command refuses the options.

**Exit status.** 0 when every episode was run, verified and has a result. 1 when an episode
could not be run, was not verified, or has no result because its wash failed (after the one
retry of `benchmark.md` section 4.6) or no cycle could be started: a failed wash is an
infrastructure failure and never a score, the table says "not scored", and the command says
`no result: <episode>: the wash failed: <reason>` on its error stream.

### Policies

| Name | What it is |
|---|---|
| `empty` | Loads nothing. The zero of the score. |
| `careful` | `@spotless/loader`'s careful loader: the scheme of the manual, as the project reads it. What settles leaning against its row or far over unheld is taken out again. |
| `careless` | The careful load, and then the common mistakes of the hand made on a seeded choice of its items: plates turned away or two to a slot, bowls and spoons nested, bowls face down flat, cups mouth up or on their side, a piece laid over others, a piece pushed in tight. The two mistakes that stop the machine (a blocked tablet, a stopped arm) are made only when asked for; `mistake-study` measures them. |
| `random` | Uniformly random feasible placements. Each basket is pulled out and pushed in once at the end, and what stops it comes out. |
| `anthropic:<model id>` | A model of Anthropic's played by the standard harness (below). Ids as of October 2026, from Anthropic's documentation; check the current list: `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`. |
| `openai:<model or deployment>` | A model behind an OpenAI-compatible endpoint (OpenAI's API, an Azure deployment, anything that speaks the dialect) played by the same standard harness. On Azure the name is the name of the deployment, for example `openai:gpt-6.1-sol`. |

With the harness's seed 1 (the default) a scripted policy plays the saved reference load of the
level (`packages/loader/loads/<level>-<policy>.json`): the policy's own seed is the level's seed
plus the harness's seed less one, and the items are offered in the order the level lists them.

The three loaders are written against a session they call synchronously. The harness lets a
loader play on a session of its own, then issues every call it made, in order, through the MCP
tools; loading is deterministic, so the game server goes through the same states, and the
harness checks that it did, event by event. A scripted policy therefore exercises the whole
chain an agent uses (MCP server, HTTP API, session), and costs the loading physics twice.

### The standard harness for a model

Fixed, so that every model is run the same way (`benchmark.md` section 10.2, item 8):

- **One system prompt** (`packages/bench/src/prompt.ts`, version 3): what the game is, how an
  episode goes, what a result tells and what happens to a long conversation; then the rules
  and manual of the level and the loading guidance, both word for word what the web client
  shows; then the level card as `get_level` returns it (without the rules, which stand above
  it in words). All three are read from the MCP server's resources, which are free, as the
  page shows them to a person at all times. One sentence before the manual (new in version
  3) says that where the manual and the description of a tool differ about what the tool
  returns, the description is right: the manual's paragraph on `list_slots` still describes
  the whole list of slots, and the tool now returns a ranked list a screenful at a time.
- **Native tool calling against exactly the tools the MCP server lists**, with the server's
  descriptions and schemas. No other tools, no code execution, no memory across episodes. A
  model may make several calls in one turn; they are run in the order given, on one scene.
- **The record says what was run** (`versions.harness`: `spotless-bench/0.2.0`;
  `versions.interface`: the MCP server's name and version and a digest of everything it
  lists about its tools; `policy.settings.prompt_version` and `context.version`). A changed
  word of a tool description changes the digest, and the results table never puts episodes
  that differ in any of the four on one line (column "Run with").
- **Context: policy `standard-2`** (`packages/bench/src/context.ts`; stated in full below).
  The conversation does not grow with the episode: the oldest turns are folded into a note
  that carries the load as it stood, and only the most recent pictures stay.
- **Limits:** as many model turns as the level allows actions, and at least 400
  (`max(400, 8 x items)`; `--max-turns` sets another number). A model that ends a turn
  without having started the cycle is reminded twice with a fixed sentence; after that, or at
  the turn limit, or when the model declines, the harness starts the cycle with what is
  loaded. A call refused because the action budget is used up ends the episode at once
  (`stopped: action_budget`): the load is washed as it stands (`benchmark.md` section 4.4),
  and the model is not called on until the turn limit. A turn cut off at the output limit is
  dropped whole (it may hold half a tool call), the model is told so with a fixed sentence
  and asked again; only three such turns in a row end the episode (`stopped: max_tokens`).
  The calls of one turn are made until their results together have passed the hard limit of
  the context policy (40,000 estimated tokens); the calls of that turn that remain are not
  made and are answered `turn_too_large`, so that the model makes them in its next turn (no
  episode so far has met this: it is there so that one turn cannot fill a model's context).
  Episodes that a limit of the harness ended are flagged in the results table.
- **Requests to Anthropic** (`packages/bench/src/anthropic.ts`; written from Anthropic's
  documentation of October 2026 and never run against the live API, so every detail here is
  untested): the Messages API through the official SDK, streamed; adaptive thinking; effort
  `high` unless `--effort` says otherwise, always stated in the request (by that documentation
  the models' own defaults differ: `medium` on Claude Opus 5.5 and Claude Haiku 5.5, `high` on
  the others) and written in the record; sampling at the
  model's default; `max_tokens` 64,000 (`--max-tokens`); the prompt cache
  marked; tool choice automatic. **No fallback model**: when the model declines, the episode
  records a refusal instead of being answered by another model. Folding old turns and
  removing old pictures edit earlier turns, which by the documentation invalidates
  reasoning blocks after the edit; the request asks the API to drop such blocks rather than
  refuse (`thinking.block_binding.prefix_mismatch_behavior: "drop_block"`, beta
  `thinking-binding-controls-2026-08-01`), and the record counts the drops (in all, in
  `policy.settings.request.reasoning_blocks_dropped`; per turn, in the transcript). See
  point 8 of the context policy for what that means for a comparison.
- A failure of the model's API (authentication, rate limit after retries, a bad request) gives
  the episode no result: it is not washed and not scored.

#### The context policy, exactly (`standard-2`)

An episode of a full level is hundreds of calls. Until 11 October 2026 the harness kept the
whole conversation as text (policy 1: `context: { text: "full" }` in a record): on a level of
57 items the careful reference load's calls made a last request of 1.2 million tokens. The
policy since, the same for every model and provider, recorded in every episode
(`policy.settings.context`, with its version and its numbers):

1. **What never leaves.** The system prompt (rules, manual, guidance, level card) and the
   opening message.
2. **The recent turns stay word for word.** A turn is the model's turn with the results of its
   calls, and is kept or taken out whole.
3. **A fold.** When the recent turns have grown past `fold_above_tokens` (12,000; or past
   twice the size of the first message with its note, `fold_above_note_factor`, when a load
   of more than some 80 items has made the note larger than 6,000), the oldest are taken out
   until about `keep_recent_tokens` (5,000) of the most recent remain, and a note of the
   harness is joined to the opening message in their place. The note says how
   many calls were taken out and of which tools, and gives **the scene as it stood after the
   last of them, exactly as `get_state` returns it**: every item in the machine with its
   pose, stability, contacts and location, the items on the counter, the baskets and their
   options, the budgets. The harness holds that scene without asking the game: it keeps its
   own copy from the results of the tools alone (`LoadTracker` of `@spotless/mcp`; the tests
   hold the copy to be what `get_state` returns after every call of an episode). The copy
   is whole from the first accepted action on, whatever the model asked before: the MCP
   server answers an action with the whole scene, in place of the changes, whenever its
   client has not yet been given the whole scene, and a `get_state` of a part (`rack`,
   `items`) does not count as that. (Until the afternoon of 11 October it did: a model whose
   first look was a part of the scene left the harness without a scene, and the first fold
   then told it that nothing had been placed. Found in review, reproduced and corrected;
   `harness.test.ts` and `results.test.ts` hold it.) Before the first accepted action there
   is nothing to say of the load, and a note written then says so in those words. The note
   also repeats the **slot advice asked last** (when it is no longer among the recent turns)
   and carries, as a picture, the **sheet of every item** (`render` view `items`) if one was
   drawn.
4. **Only what is out of date is folded.** A turn is taken out only when an accepted action
   has come after it: its results describe a scene that is no more, and the scene that is, is
   in the note. Everything since the last accepted action stays however much it is, because
   it is true of the scene as it stands and a model would have to pay to see it again. The
   one exception is a hard limit: when the recent turns alone pass `hard_limit_tokens`
   (40,000), or the provider counted the last request above `request_limit_tokens`
   (120,000), the oldest go regardless, and the transcript marks that fold `forced`. No fold
   of the reference sequences or of the model episodes so far was forced.
5. **Pictures.** A picture stays only while the turn that returned it is among the recent
   turns: a fold takes it out with its turn. That is what bounds pictures in practice: in
   the measured sequences and in the model's episode on 44 items, a request after a fold
   carried one or two pictures beside the sheet of items, and a picture the model paid for
   was gone once an accepted action had followed it and about 5,000 tokens of later turns
   had come. On top of that, at most 8 pictures of tool results are kept at any time: when
   there are more, the oldest are replaced by a line of text, down to 4 (`--keep-images`,
   `--image-slack`). So 4 to 8 is an upper bound, met only by a model that looks many times
   without acting; that rule fired in no episode so far. The four pictures of one `get_item`
   count as four. The sheet of items carried by the note does not count.
6. **In batches.** Both removals happen at intervals, not a little every turn: between two of
   them the conversation only grows at its end, which is what a provider's prompt cache and
   a model's carried reasoning depend on. After a fold the system prompt and the tools are
   still read from the cache; the note and the recent turns are written to it anew.
7. **Sizes are estimated by one fixed rule over characters** (`estimateTokens` of
   `packages/bench/src/measure.ts`), the same for every model, so the policy does not depend
   on a provider's tokenizer. Only the guard of point 4 uses the provider's own count.
8. **What a model keeps of its own reasoning across a fold is not the same for every
   provider, and this is not yet settled.** The text of the conversation is the same for
   all (the cut falls at the same turn in the Anthropic, Responses and chat completions
   forms of a request). The reasoning a model carries from turn to turn is not text of the
   conversation but the provider's own: on the Responses API the kept turns go back with
   their encrypted reasoning items after a fold, and the endpoint takes them (14 folds in
   real episodes); on Anthropic's API a reasoning block is bound to everything sent before
   it, a fold changes the first message, and so the reasoning blocks of every kept turn are
   dropped by the API at each fold (the documented behaviour of `drop_block` for a
   conversation whose older part was replaced and whose recent turns were kept). If the API
   behaves as documented, a Claude model would start the first turn after each fold without
   the reasoning of its last few turns, which a model on the Responses API keeps. This is a
   property of this harness, not of the models, and nobody has run it: the Anthropic path
   has only met a local stand-in for the API. **Before a result of a Claude model is
   set beside one of another provider**, run one episode with folds on an Anthropic model
   and read `reasoning_blocks_dropped` per turn in its transcript; and decide (an open
   question of section 10) whether the harness should drop carried reasoning at a fold for
   every provider, so that all are treated alike.

What a fold takes for good, and what looking again costs. The level card, the rules and the
load are never lost. Gone with folded turns are: the feedback of each old placement beyond
the pose it left (where the item was let go, how far it went, `resting`, contact forces),
refusals and their reasons, previews, mechanical checks and slot advice of a scene that has
since changed (but for the advice asked last), pictures of that scene, the pictures of
`get_item`, and the model's own words and reasoning of those turns. Each of these can be
asked for again at what it cost the first time (`preview` and a further part of a slot list
are free; a picture, a check or new slot advice is one query); the feedback of a placement
that has been built upon cannot, as a person cannot see the "Last action" panel of an
earlier action again. `--fold-above` and `--keep-recent` set other sizes (a run that uses
them says so in its record, and is not the standard harness).

A note never says less than is true. If a fold were ever made while the harness's copy had
not been given a whole scene (it cannot be with the MCP server of this repository), turns
with accepted actions would stay in the conversation until the hard limit forced them out,
and the note of that fold would say how many accepted actions were taken out and that the
harness has no scene to give, so that the model asks `get_state`.

The transcript of an episode (`transcript.json`) keeps every turn, also those folded since
(`history`), the conversation as the last request carried it (`conversation_at_end`), every
fold (`context.folds`: at which call, how many calls, estimated tokens before and after,
forced or not), the harness's copy of the load at the end (`load_at_end`), and per turn the
tokens, the folds so far and, where the provider reports it, the reasoning blocks it dropped
(`turns[].reasoning_blocks_dropped`; the sum is `context.reasoning_blocks_dropped`, null for
a provider that does not report it).

#### What an episode costs, measured without a model

```sh
pnpm --filter @spotless/bench measure-episode --load weeknight-dinner-careful
pnpm --filter @spotless/bench measure-episode --check <transcript.json>...
pnpm --filter @spotless/bench episode-cost --from <measurement.json> --price gpt-6.1-sol=<in>,<cached in>,<out>
```

`measure-episode` plays the calls of a saved reference load, one a turn, through the real MCP
tools with the standard loop (a scripted provider in place of a model), adds a look after
every tenth accepted placement (by turns a labelled plan view and the scene state), and
sizes every result and every request: characters and tokens per tool, the largest request,
the conversation at its largest, and the input tokens of the episode with the share a prompt
cache has seen before. It also checks that the harness's copy of the load was the game's
scene at the end. The loader's own `preview` calls are left out unless `--previews all` is
given (a level's careful load makes thousands in a search no model makes one turn at a
time). Tokens are estimated by a fit to what the endpoint of the first real episodes counted
(0.16 a letter, 1.2 a digit, 0.34 any other character, 703 a picture of 768 pixels square:
prose runs at 4.7 characters a token, the JSON of a result at about 2.8); `--check` holds the
estimate against the transcript of any real episode and prints the fit that transcript would
give. `episode-cost` prices a measurement: Anthropic's models at list prices, the deployments
of an OpenAI-compatible endpoint at whatever prices are given. The measurements of 11 October
are in `docs/benchmark/first-runs/README.md` sections 6.1 and 7.2, and their files in
`docs/benchmark/first-runs/measurements/` (`before.json`; `after-<load>.json`, before the
review; `final-<load>.json`, the code as it is).

#### What an episode costs with a model

In tokens: the episodes so far were run without prices, so nothing here is in dollars
(`episode-cost --price` turns a measurement into dollars). Input counts every
request whole, cached or not; 95 % or more of it was read from the provider's cache in every
episode played.

| Level | Measured, `gpt-6.1-sol`: input | output | Measured, `gpt-6-astra`: input | output | `--max-input-tokens` to give |
|---|---|---|---|---|---|
| Tutorial (12 items) | 0.4 to 0.65 million in 22 to 32 turns (six episodes since the results were shaped; at the official tier on the course: 646,822) | 1,600 to 2,040 | not run | | 2,000,000 |
| `breakfast` (37 items) | 2,502,609 in 105 turns and 2,832,903 in 119 | 12,765 and 13,278 | 2,756,296 in 115 turns | 8,902 | 12,000,000 |
| `dinner-party` (62 items, the largest level) | 3,020,696 in 114 turns | 11,440 | 3,219,532 in 122 turns | 9,497 | 20,000,000 |
| 120 items (the upper end the benchmark plans; no such level exists) | not played. Reckoned before the course existed: 14 to 16 million | 60,000 to 80,000 | | | 35,000,000 |

These are the episodes of `docs/benchmark/first-runs/course/` (11 October, official tier), one
or two a cell. No request was larger than 33,612 tokens, no limit was reached and no fold was
forced. Before they were played the full levels were expected to cost about twice as much
(4.5 to 6.5 million on 37 to 46 items, 6 to 9 million on 62), reckoned from the careful
reference sequence at one call a turn: both models needed about half its calls. `gpt-6-astra`
wrote 70 to 80 output tokens a turn, where 400 to 1,500 had been
allowed for. The limits by level size were left as they were: reaching one ends the loading and
washes what is loaded (`stopped: token_budget`), flagged in the table. One earlier episode on a
level of 44 items of 10 October that no longer exists used 4,454,116 in 174 turns.

A request is the same size for every model: the fixed part (system prompt with the level card,
and the tools: about 13,000 tokens on the tutorial, 15,000 to 18,000 on a full level) plus
8,000 to 17,000 of conversation under the context policy.


The provider interface is small (`packages/bench/src/provider.ts`: `complete({ system, tools,
history }) -> turn`); another provider is one file. **The Anthropic implementation has never
been run against the real API**: that path is tested only by driving the real SDK against a
local stand-in for the Messages API. The OpenAI-compatible implementation has played real
episodes (section 9).

### An OpenAI-compatible endpoint

`packages/bench/src/openai.ts` speaks to the endpoint directly over HTTP (no SDK). Settings
come from options of the command line or from the environment; the command line loads the
repository's `.env` (git-ignored; `.env.example` lists the names) when a run starts, and a
variable already set in the environment wins. It then prints the names it set, never a value
(`table`, `verify` and `link` read no key and print nothing about it).

| Variable | Option | What it is |
|---|---|---|
| `SPOTLESS_OPENAI_BASE_URL` | `--base-url` | The address up to and without `/responses`: `https://api.openai.com/v1`, or for Azure `https://<resource>.services.ai.azure.com/openai/v1` |
| `SPOTLESS_OPENAI_API_KEY` | `--api-key-env <NAME>` names another variable | The key. Read at run time, sent in one request header, written nowhere |
| `SPOTLESS_OPENAI_AUTH_HEADER` | | `api-key` (the default for a host under `azure.com`) or `authorization` (`Bearer`, the default otherwise) |
| `SPOTLESS_OPENAI_API` | `--api responses\|chat` | Which API: the Responses API (default) or chat completions |
| `SPOTLESS_OPENAI_REASONING_EFFORT` | `--effort` | Reasoning effort. Not set: the field is not sent, the model's default holds, and the record says so and says what the API reported it ran with |
| `SPOTLESS_OPENAI_PRICE_INPUT`, `_CACHED_INPUT`, `_OUTPUT` | | US dollars per million tokens. Without input and output prices **no cost is recorded** (`cost_usd: null`), only tokens. A deployment's own prices go in variables with its name in them, letters and digits only (`SPOTLESS_OPENAI_PRICE_GPT_6_1_SOL_INPUT`, ...), and win over these: two deployments of one endpoint are each priced as what they are |
| `SPOTLESS_OPENAI_MODEL_ITERATE`, `SPOTLESS_OPENAI_MODEL_EXPENSIVE` | | Not read by the harness: a note of which deployment is for iteration and which is for a few runs on finished levels. The deployment is named in the policy (`openai:<deployment>`) |

Also `--max-tokens` (the output limit of a turn, reasoning included; 64,000),
`--request-timeout-s` (the time limit of one request; 600) and `--max-input-tokens`.

- **Which API.** The Responses API is the default because the current reasoning models take
  function tools only there: the first deployment this was run against answered a chat
  completions request that had tools with *"Function tools with reasoning_effort are not
  supported for gpt-6.1-sol in /v1/chat/completions. To use function tools, use /v1/responses
  or set reasoning_effort to 'none'"*. `--api chat` is for endpoints without a Responses API
  (or with `--effort none`).
- **Tools:** exactly the MCP server's thirteen, as function tools with the server's
  descriptions and schemas (`strict: false`: the schemas are sent as they are). Tool choice
  automatic, sampling at the model's default, nothing else offered.
- **The conversation is stateless** (`store: false`): every request carries all of it. The
  model's own turns go back as the items they came as, reasoning items with their encrypted
  content included, so the model keeps its reasoning from turn to turn without the API
  storing anything. When the context policy folds old turns, their items (reasoning
  included) leave the request with them.
- **Pictures.** In the Responses API the result of a tool call carries its pictures itself
  (`function_call_output` with `input_image` parts after the text). In chat completions a tool
  message carries text only: the pictures of a round of results go into one user message
  right after that round's tool messages, each under a line naming the tool and the id of the
  call it answers, and the tool message says that its picture follows. The context policy is
  the same either way: a picture taken out leaves its line of text in the result. The sheet
  of items that a fold's note carries travels in that user message (`input_image`, or an
  `image_url` part in chat completions).
- **A cut-off turn** (`status: incomplete` with `max_output_tokens`; `finish_reason: length`)
  is handled as with Anthropic: dropped whole, the model told with the fixed sentence and
  asked again, three in a row end the episode. A reply stopped by a content filter, or a
  refusal, is recorded as a refusal.
- **Failures.** A request that fails with 429, 408 or 5xx, loses its connection or passes its
  time limit is sent again up to five times with exponential back-off (2 s doubling, with
  jitter), waiting as long as the server asks when it says (`Retry-After`, `retry-after-ms`;
  at most two minutes). 400, 401 and 403 are not retried. What remains is a provider error:
  the episode has no result.
- **Tokens** are read from every reply: fresh input, input read from the provider's cache,
  input written to it, output, and the share of the output that was reasoning. The record has
  them in `agent.usage` (`input_tokens` excludes cached input, as for Anthropic;
  `reasoning_output_tokens` is part of `output_tokens`) and, with the number of requests and
  retries, the prices if any and the cost if any, in `policy.settings.request`. The transcript
  has them per turn.
- **`--max-input-tokens n`** is a guard on spending, not part of the standard harness: the
  next request is taken to be as large as the last, and when the episode's input tokens
  (cached ones included) plus that would pass `n` the model is not asked again; the load is
  washed as it stands (`stopped: token_budget`, flagged in the table as ended by a limit).
- **What is never written:** the key and the address of the endpoint. The record says only
  what kind of endpoint it was (`azure`, `openai`, `local`, `other`); error messages are
  cleaned of the key before they leave the provider.

## 3. Run an agent from a desktop MCP client

The game server must be running in benchmark mode, and the episode must exist before the client
starts the MCP server, because an MCP server is bound to one episode.

```sh
# 1. The game server (benchmark mode; the render service starts Chrome on the first picture).
#    Give --data as an absolute path: under "pnpm --filter" a relative one (and the default,
#    .spotless) resolves inside packages/server.
pnpm --filter @spotless/server exec tsx src/cli.ts serve --admin-token <token> --wash-tier fast \
  --data "$PWD/.spotless"

# 2. An episode for the agent; prints its id (and an address at which a person can watch it)
pnpm --filter @spotless/server exec tsx src/cli.ts link --admin-token <token> \
  --level tutorial --player claude-desktop --agent
```

Then in the client's MCP configuration (for Claude Desktop, `claude_desktop_config.json`). A
client starts the command from a directory of its own, so both paths must be absolute: put the
path of your checkout in place of `/absolute/path/to/DishwasherBench`.

```json
{
  "mcpServers": {
    "spotless": {
      "command": "/absolute/path/to/DishwasherBench/node_modules/.bin/tsx",
      "args": [
        "/absolute/path/to/DishwasherBench/packages/mcp/src/cli.ts",
        "--server", "http://127.0.0.1:8787",
        "--session", "<episode id>"
      ]
    }
  }
}
```

For a client that speaks streamable HTTP, start the MCP server yourself and give the client its
address:

```sh
pnpm --filter @spotless/mcp exec tsx src/cli.ts --server http://127.0.0.1:8787 \
  --session <episode id> --http --port 8788      # serves http://127.0.0.1:8788/mcp
```

The endpoint answers 403 to any request that carries an `Origin` header and to a request whose
`Host` header does not name an address it listens on (`127.0.0.1`, `localhost` or `[::1]` by
default; `--allow-host <name>` adds one, for a client in a container). The game server refuses
a foreign `Host` in the same way, and a foreign `Origin` (its own page's is not foreign); it
takes `--allow-origin <origin>` and `--allow-host <name>`.

The agent has thirteen tools (`place`, `remove`, `reset`, `set_rack`, `start_cycle`,
`get_level`, `get_item`, `get_state`, `render`, `preview`, `list_slots`, `check_load`,
`get_report`) and three resources (`spotless://level/manual`, `spotless://guidance/loading`,
`spotless://level/card`). It cannot create, list or name sessions.

What the tools answer is shaped for a player who pays for every character of a conversation
(`packages/mcp/src/shape.ts`; the game, its log and the digests in it are untouched):

- **An action says what it changed, completely, and not the whole scene.** `place`, `remove`,
  `reset`, `set_rack` and `start_cycle` return `changes` (the whole new entry of every item
  whose pose, stability, contacts or location is new or different; the items that went back
  to the counter; the baskets, options and phase that changed), `load` (the whole load in a
  few numbers: items placed and on the counter, by location, the unstable ones, where the
  baskets are), `budget` (the counters as `used/allowed`) and the start of the scene's hash.
  An item that is not named in `changes` is exactly where and how it was. An action of a
  client that has not yet been given the whole scene (by a `get_state` without `rack` or
  `items`, or by an earlier action) carries the whole scene (`state`) in place of `changes`;
  a part of the scene asked before does not count. A client that applies
  every result to its own copy has what `get_state` returns: `LoadTracker` of `@spotless/mcp`
  does it, and `results.test.ts` holds the copy to the game's scene after every call of an
  episode.
- **`get_state` gives the whole scene or a part** (`rack`: one basket; `items`: named items),
  with the placed items as a table, one row an item. Whole or part, it is one query.
- **`get_level` says everything once**: `orientation_presets` (each named orientation),
  `item_types` (each kind of piece) and `items` (each item with its kind, soil and points;
  pieces that agree in all three share an entry). The card of a level of 57 items is 33,000
  characters where the game's own is 67,000; that of the standard load of 140 items 24,000
  where the game's own is 138,000.
- **`list_slots` with an item is a ranked list, a screenful at a time**: the suggested places
  for that item, free and seating first, 12 unless `limit` says otherwise (at most 30), with
  how many there are in all, and the rest by `offset` or `row`. A further part of the
  list asked last costs nothing while the scene is unchanged (the server keeps one list, as
  the page does). The game's own answer for the
  lower basket is 28,000 characters; this one is 1,500.
- **Numbers are what the page shows**: positions to 0.1 mm, quaternions to 1e-4, nothing
  else finer than four decimals.

While the wash runs,
`get_report` answers with the progress, and `get_report {"wait_s": 120}` waits for the end, so
a long wash costs a handful of calls. When the wash ends the server writes the episode's record
to `<data>/episodes/<episode id>.json`.

`pnpm --filter @spotless/mcp exec tsx scripts/play.ts` plays a recorded tutorial this way (a
real MCP client over stdio) and writes every result and picture to a directory.
`pnpm --filter @spotless/mcp exec tsx scripts/call.ts --url http://127.0.0.1:8788/mcp <tool> '<json>'`
makes one call to an MCP server started with `--http` and prints the text of the result as an
agent is sent it: an episode can be played by hand from a terminal that way, call by call
(`docs/benchmark/first-runs/walkthrough/` is one).

## 4. Collect a human baseline

```sh
# Build the web client once, then serve in benchmark mode at the official tier
pnpm --filter @spotless/web build
pnpm --filter @spotless/server exec tsx src/cli.ts serve --admin-token <token> \
  --data "$PWD/.spotless/baseline"

# One link per participant and level (the name is a participant id, not a real name)
pnpm --filter @spotless/server exec tsx src/cli.ts link --admin-token <token> \
  --level weeknight-dinner --player P07
#   http://127.0.0.1:8787/#<episode id>
```

The participant opens the link. The page shows "Playing as P07", the level, and under "How to
play" the rules, the manual of the interface and the loading guidance. If an episode was
created without a name (or the link is `...#<episode id>&player=<name>`), the page takes the
name from the link, or asks for it once and says what is recorded. Without a link the page
offers nothing: in benchmark mode a participant cannot start a second episode of a level to try
a load and read its report first.

When the wash ends the server writes `<data>/episodes/<episode id>.json`, the same record the
harness writes for an agent, without the harness's sections. `bench table <data>` puts people
and policies in one table.

**How a person plays the page** (as of 12 October 2026, after the first play test and the
corrections that followed it; the words of the page itself are under "How to play"):

- *Pick up*: a click on a piece in the list, or a drag from the list into the machine. It
  comes the way it usually stands in a dishwasher (a plate on edge, a glass upside down,
  cutlery handle down).
- *Point*: the piece is drawn in the machine where it would be let go, under the cursor, in
  whichever pulled-out basket the cursor is over. The page follows the cursor's line of sight
  down to the place the game's free `preview` says the piece touches down at. Green: let go on
  the floor of the basket. Yellow: let go above it, on tine tips, on another piece or on top
  of the cutlery basket; it may tip. Red: it overlaps something. Amber: it cannot be reached,
  or it would be let go on the rim, on the handle of the cutlery basket or outside the basket.
- *Turn*: which way up by the stance pictures or R; which way it faces by Q and E or the
  wheel, a quarter turn a step (Shift: 15 degrees). A piece on edge near a row of tines takes
  up the nearest free gap of the row; Alt places freely.
- *Put down*: one click. A click made while the page is still asking the game waits for the
  answer. Where the piece is shown amber for falling out, the click does nothing and nothing
  is sent or charged; a typed pose (the "Exact pose" panel) is put down wherever it says.
  A piece of cutlery that would be let go above the rim of the cutlery cells, on the carrying
  handle or on something lying over the cutlery basket is likewise kept in the hand ("not put
  down").
- *What pointing does not do yet*: a plate pointed at the gap next to a plate already placed
  often perches on its neighbour, and a cup or glass cannot be leant on a side rest of the
  upper basket by pointing. "Suggest spots" gives the seat for both (one query, then a click
  on a numbered mark). A person therefore pays queries where an agent pays the same query for
  `list_slots`.
- *Move*: a click on a piece in the machine picks it up as it stands (one action, a `remove`);
  a click puts it down; Esc puts it back (one more action; it is let go there again and can
  settle a little differently); Z takes the piece put down last back into the hand as it was
  held (one action); Backspace sends the piece in hand to the counter.
- *Views*: the two three-quarter views and the three plans place; the three elevations are
  for looking (a piece keeps its depth there), and the page says so.
- *Wash*: on a server in open mode the start dialog offers a quick preview (the fast tier) or
  the full wash (the official tier), each with the time it is expected to take: in minutes
  when this machine has timed such a wash, in words when it has not. After a preview the
  report offers the full wash on the same load, which runs in a new game of the level with
  the same moves replayed. **In benchmark mode none of this is offered**: the wash is the
  server's (the official tier unless it was started with `--wash-tier fast`),
  `start_cycle?wash_tier=` is ignored and `rewash` is refused.
- *Programme*: the page starts the programme the level is scored on and names no other.
- *Sound*: music (five CC0 pieces, `apps/web/public/audio/LICENSES.md`) and, off by default,
  a clink and a door thud made by the page. Nothing in it carries information about the game:
  the music sinks while the wash runs and comes back when the report arrives, which the
  progress panel already shows. A participant can turn it off under "Sound".

Kept scripts that drive the page with mouse and keyboard only (`apps/web/scripts`, each after
`vite build`): `play-tutorial.ts` (every control, 32 pictures), `play-benchmark.ts`,
`play-wash.ts` (two real washes), `measure-placing.ts` (how far a piece is let go and comes to
rest from the cursor), `check-edges.ts` (nothing drawn green ends outside the machine),
`count-gestures.ts` (clicks and keys for the tutorial's careful load), and for the sound
`audio-mix-check.ts`, `audio-joins.ts` and `audio-live-check.ts`. Every browser they start is
muted.

Not built: the consent text, the comprehension check, the exit survey, the assignment of levels
to participants and the payment bookkeeping of `benchmark.md` section 6. In the one-shot track
the participant sees the report when the wash ends; withholding it until the whole session is
over (section 6.2) is not built either.

## 5. What is recorded

One JSON document per episode (`EpisodeRecord`, `packages/server/src/episode.ts`), the same for
every kind of player:

| Field | Content |
|---|---|
| `level`, `versions` | Level id, title and digest; benchmark version; which code ran the wash (`wash_runner.version` is the version the wash worker found when the wash was over: it ends in a fingerprint of the source of the simulation, and `report.job.runner_version` is the same string), at which tier; the version of the guidance text; the harness (`harness`: `spotless-bench/0.2.0` since the results were shaped and the conversation folded, 0.1.0 before); the tool interface the player was given (`interface`: `mcp_server`, the number of tools, and `tools_digest`, a hash of the server's instructions and of every tool's name, title, description and schemas; records of harness 0.2.0 on) |
| `player` | `human`, `agent` or `scripted`; the participant id or policy name; the interface (`web`, `mcp/...`) |
| `events` | Every call of the episode as the session logged it: name, arguments, accepted or not, a digest of the result, the scene hash after it, the budget counters, and the time the server wrote it |
| `counts`, `budget` | Accepted and refused actions and queries, by name; the budget counters at the end |
| `opened_at`, `cycle_started_at`, `time` | When the player arrived (first socket or first call), when the cycle started, the seconds between (the loading time), the wash's wall and computing time |
| `load`, `prechecks` | The frozen load (rounded poses) and what closing up found |
| `wash`, `washes`, `report`, `score` | The last wash job with the tier it was asked for; every wash of the episode in order, failed ones included, each with the hash of the load it was started on (more than one entry: a wash was started again, flagged in the table); the whole report as it was delivered, with its verdict summary (`report.verdicts`: the programme washed on and whether it is the scored one, whether the wash was a preview, the loaded items at the edge of clean and those with a provisional verdict with what each is worth, and the points with the edge items read either way); points, share, clean and loaded items, and the same summary in numbers (`score.counting`, `points_strict`, `points_lenient`, `edge_items`, `edge_points`, `provisional_items`, `provisional_points`, `preview`, `programme_id`, `programme_status`) |
| `policy` (harness) | The policy and what it was run with: seed, model, request settings, the turn limit and its rule, the context policy with its version and numbers (`context.version`: `standard-2`), prompt version |
| `agent` (harness) | Every tool call as the agent made it (arguments, error or not, result digest, picture files, start and duration), model turns and tokens (`usage`: input neither read from the cache nor written to it, input read from it, input written to it, output, and where the provider states it the share of the output that was reasoning), why the policy stopped, whether the harness had to start the cycle |
| `replay` (harness) | The verification |

Of a person, only what they did is recorded: the semantic action log with times. No mouse
trace, no video, no free text. The wash seed is in no record.

## 6. Verification

Nobody should have to trust a reported load or score (`benchmark.md` section 4.6). Three
checks, each named for what it covers (`replay.checks` in a record, and three counts in the
table):

| Check | What it shows | Cost |
|---|---|---|
| `log` | The action log, applied to a fresh session of the same level, reproduces the scene hash after every event. An event whose name is no call of the game is a mismatch. Washes that failed are replayed as failures (`washes`). | The loading physics once |
| `load` | The record's frozen load is the load the replay froze; the report names that load's hash and calls loaded exactly the items in it; every item's points follow from its verdict and the totals from the items; the record's `score` is the score of its report; and the wash key the record names is the key of the replayed manifest under the recorded code and tier. | Nothing more |
| `score` | The replayed load, washed again at the record's tier, gives the same verdicts and points. The only check under which a falsified report cannot pass. | A wash |

`bench verify <record.json>` runs `log` and `load` and exits with 1 if either fails;
`bench verify <record.json> --rewash` also runs `score` with the simulation of the checkout it
is run from (a different result hash under the same verdicts is reported and does not fail
it: other code or another GPU).

During a run the harness verifies every episode of a model by `log` and `load`
(`replay.method: "replay"`). For a scripted policy the log is compared against the policy's
own session, which made the calls first (`"policy_session"`, the `log` check only);
`--verify replay` forces the fresh replay and with it the `load` check.

A record with every item marked clean and full points, attached to a true log, fails `load`.
A record whose report was edited consistently (verdicts, points and score all changed
together) passes `load` and is caught only by `score`: publish a score as verified only when
that count is not zero.

What the server guarantees on its side. A report is kept exactly as it was delivered
(`<data>/reports/<job id>.json`) and that copy, not the result cache, is what a restored
session, its record and its pictures use. In benchmark mode a wash whose worker ran other
source than the wash was keyed by is no result (the wash fails and is started again), and a
session whose delivered report is gone is not restored by washing its load again. Once a
cycle has been started the load is frozen: after a failed wash the server takes only
`start_cycle` (`load_frozen` for anything else), so a retry washes what was committed.

## 7. What each player sees

Equal availability at equal cost (`benchmark.md` P2). Budgets are the session's and are the
same for both.

| Information | Person (web client) | Agent (MCP tool) | Cost |
|---|---|---|---|
| Level card: machine, programme, items, soil, points, rules | Tray, panels, "How to play" | `get_level`, resource `spotless://level/card`; in the system prompt of the standard harness | 1 query per `get_level`; the page and the resource read it free |
| Manual of the interface | "How to play", word for word | Resource `spotless://level/manual`; in the system prompt | Free |
| Loading guidance (the project's short summary of the manufacturer's advice, plus one paragraph on the scored programme) | "How to play", word for word | Resource `spotless://guidance/loading`; in the system prompt | Free |
| The machine and the load, from any side | 3D stage, named views, free orbit | `render` with the same named views and `custom` | Page: free. Agent: 1 query per picture |
| Item ids on the items; millimetre grid in the basket's frame; tub grid and basket rulers in elevations | "Labels" and "Grid" switches (the same marks, drawn by the same code) | `render` options `labels`, `grid` | As above |
| One item from four sides, with its soil | Four pictures in the "In hand" panel; thumbnail in the tray | `get_item` (four pictures), `render` view `item` | Page: free. Agent: 1 query |
| Scene state: poses, stability, contacts, budgets | "Selected" panel, counters at the top | `get_state` (the whole scene, a basket or named items); every action's result says what it changed (`changes`) and sums the load up (`load`), and an action of a client that has not yet been given the whole scene carries the whole scene (`state`) instead; the counters are in every action's result and the query counter in every charged query's | Page: free pushes. Agent: what an action changed is free with the action; 1 query per `get_state`, whole or part. In the standard harness the scene as it stood is given again, free, whenever old turns are folded |
| Feedback after a placement | "Last action" panel, the animation | The result of `place`: where it was let go, how far it went, `stable`, `resting`, contact forces, and the new entry of every item that moved | Free (part of the action) |
| A pose tested without placing | The piece in hand is drawn at the pose `preview` lowers it to, tinted by `preview`'s answer; a typed pose shows its landing outline | `preview`; `render` option `ghost` | `preview` free for both. The page asks up to 8 previews each time the cursor rests (it looks along the line of sight for the place under the cursor); all are logged |
| Where a piece would be let go: on the floor of the basket, above it, on the rim | Green, yellow or amber, with a line of words: from `preview`'s lowered pose and the basket's inside, rim heights and cutlery-basket box, which the page has in its free geometry | `preview`: `lowered_pose`; the basket's envelope on the level card. The rim heights and the cutlery basket's box are not on the card: an agent sees them in a picture | `preview` free for both; the page has the rim geometry free, an agent a picture for 1 query. It says where the piece is let go, not whether it stays: neither is told that before placing |
| Rows and slots of a basket; where to drop the item in hand, and whether that spot is free now | Visible; "Suggest spots" in the "In hand" panel: the list as numbered marks in the machine, best first (where two marks would overlap in the view only the better is drawn); a click on a mark places the piece there | `list_slots` (with `item_id`): the same list in the same order (`slotAdvice` of `@spotless/server`, which both use), a screenful at a time | 1 query for both: a person's press shows the whole list; an agent's query pays for the whole list, and its further parts (`offset`, `row`) are free while the scene is unchanged and no other list has been asked since. The page keeps the list of the last press and the MCP server the list asked last: one each |
| The gaps of a tine row as places for a piece on edge | **Free on the page**: a piece on edge near a row stands across it over the nearest gap not marked blocked, facing away from the lean, held upright above the tips (`affordances.tineRows` of the free geometry). It is not told whether the gap is free now (`preview` says) nor the lean that seats the piece beside a neighbour (that is the suggestion, 1 query) | `list_slots` without an item: the rows and the geometry of their slots | **Page: free. Agent: 1 query.** An open design question (below) |
| The order of an item's stances | The stance pictures, the usual one for a dishwasher first and chosen at pick-up; `on_edge_reversed` and `leaning` have no picture (typed panel only) | `orientation_presets` in the card's order | Free for both; the page's order is a hint an agent does not get in that form |
| Taking the last placement back | Z: the piece put down last comes back into the hand as it was held | `remove`, then `place` | 1 action each for both |
| Where the tray is that catches the detergent tablet | Visible at the front of the upper basket | `tablet_tray` on the card of that basket (`get_level`): its box in the basket's frame | As the level card |
| Every item at once | The tray's thumbnails | `render` view `items` (one sheet) | Page: free. Agent: 1 query |
| Which end of an item is its +x; its reference point | Arrows on the four pictures in the "In hand" panel (the same marks, drawn by the same code) | Arrows on the pictures of `get_item` and of `render` view `item` | As the pictures |
| What blocks the way down to a free pose | The tint of the piece in hand and the status line of the preview (parts of the machine are named in words, items by their ids) | `preview`: `blocked_by`, `blocked_above_mm` | Free for both |
| How an item came to rest: on the base or held up, wedged or not | The animation and the view (the "Last action" panel prints where it came to rest, how far it went and what it touches; it does not print `resting`) | `place`: `resting` | Free (part of the action) |
| Mechanical check | "Run the check": whether each basket slides in, the arms turn, the door closes and the tablet can fall; which pieces lean out over a side and what they touch; which pieces the wall of the tub or the door pushed as the baskets went in | `check_load`: the same facts (`shifted[].pushed_by`, `protruding[].over` and `.touching`) | 1 query for both |
| Which programme the wash runs on | Eco 50 only: the page offers and names no other | Eco 50 only: the card lists no other programme and `start_cycle` refuses one (`unknown_programme`) | Free, and the same for both |
| Which wash: quick preview or full | Open mode only: a choice in the start dialog, and "Run the full wash on this load" after a preview. Benchmark mode: none | Open mode only: `POST .../start_cycle?wash_tier=fast\|official`, `POST .../rewash` (HTTP; not MCP tools). Benchmark mode: ignored and refused | Not part of the benchmark: in benchmark mode every wash is the server's tier for both |
| Wash progress | Progress panel | `get_report` (with `wait_s`) | Free |
| Report: per item clean or not, reason, residue by region, water | Report panel | `get_report` | Free |
| Residue where it is on the item | Painted on the items; "Look closely" | `render` after the wash; view `item` with `after_wash` | Page: free. Agent: 1 query per picture |
| Music and sound | Music; a clink and a door thud if switched on | None | Carries no information: the music follows only the wash running and the report arriving, which the progress panel shows |
| Spray coverage, soil-model numbers, predicted outcome, seed | Hidden | Hidden | - |

**What an action's result carries, and what that does to the comparison** (changed on 11
October 2026). A person sees the whole load all the time, for nothing. Until now an agent
was sent the whole scene with every action's result, for nothing too; that cannot be kept,
because a result that carries every item grows with the load, and a conversation of such
results outgrows every model's context long before a full level is loaded (the careful
load of a level of 57 items: a last request of 1.2 million tokens). The rule now:

- **A change is free and complete.** The result of an action names every item whose entry in
  the scene is new or different, with its whole new entry, and everything else that changed.
  What it does not name is as it was. An agent that keeps track therefore loses nothing: its
  copy of the scene is, after every action, exactly what `get_state` returns
  (`packages/mcp/src/results.test.ts` holds that after every call of an episode, and
  `measure-episode` at the end of every load it measures: 140 items, 547 calls).
- **The base of that copy is free too.** An accepted action answers with the whole scene in
  place of the changes whenever the client has not yet been given the whole scene: by a
  `get_state` without `rack` or `items`, or by an earlier action. A part of the scene asked
  first does not count as the scene. Each client of the MCP server is told for itself.
- **The standard harness keeps track for every model**, the same way: when it folds old turns
  it gives the scene as it stood (section 2). A model in the standard harness is thus never
  without the whole load in its conversation, and never pays for it.
- **Looking again costs what it cost before**: `get_state` is one query, whole or part, as it
  always was; a picture is one query; slot advice is one query for the whole list.

What an agent no longer has for nothing: the whole scene repeated at every step. An agent
outside the standard harness that keeps no copy (a desktop client that forgets) has to ask
`get_state` where it used to read the last result; it pays one query a look, of a budget
that has not bound in play (46 of 660 queries used on weeknight-dinner by the careful
loader, 56 of 660 by the first model on that level, which asked for the scene once). What
it has gained: slot advice at a twentieth and the level card at a half to a sixth of their
length, and the query counter in every charged result.

Known differences, the ones that could bias a comparison first:

- **Looking costs an agent queries and a person nothing.** A person watches the load
  continuously, with a free camera, every thumbnail in the tray at once, a ghost under the
  mouse drawn where the free preview lowers it to, and each drop animated. An agent pays one query per
  picture and per `get_state` and sees a drop as numbers. This is the dossier's accounting
  (section 4.4: a query cap for agents to bound cost, none for people), not an oversight; the
  cap (300 on the tutorial, 15 per item on larger levels) has not bound in play (56 of 660
  used on weeknight-dinner by the first model, 28 of them pictures). What it costs an agent
  is turns and tokens: a picture of 768 pixels is about 700 tokens, and the harness keeps
  a picture only while its turn is among the recent turns, at most 8 at a time (section 2,
  point 5): on a long level a picture is gone some 5,000 tokens of turns after the next
  accepted action, and seeing it again is another query. Two things narrow it: the view `items` shows every item of the level on
  one sheet for one query (and the harness keeps that sheet through every fold), and the
  level card and manual are free resources. Making every look free for agents, or returning a picture with
  each accepted `place`, is an open design question.
- **The report.** A person sees the report and the residue painting as soon as the wash ends
  and carries what they learnt to the next level of their session. An agent's episode ends at
  the report and each level starts from a fresh context. Withholding reports from a
  participant until their session is over (`benchmark.md` section 6.2) is not built.
- **Time.** People have no time limit here (the dossier's 20 minutes soft and 30 hard are not
  enforced; the loading time is recorded). A model has 400 turns and no clock.
- **Numbers.** An agent is given poses at the precision the "Selected" panel shows (0.1 mm,
  four decimals of a quaternion). It is also given what the page does not print: the contact
  forces of a placement and `resting` (how high the lowest point is, the forces over the
  weight). A person has the animation for that. What the game's own answers hold and the
  tools' results no longer do (none of it is shown to a person either): the points of each
  contact (`touches` names what an item touches), the pose that was asked for in the result
  of `place` and `preview`, the frozen manifest in the result of `start_cycle` (`get_state`
  still answers), and of `list_slots` the `runs` and `partner.spacing_mm` of a tine row and,
  when an item is named, the tine rows and the geometry of the slots (their centres, widths
  and lean), which the call without an item returns, for a second query. New for the agent
  and not on the page: the ids of the unstable items in every action's result
  (`load.unstable`).
- **Rows of tines for nothing (new on 11 October 2026; an open question of section 10).** On the page
  a piece on edge takes up the nearest gap of a tine row using the row geometry the page is
  sent to draw the baskets, at no cost; an agent gets that geometry from `list_slots` without
  an item for one query. The page does not learn from it whether the gap is free or how the
  piece seats beside a leaning neighbour. Three ways to make it even: give agents the rows on
  the level card (free for both), charge the page one query the first time a row is taken up
  in a basket, or switch the page's row-taking off in benchmark mode. Until that is decided
  the page keeps it, and a human baseline is slightly favoured in queries, of a budget that
  has not bound.
- **Where a piece is let go (new on 11 October 2026).** The page tints the piece yellow when
  `preview` lowers it to more than 25 mm above the floor of the basket and amber when it would
  be let go on the rim, on the handle of the cutlery basket or with its middle outside the
  basket, and it does not send a drop it shows amber for that reason (in the first play
  tests such drops fell onto the kitchen floor and were charged). The
  heights it compares with (the top of the rim by side, the box of the cutlery basket) come
  with the free geometry; an agent has `lowered_pose` free and the basket's envelope on the
  card, and sees the rim in a picture. An agent is not stopped from making such a drop.
  Putting `rim_top_mm` and the cutlery basket's box on the rack card would close it.
- **The programme.** Closed on 11 October: no level card lists a programme other than Eco 50,
  the manual and the tool descriptions name none, `start_cycle` refuses another, and the page
  offers none. A person and an agent wash on the same programme.
- **Drop suggestions** are the same list in the same order for both and cost both one query:
  an agent calls `list_slots` with an item and reads the list a screenful at a time, a person
  presses "Suggest spots" in the "In hand" panel and sees the list as numbered marks in the
  machine; a click on a mark places the piece at that pose (one action). In a view where two
  marks would lie on top of each other only the better is drawn. The page keeps the list asked last; so does the MCP server
  (one list: asking for another replaces it, and the first then costs a query again, as a
  second press does), and so does the standard harness when it folds.
- **Memory.** A person remembers what they did, or does not; the page keeps no history of
  actions. A model in the standard harness has its recent turns word for word and of older
  ones the scene they left (section 2 says what is gone with them).
- **Residue maps** as raw cells (`GET .../residue_map`) are fetched by the page to paint
  residue; an agent sees the painting, not the cells.
- **Height-map views** (`height_lower`, `height_upper`) are not built for either.
- **The upper basket from above** is drawn with what lies under it cut away, for both.

## 8. Rendered observations

`render` draws the session's scene with the web client's scene code in headless Chrome
(the program named by `SPOTLESS_CHROME`, or else Chrome or Chromium in the usual places of macOS,
Linux and Windows; tested on macOS only), from a page that stays warm.

**The machine as drawn** (changed on 11 October 2026, for the page and for these pictures
alike: one function, `buildMachineObjects` of `@spotless/render`, builds both). Every part the
wash treats as open is drawn open: the walls, floors, dividers and lid grids of the cutlery
basket, the knife shelf, the two cup shelves and the floor of the tablet tray are lattices one
can see through (35 sub-parts), each with openings of the real size and direction and with
bars as wide as makes the share one sees through equal to the share the wash lets through.
The two filter sheets, whose 0.85 mm holes are too fine for bars, are dotted. The plastic
fittings are the mid grey of the owner's machine, no longer near white. Collision shapes and
what the wash sees did not change: the lattices are drawing only (a fork still cannot pass
through a wall of the cutlery basket). An agent can now see cutlery through the walls of the
cutlery basket and items under a shelf through the shelf, as a person can. Not drawn: the
pressed panels of the tub, the red strips of the handles, the closed lower band of the cutlery
basket's inner walls; the knife shelf's bars are about twice as wide as the real ones because
the wash takes the shelf as half open. The piece in hand has a fifth tint, yellow (`perched`),
on the page; `render`'s `ghost` option uses the four it had.

| View | What it is |
|---|---|
| `iso_lower`, `iso_upper` | Perspective, from the front right and above, centred on the basket where it stands |
| `top_lower`, `top_upper`, `top_cutlery` | Orthographic, straight down, back of the machine up |
| `front`, `left`, `right` | Orthographic elevations |
| `custom` | Camera by azimuth, elevation, target, distance and field of view |
| `item` | One item alone from four fixed sides (or one side, with `camera`), with the axes of its own frame drawn from its reference point; `after_wash` shows what is left on it, with the legend of the four magenta steps |
| `items` | Every item of the level on one sheet, each with its id, as it goes in (at most 100 items) |

Options: `labels`, `grid`, `racks` (draw the baskets in or out; the load is shown moved with
them, not re-simulated), `highlight`, `ghost`, `size_px` (768 by default, 64 to 1024),
`traces` (after a wash: also the spots with a trace too faint to count). With `labels`,
`top_cutlery` outlines and names the cells of the cutlery basket as `list_slots` names them.
After the wash, while the load is as it was washed, every machine view shows the washed items
bare with what is left painted magenta, says so in a caption and carries the legend. The
pictures of a washed load are drawn from the report the player was given; when the server
does not hold it, `after_wash` is refused as `not_available` and never drawn from the soil
the item went in with. The custom camera is bounded (elevation -90 to 90 degrees, distance
1 mm to 10 m, field of view 5 to 120 degrees).
`top_cutlery` is offered although the session contract's `ViewName` does not list it.

The same state and view give the same bytes on one machine: a second Chrome with nothing cached
drew a byte-identical picture (checked by `packages/server/scripts/render-views.ts` and by the
tests). Pictures are cached by a hash of the level, the scene's state hash, the phase, the wash
and the request, in memory and under `<data>/renders/`, and the key includes a fingerprint of
the drawing code (every source file of `packages/render`), so a picture drawn before the
lattices is never served again.

Measured (M3 Pro, machine busy with other runs, `render-views.ts`):

| | Time |
|---|---|
| First picture after the server starts: Chrome, page, scene, picture | 1.3 s with the page script on disk; 2.2 s when it has to be built first (0.5 s) |
| A picture of a new state, 768 px | 17 to 56 ms, median 31 ms over 13 views |
| The same at 1024 px | median 35 ms, at most 82 ms |
| A picture from the cache | 6 ms |
| The four pictures of `get_item`, first time | 25 to 46 ms |
| A picture at 1024 px with the lattices, 17 views, other jobs running on the laptop (`packages/render/scripts/look.ts`, 11 October) | median 30 to 38 ms over four runs; 25 to 33 ms with the lattices switched off |

## 9. First results

**Two models have played three levels of the course at the official tier**, on 11 October,
through the standard harness: `gpt-6.1-sol` (four episodes) and `gpt-6-astra` (two episodes),
both served through one OpenAI-compatible endpoint on Azure. The names are those of the two
deployments on that endpoint; the records hold the
deployment name and the reasoning effort the API reported (`medium` for both), and no model
version or snapshot date was recorded. One episode a cell is an anecdote, not a measurement,
and nothing here ranks the two models. Records, transcripts, pictures and the full account are
in `docs/benchmark/first-runs/course/`.

Points, with the share of the level's points. The reference columns are the stored table of the
saved reference loads on the code as it is (`docs/benchmark/course-table.md`); the models'
episodes were washed a few hours earlier and washed again on the code as it is, with the same
points and every verdict the same.

| # | Level | Difficulty | Points | Empty | Random | Careless | Careful | `gpt-6.1-sol` | `gpt-6-astra` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | tutorial (12 pieces) | 2.3 | 64 | 0 | 20 (31.3 %) | 58 (90.6 %) | 64 (100 %) | 64 (100 %) | not run |
| 4 | breakfast (37) | 6.3 | 220 | 0 | 36 (16.4 %) | 112 (50.9 %) | 174 (79.1 %) | 190 (86.4 %); a second episode 188 (85.5 %) | 175 (79.5 %) |
| 7 | dinner-party (62) | 7.2 | 367 | 0 | 88 (24.0 %) | 100 (27.2 %) | 250 (68.1 %) | 260 (70.8 %) | 274 (74.7 %) |

Every model episode ended in a wash the model started and was verified three ways: the log
replayed, the load checked against it, and the load washed a second time with the same verdicts
and points. What the episodes took is in the table of section 2 ("What an episode costs with a
model") and, per episode, in `first-runs/course/episodes.md`.

What they show:

- **The careful reference load is not a ceiling.** Both models beat it on both full levels (by 1
  to 24 points), by placing pans, a platter and boards that the scripted careful hand never
  tries. A score divided by the careful reference would exceed 1; nothing here is normalised.
- **Neither model made the mistake the course's gates rest on.** No hollow piece was stood mouth
  up or laid on its side in six episodes. What the models loaded came out 84 to 100 % clean.
- **The share of points falls along the course only through what stays on the counter** (careful
  100, 79, 68 %; `gpt-6.1-sol` 100, 86, 71 %; `gpt-6-astra` 80, 75 %).
- **Not shown:** money (no prices), people, any model of Anthropic's, levels 2, 3, 5 and 6, or
  the spread of a model's own play (the one repeat reached 188 after 190 by a different load).

The five episodes of the first row of runs used one list of tools; the repeat on `breakfast`
used a corrected one (the plan view of the lower basket, the wording on rotation and on cutlery
cells), and the list has changed again since (`check_load` reports `pushed_by`, `over` and
`touching`). The results table keeps episodes of different tool lists on separate lines.

**Earlier episodes**, kept for how the harness came to be and not as results:
`docs/benchmark/first-runs/README.md` has the seven episodes of `gpt-6.1-sol` of the night and
morning of 11 October (five on the tutorial, one on a level of 44 items that no longer exists,
all at the fast tier on parameter sets since superseded) and the measurement of what a full
level cost before the results were shaped (175 million input tokens with a last request of 1.2
million) and after (8.9 million, no request above 34,000). No model of Anthropic's has been run
against the live API, and what a fold does to such a model's carried reasoning is unrun
(section 2, point 8).

**The reference policies on the seven levels of the course**, washed straight from the saved
loads, with the gates, what each mistake costs, the fast tier beside the official and how far a
score moves with the seed and the unsettled parameters: `docs/benchmark/levels.md` section 7,
`course-table.md` and `course-robustness.md`.

Under every table the harness prints how to read it: points are binary on the verdict of the
standard inspector; items at the edge of clean and provisional verdicts are counted beside the
points and never change them; a line marked "preview" (the fast tier) is not a benchmark
result; a line holds episodes of one level digest, benchmark version, tier, programme and wash
code only, and of one way of running them (the
column "Run with": harness version, MCP server version and the start of the digest of its
tool list, prompt version, context policy); and of the three verifications only `score` (a
second wash) covers the score itself.

## 10. Design decisions, and the questions still open

`benchmark.md` section 9 lists the decisions a benchmark of this kind has to take. This table
says what the code does for each today; where the build left one open, the dossier's
recommendation was taken. The questions still open follow the table, each with the answer the
code takes meanwhile. They are open design questions of the project: an issue or a pull request
that argues one of them is welcome (`docs/ROADMAP.md`).

| # | Decision | Taken |
|---|---|---|
| 1 | Binary or graded headline | Binary on the verdict: the table's points are the report's `points`, and an item counts by the verdict the standard inspector gives it whatever is flagged beside it. The band is reported beside the headline: every report, record and table line says how many loaded items were at the edge of clean (seen by the strictest eye the inspection standard allows and not by the most lenient) or carried a provisional verdict, what they are worth, and what the load would score with the edge items read either way (`Strict to lenient`). The graded points are in every record. |
| - | The programme | Eco 50 (decided on 2026-10-10), and no other: no level card lists another programme and `start_cycle` refuses one (11 October, after the first play test). |
| - | A fast wash | A preview: labelled on the page, in the report, in the record and in the table; never grouped with official washes. |
| 3 | One wash, no practice washes | One-shot: the harness ends an episode at the first accepted `start_cycle`. |
| 4 | Preview wash | None. |
| 5 | Loading guidance and worked examples | Guidance: yes, one text for everyone (`packages/server/src/guidance.ts`, version 2 since 11 October), the project's summary of the manufacturer's loading advice and of what the manual prints about the programme, and nothing else. Worked examples (the tutorial pack): not built, so not in the prompt. |
| 6 | Functional checks on request | As the levels have it: `check_load`, mechanical facts only. |
| 7 | Plausibility rules | The session's, unchanged. |
| 2 | What "clean" covers | Soil residue only, the dossier's recommendation and what the level card tells every player: at most 4 specks and 4 mm2 of visible soil. Water left standing in an item is reported and does not by itself decide (`cleanBySoil`, `packages/wash-runner/src/report.ts`). Since 11 October what that water held is counted as residue on the surface under it, so a glass or mug left mouth up is not clean; a few millilitres in the base recess of a level mug usually leave too little to see. The simulation's inspector also fails an item holding more than 1 mL; the report does not take that over. **Open**: whether water as such should fail an item. |
| 11 | Harness policy | One standard harness (section 2). Its numbers are its own choices: as many turns as the level allows actions and at least 400, the context policy `standard-2` (recent turns up to 12,000 estimated tokens or twice the note, folded down to 5,000; at most 8 pictures, pruned to 4), two reminders, two retries of a turn cut off at the output limit, `max_tokens` 64,000, effort `high` for every model of Anthropic's. For an OpenAI-compatible endpoint the effort is the model's default unless one is named (`--effort`), and the record says which. **Open**: whether published runs name one effort for every model. |
| - | What an action's result carries | What the action changed, completely, and a summary of the load; not the whole scene (section 7). Taken on 11 October 2026 because no model could otherwise play a full level; the rule is that a change is free and complete and that looking again costs what it cost before. Shaped in the MCP server; the session's own results and its log are unchanged. |
| - | A long conversation | Folded, in the standard harness, for every model alike: the oldest turns that an accepted action has since followed are replaced by a note with the scene as it stood, kept by the harness from the results alone (section 2). **Open**: the two sizes (12,000 and 5,000 estimated tokens) trade the length of a model's word-for-word memory against the cost of every request; they were set from the reference sequences, not from a study of play. |
| - | The level card in the prompt | The standard harness puts the level card in the system prompt (it is a free resource; the page shows it at all times). A model need not call `get_level`, and the card is never folded away. |
| - | Turn limit | `max(400, 8 x items)`: the level's own action budget. 400 for every level until 11 October; a level of 120 items allows 960 actions, and the careful reference load of 140 items makes 400 actions and 120 charged queries. |
| 12 | Human baseline scope | Only the mechanism is built (links, names, records). |
| 14 | Reports for private test levels | Not applied: the level format has no private levels, so every report is whole. |
| - | Budgets | The levels' own (`max(400, 8 x items)` actions, `max(300, 15 x items)` queries): the dossier's provisional 400 actions, and more where a level is larger. |
| - | Agent time limit (60 min of working time) | Not enforced; a turn limit stands in for it. Wall-clock and tokens are recorded. |
| - | A model that declines | Recorded as a refusal; no fallback model answers for it. |
| - | Context policy with signed reasoning | Old turns are folded and pictures pruned in batches, and the API is asked to drop reasoning blocks an edit invalidated. **Open**: as it stands a model on the Responses API keeps the carried reasoning of its kept turns across a fold and a model of Anthropic's would lose it if the API behaves as documented (section 2, point 8). Either that difference is stated with every comparison, or the harness drops carried reasoning at a fold for every provider (a change to the context policy and its version, with what it costs in points unmeasured). Not taken here: no Anthropic model has been run, and the change would alter how the two models that have played are run. |
| - | Harness and interface versions | `spotless-bench/0.2.0` from the afternoon of 11 October: shaped results, context policy `standard-2`, and `versions.interface` in the record. Prompt version 3. The four episodes of that day made after the results were shaped and before this (`sol-tutorial-3`, `sol-tutorial-4`, `sol-weeknight-1` and the reviewer's) say 0.1.0 and prompt version 2; the table keeps them on lines of their own. |
| - | The slot list a client can read on | One: the list asked last, as the page keeps the list of the last "Suggest spots". The MCP server kept every list of the unchanged scene until the review of 11 October. |
| - | Verification of scripted policies | Against the policy's own session by default (the log only); a fresh replay, which also checks the load, on request. The score itself is verified only by `bench verify --rewash`. |
| - | Query accounting | The dossier's: agents have a query cap, people look for free. Not changed. |
| - | A wash whose source changed under it | Benchmark mode: no result, started again. Local play: delivered, named by the code that ran, not kept in the result cache. |
| - | After a failed wash | Benchmark mode: the load is frozen, only `start_cycle` is taken. Local play: the player may change the load, as before. |
| - | Routes in benchmark mode | The list of levels, a level card without a session, a session's log, closing and restoring a session and every job record need the admin token. A participant's link opens their own session, its card (`GET /api/sessions/:id/card`) and nothing else. |
| - | Arguments beyond the session contract | `get_report` `wait_s`; `get_state` `rack` and `items`; `list_slots` `offset`, `limit` and `row`. All are handled in the MCP server and never reach the game: the game is asked what it was always asked, and its log says so. |

### Open questions, collected on 12 October 2026

Each with what the code does meanwhile. The first seven are about how runs are compared, the
rest about the levels and the score.

| Question | What the code does today |
|---|---|
| Whether the page's taking up of tine rows should cost a query, be given to agents on the level card, or be switched off in benchmark mode | The page keeps it free; an agent pays one query for the same geometry |
| Whether the rim heights of the baskets and the box of the cutlery basket go on the rack card | Not on the card: the page refuses to let a piece go on the rim, an agent is not stopped and pays for the drop |
| Whether carried reasoning is dropped at a fold of the conversation for every provider | Unchanged: a model on the Responses API keeps it, a model of Anthropic's would lose it; none of Anthropic's has been run |
| Whether published runs name one reasoning effort for every model | Each model's own default (both deployments reported `medium`) |
| The two sizes of the fold (12,000 and 5,000 estimated tokens) | As set from the reference sequences |
| Whether a published result states a cost. The six episodes so far were run without prices | Tokens are always recorded; a cost only when prices are given in `.env` |
| How many episodes a cell make a result (a full level takes about 3 million input tokens) | One a cell, labelled an anecdote; the two models are 14 and 15 points apart in opposite directions on two levels |
| What a score is normalised by, now that both models beat the careful reference load | Raw points and shares only |
| Whether agents are told a level's number and difficulty | People see them in the list; an agent reads only the "New: ..." sentence of the summary |
| Whether a piece dropped out of the machine costs an action | It does, for agents and people alike; the page refuses the two drops that caused it |
| Whether water left standing in an item fails it by itself (the standards dossier: yes, above 1 mL; the benchmark dossier: soil only) | Soil only, with what the water held counted as soil |
| The tutorial, which fails the one-fifth gate (64 against 58): more cups (14 pieces, and the tests that pin its 12 follow), a careless script that turns a cup under the knife shelf, or an exemption as the level that teaches the interface | Left at 12 pieces and 64 points, reported as failing; `course-table --gates` exits 1 for it |
| The gate itself. To pass it on this wash, 31 to 40 % of each level's points sit in glasses, mugs and little pots; the alternative is a lower gate until nesting and doubling up are modelled | Designed to the gate |
| The dinner party's careless load, which blocks the tablet's path by accident; without that its margin would be about 21 % | Kept as it fell |
| The order of the course. The difficulty figure rises, the scripted loads' scores do not fall level by level, and no order makes both scripted series fall | Order kept; the page says the figure is worked out from what is on the counter |
| Whether the course should also get harder to wash, not only fuller: neither model made the hollow-piece mistake every gate rests on | Nothing changed in the levels |
| Whether pieces that cannot come clean keep their high points (the cooked-egg frying pan, 18 points at the breakfast) | Unchanged |
| The six generated levels (pasta supper, Sunday roast, cooked breakfast, two of each) | Out of the list; the generator is kept. Bringing them back means redrawing the families and about 35 minutes of washes per three levels |

## 11. Things to know before a long run

- **A scripted policy decides in the harness's own process**, synchronously: on a full level
  that is minutes during which the harness's game server answers nobody. Nothing else uses that
  server, so nothing is lost, but a batch is one episode at a time. To run policies side by
  side, start one `bench run` per policy with its own `--out`.
- **A placement can be slow.** Loading physics on an untidy pile takes seconds to a minute or
  more on a busy machine (`docs/design/platform.md` section 6). The harness gives a tool call
  30 minutes. An MCP client has its own limit for a call (the SDK's client: one minute unless
  told otherwise); a client that gives up on a slow `place` has not undone it, and `get_state`
  says what happened.
- **Connections.** The MCP server sends every call of the game on a connection of its own, and
  its HTTP endpoint never closes an idle connection itself. Both are there because a call of the
  game cannot be sent twice: a pooled connection closed by the other side while a process was
  busy fails the next request, and did so twice while this was built.
- **The loading time of a scripted policy** in the table is the time its calls took to issue,
  not the time it took to decide (it decides before its first call). For a model and for a
  person it runs from the first call (or the page opening) to the start of the cycle.
- **What a scripted policy does depends on the loader's code**, which was still changing on
  2026-10-10; a record carries a fingerprint of it (`policy.settings.source_fingerprint`).
- **Pictures on disk.** The render service keeps every picture it draws under
  `<data>/renders/`, and page scripts under the system's temp directory
  (`spotless-render-bundles/`); neither is pruned.

## 12. Commands

```sh
pnpm --filter @spotless/bench bench run ...            # episodes (section 2)
pnpm --filter @spotless/bench bench run --levels tutorial --policies openai:gpt-6.1-sol --max-input-tokens 2000000 --out "$PWD/.spotless/bench/sol-tutorial"   # a model behind an OpenAI-compatible endpoint: the tutorial at the official tier (646,822 input tokens on 11 October)
pnpm --filter @spotless/bench bench run --levels breakfast --policies openai:gpt-6.1-sol --max-input-tokens 12000000 --out <absolute dir>   # a full level (section 2 says which limit to give for which level)
pnpm --filter @spotless/bench bench table <absolute dir>        # the results table
pnpm --filter @spotless/bench episode-table <dir> [--md <file>] [--json <file>]   # one line an episode, with tokens (relative paths from where it is called)
pnpm --filter @spotless/bench course-table [--gates] [--md docs/benchmark/course-table.md]   # the course from the stored reference tables
pnpm --filter @spotless/bench reference-table [--levels a,b] [--tier fast] [--gates]   # the reference policies on the saved loads (levels.md)
pnpm --filter @spotless/bench mistake-study --level <id>   # what each kind of mistake costs, one at a time
pnpm --filter @spotless/bench robustness --levels a,b,c    # careful and careless under other seeds and parameter ends
pnpm --filter @spotless/bench soil-lab --spec <spec.json> --loads <names> --out <dir>   # other soils on saved loads
pnpm --filter @spotless/bench measure-episode --load <level>-careful [--previews all] [--label <text>] [--json <file>] [--md <file>]   # what an episode costs in tokens, measured without a model (15 s for the tutorial, 4 minutes for a full level, 19 for the load of 140 items)
pnpm --filter @spotless/bench measure-episode --check <transcript.json>   # the token estimate against a real episode
pnpm --filter @spotless/bench episode-cost --from <measurement.json> [--from ...] [--price <model>=<in>,<cached>,<out>] [--json <file>] [--md <file>]   # the same in dollars (or --level <id>, which measures first)
pnpm --filter @spotless/loader generate-loads [names] [--jobs 6]   # the reference loads of every level
pnpm --filter @spotless/loader check-loads [--jobs 6]  # every saved load replays, its baskets travel
pnpm --filter @spotless/levels exec tsx scripts/summary.ts          # every level: items, points, problems
pnpm --filter @spotless/levels exec tsx scripts/pack-levels.ts --from-loads   # more is offered than fits
pnpm --filter @spotless/bench bench verify <record> [--rewash] [--cache <dir>]   # log and load; with --rewash the score
pnpm --filter @spotless/server exec tsx src/cli.ts link --level <id> --player <name> [--agent]
pnpm --filter @spotless/mcp exec tsx src/cli.ts --server <url> --session <id> [--http] [--allow-host <name>]
pnpm --filter @spotless/mcp exec tsx scripts/play.ts   # a real MCP client over stdio, tutorial
pnpm --filter @spotless/mcp exec tsx scripts/call.ts --url <mcp url> <tool> '<json>'   # one call by hand
pnpm --filter @spotless/server exec tsx scripts/render-views.ts --load   # every view, timed
pnpm --filter @spotless/web benchmark-shots            # the participant's page, in headless Chrome
```
