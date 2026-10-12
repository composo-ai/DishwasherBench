# Security policy

## Reporting a problem

Please report a security problem **privately**, not in a public issue.

1. If "Report a vulnerability" is offered under the **Security** tab of this repository on
   GitHub (private vulnerability reporting), use it.
2. Otherwise write to **support@composo.ai** with "DishwasherBench security" in the subject.

Say what you found, how to reproduce it, and which version or commit you looked at. We aim to
acknowledge a report, but the project is maintained at a small scale and no response time is
promised; please give the maintainers a reasonable time to fix a problem before you publish it.

Only the current state of the `main` branch is supported. The one version so far is 0.1.0
([CHANGELOG.md](CHANGELOG.md)).

## Personal information in the repository

The repository contains photographs, measurements and test-wash records of one privately owned
dishwasher. They were prepared for publication as
[docs/reference/REDACTIONS.md](docs/reference/REDACTIONS.md) describes. If you find something
that should not be public (a serial number, a name, something that locates a home, metadata in
a picture, a key or an address of a service in a record or transcript), please report it the
same private way, and do not quote it in a public issue.

## What is in scope

DishwasherBench is a research project that you run on your own machine. Two of its programs
listen on a network port, and both are **meant for local use only**:

- **The game server** (`packages/server`, started by `pnpm --filter @spotless/web play` or by
  `serve`). It listens on 127.0.0.1 by default. Without an admin token it has no access control
  at all: any program that can reach the port can create sessions, act in them and start washes,
  which occupy the GPU for minutes. With an admin token (benchmark mode) the token guards the
  administrative routes and a participant's link opens that participant's session; this is
  there to keep benchmark episodes honest, not to protect a server on an open network.
- **The MCP server** (`packages/mcp`). Over stdio it is started by the client. Over HTTP it
  listens on 127.0.0.1 by default and has no authentication.

**A web page from elsewhere cannot drive a local server.** The game server answers 403 to any
request whose `Origin` header names another origin than the one the request was sent to, unless
that origin was allowed with `--allow-origin`, and it does not send
`access-control-allow-origin: *`. It also answers 403 to any request whose `Host` header names
a host it does not answer to, whatever the port: when it listens on a loopback address (the
default) it answers to `127.0.0.1`, `localhost` and `[::1]`; started with `--host <address>`,
to that address; with `--host 0.0.0.0` or `--host ::`, to the loopback names and every address
of the machine; and always to a name allowed with `--allow-host`. So a page that reaches the
machine under a name of its own (DNS rebinding) is refused. The MCP server over HTTP checks
`Host` in the same way and refuses every request that carries an `Origin` header. What is left:
a page of another site can still cause a plain `GET` that carries no `Origin` (a picture, a
link); it cannot read the answer, and it does not know the id of a session. These checks stop a
page open in your browser; they are not access control against a program that can reach the
port.

Neither has been reviewed for exposure to the internet, and neither should be bound to a public
address (`--host`) or put behind a public proxy without your own access control in front of it;
whoever does so does it at their own risk. A report that either can be reached without
authentication when you expose it yourself is therefore expected behaviour, not a
vulnerability.

Reports that are in scope and welcome:

- a way for a page, a file or a model's output to run code, read files or reach the network on
  the machine that runs the game server, the MCP server or the harness, and any way round the
  `Origin` and `Host` checks above;
- a way for a benchmark participant or an agent to read or change another participant's episode,
  or to obtain the admin token;
- a way for the harness to write a key or the address of an endpoint into a record, a transcript
  or a log (the harness is meant never to);
- a path by which a file that carries personal information would pass the hygiene check
  (`scripts/check-hygiene.mjs`) when it should not.

Out of scope: vulnerabilities in dependencies that do not affect this project as it uses them
(please report those to the dependency), and anything that requires an attacker who already
controls the machine.

## Keys

Model runs read the address and the key of an endpoint from `.env`, which git ignores. Never
commit a key. `pnpm hygiene` fails on the common shapes of keys, on a named value that looks like
a key, on a password inside an address, on the host of an Azure OpenAI endpoint and on a
filled-in `.env.example`; it cannot recognise every secret, so read what you commit.
