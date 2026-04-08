# `.envrc` / `.envxrc` Monorepo Discovery — Design Spec

**Date:** 2026-04-08
**Status:** Approved (brainstorming phase)
**Author:** Rahul Retnan + Claude (brainstorming session)

## Goal

Fix envx's behavior in monorepos. When a user runs any envx command from a subdirectory (e.g., `packages/db/` in a turborepo), the command must discover `.envrc` (passphrases) and `.envxrc` (project config) from an ancestor directory instead of silently falling through to an interactive passphrase prompt.

The canonical repro: a turborepo with `.envrc` + `.envxrc` at the root and `.env.dev.gpg` inside `packages/db/`. Running `envx run -e dev -- pnpm migrate` from `packages/db/` today prompts for the passphrase because `FileUtils.readEnvrc(cwd)` only looks in `packages/db/`. After this change, it picks up the passphrase from the root `.envrc` automatically.

## Non-goals

- Stage file (`.env.<stage>[.gpg]`) discovery across directories. Still cwd-only, as locked in the v1 `run` spec (`2026-04-07-envx-run-design.md`, decision #4). This spec does not re-litigate that decision.
- Configurable paths inside `.envxrc` (e.g., a `paths` field pointing to custom locations). YAGNI. The upward walk + a `.git`/`.envrc`/`.envxrc` fence covers the real-world scenarios. Can be added later if a concrete use case appears.
- Merging `.envrc` or `.envxrc` across multiple ancestors. Nearest ancestor wins; no merge.
- Recursive env file discovery from a parent directory (e.g., finding `packages/**/.env.dev` when run from root). Separate concern, separate spec.
- Changing discovery for `findAllEnvironments(cwd)`. That still globs downward from cwd — the only change is that the **ignore list** and **excludeDirs** it consults now come from the nearest `.envxrc` up the tree.

## Decisions locked during brainstorming

| #   | Question                                                         | Decision                                                                                                                                                                            | Reason                                                                                                                                                                        |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which files should walk upward?                                  | `.envrc` and `.envxrc`. Stage files (`.env.<stage>[.gpg]`) stay cwd-only.                                                                                                           | Fixes the reported passphrase bug and the symmetric `.envxrc` (ignore / excludeDirs) bug in one consistent change. Leaves the deliberately-scoped stage-file rules untouched. |
| 2   | Where does the walk stop?                                        | Walk upward; stop at the first ancestor containing any of `.envrc`, `.envxrc`, or `.git`. Any of the three signals "project root".                                                  | Handles both git-tracked and non-git projects. `.git` alone would fail for non-git projects; `.envrc` alone would fail pre-init.                                              |
| 3   | What if the walk finds nothing before hitting filesystem root?   | Fall back to existing behavior (e.g., prompt for passphrase for encrypt/decrypt/run).                                                                                               | Zero breaking change. Users who do ad-hoc encryption without ever creating an `.envrc` keep working.                                                                          |
| 4   | Are `.envrc` and `.envxrc` walks independent?                    | Yes. Each file is resolved by its own walk. They can in principle live in different ancestor directories.                                                                           | Simpler. In practice they'll always be co-located, but nothing in the design enforces it.                                                                                     |
| 5   | Should `.envxrc` be gitignored?                                  | No. Remove `.envxrc` from `FileUtils.updateGitignore`'s `secretPatterns`. `.envrc` stays ignored.                                                                                   | `.envxrc` holds project config (ignore patterns, exclude dirs, enrolled environments) meant to be shared across a team. It never contained secrets. This was a bug.           |
| 6   | Where do `envx config ... add/remove` writes land in a monorepo? | Write to the nearest existing `.envxrc` up the tree via `findEnvxrcUpward`. If none exists, write to `cwd` (greenfield behavior).                                                   | Matches user intent: editing "the project config" from a subdirectory should edit the root config, not shadow it with a package-local file.                                   |
| 7   | How does `envx config show` from a subdirectory behave?          | Shows the resolved (nearest) `.envxrc` and prints its path so the user knows where the displayed config came from.                                                                  | Transparency. Avoids confusion when the config is resolved from several directories up.                                                                                       |
| 8   | Implementation style                                             | Add new helpers on `FileUtils` (`findProjectRoot`, `findEnvrcUpward`, `findEnvxrcUpward`, `readEnvrcNearest`). Keep existing `readEnvrc(cwd)` / `readEnvxrc(cwd)` contracts intact. | Separates "find the config" from "read the config". Low-level readers stay deterministic for testing; high-level wrappers do the walking.                                     |

## Behavior (the contract)

1. **`.envrc` discovery walks upward.** Any command that reads `.envrc` for passphrases walks from `cwd` toward the filesystem root and uses the first `.envrc` it finds.
2. **`.envxrc` discovery walks upward.** Same rule, resolved independently from `.envrc`.
3. **The walk stops at the first ancestor containing any of `.envrc`, `.envxrc`, or `.git`.** That ancestor is treated as the project root. If none is found before the walk hits filesystem root, the walk returns `null` and callers fall back to their current no-config behavior.
4. **Stage files unchanged.** `resolveStageFile(stage, cwd)` still looks only in `cwd`.
5. **`.envxrc` is now committable.** It is dropped from the `.gitignore` defaults emitted by `FileUtils.updateGitignore`. `.envrc` stays ignored.
6. **`.envxrc` writes target the nearest existing file.** `FileUtils.mergeEnvxrc(cwd, partial)` writes to the nearest existing `.envxrc` up the tree. If none exists, creates `.envxrc` in `cwd`.

### Observable outcomes

- From `packages/db/` in a turborepo with `.envrc` at the monorepo root: `envx run -e dev -- pnpm migrate` picks up the root passphrase automatically. No interactive prompt.
- From `packages/db/` with no local `.envxrc` but a root-level one containing `ignore: ["demo"]`: environment discovery honors that ignore list.
- From a fresh directory outside any project (no `.envrc`, no `.envxrc`, no `.git` up the tree): behavior is identical to today. Passphrase prompts still appear when required.
- Running `envx config ignore add demo` from `packages/db/`: edits the root `.envxrc`, not a new `packages/db/.envxrc`.

## File layout

### Modified files

- **`src/utils/file.ts`** — add the walking helpers, rewire the config readers, and fix the `.gitignore` defaults.
  - New static methods:
    - `findProjectRoot(cwd: string): Promise<string | null>` — walks from `cwd` toward the filesystem root. Returns the first ancestor containing any of `.envrc`, `.envxrc`, `.git`. Returns `null` if none is found. Stops when `path.dirname(p) === p` to handle both POSIX and Windows roots. Permission errors on a stat call are treated as "not present, keep walking" (no throw).
    - `findEnvrcUpward(cwd: string): Promise<string | null>` — walks upward for the nearest ancestor containing `.envrc`. Returns the directory (not the file path) to match the shape of `readEnvrc(cwd)`.
    - `findEnvxrcUpward(cwd: string): Promise<string | null>` — same, for `.envxrc`.
    - `readEnvrcNearest(cwd: string): Promise<EnvrcConfig>` — convenience wrapper. Calls `findEnvrcUpward` then `readEnvrc(dir ?? cwd)`. Returns `{}` if no file was found.
  - Modified methods:
    - `getIgnorePatterns(cwd)` — now calls `findEnvxrcUpward(cwd)` and reads `.envxrc` from the resolved directory (or `cwd` if not found). Fallback to `DEFAULT_IGNORE_PATTERNS` preserved.
    - `getExcludeDirs(cwd)` — same shape.
    - `mergeEnvxrc(cwd, partial)` — calls `findEnvxrcUpward(cwd)` to find the target directory. Writes to the nearest existing file. If none found, writes to `cwd`.
    - `updateGitignore(cwd)` — `secretPatterns` becomes `['.envrc']` (drops `.envxrc`). Behavior for `envPatterns` is unchanged.
  - Unchanged: `readEnvrc(cwd)` and `readEnvxrc(cwd)` still read from exactly the directory you hand them. Tests that deliberately pass a directory without a config file continue to get `{}`.

- **`src/commands/run.ts`** — line 317. Replace `FileUtils.readEnvrc(cwd)` with `FileUtils.readEnvrcNearest(cwd)`. One-line change.

- **`src/commands/encrypt.ts`** — line 209. Same one-line change.

- **`src/commands/decrypt.ts`** — line 226. Same one-line change.

- **`src/commands/copy.ts`** — line 306. Same one-line change. The existing `rootCwd` variable is redundant after this; collapse it.

- **`src/commands/interactive.ts`** — lines 67 and 145. Same one-line change at each site.

- **`src/utils/interactive.ts`** — line 242. Same one-line change.

- **`src/commands/config.ts`** — lines 146, 197, 274. `envx config show`, `envx config ignore`, and `envx config exclude` all need to read the nearest `.envxrc` instead of the cwd-only one. Use `findEnvxrcUpward(cwd)` at each site. `envx config show` additionally prints the resolved path ("reading from: `<path>`") so users can see which file the displayed config came from.

- **`__tests__/core/file.test.ts`** — update any `updateGitignore` assertion that asserts on the count or exact contents of the secret-patterns section so it reflects the removal of `.envxrc`. CLAUDE.md flags this as a known gotcha ("When adding patterns to `FileUtils.updateGitignore` …, update the corresponding pattern-count assertions"). Add new tests for `findProjectRoot`, `findEnvrcUpward`, `findEnvxrcUpward`, `readEnvrcNearest`, and the updated `mergeEnvxrc` semantics.

- **`__tests__/integration/cli.test.ts`** — add a monorepo fixture test: create a temp dir with `.envrc`, `.envxrc`, `.env.dev` + `.env.dev.gpg` at the top level and a `packages/db/` subdirectory containing its own `.env.dev.gpg` but no `.envrc`. Run `envx run -e dev --cwd <tmp>/packages/db -- node -e "console.log(process.env.FOO)"` and assert the child picks up the root passphrase without prompting.

- **`CLAUDE.md`** — update the "Configuration Files" section to document that `.envrc` and `.envxrc` are now resolved by walking upward from `cwd`, stopping at the first ancestor containing any of the three markers. Note that `.envxrc` is committable; only `.envrc` is gitignored.

- **`README.md`** — update the "Configuration Files" documentation and add a short "Monorepos" subsection under the relevant command(s) explaining that envx now discovers config from ancestor directories.

### New files

None. All logic lives in existing `FileUtils` plus the seven command/utility files that currently call `readEnvrc`.

## Edge cases

1. **Walk termination.** Loop stops when `path.dirname(current) === current`. Handles both POSIX (`/`) and Windows (`C:\`) roots.
2. **Symlinks.** The walk uses `path.resolve(cwd)` once at entry; it does NOT call `fs.realpath` on every step. Symlinks are traversed as-given. Matches the behavior of eslint/prettier's rc-file resolution.
3. **Permission errors on an ancestor.** `fs.stat` failures are caught and treated as "file not present; keep walking". No propagated errors.
4. **Git submodules.** A submodule's `.git` entry is a file; a normal repo's `.git` is a directory. The existence probe inside `findProjectRoot` must accept either, so it cannot use the existing `FileUtils.fileExists` (which requires `stat.isFile()`). It uses a dedicated internal probe — `await fs.stat(entry)` wrapped in try/catch, returning `true` on success regardless of entry type. This detail applies only to the three marker checks inside `findProjectRoot`; the low-level `readEnvrc` / `readEnvxrc` continue to use the existing file-only probe because `.envrc` / `.envxrc` are always files.
5. **Empty or malformed `.envrc` / `.envxrc`.** Existing `readEnvrc` / `readEnvxrc` already swallow parse errors and return `{}`. The walk stops at that ancestor — it's still the project root. The caller sees an empty config and falls through to its existing no-config path.
6. **Walking from `/`.** `findProjectRoot('/')` immediately returns `null` (no ancestors to check beyond the initial directory itself).
7. **Relative `--cwd` arguments.** `findProjectRoot` resolves its input via `path.resolve` once before walking.

## Testing

### Unit tests (`__tests__/core/file.test.ts`)

Each test uses a temp directory built via `fs.mkdtemp` and cleaned in `afterEach`, per the existing convention. All tests are hermetic — no reliance on the surrounding filesystem.

1. `findProjectRoot` returns the nearest ancestor containing `.envrc`.
2. `findProjectRoot` returns the nearest ancestor containing `.envxrc`.
3. `findProjectRoot` returns the nearest ancestor containing `.git` (directory).
4. `findProjectRoot` returns the nearest ancestor containing `.git` (file, i.e., git submodule).
5. `findProjectRoot` prefers the nearest ancestor when multiple ancestors contain markers.
6. `findProjectRoot` returns `null` when the walk hits the filesystem root without finding any marker.
7. `findProjectRoot` handles `fs.stat` permission errors by treating the directory as "not a match" and continuing the walk.
8. `findEnvrcUpward` returns `null` when there's only `.envxrc` up the tree (but no `.envrc`).
9. `findEnvxrcUpward` returns `null` when there's only `.envrc` up the tree (but no `.envxrc`).
10. `findEnvrcUpward` and `findEnvxrcUpward` can return different directories (walks are independent).
11. `readEnvrcNearest` returns the config from the resolved ancestor.
12. `readEnvrcNearest` returns `{}` when nothing is found anywhere.
13. `getIgnorePatterns(cwd)` from a sub-directory honors the ancestor `.envxrc`'s `ignore`.
14. `getExcludeDirs(cwd)` from a sub-directory honors the ancestor `.envxrc`'s `excludeDirs`.
15. `mergeEnvxrc` from a subdirectory with an ancestor `.envxrc` writes to that ancestor, not `cwd`.
16. `mergeEnvxrc` in a greenfield directory (no ancestor `.envxrc`, no markers) creates `.envxrc` in `cwd`.
17. `updateGitignore` no longer adds `.envxrc` to `.gitignore`. Update the existing pattern-count assertion accordingly.

### Integration tests (`__tests__/integration/cli.test.ts`)

1. **Monorepo passphrase discovery.** Build a temp fixture with:

   ```text
   <tmp>/
     .envrc                # contains DEV_SECRET="<passphrase>"
     .envxrc               # any valid JSON
     packages/
       db/
         .env.dev.gpg      # encrypted with <passphrase>, contains FOO=bar
   ```

   Run:

   ```bash
   envx run -e dev --cwd <tmp>/packages/db -- node -e "console.log(process.env.FOO)"
   ```

   Assert: exit code 0, stdout contains `bar`, no passphrase prompt appeared.

2. **No project root fallback.** Run an encrypt/decrypt command from a temp directory with no markers up the tree (use a directory path that doesn't chain up into any `.git` ancestor). Verify the existing passphrase prompt still triggers — behavior preservation.

3. **`envx config show` from subdirectory.** Create a temp fixture with an `.envxrc` at the root and run `envx config show --cwd <tmp>/packages/db`. Assert the output reflects the root `.envxrc`'s contents and includes the resolved file path.

### Existing test impact

- `__tests__/core/file.test.ts` — any test that constructs a temp directory and directly calls `readEnvrc(dir)` or `readEnvxrc(dir)` is unaffected. Only tests that would incidentally find an ancestor `.envrc` during the walk need attention — those should either point `cwd` at an isolated temp directory (standard practice already) or assert against `readEnvrcNearest` where appropriate.
- The known `secretPatterns` pattern-count assertion flagged in CLAUDE.md must be updated as part of this change.

## Rollout

- This is a minor, additive behavioral change. No flag, no opt-in. The fallback path preserves today's behavior for anyone not in a monorepo.
- The `.envxrc` gitignore fix only affects new invocations of `envx init` and `FileUtils.updateGitignore`. Users with `.envxrc` already listed in their `.gitignore` can remove it manually; we don't rewrite existing `.gitignore` files.
- No changes to the CLI surface. No new flags, no new commands.
