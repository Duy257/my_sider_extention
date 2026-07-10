# README, CHANGELOG & Version Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add end-user README, CHANGELOG (Keep a Changelog), and a bump-version script to professionalize the project.

**Architecture:** `wxt.config.ts` reads version from `package.json` (single source of truth). `scripts/bump-version.sh` updates `package.json` and creates git tag. `README.md` and `CHANGELOG.md` at root are manually maintained.

**Tech Stack:** Shell script, Markdown, TypeScript (WXT config)

**Spec:** `docs/superpowers/specs/2026-07-10-readme-changelog-versioning-design.md`

## Global Constraints

- README language is Vietnamese (matching existing UI language in AGENTS.md)
- CHANGELOG follows Keep a Changelog format (https://keepachangelog.com)
- Version single source of truth is `version` field in `package.json`
- All deliverables at repo root except scripts which go in `scripts/`

---

### Task 1: Sync version — wxt.config.ts reads from package.json

**Files:**
- Modify: `wxt.config.ts:1-8`
- No test file needed

**Interfaces:**
- Consumes: `package.json` (version field)
- Produces: `wxt.config.ts` uses `pkg.version` in manifest

- [ ] **Step 1: Edit wxt.config.ts**

Replace the hardcoded `version: "0.1.0"` with a dynamic import from `package.json`:

```ts
import { defineConfig } from "wxt";
import pkg from "./package.json";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Personal AI Sidebar",
    description: "Private AI assistant for reading, rewriting, summarizing, and analysis workflows.",
    version: pkg.version,
    permissions: ["storage", "activeTab", "sidePanel", "scripting", "contextMenus"],
    host_permissions: ["https://api.openai.com/*", "https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    content_scripts: [
      {
        matches: ["https://*/*"],
        js: ["active-tab-agent.js"],
        run_at: "document_idle"
      }
    ],
    side_panel: {
      default_path: "sidepanel.html"
    },
    action: {
      default_title: "Personal AI Sidebar"
    }
  }
});
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run compile`
Expected: exit code 0, no errors

- [ ] **Step 3: Commit**

```bash
git add wxt.config.ts
git commit -m "refactor: read version from package.json"
```

---

### Task 2: Create CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`
- No test file needed

**Interfaces:** None

- [ ] **Step 1: Create CHANGELOG.md**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-10

### Added

- AI chat with streaming in sidebar
- Page reading & summarization (Readability.js)
- Text selection toolbar with floating actions
- Multi-provider support: OpenAI, OpenCode, CommandCode, LMStudio
- Prompt management (create, edit, organize)
- Chat history with saved results
- Thinking mode toggle per chat
- BYOK (Bring Your Own API Key) model
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md"
```

---

### Task 3: Create README.md

**Files:**
- Create: `README.md`
- No test file needed

**Interfaces:** None

- [ ] **Step 1: Create README.md**

```markdown
<div align="center">

# Personal AI Sidebar

**Trợ lý AI cá nhân — đọc, viết lại, tóm tắt, phân tích ngay trong trình duyệt**

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Tổng quan

**Personal AI Sidebar** là extension Chrome cho phép bạn trò chuyện với AI ngay trong sidebar trình duyệt. Hỗ trợ đọc nội dung trang web, tóm tắt, phân tích văn bản được chọn, và nhiều tác vụ xử lý thông tin khác.

Mô hình **BYOK (Bring Your Own API Key)** — bạn tự cấu hình API key, không cần backend server, dữ liệu hoàn toàn riêng tư.

## Tính năng

- **Chat với AI** — Giao diện chat trong sidebar, hỗ trợ streaming phản hồi
- **Đọc & tóm tắt trang** — Tự động trích xuất nội dung trang web, tóm tắt hoặc hỏi đáp về nội dung
- **Chọn text để xử lý** — Bôi đen văn bản bất kỳ, toolbar xuất hiện để phân tích, tóm tắt, dịch
- **Quản lý Prompt** — Tạo, chỉnh sửa, tổ chức các prompt mẫu
- **Lưu kết quả** — Lưu lại các phản hồi quan trọng để tra cứu sau
- **Thinking Mode** — Bật chế độ "suy nghĩ" cho các câu hỏi phức tạp (OpenAI models hỗ trợ)
- **Đa dạng AI Provider** — OpenAI, OpenCode, CommandCode, LMStudio

## Yêu cầu hệ thống

- **Trình duyệt:** Chrome (bản mới nhất)
- **API Key:** Cần có API key từ ít nhất một AI provider hỗ trợ
- **Quyền extension:** storage, activeTab, sidePanel, scripting, contextMenus

## Hướng dẫn cài đặt

### Từ Chrome Web Store

_Coming soon — extension đang trong giai đoạn phát triển._

### Load unpacked (development)

1. Clone repository:
   ```bash
   git clone https://github.com/your-username/personal-ai-sidebar.git
   cd personal-ai-sidebar
   ```
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Build extension:
   ```bash
   npm run build
   ```
4. Mở `chrome://extensions`, bật **Developer mode**
5. Chọn **Load unpacked** → chọn thư mục `.output/chrome-mv3/`

### Chạy ở chế độ development (HMR)

```bash
npm run dev
```

Extension sẽ tự động load lại khi có thay đổi.

## Hướng dẫn sử dụng

### Chat cơ bản

1. Click icon extension trên thanh công cụ → sidebar mở ra bên phải
2. Nhập tin nhắn vào ô chat → nhấn Enter hoặc click nút gửi
3. AI phản hồi theo thời gian thực (streaming)

### Chọn text để xử lý

1. Bôi đen văn bản trên bất kỳ trang web nào
2. Toolbar nổi xuất hiện với các tùy chọn: Tóm tắt, Giải thích, Dịch
3. Chọn thao tác → kết quả hiển thị trong sidebar

### Đọc & tóm tắt trang

1. Mở sidebar → click nút **Read Page**
2. Extension tự động trích xuất nội dung chính của trang
3. Chọn: Tóm tắt trang, Hỏi đáp về nội dung, hoặc chat tự do

### Quản lý prompt

1. Vào Settings → Prompt Manager
2. Tạo prompt mới với tiêu đề và nội dung mẫu
3. Sắp xếp theo thư mục hoặc gắn nhãn
4. Dùng prompt mẫu khi chat để tiết kiệm thời gian

## Cấu hình AI Provider

1. Mở sidebar → click icon Settings (⚙️)
2. Chọn tab **AI Provider**
3. Chọn provider từ danh sách: OpenAI, OpenCode, CommandCode, LMStudio
4. Nhập API key tương ứng
5. Chọn model mong muốn (danh sách model được tải tự động)
6. (Tùy chọn) Cấu hình thêm: base URL, extra parameters

> ⚠️ API Key được lưu trữ cục bộ trong `chrome.storage.local` — không bao giờ gửi đến server nào ngoài AI provider bạn chọn.

## Phát triển

Xem [AGENTS.md](./AGENTS.md) và [docs/modules/README.md](./docs/modules/README.md) để hiểu kiến trúc và quy ước code.

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README.md"
```

---

### Task 4: Create scripts/bump-version.sh

**Files:**
- Create: `scripts/bump-version.sh`
- No test file needed

**Interfaces:** None (standalone script)

- [ ] **Step 1: Create scripts/ directory and bump-version.sh**

```bash
mkdir -p scripts
```

```bash
cat > scripts/bump-version.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: $0 {patch|minor|major|<semver>}"
  echo "  patch  — bump x.y.Z (default)"
  echo "  minor  — bump x.Y.0"
  echo "  major  — bump X.0.0"
  echo "  0.2.0  — explicit version"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

ARG=$1
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_FILE="$ROOT_DIR/package.json"

# Read current version
CURRENT_VERSION=$(node -p "require('$PKG_FILE').version")

if [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$ARG"
else
  IFS='.' read -ra PARTS <<< "$CURRENT_VERSION"
  MAJOR="${PARTS[0]}"
  MINOR="${PARTS[1]}"
  PATCH="${PARTS[2]}"

  case "$ARG" in
    patch)
      PATCH=$((PATCH + 1))
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    *)
      usage
      ;;
  esac

  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
fi

echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"

# Update package.json
node -e "
const pkg = require('$PKG_FILE');
pkg.version = '$NEW_VERSION';
require('fs').writeFileSync('$PKG_FILE', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit and tag
git add "$PKG_FILE"
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"

echo ""
echo "Version bumped to $NEW_VERSION"
echo "Tag v$NEW_VERSION created"
echo ""
echo "Next steps:"
echo "  1. Update CHANGELOG.md with the new release"
echo "  2. git push --follow-tags"
SCRIPT
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x scripts/bump-version.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/bump-version.sh
git commit -m "chore: add bump-version script"
```

---

### Task 5: Add bump-version script to package.json scripts

**Files:**
- Modify: `package.json`
- No test file needed

**Interfaces:** None

- [ ] **Step 1: Add bump script to package.json**

Add `"bump": "sh scripts/bump-version.sh"` to scripts:

```json
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "compile": "tsc --noEmit",
    "test": "vitest",
    "postinstall": "wxt prepare",
    "bump": "sh scripts/bump-version.sh"
  },
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add npm run bump command"
```

---

### Task 6: Verify everything works end-to-end

**Files:** None (verification only)

**Interfaces:** None

- [ ] **Step 1: Verify type-check**

Run: `npm run compile`
Expected: exit code 0, no errors

- [ ] **Step 2: Verify tests pass**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: build completes without errors

- [ ] **Step 4: Verify bump script works (dry run with revert)**

```bash
# Save state
CURRENT_HASH=$(git rev-parse HEAD)

# Test bump patch
sh scripts/bump-version.sh patch

# Verify version changed
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Version after bump: $NEW_VERSION"
# Should show 0.2.0

# Revert
git reset --hard "$CURRENT_HASH"
git tag -d "v$NEW_VERSION" 2>/dev/null || true
echo "Reverted to pre-bump state"
```

