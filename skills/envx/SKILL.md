---
name: envx
description: >-
  Use when working in a project that manages secrets with envx (envx-cli):
  .env.<stage> files, .env.<stage>.gpg encrypted files, an .envrc passphrase
  file, an .envxrc JSON config, or registered secret files (certs, keystores,
  service-account JSON). Covers encrypting/decrypting env files, running
  commands with injected secrets, managing secret files, and safety rules
  for handling plaintext secrets.
---

# envx — encrypted environment and secret files

envx encrypts `.env.<stage>` files and registered secret files with GPG.
Encrypted `*.gpg` artifacts are committed to git; plaintext never is.

## Key files

| File                    | Purpose                                                                 | Committed?                           |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `.envrc`                | Passphrases: `export <STAGE>_SECRET="..."`, `export FILES_SECRET="..."` | **Never.** Never print its contents. |
| `.envxrc`               | JSON project config: `environments`, `ignore`, `excludeDirs`, `files`   | Yes                                  |
| `.env.<stage>`          | Plaintext env file (e.g. `.env.production`)                             | Never                                |
| `.env.<stage>.gpg`      | Encrypted env file                                                      | Yes                                  |
| Registered secret files | Paths listed in `.envxrc` `files` (plaintext)                           | Never (their `.gpg` siblings: yes)   |

## Discover state first

Do not assume which environments or secret files exist. Ask envx:

```bash
envx status        # encryption status + recommendations
envx list          # every env file, encrypted or not
envx config show   # .envxrc: environments, ignore patterns, files registry
envx files list    # registered secret files
```

Commands work from any subdirectory — envx finds `.envrc`/`.envxrc` by
walking upward to the project root (monorepo-safe).

## Core workflows

**Fresh clone / missing plaintext files:**

```bash
envx decrypt --all          # decrypt every environment + registered files
```

**After editing a plaintext env or registered secret file, re-encrypt and
commit only the `.gpg`:**

```bash
envx encrypt -e <stage>     # one environment (+ its stage-bound files)
envx encrypt --all          # everything
```

**Run a command with secrets injected in memory (nothing written to disk):**

```bash
envx run -e production -- npm start
envx run -e staging --env DEBUG=true -- npm test
```

Prefer `envx run` over decrypting to disk when a process just needs the
variables.

**Manage arbitrary secret files (service-account JSON, certs, keystores):**

```bash
envx files add path/to/secret.json                 # global (FILES_SECRET)
envx files add google-services.json -e production  # stage-bound
envx files encrypt
envx files decrypt
```

**New environment:**

```bash
envx create -e staging     # then edit it, then: envx encrypt -e staging
```

## Safety rules

- NEVER commit or print plaintext secrets (`.env.<stage>`, registered
  files, `.envrc`). When asked about config, show variable NAMES only.
- NEVER edit `.gpg` files directly — edit the plaintext, then re-encrypt.
- NEVER delete or rewrite `.envrc`; it may hold the only copy of the
  passphrases.
- NEVER invent, hardcode, or relocate passphrases. They come from `.envrc`
  (`<STAGE>_SECRET` / `FILES_SECRET`) or from the user.
- If decryption fails on a passphrase, ask the user — do not guess.

## Command reference

| Command                                      | Purpose                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `envx init`                                  | First-run setup: discover envs, write `.envxrc`/`.gitignore`, secrets |
| `envx encrypt -e <stage>` / `--all`          | Encrypt env files (registered files ride along)                       |
| `envx decrypt -e <stage>` / `--all`          | Decrypt env files (registered files ride along)                       |
| `envx run -e <stage> -- <cmd>`               | Run command with decrypted vars in memory                             |
| `envx create -e <stage>`                     | Create a new `.env.<stage>` file                                      |
| `envx copy -e <stage>`                       | Copy a stage file to plain `.env`                                     |
| `envx files add/remove/list/encrypt/decrypt` | Manage registered secret files                                        |
| `envx config show/ignore/exclude/reset`      | Manage `.envxrc`                                                      |
| `envx list` / `envx status`                  | Inspect project state                                                 |
| `envx interactive`                           | Guided secret setup for `.envrc`                                      |
| `envx skill add/remove`                      | Install/remove this skill                                             |

Useful flags everywhere: `--dry-run` (preview), `--overwrite`,
`-c/--cwd <path>`.
