# README, CHANGELOG & Version Management Design

**Date:** 2026-07-10
**Status:** Approved

## Goal

Professionalize the project by adding README (end-user focused), CHANGELOG (Keep a Changelog format), and a simple version management workflow.

## Deliverables

### 1. `README.md` (root)

End-user focused, Vietnamese UI language. Sections:

- Badges (version, license)
- Tổng quan — what the extension does, BYOK model
- Tính năng — bullet list of features
- Yêu cầu hệ thống — Chrome, API key needed
- Hướng dẫn cài đặt — Chrome Web Store + load unpacked
- Hướng dẫn sử dụng — chat, text selection, page reading, prompt management
- Cấu hình AI Provider — API key, provider selection, model config
- License

### 2. `CHANGELOG.md` (root)

[Keep a Changelog](https://keepachangelog.com) format, manually written per release.

### 3. `scripts/bump-version.sh`

Shell script that:
- Accepts `patch | minor | major` or explicit version (e.g., `0.2.0`)
- Updates `version` in `package.json`
- Creates a git commit + annotated tag (`v{version}`)
- Prints reminder to update CHANGELOG

### 4. `wxt.config.ts` — version de-duplication

Change `version: "0.1.0"` to read from `package.json` dynamically:

```ts
import pkg from "./package.json";
// manifest: { version: pkg.version, ... }
```

This ensures one source of truth — only `package.json` is edited on bump.

## Version Workflow

```
# Developer workflow per release:
1. Update CHANGELOG.md with [Unreleased] → versioned section
2. sh scripts/bump-version.sh patch  (or minor/major)
   → updates package.json
   → commits "chore: bump version to x.y.z"
   → tags vx.y.z
3. git push --follow-tags
```

## Non-goals

- No automated CHANGELOG generation (manual keeps quality)
- No CI/CD integration (out of scope)
- No npm version lifecycle hooks (unnecessary complexity)

## Files Changed

| File | Action |
|------|--------|
| `README.md` | Create |
| `CHANGELOG.md` | Create |
| `scripts/bump-version.sh` | Create |
| `wxt.config.ts` | Edit — import version from package.json |
