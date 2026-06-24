import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Personal AI Sidebar",
    description: "Private AI sidebar for reading, rewriting, summarizing, and analysis workflows.",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "sidePanel", "scripting"],
    host_permissions: ["https://api.openai.com/*", "https://*/*"],
    side_panel: {
      default_path: "sidepanel.html"
    },
    action: {
      default_title: "Open Personal AI Sidebar"
    }
  }
});
