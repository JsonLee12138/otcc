#!/usr/bin/env bun
/**
 * Version bump script - updates version in all version files.
 * Usage: bun run version.ts vX.Y.Z
 *
 * Only updates version in files, does NOT create git tags or commits.
 */
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const VERSION_FILES = [
  "package.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
];

const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

function updateJsonVersion(source: string, version: string): string {
  const data = JSON.parse(source) as Record<string, unknown>;
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`;
}

function main() {
  const tag = process.argv[2];

  if (!tag) {
    process.stderr.write("Usage: bun run version.ts vX.Y.Z\n");
    process.exit(1);
  }

  const match = RELEASE_TAG_PATTERN.exec(tag);
  if (!match) {
    process.stderr.write("Tag must match vX.Y.Z\n");
    process.exit(1);
  }

  const version = match[1];
  const cwd = resolve(process.cwd());

  for (const rel of VERSION_FILES) {
    const abs = `${cwd}/${rel}`;
    const raw = readFileSync(abs, "utf8");
    const updated = updateJsonVersion(raw, version);
    writeFileSync(abs, updated, "utf8");
    process.stdout.write(`Updated ${rel} to ${version}\n`);
  }
}

main();
