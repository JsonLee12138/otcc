# Tag Auto Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `bun run tag -- vX.Y.Z` so it updates `package.json` plus both `.claude-plugin` version files before creating the git tag, while keeping `--check` as a read-only CI validation mode.

**Architecture:** Keep `scripts/tag.ts` as the thin entrypoint and evolve `src/core/release/tag.ts` into the single source of truth for parsing tags, validating versions, syncing all version files, and creating git tags. Update the integration tests in `test/scripts/tag.test.ts` to define the new default behavior, then adapt the workflow only where needed to stay aligned with `--check`.

**Tech Stack:** TypeScript, Bun, bun:test, Git, GitHub Actions

---

## File Structure

- Modify: `src/core/release/tag.ts` — expand version sync scope from `.claude-plugin/*` to all release version files and keep `--check` read-only
- Modify: `test/scripts/tag.test.ts` — replace the old package-version-mismatch failure assumption with the new auto-sync behavior and add illegal-tag coverage
- Modify: `.github/workflows/release-npm.yml` — optionally remove `workflow_dispatch` if we decide the simpler trigger-only workflow is preferred; otherwise keep existing guarded workflow unchanged

### Task 1: Redefine tag command default behavior with failing integration tests

**Files:**

- Modify: `test/scripts/tag.test.ts`
- Test: `test/scripts/tag.test.ts`

- [ ] **Step 1: Write the failing test for auto-syncing package.json**

Replace the first two tests in `test/scripts/tag.test.ts:69-126` with the following two tests so the suite reflects the new behavior:

```ts
it("updates package.json and .claude-plugin versions before creating the git tag", () => {
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

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain(
    "created v1.2.3 and synced .claude-plugin versions to 1.2.3",
  );
  expect(readFileSync(join(workspace, "package.json"), "utf8")).toContain(
    '"version": "1.2.3"',
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

it("fails on an invalid tag before modifying any version files", () => {
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
    "1.2.3",
  ]);

  expect(result.exitCode).toBe(1);
  expect(`${result.stdout}\n${result.stderr}`).toContain("tag 必须匹配 vX.Y.Z");
  expect(readFileSync(join(workspace, "package.json"), "utf8")).toContain(
    '"version": "1.2.2"',
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/scripts/tag.test.ts`
Expected: FAIL because the current implementation still throws `package.json version 1.2.2 与 tag version 1.2.3 不一致` instead of updating `package.json`.

- [ ] **Step 3: Commit the failing-test checkpoint only if your workflow requires it**

Do not commit yet unless your local workflow explicitly requires red commits. Continue directly to Task 2.

### Task 2: Update release core logic to sync all version files

**Files:**

- Modify: `src/core/release/tag.ts`
- Test: `test/scripts/tag.test.ts`

- [ ] **Step 1: Replace the release helper implementation**

Replace the contents of `src/core/release/tag.ts` with:

```ts
import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

export const VERSION_FILES = [
  "package.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
] as const;

export const PLUGIN_VERSION_FILES = [
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
] as const;

export function parseReleaseTag(tag: string): string {
  const match = RELEASE_TAG_PATTERN.exec(tag);

  if (!match) throw new Error("tag 必须匹配 vX.Y.Z");

  return match[1];
}

export function updateJsonVersion(source: string, version: string): string {
  const data = JSON.parse(source) as Record<string, unknown>;
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`;
}

export async function readPackageVersion(cwd: string): Promise<string> {
  const raw = await readFile(join(cwd, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: string };

  if (!pkg.version) throw new Error("package.json 缺少 version 字段");

  return pkg.version;
}

export async function assertVersionFilesMatch(
  cwd: string,
  tagVersion: string,
): Promise<void> {
  for (const rel of VERSION_FILES) {
    const raw = await readFile(join(cwd, rel), "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (String(data.version) !== tagVersion) {
      throw new Error(
        `${rel} version ${String(data.version)} 与 tag version ${tagVersion} 不一致`,
      );
    }
  }
}

export async function syncVersionFiles(
  cwd: string,
  version: string,
): Promise<void> {
  for (const rel of VERSION_FILES) {
    const abs = join(cwd, rel);
    const raw = await readFile(abs, "utf8");
    await writeFile(abs, updateJsonVersion(raw, version), "utf8");
  }
}

export function ensureGitTagMissing(cwd: string, tag: string): void {
  const existing = execSync(`git tag --list ${tag}`, {
    cwd,
    encoding: "utf8",
  }).trim();

  if (existing) throw new Error(`tag ${tag} 已存在`);
}

export function createGitTag(cwd: string, tag: string): void {
  execSync(`git tag ${tag}`, { cwd });
}

export async function verifyReleaseTag(
  cwd: string,
  tag: string,
): Promise<string> {
  const tagVersion = parseReleaseTag(tag);
  await assertVersionFilesMatch(cwd, tagVersion);
  return tagVersion;
}

export async function syncReleaseTag(
  cwd: string,
  tag: string,
): Promise<string> {
  const tagVersion = parseReleaseTag(tag);
  ensureGitTagMissing(cwd, tag);
  await syncVersionFiles(cwd, tagVersion);
  createGitTag(cwd, tag);
  return tagVersion;
}
```

- [ ] **Step 2: Run the integration test suite to verify it passes**

Run: `bun test test/scripts/tag.test.ts`
Expected: PASS with the updated happy path, invalid-tag failure, `--check` mismatch tests, and tag-exists regression test all green.

- [ ] **Step 3: Run the focused unit test suite to verify no regressions in helper behavior**

Run: `bun test test/core/release/tag.test.ts`
Expected: FAIL because the old unit test still expects `assertReleaseVersionMatchesPackage`, which was removed from the implementation.

### Task 3: Align focused helper tests with the new release helper API

**Files:**

- Modify: `test/core/release/tag.test.ts`
- Test: `test/core/release/tag.test.ts`

- [ ] **Step 1: Replace the unit test with the new helper surface**

Replace `test/core/release/tag.test.ts` with:

```ts
import { describe, expect, it } from "bun:test";

import {
  parseReleaseTag,
  updateJsonVersion,
  VERSION_FILES,
  PLUGIN_VERSION_FILES,
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

  describe("version file constants", () => {
    it("includes package.json and both claude plugin files in VERSION_FILES", () => {
      expect(VERSION_FILES).toEqual([
        "package.json",
        ".claude-plugin/plugin.json",
        ".claude-plugin/marketplace.json",
      ]);
    });

    it("keeps plugin-only files in PLUGIN_VERSION_FILES", () => {
      expect(PLUGIN_VERSION_FILES).toEqual([
        ".claude-plugin/plugin.json",
        ".claude-plugin/marketplace.json",
      ]);
    });
  });
});
```

- [ ] **Step 2: Run the unit test to verify it passes**

Run: `bun test test/core/release/tag.test.ts`
Expected: PASS with 5 tests green.

- [ ] **Step 3: Run the combined release-focused test suite**

Run: `bun test test/core/release/tag.test.ts test/scripts/tag.test.ts`
Expected: PASS with all release helper and tag script tests green.

- [ ] **Step 4: Commit the auto-sync behavior change**

```bash
git add src/core/release/tag.ts test/core/release/tag.test.ts test/scripts/tag.test.ts
git commit -m "feat(release): auto-sync version files in tag command"
```

### Task 4: Simplify the release workflow trigger surface

**Files:**

- Modify: `.github/workflows/release-npm.yml`

- [ ] **Step 1: Remove workflow_dispatch from the release workflow**

Replace `.github/workflows/release-npm.yml:1-48` with:

```yaml
name: Release npm

on:
  push:
    tags:
      - "v*"

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

- [ ] **Step 2: Verify the workflow now contains only tag-push release triggers**

Run:

```bash
python -c "from pathlib import Path; s = Path('.github/workflows/release-npm.yml').read_text(); assert 'workflow_dispatch' not in s; assert "- 'v*'" in s; assert 'bun run tag -- --check \"$RELEASE_TAG\"' in s; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Run the release-focused verification commands**

Run: `bun test test/core/release/tag.test.ts test/scripts/tag.test.ts`
Expected: PASS with all release-focused tests green.

- [ ] **Step 4: Commit the workflow cleanup**

```bash
git add .github/workflows/release-npm.yml
git commit -m "ci: simplify release workflow to tag pushes"
```

## Spec Coverage Check

- Default `bun run tag -- vX.Y.Z` updates all three version files: covered by Task 1 and Task 2
- Default mode creates the git tag after version sync: covered by Task 2 and Task 3
- `--check` remains read-only for CI: covered by Task 2 and Task 4
- Tag already exists leaves files untouched: covered by Task 1 existing regression test and Task 2 implementation order
- Invalid tags fail before file changes: covered by Task 1
- CI still uses `bun run tag -- --check "$RELEASE_TAG"`: covered by Task 4

## Placeholder Scan

- No `TBD` / `TODO` markers
- Every code-writing step includes exact file content to write
- Every verification step includes an exact command and expected outcome

## Type Consistency Check

- Shared helper names stay consistent across tasks: `parseReleaseTag`, `updateJsonVersion`, `verifyReleaseTag`, `syncReleaseTag`, `VERSION_FILES`, `PLUGIN_VERSION_FILES`
- The tag command contract remains `bun run tag -- [--check] vX.Y.Z`
