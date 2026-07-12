---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx create`

## Summary

Create new `.env.<stage>` files — one at a time, or several via an interactive
wizard, optionally seeded from a template file. Source: `src/commands/create.ts`.

## Usage

```bash
envx create -e development                 # single stage
envx create -i                             # interactive multi-create
envx create -e production -t .env.example  # from a template
envx create -e staging --overwrite
```

## Flags

| Flag                      | Meaning                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `-e, --environment <env>` | Stage name. If omitted, an interactive prompt asks for one. |
| `-t, --template <path>`   | Seed content from this file (absolute or cwd-relative).     |
| `-i, --interactive`       | Multi-environment wizard.                                   |
| `--overwrite`             | Overwrite existing files without confirmation.              |
| `-c, --cwd <path>`        | Working directory.                                          |

## Behavior

### Single (`-e`)

1. Prompt for name if not given; validate against `^[a-zA-Z0-9_-]+$`.
2. `validateCreateOptions` (Zod).
3. If the stage already exists, list its files and (without `--overwrite`) ask
   whether to add more files.
4. If `-t`, resolve and verify the template exists (throws if not).
5. Write `.env.<stage>`. If the file exists and no `--overwrite`, confirm first.
6. Content = template file if given, else a commented starter stub.

### Interactive (`-i`)

Wizard in `executeInteractiveCreate`: suggests common stages
(`development`, `staging`, `production`, `local`, `test`) minus existing ones, lets
you multi-select and/or add custom names in a loop, optionally pick a template
(auto-detects `.env.example` / `.env.template` / `.env.sample`), shows a summary,
confirms, then creates — skipping existing files unless `--overwrite`.

## Template resolution

`createEnvTemplate(path, template?)`: if `template` exists, copy its content;
otherwise write the default stub:

```
# Environment variables
# Add your environment-specific variables here
# Example:
# DATABASE_URL=
# API_KEY=
# DEBUG=false
```

## Edge cases (from code)

| Scenario                      | Behavior                                                |
| ----------------------------- | ------------------------------------------------------- |
| Invalid stage name            | Throw: letters/numbers/hyphens/underscores only.        |
| Template not found            | Throw `Template file not found: <path>`.                |
| File exists, no `--overwrite` | Confirm; declining cancels (single) or skips (wizard).  |
| Wizard, nothing selected      | Warn "No environments selected", return.                |
| Write failure (wizard)        | Per-file error; exit `GENERAL_ERROR (1)` if any failed. |

## Notes

`create` does **not** touch GPG — it only writes plaintext stage files. Encrypt
them afterward with `envx encrypt`.

## Exit codes

`SUCCESS 0` · `GENERAL_ERROR 1` (wizard file failures / thrown errors).

## Related

- [feature-encrypt](./feature-encrypt.md) · [feature-interactive](./feature-interactive.md)
  · [commands.md](../commands.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |
