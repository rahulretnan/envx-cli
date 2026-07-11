# 14 — Scaffolding (project initialization)

After docs are generated and the user is ready to build, the skill offers to
**scaffold the actual project**. The CLI command depends on the chosen
archetype + modifiers. Always ASK before running anything that touches the
filesystem outside `docs/`.

## When to offer scaffolding

After Phase 11 (refinement) completes, ask:

> Docs are locked. Want me to scaffold the project now? I'll run:
> `<the right CLI for your archetype>`
> Or skip — you can run it yourself later.

## Archetype → CLI mapping

### Archetype A — Better-T-Stack

**Latest CLI:** `pnpm create better-t-stack@latest`
(Check `https://better-t-stack.dev` for current flag set — the recommended
shape as of May 2026 is below.)

**Command pattern:**
```bash
pnpm create better-t-stack@latest <project-name> \
  --frontend <next|tanstack-router|expo|combine>     # multi: comma-separated
  --backend self                                     # always; self means in-monorepo
  --api orpc                                         # or none if no API needed
  --auth better-auth                                 # or none for Archetype C-ish
  --db-setup <neon|postgres-js|none>                 # Neon default
  --runtime <node|bun>                               # Bun for askshelf-style
  --addons turborepo,husky,prettier,biome,changesets # tune to user
  --package-manager pnpm
  --git
  --install
```

**ASK the user these one at a time before running:**

1. Project name (kebab-case)
2. Frontend mix: Next.js dashboard only / + marketing / + admin / + Expo mobile
3. DB driver: Neon serverless (Recommended) / postgres-js (Bun runtime)
4. Runtime: Node (Recommended for most) / Bun (askshelf-style — Hono server)
5. Add-ons: confirm `turborepo, husky, prettier, biome, changesets`
6. Initialize git + install dependencies? (Recommended yes)

**After scaffolding:**
- Copy generated `bts.jsonc` to `docs/project/adr/0001-archetype.md` as evidence
- Run `pnpm install` if not auto-installed
- Set up `envx-cli` if India market: `make env-init`
- Move on to "post-scaffold tasks" below

### Archetype B — Hasura + Amplify Hybrid

No single CLI. Use a stepwise scaffold script (provided in
`scripts/scaffold-hasura-amplify.sh` template). Pattern:

```bash
# 1. Create monorepo skeleton
mkdir -p <project>/{apps,packages,libs,services,docker,docs}
cd <project>
pnpm init
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - apps/*
  - packages/*
  - libs/*
nodeLinker: hoisted
EOF

# 2. Vite admin app
cd apps && pnpm create vite@latest platform -- --template react-ts
cd platform && pnpm add @tanstack/react-router @tanstack/react-query \
  @apollo/client graphql graphql-ws zustand

# 3. Amplify Gen 2 backend
mkdir -p packages/backend && cd packages/backend
pnpm add aws-amplify @aws-amplify/backend @aws-amplify/backend-cli aws-cdk-lib
pnpm dlx ampx init

# 4. Hasura + Postgres via Docker
mkdir -p docker/local services/hasura services/postgres
# (write docker-compose.yml, hasura config.yaml, Caddyfile if production)

# 5. Codegen
pnpm add -D @graphql-codegen/cli @graphql-codegen/typescript \
  @graphql-codegen/typescript-react-apollo \
  @graphql-codegen/typescript-graphql-request \
  @graphql-codegen/near-operation-file-preset
# (write codegen.ts with dual targets)

# 6. shadcn
pnpm dlx shadcn@latest init    # in apps/platform

# 7. Sandbox
cd packages/backend
pnpm ampx sandbox --identifier <project>
```

**ASK the user one at a time:**

1. Project name
2. Hasura hosting: self-hosted (Docker + Caddy) — Recommended for control, OR Hasura Cloud
3. Postgres: Neon / RDS / self-hosted with PostGIS
4. Vector DB: none / S3 Vectors via Mastra / Milvus (Zilliz)
5. Mobile companion? Expo yes/no

### Archetype C — Lightweight (Vite SPA / shadcn-only)

For internal tools, simple admin panels, content sites without auth, etc.

**Command:**
```bash
pnpm create vite@latest <project> -- --template react-ts
cd <project>
pnpm install
pnpm dlx shadcn@latest init       # the user explicitly asked for this path
pnpm add @tanstack/react-router @tanstack/react-query tailwindcss \
  @tailwindcss/vite zustand
```

**ASK one at a time:**

1. Project name
2. Routing: TanStack Router (Recommended) / React Router / none (single-page)
3. State: Zustand (Recommended for >2 stores) / React state only
4. Backend: existing API (provide URL) / new Hono service / no backend (static)

### Custom (no CLI)

If user wants a hand-rolled stack, generate a `setup.md` in `docs/project/`
with explicit `pnpm add` commands per package, then ask the user to run them
manually.

## Post-scaffold tasks (run for any archetype)

After scaffolding, walk through these one at a time:

1. **Set up env files** — copy `.env.example` to `.env.development`, ask if
   the user wants envx-cli wired (`envx init` then `envx encrypt --env development`)
2. **Install supporting skills** — see `13-supporting-skills-catalog.md`. Ask
   which ones to install, then `mkdir -p .claude/skills/` and copy
3. **Wire docs** — copy `docs/project/_templates/` into project, link CLAUDE.md
   from root
4. **First commit** — `git add . && git commit -m "chore: initial scaffold"`
5. **Wire CI** — offer to generate `.github/workflows/ci.yml` based on archetype
6. **Wire deploy targets** — Vercel project link (Next apps), SST config
   (Lambdas), Amplify project (if Archetype B), EAS project (if mobile)

## What to skip / never auto-run

- Never `pnpm db:push` — always migration-based
- Never push to `main` without explicit user permission
- Never create AWS resources without confirming the AWS profile (`Datahase` is
  the convention for the DataHase set of projects)
- Never run `eas build` — that's a separate manual decision

## Output to user after scaffold complete

```
✓ Scaffold complete: <project-name>
✓ Stack: <archetype + modifiers>
✓ Docs: docs/project/
✓ Supporting skills installed: <list>
✓ Next: cd <project> && pnpm dev
```

Then offer to walk the first module's implementation, citing the relevant
`docs/project/modules/<module>/module.md`.
