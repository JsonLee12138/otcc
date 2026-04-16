---
name: release-manager
description: >
  Manage release workflow: bump version files, create annotated git tag with AI-summarized
  commit message, and push to remote. Use when the user wants to release a new version,
  cut a release, bump version, create a git tag, publish a new release, or rollback a version.
  Triggers on phrases like "release vX.Y.Z", "bump version to", "create release", "cut a release",
  "tag release", "publish version", "rollback version", "revert version".
---

## Release Workflow

Execute the following steps in order:

### 0. Check Working Tree Clean

Run `git status --porcelain`. If there are uncommitted changes:

- Ask the user if they want to commit them first.
- If yes, stage and commit with an appropriate message, then proceed.
- If no, warn that changes will be included in the release commit and proceed.

### 1. Determine Version Type

Ask the user which version bump type:

- **patch** — bug fixes, small changes (X.Y.Z → X.Y.Z+1)
- **minor** — new features, backward compatible (X.Y.Z → X.Y+1.0)
- **major** — breaking changes (X.Y.Z → X+1.0.0)

Read current version from `package.json`, calculate the new version, confirm with user before proceeding.

### 2. Bump Version in Files

Run the version script:

```bash
bun run <skill-path>/scripts/version.ts vX.Y.Z
```

This updates version in:

- `package.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

### 3. Stage and Commit

```bash
git add -A
```

Generate commit message by analyzing recent git history:

```bash
git log --oneline -20
```

Create release commit with conventional commit format:

```bash
git commit -m "chore(release): bump version to X.Y.Z" -m "<AI-generated summary of changes>"
```

Summary should be concise bullet points of notable changes since last release.

### 4. Create Annotated Tag

```bash
git tag -a vX.Y.Z -m "chore(release): bump version to X.Y.Z

<same AI-generated summary as commit body>"
```

### 5. Push to Remote

```bash
git push origin main --follow-tags
```

## Rollback Workflow

When the user wants to rollback a version (e.g., "rollback v0.1.3", "redo this version"):

1. **Confirm the target version** — read current version from `package.json`, confirm which version to rollback to.

2. **Delete local tag and commit**:

```bash
git tag -d vX.Y.Z
```

If the release commit is the most recent one:

```bash
git reset --soft HEAD~1
```

3. **Reset version files** — re-run the version script with the target version to set all files back:

```bash
bun run <skill-path>/scripts/version.ts vX.Y.Z
```

4. **Re-commit and re-tag** — follow the normal release workflow from step 3.

## Version Script

Located at `scripts/version.ts`. Takes a single argument: version tag (e.g., `v1.2.3`).
Only updates version fields in JSON files — no git operations.
