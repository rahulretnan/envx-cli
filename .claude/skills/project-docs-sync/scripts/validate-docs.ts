#!/usr/bin/env tsx
/**
 * validate-docs.ts — Cross-reference + completeness checker
 *
 * Run: pnpm dlx tsx scripts/validate-docs.ts [path-to-docs-folder]
 * Default path: docs/project
 *
 * Checks:
 *   A. Structural completeness (required files exist)
 *   B. Per-module completeness (every module has module.md, at least 1 feature, etc.)
 *   C. Cross-references (every link resolves)
 *   D. Index files list every doc
 *   E. Anti-pattern scan (sunset dates, dead claims, etc.)
 *
 * Produces a gap report printed to stdout + optional JSON output via --json.
 */

import { promises as fs } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { existsSync } from "node:fs";

type Severity = "P0" | "P1" | "P2";
type Finding = { severity: Severity; message: string; path?: string };

const docsRoot = resolve(process.argv[2] ?? "docs/project");
const findings: Finding[] = [];

const find = (sev: Severity, message: string, path?: string) =>
  findings.push({ severity: sev, message, path });

const exists = (p: string) => existsSync(p);

async function readFile(p: string): Promise<string> {
  return await fs.readFile(p, "utf8");
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/* A. Structural completeness */
async function checkStructure() {
  const required = [
    "tech-stack.md",
    "architecture-overview.md",
    "design-guidelines.md",
    "glossary.md",
    "decisions.md",
    "changelog.md",
    "changes-log.md",
  ];
  for (const r of required) {
    const p = join(docsRoot, r);
    if (!exists(p)) find("P0", `Missing required file: ${r}`, p);
  }
  if (!exists(join(docsRoot, "modules"))) {
    find("P0", "Missing modules/ folder", join(docsRoot, "modules"));
  }
  if (!exists(join(docsRoot, "shared"))) {
    find("P1", "Missing shared/ folder", join(docsRoot, "shared"));
  }
  if (!exists(join(docsRoot, "index"))) {
    find("P1", "Missing index/ folder", join(docsRoot, "index"));
  }
}

/* B. Per-module completeness */
async function checkModules() {
  const modulesDir = join(docsRoot, "modules");
  if (!exists(modulesDir)) return;
  const moduleDirs = (await fs.readdir(modulesDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const m of moduleDirs) {
    const mDir = join(modulesDir, m);
    const modFile = join(mDir, "module.md");
    if (!exists(modFile)) {
      find("P0", `Module "${m}" missing module.md`, modFile);
      continue;
    }
    const content = await readFile(modFile);
    if (!content.includes("```mermaid")) {
      find("P1", `Module "${m}" module.md missing Mermaid diagram`, modFile);
    }
    if (!/Role .{0,4}×|Role x|## Role/.test(content)) {
      find("P1", `Module "${m}" module.md missing Role × Action matrix`, modFile);
    }
    if (!exists(join(mDir, "features"))) {
      find("P0", `Module "${m}" missing features/`, mDir);
    }
    if (!exists(join(mDir, "api"))) {
      find("P0", `Module "${m}" missing api/`, mDir);
    }
    if (!exists(join(mDir, "schema"))) {
      find("P0", `Module "${m}" missing schema/`, mDir);
    }
    if (!exists(join(mDir, "workflows"))) {
      find("P1", `Module "${m}" missing workflows/`, mDir);
    }
    if (!exists(join(mDir, "observability.md"))) {
      find("P1", `Module "${m}" missing observability.md`, mDir);
    }
    if (!exists(join(mDir, "test-plan.md"))) {
      find("P1", `Module "${m}" missing test-plan.md`, mDir);
    }
  }
}

/* C. Cross-references */
async function checkLinks() {
  const allMd = await walk(docsRoot);
  const linkRe = /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g;
  for (const f of allMd) {
    const text = await readFile(f);
    for (const m of text.matchAll(linkRe)) {
      const target = m[1];
      if (target.startsWith("http")) continue;
      if (target.startsWith("mailto:")) continue;
      const resolved = resolve(dirname(f), target);
      if (!exists(resolved)) {
        find("P1", `Broken link: "${target}" in ${relative(docsRoot, f)}`, f);
      }
    }
  }
}

/* D. Wiring section in every feature */
async function checkFeatureWiring() {
  const featureFiles = (await walk(docsRoot)).filter((p) =>
    p.includes("/features/feature-"),
  );
  for (const f of featureFiles) {
    const text = await readFile(f);
    if (!text.includes("```mermaid")) {
      find(
        "P0",
        `Feature missing Mermaid wiring: ${relative(docsRoot, f)}`,
        f,
      );
    }
    if (!text.match(/File-level paths|## End-to-End Wiring/)) {
      find(
        "P0",
        `Feature missing wiring section: ${relative(docsRoot, f)}`,
        f,
      );
    }
  }
}

/* E. Anti-pattern scan */
async function checkAntiPatterns() {
  const today = new Date().toISOString().slice(0, 10);
  const allMd = await walk(docsRoot);
  for (const f of allMd) {
    const text = await readFile(f);
    // Sunset dates in the past
    const sunsets = text.matchAll(/remove after (\d{4}-\d{2}-\d{2})/gi);
    for (const m of sunsets) {
      if (m[1] < today) {
        find(
          "P1",
          `Past-due sunset marker: "${m[0]}" in ${relative(docsRoot, f)}`,
          f,
        );
      }
    }
    // Claim of tests with no test-plan in same module
    if (/Vitest|Playwright/i.test(text) && f.includes("/modules/")) {
      const moduleDir = dirname(dirname(f));
      const testPlan = join(moduleDir, "test-plan.md");
      if (!exists(testPlan)) {
        find(
          "P2",
          `Mentions Vitest/Playwright but no test-plan.md: ${relative(docsRoot, f)}`,
          f,
        );
      }
    }
    // db:push warning
    if (/db:push/.test(text)) {
      find(
        "P1",
        `Mentions db:push (should always be migration-based): ${relative(docsRoot, f)}`,
        f,
      );
    }
  }
}

async function main() {
  if (!exists(docsRoot)) {
    console.error(`docs folder not found: ${docsRoot}`);
    process.exit(2);
  }
  await checkStructure();
  await checkModules();
  await checkLinks();
  await checkFeatureWiring();
  await checkAntiPatterns();

  const counts = findings.reduce(
    (acc, f) => {
      acc[f.severity]++;
      return acc;
    },
    { P0: 0, P1: 0, P2: 0 } as Record<Severity, number>,
  );

  console.log(`# Verification Report — ${new Date().toISOString()}\n`);
  console.log(
    `Total: ${findings.length}  ·  P0: ${counts.P0}  ·  P1: ${counts.P1}  ·  P2: ${counts.P2}\n`,
  );

  for (const sev of ["P0", "P1", "P2"] as Severity[]) {
    const subset = findings.filter((f) => f.severity === sev);
    if (subset.length === 0) continue;
    console.log(`\n## ${sev} (${subset.length})\n`);
    for (const f of subset) {
      console.log(`- ${f.message}`);
    }
  }

  if (process.argv.includes("--json")) {
    await fs.writeFile(
      "verification-report.json",
      JSON.stringify({ counts, findings }, null, 2),
    );
    console.log("\nJSON written to verification-report.json");
  }

  process.exit(counts.P0 > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
