---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Scope: Project-wide
---

# Architecture Overview

EnvX is a thin CLI: `commander` parses argv and dispatches to a command's
`executeXxx()`, which composes four static utility classes. There is no server,
no persistent process, no network I/O — the only external process is `gpg`.

## 1. Component layers

```mermaid
flowchart TB
  subgraph Entry[Entry point · src/index.ts]
    Prog[Commander program<br/>+ inline: list/ls · status · init · version]
  end

  subgraph Cmds[Commands · src/commands/*]
    Enc[encrypt]
    Dec[decrypt]
    Cre[create]
    Cop[copy]
    Int[interactive]
    Run[run]
    Cfg[config]
  end

  subgraph Utils[Static utility classes · src/utils/*]
    Exec[ExecUtils<br/>gpg · spawn · fs sync]
    Cli[CliUtils<br/>chalk output · tables]
    File[FileUtils<br/>discovery · .envrc/.envxrc · gitignore]
    Inter[InteractiveUtils<br/>inquirer prompts]
  end

  subgraph Val[Validation]
    Zod[Zod schemas · src/schemas]
  end

  subgraph Ext[External]
    GPG[[system gpg]]
    FS[(filesystem)]
    Child[[spawned sub-process]]
  end

  Prog --> Cmds
  Cmds --> Zod
  Cmds --> Exec & Cli & File & Inter
  Exec --> GPG & FS & Child
  File --> FS
```

## 2. Command dispatch

```mermaid
flowchart LR
  argv[process.argv] --> Parse[commander parseAsync]
  Parse -->|no args| Help[program.help]
  Parse --> Pre[preAction hook<br/>--quiet suppresses non-error logs]
  Pre --> Action[command action]
  Action --> Exec[executeXxx rawOptions]
  Exec --> Validate[validateXxxOptions · Zod]
  Validate --> Work[do work]
  Work --> Exit[process.exit ExitCode]
```

## 3. Configuration resolution

Three independent resolution chains. Each command reads what it needs.

```mermaid
flowchart TB
  subgraph Passphrase
    PF[--passphrase flag] -->|else| PS[-s secret from .envrc]
    PS -->|else| PC[STAGE_SECRET from .envrc]
    PC -->|else| PP[interactive prompt]
  end
  subgraph WorkingDir
    WF[--cwd flag] -->|else| WP[process.cwd via shell.pwd]
  end
  subgraph IgnoreExclude
    IF[explicit arg] -->|else| IX[.envxrc nearest] -->|else| ID[FileUtils defaults]
  end
```

`.envrc` (passphrases) is read via `readEnvrcNearest` and `.envxrc` (ignore /
excludeDirs / environments) via `findEnvxrcUpward` — both walk upward from `cwd`
(see diagram 6).

## 4. Encrypt / decrypt sequence

```mermaid
sequenceDiagram
  participant U as User
  participant C as encrypt/decrypt cmd
  participant F as FileUtils
  participant E as ExecUtils
  participant G as gpg

  U->>C: envx encrypt -e production
  C->>E: isGpgAvailable()
  C->>F: findAllEnvironments(cwd)  (ignore-filtered)
  C->>C: resolve passphrase (flag → .envrc → prompt)
  C->>E: testGpgOperation(passphrase)  (round-trip a temp file)
  C->>F: findEnvFiles(env, cwd)
  loop each unencrypted .env.<stage>
    C->>E: encryptFile(path, passphrase)
    E->>G: gpg --passphrase-fd 0 -c <file>  (passphrase via stdin)
    G-->>E: <file>.gpg
  end
  C-->>U: summary + exit code
```

Decrypt is the mirror: it filters to `.gpg` files, backs up any existing
plaintext before writing, and restores the backup if `gpg` fails.

## 5. `envx run` — in-memory decrypt & spawn

`run` is the one command that decrypts **without touching disk**.

```mermaid
sequenceDiagram
  participant U as User
  participant R as run cmd
  participant F as FileUtils
  participant E as ExecUtils
  participant Sub as sub-process

  U->>R: envx run -e prod -- node server.js
  R->>R: collectRawSources (stage → files → inline)
  R->>F: resolveStageFile / fileExists
  R->>R: resolve passphrase only if a source is encrypted
  R->>F: loadEnvSource(...)  (decryptFileToString → parseEnvContent)
  Note over F: plaintext lives only in memory
  R->>R: mergeEnv (process.env wins unless --overload)
  alt --dry-run
    R-->>U: print sources + key names (never values)
  else
    R->>E: spawnChildWithEnv(argv, finalEnv, cwd)  (shell:false)
    E->>Sub: spawn with injected env; forward SIGINT/TERM/HUP
    Sub-->>R: exit code
    R-->>U: propagate exit code
  end
```

See [commands/features/feature-run.md](./commands/features/feature-run.md) and
[adr/0004-run-in-memory-decrypt.md](./adr/0004-run-in-memory-decrypt.md).

## 6. Upward config discovery (monorepo support)

`.envrc` and `.envxrc` are found by walking upward from `cwd`. Stage files
(`.env.<stage>[.gpg]`) are **not** — they resolve from `cwd` only.

```mermaid
flowchart TB
  Start[cwd] --> Check{contains .envrc / .envxrc / .git?}
  Check -->|yes| Root[= project root]
  Check -->|no| Parent[go to parent dir]
  Parent --> FSRoot{filesystem root?}
  FSRoot -->|yes| Null[return null → caller uses defaults / prompt]
  FSRoot -->|no| Check
  Root --> Has{root has the specific file?}
  Has -->|yes| Use[read it]
  Has -->|no| Null
```

`findProjectRoot` stops at the first ancestor holding any marker; `findEnvrcUpward`
/ `findEnvxrcUpward` then confirm the specific file exists there. Writes via
`mergeEnvxrc` target that nearest existing `.envxrc`, so `envx config …` from a
subdirectory edits the root config.

## 7. On-disk artifacts

```mermaid
flowchart LR
  subgraph Committed
    GPG[.env.&lt;stage&gt;.gpg]
    XRC[.envxrc · JSON project config]
    GI[.gitignore]
  end
  subgraph Local-only[Local-only · git-ignored]
    Plain[.env.&lt;stage&gt;]
    RC[.envrc · passphrases]
    DotEnv[.env · active copy]
  end
  GPG -. decrypt .-> Plain
  Plain -. copy .-> DotEnv
  RC -->|passphrase| GPG
  XRC -->|ignore/exclude| GPG
```

## Related

- [tech-stack.md](./tech-stack.md)
- [commands/commands.md](./commands/commands.md)
- [decisions.md](./decisions.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |
