import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Personal AI Sidebar",
    description: "Private AI assistant for reading, rewriting, summarizing, and analysis workflows.",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: ["https://api.openai.com/*", "https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    action: {
      default_title: "Personal AI Sidebar"
    }
  }
});
