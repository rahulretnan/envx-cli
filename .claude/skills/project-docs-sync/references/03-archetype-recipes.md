# 03 — Archetype Recipes (copy-pasteable bootstrap)

Once an archetype is chosen, the skill should follow the matching recipe
verbatim. Each recipe lists the bootstrap command, the monorepo skeleton,
the catalog versions, the canonical mounts, and the env-management story.

---

## Recipe A — Better-T-Stack SaaS

### Bootstrap
```bash
pnpm create better-t-stack@latest <project-name>
# Run with --help to see latest flags. As of May 2026 the recommended config:
#   --frontend next                       (or "next,expo" or "next,tanstack-router,expo")
#   --backend self                        (in-monorepo)
#   --api orpc                            (or "none" for SPA-only)
#   --auth better-auth                    (or "none")
#   --db-setup neon                       (or "postgres-js" for Bun)
#   --runtime node                        (or "bun" for Hono/Bun stack)
#   --addons turborepo,husky,prettier,biome,changesets
#   --package-manager pnpm
#   --git
#   --install
```

### Monorepo skeleton
```
apps/
  app/            Next 16 — main product, port 3001
  admin/          Next 16 — separate cookie scope, port 3002
  web/            Next 16 — marketing site
  mobile/         Expo SDK 55 (optional)
  docs/           Fumadocs (optional, for SDK products)
  demo/           Sample SDK consumer (optional)
packages/
  api/            oRPC routers
  auth/           Better Auth + plugins
  db/             Drizzle schema + Neon client
  email/          React Email templates + ZeptoMail sender
  env/            t3-env: /server, /web, /cron, /worker
  cron/           SST Lambda handlers
  workers/        SST Lambda handlers for QStash consumers
  editor/         Plate.js wrapper (if rich-text core)
  sdk/            Published @org/sdk (if SDK product)
  react/          Published @org/react (if SDK product)
  config/         shared tsconfig + eslint
```

### `pnpm-workspace.yaml` catalog
```yaml
packages: [apps/*, packages/*]
nodeLinker: hoisted
catalog:
  next: "16.1.1"
  react: "19.2.4"
  react-dom: "19.2.4"
  better-auth: "1.4.18"
  "@orpc/server": "1.13.4"
  "@orpc/client": "1.13.4"
  "@orpc/openapi": "1.13.4"
  drizzle-orm: "0.45.1"
  drizzle-kit: "0.31.8"
  zod: "4.3.6"
  hono: "4.8.0"
  typescript: "5.7.0"
```

### oRPC + OpenAPI mount
```ts
// apps/app/src/app/api/rpc/[[...rest]]/route.ts
import { RPCHandler } from "@orpc/server/fetch";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@my-app/api";

const rpcHandler = new RPCHandler(appRouter, { context: createContext });
const openapiHandler = new OpenAPIHandler(appRouter, {
  context: createContext,
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

const handler = async (req: Request) => {
  const rpcResult = await rpcHandler.handle(req);
  if (rpcResult.matched) return rpcResult.response;
  const openapiResult = await openapiHandler.handle(req);
  if (openapiResult.matched) return openapiResult.response;
  return new Response("Not found", { status: 404 });
};

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
```

### SST config skeleton
```ts
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: "my-app",
      home: "aws",
      providers: { aws: { profile: "Datahase", region: "ap-south-1" } },
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket("Media", { access: "cloudfront" });
    new sst.aws.Function("UrlImport", {
      handler: "packages/workers/src/handlers/url-import.handler",
      url: true,
      link: [bucket],
    });
    new sst.aws.Cron("DailyJobs", {
      schedule: "cron(30 18 * * ? *)",  // 00:00 IST
      function: "packages/cron/src/handler.main",
    });
  },
});
```

### Env management
```makefile
env-dev:    envx decrypt --env development
env-prod:   envx decrypt --env production
env-encrypt-dev:  envx encrypt --env development
env-encrypt-prod: envx encrypt --env production
```
Commit `.env.development.gpg` and `.env.production.gpg`. Never commit decrypted versions.

### Better Auth two-instance pattern (admin separation)
```ts
// packages/auth/src/index.ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [organization(), apiKey(), dodopayments({...})],
  advanced: { cookiePrefix: "myapp" },
});

export const adminAuth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [admin()],
  advanced: { cookiePrefix: "myapp-admin" },
});
```
Server route handler chooses instance via `X-Auth-Source: admin|app` header.

---

## Recipe B — Hasura + Amplify Hybrid

### Bootstrap (stepwise — no single CLI)
See `14-scaffolding.md` for the full script. High-level steps:

1. `mkdir <project> && cd <project> && pnpm init && pnpm-workspace.yaml`
2. `cd apps && pnpm create vite@latest platform -- --template react-ts`
3. `cd packages/backend && pnpm dlx ampx init`
4. `mkdir docker/local services/hasura services/postgres`
5. Write `docker/local/docker-compose.yml` (Postgres + Hasura + Caddy)
6. Wire `codegen.ts` with dual targets
7. `cd packages/backend && pnpm ampx sandbox --identifier <project>`

### Monorepo skeleton
```
apps/
  platform/       Vite SPA — the authenticated product
  website/        Next 15 — marketing/blog/pricing
  admin/          Vite SPA — internal admin (optional)
  mobile/         Expo (optional)
packages/
  backend/        Amplify Gen 2 backend + 30-80 Lambdas
  agent-tools/    Mastra tools (if voice agent — tiaime pattern)
  agent-memory/   Mastra Memory wrapper (if voice)
  api-client/     Shared Apollo factory
  hasura-sdk/     graphql-request SDK for Lambdas
  ui/             shadcn + Radix + generated GraphQL hooks
  email/          React Email
  validators/     Zod schemas
  env/            t3-env
  shared/         cross-cutting utils
libs/
  backend/        Lambda-side helpers (hasura-service, milvus, etc.)
services/
  hasura/         Migrations + metadata YAML
  postgres/       Dockerfile (PostGIS if needed)
docker/
  local/          docker-compose.yml (Postgres + Hasura)
  production/     docker-compose.yml (+ Caddy TLS termination)
```

### Codegen dual-target
```ts
// codegen.ts
const config: CodegenConfig = {
  schema: [{ "https://hasura.example.com/v1/graphql": {
    headers: { "x-hasura-admin-secret": process.env.HASURA_GRAPHQL_ADMIN_SECRET! },
  }}],
  documents: [
    "apps/platform/src/**/*.graphql",
    "packages/backend/amplify/functions/**/*.graphql",
  ],
  generates: {
    "packages/ui/src/graphql/base-types.ts": { plugins: ["typescript"] },
    "packages/ui/src/": {
      preset: "near-operation-file-preset",
      presetConfig: { extension: ".generated.ts", baseTypesPath: "graphql/base-types.ts" },
      plugins: ["typescript-operations", "typescript-react-apollo"],
    },
    "packages/hasura-sdk/src/": {
      preset: "near-operation-file-preset",
      presetConfig: { extension: ".sdk.ts", baseTypesPath: "graphql/base-types.ts" },
      plugins: ["typescript-operations", "typescript-graphql-request"],
      config: { documentMode: "string" },
    },
  },
  config: {
    scalars: { uuid: "string", numeric: "number", jsonb: "Record<string, unknown>" },
  },
};
```

### Amplify backend.ts skeleton
```ts
// packages/backend/amplify/backend.ts
const backend = defineBackend({
  auth,
  data,
  storage,
  createAdmin,
  inviteUser,
  addOrder,
  ...
});

// Add custom CDK stacks
const sqsStack = backend.createStack("SqsQueueStack");
const queue = new sqs.Queue(sqsStack, "MainQueue", {
  visibilityTimeout: Duration.minutes(5),
  deadLetterQueue: { maxReceiveCount: 10, queue: dlq },
});

// Storage triggers
storage.resources.bucket.addObjectCreatedNotification(
  new s3n.LambdaDestination(onUploadFn),
);
```

### Hasura Actions pattern
Lambdas exposed as Hasura Actions via API Gateway HTTP API. See
`05-module-decomposition.md` for the per-module wiring.

---

## Recipe C — Lightweight (Vite SPA / shadcn-init)

### Bootstrap
```bash
pnpm create vite@latest <project> -- --template react-ts
cd <project>
pnpm install
pnpm dlx shadcn@latest init                # shadcn baseline
pnpm add @tanstack/react-router @tanstack/react-query \
  tailwindcss @tailwindcss/vite zustand class-variance-authority \
  lucide-react sonner
```

### Skeleton
```
src/
  main.tsx
  routes/                                  # if using TanStack Router file-based
  components/ui/                           # shadcn components
  components/                              # custom components
  lib/
  stores/                                  # zustand stores
  hooks/
public/
index.html
vite.config.ts
tailwind.config.ts (or @tailwindcss/vite plugin)
tsconfig.json
```

### When to add backend
Start with no backend. If user later needs one:
- Lightweight CRUD → add a Hono+Bun service in same repo
- Heavier → graduate to Archetype A (BTS)

---

## Common to all archetypes

### Husky + commitlint + cz-customizable + release-it
```bash
pnpm dlx husky init
pnpm add -D @commitlint/cli @commitlint/config-conventional cz-customizable release-it
```

### Sentry wiring
```bash
pnpm add @sentry/nextjs        # or @sentry/expo, @sentry/node
pnpm dlx @sentry/wizard@latest -i nextjs
```

### Direnv + envx
```bash
brew install direnv envx       # or curl install per platform
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
cat > .envrc << 'EOF'
dotenv .env.development
EOF
direnv allow
```
