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
