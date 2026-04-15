# OTCC npm Release Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local `bun run tag -- vX.Y.Z` flow that syncs `.claude-plugin` versions, validates `package.json`, creates the git tag, and add a GitHub Actions workflow that publishes to npm when `v*` tags are pushed.

**Architecture:** Keep release logic in one focused module under `src/core/release/tag.ts`, with `scripts/tag.ts` as a thin Bun entrypoint. Reuse the same logic locally and in CI via a `--check` mode so version validation stays centralized while the workflow remains read-only.

**Tech Stack:** TypeScript, Bun, bun:test, Git, GitHub Actions, npm trusted publishing

---

## File Structure

- Create: `src/core/release/tag.ts` — release tag parsing, version matching, JSON version rewriting, filesystem sync, git tag operations
- Create: `test/core/release/tag.test.ts` — unit tests for pure parsing and version rewrite behavior
- Create: `scripts/tag.ts` — local Bun script entrypoint for `bun run tag -- ...`
- Create: `test/scripts/tag.test.ts` — integration tests for script success/failure/check-only mode in temp git repos
- Modify: `package.json:24-32` — add `tag` script
- Modify: `tsconfig.json:14-15` — include `scripts/**/*` in typecheck coverage
- Create: `Makefile` — optional wrapper for `make tag VERSION=vX.Y.Z`
- Create: `.github/workflows/release-npm.yml` — publish workflow for `v*` tags

### Task 1: Add release helper unit tests and core logic

**Files:**

- Create: `test/core/release/tag.test.ts`
- Create: `src/core/release/tag.ts`
- Test: `test/core/release/tag.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/release/tag.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
  assertReleaseVersionMatchesPackage,
  parseReleaseTag,
  updateJsonVersion,
} from "../../../src/core/release/tag";

describe("core/release/tag", () => {
  describe("parseReleaseTag", () => {
    it("returns normalized version for a v-prefixed tag", () => {
      expect(parseReleaseTag("v1.2.3")).toBe("1.2.3");
    });

    it("throws when tag does not match vX.Y.Z", () => {
      expect(() => parseReleaseTag("1.2.3")).toThrow("tag 必须匹配 vX.Y.Z");
      expect(() => parseReleaseTag("v1.2")).toThrow("tag 必须匹配 vX.Y.Z");
    });
  });

  describe("assertReleaseVersionMatchesPackage", () => {
    it("does nothing when versions match", () => {
      expect(() =>
        assertReleaseVersionMatchesPackage("1.2.3", "1.2.3"),
      ).not.toThrow();
    });

    it("throws when package.json version differs from tag version", () => {
      expect(() =>
        assertReleaseVersionMatchesPackage("1.2.2", "1.2.3"),
      ).toThrow("package.json version 1.2.2 与 tag version 1.2.3 不一致");
    });
  });

  describe("updateJsonVersion", () => {
    it("rewrites the version field and keeps a trailing newline", () => {
      const source = `${JSON.stringify(
        {
          name: "otcc",
          version: "0.1.0",
        },
        null,
        2,
      )}\n`;

      expect(updateJsonVersion(source, "1.2.3")).toBe(
        `${JSON.stringify(
          {
            name: "otcc",
            version: "1.2.3",
          },
          null,
          2,
        )}\n`,
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/release/tag.test.ts`
Expected: FAIL with `Cannot find module '../../../src/core/release/tag'` or equivalent missing export error.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/release/tag.ts`:

```ts
const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

export function parseReleaseTag(tag: string): string {
  const match = RELEASE_TAG_PATTERN.exec(tag);

  if (!match) throw new Error("tag 必须匹配 vX.Y.Z");

  return match[1];
}

export function assertReleaseVersionMatchesPackage(
  packageVersion: string,
  tagVersion: string,
): void {
  if (packageVersion !== tagVersion) {
    throw new Error(
      `package.json version ${packageVersion} 与 tag version ${tagVersion} 不一致`,
    );
  }
}

export function updateJsonVersion(source: string, version: string): string {
  const data = JSON.parse(source) as Record<string, unknown>;
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/release/tag.test.ts`
Expected: PASS with 5 tests passed and no stderr output.

- [ ] **Step 5: Commit**

```bash
git add test/core/release/tag.test.ts src/core/release/tag.ts
git commit -m "test(release): cover tag version helpers"
```

### Task 2: Add the Bun tag script and integration coverage

**Files:**

- Modify: `src/core/release/tag.ts`
- Create: `scripts/tag.ts`
- Create: `test/scripts/tag.test.ts`
- Test: `test/scripts/tag.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/scripts/tag.test.ts`:

```ts
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const projectRoot = resolve(import.meta.dir, "../..");
const tempDirs: string[] = [];

function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), "otcc-tag-script-test-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  return dir;
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function run(cwd: string, cmd: string[]) {
  const proc = Bun.spawnSync({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

function initGitRepo(workspace: string) {
  expect(run(workspace, ["git", "init"]).exitCode).toBe(0);
  writeFileSync(join(workspace, "README.md"), "fixture\n", "utf8");
  expect(run(workspace, ["git", "add", "README.md"]).exitCode).toBe(0);
  expect(
    run(workspace, [
      "git",
      "-c",
      "user.name=OTCC Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-m",
      "init",
    ]).exitCode,
  ).toBe(0);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { force: true, recursive: true });
  }
});

describe("scripts/tag.ts", () => {
  it("syncs claude plugin versions and creates the git tag", () => {
    const workspace = createWorkspace();
    initGitRepo(workspace);

    writeJson(join(workspace, "package.json"), {
      name: "@jsonlee_12138/otcc",
      version: "1.2.3",
    });
    writeJson(join(workspace, ".claude-plugin/plugin.json"), {
      name: "otcc",
      version: "0.1.0",
    });
    writeJson(join(workspace, ".claude-plugin/marketplace.json"), {
      name: "otcc",
      version: "0.1.0",
    });

    const result = run(workspace, [
      "bun",
      "run",
      `${projectRoot}/scripts/tag.ts`,
      "v1.2.3",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "created v1.2.3 and synced .claude-plugin versions to 1.2.3",
    );
    expect(
      readFileSync(join(workspace, ".claude-plugin/plugin.json"), "utf8"),
    ).toContain('"version": "1.2.3"');
    expect(
      readFileSync(join(workspace, ".claude-plugin/marketplace.json"), "utf8"),
    ).toContain('"version": "1.2.3"');

    const tagList = run(workspace, ["git", "tag", "--list", "v1.2.3"]);
    expect(tagList.stdout.trim()).toBe("v1.2.3");
  });

  it("fails before writing files when package.json version does not match the tag", () => {
    const workspace = createWorkspace();
    initGitRepo(workspace);

    writeJson(join(workspace, "package.json"), {
      name: "@jsonlee_12138/otcc",
      version: "1.2.2",
    });
    writeJson(join(workspace, ".claude-plugin/plugin.json"), {
      name: "otcc",
      version: "0.1.0",
    });
    writeJson(join(workspace, ".claude-plugin/marketplace.json"), {
      name: "otcc",
      version: "0.1.0",
    });

    const result = run(workspace, [
      "bun",
      "run",
      `${projectRoot}/scripts/tag.ts`,
      "v1.2.3",
    ]);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "package.json version 1.2.2 与 tag version 1.2.3 不一致",
    );
    expect(
      readFileSync(join(workspace, ".claude-plugin/plugin.json"), "utf8"),
    ).toContain('"version": "0.1.0"');
    expect(
      readFileSync(join(workspace, ".claude-plugin/marketplace.json"), "utf8"),
    ).toContain('"version": "0.1.0"');

    const tagList = run(workspace, ["git", "tag", "--list", "v1.2.3"]);
    expect(tagList.stdout.trim()).toBe("");
  });

  it("verifies versions in check mode without creating the tag", () => {
    const workspace = createWorkspace();
    initGitRepo(workspace);

    writeJson(join(workspace, "package.json"), {
      name: "@jsonlee_12138/otcc",
      version: "1.2.3",
    });
    writeJson(join(workspace, ".claude-plugin/plugin.json"), {
      name: "otcc",
      version: "1.2.3",
    });
    writeJson(join(workspace, ".claude-plugin/marketplace.json"), {
      name: "otcc",
      version: "1.2.3",
    });

    const result = run(workspace, [
      "bun",
      "run",
      `${projectRoot}/scripts/tag.ts`,
      "--check",
      "v1.2.3",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("release version check passed: 1.2.3");

    const tagList = run(workspace, ["git", "tag", "--list", "v1.2.3"]);
    expect(tagList.stdout.trim()).toBe("");
    expect(existsSync(join(workspace, ".claude-plugin/plugin.json"))).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/scripts/tag.test.ts`
Expected: FAIL with `Cannot find module '/.../scripts/tag.ts'` or equivalent missing script error.

- [ ] **Step 3: Write minimal implementation**

Replace `src/core/release/tag.ts` with:

```ts
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

export const PLUGIN_VERSION_FILES = [
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
] as const;

export function parseReleaseTag(tag: string): string {
  const match = RELEASE_TAG_PATTERN.exec(tag);

  if (!match) throw new Error("tag 必须匹配 vX.Y.Z");

  return match[1];
}

export function assertReleaseVersionMatchesPackage(
  packageVersion: string,
  tagVersion: string,
): void {
  if (packageVersion !== tagVersion) {
    throw new Error(
      `package.json version ${packageVersion} 与 tag version ${tagVersion} 不一致`,
    );
  }
}

export function updateJsonVersion(source: string, version: string): string {
  const data = JSON.parse(source) as Record<string, unknown>;
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`;
}

export async function readPackageVersion(rootDir: string): Promise<string> {
  const source = await readFile(join(rootDir, "package.json"), "utf8");
  const data = JSON.parse(source) as { version?: unknown };

  if (typeof data.version !== "string" || data.version.length === 0)
    throw new Error("package.json 缺少有效的 version 字段");

  return data.version;
}

export async function assertPluginVersionsMatch(
  rootDir: string,
  version: string,
): Promise<void> {
  for (const relativePath of PLUGIN_VERSION_FILES) {
    const source = await readFile(join(rootDir, relativePath), "utf8");
    const data = JSON.parse(source) as { version?: unknown };

    if (data.version !== version) {
      throw new Error(
        `${relativePath} version ${String(data.version)} 与 tag version ${version} 不一致`,
      );
    }
  }
}

export async function syncPluginVersions(
  rootDir: string,
  version: string,
): Promise<void> {
  for (const relativePath of PLUGIN_VERSION_FILES) {
    const filePath = join(rootDir, relativePath);
    const source = await readFile(filePath, "utf8");
    await writeFile(filePath, updateJsonVersion(source, version), "utf8");
  }
}

export function ensureGitTagMissing(rootDir: string, tag: string): void {
  const output = execFileSync("git", ["tag", "--list", tag], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (output.trim() === tag) throw new Error(`git tag ${tag} 已存在`);
}

export function createGitTag(rootDir: string, tag: string): void {
  execFileSync("git", ["tag", tag], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

export async function verifyReleaseTag(
  rootDir: string,
  tag: string,
): Promise<string> {
  const version = parseReleaseTag(tag);
  const packageVersion = await readPackageVersion(rootDir);

  assertReleaseVersionMatchesPackage(packageVersion, version);
  await assertPluginVersionsMatch(rootDir, version);

  return version;
}

export async function syncReleaseTag(
  rootDir: string,
  tag: string,
): Promise<string> {
  const version = parseReleaseTag(tag);
  const packageVersion = await readPackageVersion(rootDir);

  assertReleaseVersionMatchesPackage(packageVersion, version);
  await syncPluginVersions(rootDir, version);
  ensureGitTagMissing(rootDir, tag);
  createGitTag(rootDir, tag);

  return version;
}
```

Create `scripts/tag.ts`:

```ts
import { syncReleaseTag, verifyReleaseTag } from "../src/core/release/tag";

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args[0] === "--check";
  const tag = checkOnly ? args[1] : args[0];

  if (!tag) throw new Error("用法: bun run tag -- [--check] vX.Y.Z");

  const rootDir = process.cwd();
  const version = checkOnly
    ? await verifyReleaseTag(rootDir, tag)
    : await syncReleaseTag(rootDir, tag);

  if (checkOnly) console.log(`release version check passed: ${version}`);
  else
    console.log(
      `created ${tag} and synced .claude-plugin versions to ${version}`,
    );
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/scripts/tag.test.ts`
Expected: PASS with 3 tests passed and no unexpected stderr output.

- [ ] **Step 5: Commit**

```bash
git add src/core/release/tag.ts scripts/tag.ts test/scripts/tag.test.ts
git commit -m "feat(release): add tag sync script"
```

### Task 3: Wire developer entrypoints for the tag flow

**Files:**

- Modify: `package.json:24-32`
- Modify: `tsconfig.json:14-15`
- Create: `Makefile`

- [ ] **Step 1: Update package.json scripts**

Replace the `scripts` block in `package.json:24-32` with:

```json
"scripts": {
  "build": "tsdown && cp -r templates dist/",
  "typecheck": "tsc --noEmit",
  "dev": "bun run src/index.ts",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "prepare": "husky",
  "test": "bun test",
  "tag": "bun run scripts/tag.ts"
}
```

- [ ] **Step 2: Include scripts in TypeScript checking**

Replace `tsconfig.json:14-15` with:

```json
"include": ["src/**/*", "scripts/**/*", "test/**/*"],
"exclude": ["node_modules", "bin", "dist"]
```

- [ ] **Step 3: Add the optional Makefile wrapper**

Create `Makefile`:

```makefile
.PHONY: tag

tag:
	@test -n "$(VERSION)" || (echo "VERSION is required, use: make tag VERSION=vX.Y.Z" && exit 1)
	bun run tag -- $(VERSION)
```

- [ ] **Step 4: Run typecheck to verify the new entrypoints**

Run: `bun run typecheck`
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Dry-run the Makefile wrapper**

Run: `make -n tag VERSION=v0.1.2`
Expected: output contains `bun run tag -- v0.1.2`.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json Makefile
git commit -m "chore(release): add local tag entrypoints"
```

### Task 4: Add the npm release workflow for version-checked tags

**Files:**

- Create: `.github/workflows/release-npm.yml`

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/release-npm.yml`:

```yaml
name: Release npm

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6.0.2

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2.2.0

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Verify release versions
        env:
          RELEASE_TAG: ${{ github.ref_name }}
        run: bun run tag -- --check "$RELEASE_TAG"

      - name: Type check
        run: bun run typecheck

      - name: Run tests
        run: bun test

      - name: Build package
        run: bun run build

      - name: Publish to npm
        run: npm publish --provenance --access public
```

- [ ] **Step 2: Verify the workflow file contains the required release gates**

Run:

```bash
python -c "from pathlib import Path; s = Path('.github/workflows/release-npm.yml').read_text(); required = ['actions/checkout@v6.0.2', 'oven-sh/setup-bun@v2.2.0', \"- 'v*'\", 'bun run tag -- --check \"$RELEASE_TAG\"', 'bun run typecheck', 'bun test', 'bun run build', 'npm publish --provenance --access public']; missing = [item for item in required if item not in s]; print('OK' if not missing else 'MISSING: ' + ', '.join(missing))"
```

Expected: `OK`

- [ ] **Step 3: Run the full local verification suite**

Run: `bun run typecheck && bun test`
Expected: PASS with the new unit and integration tests green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-npm.yml
git commit -m "ci: add npm release workflow for tags"
```

## Spec Coverage Check

- Local tag sync entrypoint: covered by Task 2 and Task 3
- `.claude-plugin` version rewrite: covered by Task 2
- `package.json` version equality gate: covered by Task 1 and Task 2
- Optional Makefile wrapper: covered by Task 3
- GitHub Actions publish on `v*`: covered by Task 4
- CI read-only validation before publish: covered by Task 4 via `--check`

## Placeholder Scan

- No `TBD` / `TODO` markers
- Every code-writing step includes concrete file contents
- Every verification step includes an exact command and expected result

## Type Consistency Check

- Shared function names are consistent across plan steps: `parseReleaseTag`, `assertReleaseVersionMatchesPackage`, `updateJsonVersion`, `verifyReleaseTag`, `syncReleaseTag`
- The CLI contract is consistent across local and CI usage: `bun run tag -- [--check] vX.Y.Z`
