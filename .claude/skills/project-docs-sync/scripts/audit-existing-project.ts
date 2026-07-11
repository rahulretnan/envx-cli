#!/usr/bin/env tsx
/**
 * audit-existing-project.ts — infer archetype from an existing repo
 *
 * Run: pnpm dlx tsx scripts/audit-existing-project.ts [project-root]
 *
 * Scans for archetype signals (package.json deps, presence of bts.jsonc,
 * amplify/, services/hasura/, sst.config.ts, etc.) and produces a report
 * with the inferred archetype + modifiers + flags any drift from CLAUDE.md.
 */

import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(process.argv[2] ?? ".");

type Report = {
  archetype: "A" | "B" | "C" | "unknown";
  confidence: "high" | "medium" | "low";
  signals: string[];
  modifiers: string[];
  driftWarnings: string[];
};

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function readText(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function audit(): Promise<Report> {
  const signals: string[] = [];
  const modifiers: string[] = [];
  const driftWarnings: string[] = [];

  const has = (p: string) => existsSync(join(root, p));

  // Archetype A signals
  const btsExists = has("bts.jsonc");
  if (btsExists) signals.push("bts.jsonc present");

  const sstExists = has("sst.config.ts") || has("sst.config.mjs");
  if (sstExists) signals.push("sst.config present");

  // Archetype B signals
  const amplifyExists = has("amplify_outputs.json") || has("packages/backend/amplify");
  if (amplifyExists) signals.push("Amplify Gen 2 backend present");

  const hasuraExists =
    has("services/hasura") || has("docker/local/docker-compose.yml");
  if (hasuraExists) signals.push("Hasura present");

  // Inspect root package.json for deps
  const rootPkg = await readJson(join(root, "package.json"));
  const deps = {
    ...(rootPkg?.dependencies as Record<string, string> | undefined),
    ...(rootPkg?.devDependencies as Record<string, string> | undefined),
  };
  if (deps?.["@orpc/server"] || deps?.["@orpc/client"]) signals.push("oRPC present");
  if (deps?.["better-auth"]) signals.push("Better Auth present");
  if (deps?.["drizzle-orm"]) signals.push("Drizzle present");
  if (deps?.["aws-amplify"]) signals.push("aws-amplify present");
  if (deps?.["@aws-amplify/backend"]) signals.push("@aws-amplify/backend present");
  if (deps?.["@apollo/client"]) signals.push("Apollo Client present");
  if (deps?.["@neondatabase/serverless"]) modifiers.push("Neon serverless");
  if (deps?.["@livekit/components-react"] || deps?.["@livekit/agents"])
    modifiers.push("LiveKit");
  if (deps?.["@mastra/core"]) modifiers.push("Mastra");
  if (deps?.["@elevenlabs/react"] || deps?.["@elevenlabs/react-native"])
    modifiers.push("ElevenLabs");
  if (deps?.["@dodopayments/better-auth"]) modifiers.push("Dodopayments");
  if (deps?.["@upstash/redis"]) modifiers.push("Upstash Redis");
  if (deps?.["@upstash/qstash"]) modifiers.push("Upstash QStash");
  if (deps?.["@upstash/workflow"]) modifiers.push("Upstash Workflow");
  if (deps?.["expo"]) modifiers.push("Expo mobile");

  // Determine archetype
  let archetype: Report["archetype"] = "unknown";
  let confidence: Report["confidence"] = "low";

  if (btsExists || (deps?.["@orpc/server"] && deps?.["better-auth"] && deps?.["drizzle-orm"])) {
    archetype = "A";
    confidence = btsExists ? "high" : "medium";
  } else if (amplifyExists && hasuraExists) {
    archetype = "B";
    confidence = "high";
  } else if (deps?.["vite"] && deps?.["react"] && !deps?.["next"]) {
    archetype = "C";
    confidence = "medium";
  }

  // CLAUDE.md drift checks
  const claudeMd = await readText(join(root, "CLAUDE.md"));
  if (claudeMd) {
    if (
      claudeMd.includes("Vitest") &&
      !existsSync(join(root, "vitest.config.ts")) &&
      !Object.keys(deps ?? {}).includes("vitest")
    ) {
      driftWarnings.push("CLAUDE.md mentions Vitest but no config / dependency found");
    }
    if (
      claudeMd.includes("Playwright") &&
      !existsSync(join(root, "playwright.config.ts")) &&
      !Object.keys(deps ?? {}).includes("@playwright/test")
    ) {
      driftWarnings.push(
        "CLAUDE.md mentions Playwright but no config / dependency found",
      );
    }
    if (claudeMd.includes("file-based routing") && !has("apps/app/src/app")) {
      driftWarnings.push(
        "CLAUDE.md mentions file-based routing but no src/app folder found",
      );
    }
  }

  return { archetype, confidence, signals, modifiers, driftWarnings };
}

async function main() {
  const r = await audit();
  console.log("# Existing Project Audit\n");
  console.log(`**Root:** ${root}`);
  console.log(`**Inferred archetype:** ${r.archetype} (confidence: ${r.confidence})`);
  console.log("\n**Signals:**");
  for (const s of r.signals) console.log(`- ${s}`);
  console.log("\n**Modifiers:**");
  for (const s of r.modifiers) console.log(`- ${s}`);
  if (r.driftWarnings.length > 0) {
    console.log("\n**CLAUDE.md drift warnings:**");
    for (const w of r.driftWarnings) console.log(`- ⚠️ ${w}`);
  }
  if (process.argv.includes("--json")) {
    await fs.writeFile("audit-report.json", JSON.stringify(r, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
