# <Project Name>

<One-line description.>

## Quick start

```bash
pnpm install
cp .env.example .env.development
direnv allow
pnpm dev
```

App runs at: http://localhost:3001

## What's here

- `apps/app` — main product (Next.js)
- `apps/admin` — internal admin (Next.js, separate auth)
- `apps/web` — marketing site (Next.js)
- `apps/mobile` — Expo (if applicable)
- `packages/api` — oRPC routers / Hasura SDK
- `packages/auth` — auth config
- `packages/db` — schema
- `docs/project/` — full project docs ← start here

## Tech stack
See [docs/project/tech-stack.md](./docs/project/tech-stack.md).

## Documentation
- [CLAUDE.md](./CLAUDE.md) — entry point for AI agents
- [docs/project/architecture-overview.md](./docs/project/architecture-overview.md) — system + data flow diagrams
- [docs/project/modules/](./docs/project/modules/) — per-module specs
- [docs/project/changes-log.md](./docs/project/changes-log.md) — change history

## Development

```bash
pnpm dev              # all apps
pnpm dev --filter app # specific app
pnpm test
pnpm lint
pnpm typecheck
pnpm db:generate      # generate migrations
pnpm db:migrate       # apply migrations
```

## Deployment

```bash
make deploy-app       # Vercel
make deploy-sst       # AWS via SST
make deploy-agent     # voice worker (if applicable)
```

## License
<License>
