---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Scope: Project-wide
---

# EnvX — Project Documentation

> **Source:** Reverse-engineered from existing code on 2026-07-12 by the
> `project-docs-sync` skill. Sections marked _(inferred from code)_ came from
> automated analysis; everything else is confirmed against the source in `src/`.

EnvX (`envx-cli` on npm) is a command-line tool for **secure environment file
encryption and management using GPG**. It manages `.env.<stage>` files across
environments (local, development, staging, production), stores passphrases in
`.envrc` (direnv convention), and keeps shared project config in `.envxrc`
(JSON).

This folder is the design/reference docs. The **user-facing manual is the root
[`README.md`](../../README.md)** — it stays the source of truth for installation,
per-flag reference, and workflow recipes. These docs describe _how the tool is
built and why_.

## Map

| Doc                                                    | What it covers                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [tech-stack.md](./tech-stack.md)                       | Runtime, dependencies, tooling, and why each was chosen                                                              |
| [architecture-overview.md](./architecture-overview.md) | Diagrams: component layers, command dispatch, config resolution, encrypt/decrypt & `run` sequences, upward discovery |
| [commands/commands.md](./commands/commands.md)         | The one "module" — command inventory, shared behavior, the `--all` matrix                                            |
| [commands/features/](./commands/features/)             | One spec per command (encrypt, decrypt, create, copy, interactive, run, config, files, project commands)             |
| [glossary.md](./glossary.md)                           | Terms: stage, secret, `.envrc` vs `.envxrc`, project root, ignore/exclude                                            |
| [decisions.md](./decisions.md) + [adr/](./adr/)        | Architecture decisions and their rationale                                                                           |
| [test-plan.md](./test-plan.md)                         | Test surface: core suites, integration suites, what is intentionally not tested                                      |
| [changes-log.md](./changes-log.md)                     | Append-only pointer log of doc changes after this initial generation                                                 |

## What's intentionally not documented

EnvX is a single-binary CLI with no server, database, HTTP API, auth, tenancy,
webhooks, background jobs, or telemetry. The web-app-oriented templates for
those (`rbac-matrix`, `nfr`, `webhooks-*`, `async-architecture`, `schema-*`,
`api-*`, `observability`, `compliance-pii`, `index/*`) are deliberately omitted.
If any of those surfaces is ever added, generate the matching doc then.

## Modules

| Module                             | Docs            | Status      |
| ---------------------------------- | --------------- | ----------- |
| [Commands](./commands/commands.md) | 9 feature specs | Implemented |
