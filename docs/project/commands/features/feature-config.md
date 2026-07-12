---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx config`

## Summary

Manage the `.envxrc` project config (ignore patterns, excluded directories,
enrolled environments) without hand-editing JSON. Source: `src/commands/config.ts`.

## Subcommands

| Command                          | Does                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `config show`                    | Print effective config (custom values, else defaults). Shows the source path if `.envxrc` is in an ancestor dir. |
| `config ignore list`             | List effective ignore patterns; notes when defaults are in use.                                                  |
| `config ignore add <pattern>`    | Add an ignore pattern (case-insensitive dedupe).                                                                 |
| `config ignore remove <pattern>` | Remove an ignore pattern.                                                                                        |
| `config exclude list`            | List effective excluded directories.                                                                             |
| `config exclude add <dir>`       | Add an excluded directory.                                                                                       |
| `config exclude remove <dir>`    | Remove an excluded directory.                                                                                    |
| `config reset`                   | Overwrite `.envxrc` with default ignore + exclude lists.                                                         |

All accept `-c, --cwd <path>`.

## Behavior

- **Reads** resolve the nearest `.envxrc` via `findEnvxrcUpward` (upward walk).
  `getIgnorePatterns` / `getExcludeDirs` return the file's values or the
  `FileUtils` defaults.
- **Writes** go through `mergeEnvxrc`, which targets the nearest existing
  `.envxrc` — so `config … add` from a monorepo subdir edits the **root** config,
  not a package-local shadow. If no ancestor has one, it creates `.envxrc` in
  `cwd`.
- `add`/`remove` are case-insensitive and warn (not error) on no-op (already
  present / not present).
- `reset` restores `ignore` and `excludeDirs` to defaults while **preserving**
  `files` (the registered-files registry) and `environments` — those are
  project state, not preferences. It targets the nearest `.envxrc` (upward
  walk), falling back to `cwd` when none exists.

## Defaults

- **ignore:** `example`, `sample`, `template`
- **excludeDirs:** `node_modules`, `.git`, `dist`, `.next`, `.turbo`, `.output`,
  `.nuxt`, `.cache`, `build`, `coverage`, `.svelte-kit`

## `.envxrc` shape

```json
{
  "ignore": ["example", "sample", "template", "test"],
  "excludeDirs": ["node_modules", ".git", "dist", ".vercel"],
  "environments": ["development", "staging", "production"]
}
```

Validated by `envxrcFileConfigSchema`. All fields optional. An empty
`ignore: []` is the explicit "disable filtering" escape hatch.

## Edge cases (from code)

| Scenario                        | Behavior                                                       |
| ------------------------------- | -------------------------------------------------------------- |
| No `.envxrc` anywhere           | `show` prints defaults; reads fall back to defaults.           |
| `add` a pattern already present | Warn, no write.                                                |
| `remove` a pattern not present  | Warn, no write.                                                |
| `.envxrc` in ancestor dir       | `show`/`list` note the source path; writes edit that ancestor. |
| Write fails                     | Error message; exit `GENERAL_ERROR (1)`.                       |

## Exit codes

`SUCCESS 0` · `GENERAL_ERROR 1` (per-subcommand action failure).

## Related

- [feature-project-commands](./feature-project-commands.md) (init writes
  `.envxrc`) · [adr/0002](../../adr/0002-envrc-envxrc-split.md) ·
  [adr/0003](../../adr/0003-upward-config-discovery.md) · [commands.md](../commands.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |
