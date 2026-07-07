import config from "../wxt.config";

type ManifestConfig = {
  manifest?: {
    side_panel?: { default_path?: string };
    content_scripts?: Array<{
      matches?: string[];
      js?: string[];
      run_at?: string;
    }>;
  };
};

describe("wxt manifest config", () => {
  const manifest = (config as ManifestConfig).manifest;

  it("keeps the side panel as the extension icon entrypoint", () => {
    expect(manifest?.side_panel).toEqual({ default_path: "sidepanel.html" });
  });

  it("registers the active tab agent on HTTPS pages only", () => {
    expect(manifest?.content_scripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matches: ["https://*/*"],
          js: ["active-tab-agent.js"],
          run_at: "document_idle"
        })
      ])
    );
  });
});
