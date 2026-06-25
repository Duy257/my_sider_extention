import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "../entrypoints/sidepanel/components/SettingsPanel";
import type { Settings } from "../src/lib/storage/types";

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    providerId: "openai",
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    updatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides
  };
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
  });

  it("renders bundled providers and removes manual base url UI", () => {
    render(<SettingsPanel settings={settings()} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/Nhà cung cấp/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OpenAI" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "LMStudio" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Base URL/i)).not.toBeInTheDocument();
  });

  it("stores api keys by provider", async () => {
    const onChange = vi.fn();
    render(<SettingsPanel settings={settings()} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/Khóa API/i), "sk-test");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      apiKeys: { openai: "sk-test" }
    }));
  });

  it("loads models and selects first returned model", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true, models: ["model-a", "model-b"] });
    const onChange = vi.fn();
    render(<SettingsPanel settings={settings({ apiKeys: { openai: "sk" } })} onChange={onChange} />);

    await waitFor(() => expect(screen.getByRole("option", { name: "model-a" })).toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selectedModels: { openai: "model-a" } }));
  });

  it("uses known models when model loading is blocked by missing key", () => {
    render(<SettingsPanel settings={settings({ providerId: "opencode" })} onChange={vi.fn()} />);

    expect(screen.getByText(/Thêm khóa API để tải mô hình trực tiếp/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "minimax-m3" })).toBeInTheDocument();
  });

  it("sends test connection without urls or keys", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true });
    render(<SettingsPanel settings={settings({ apiKeys: { openai: "sk" }, selectedModels: { openai: "gpt-5.4-mini" } })} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Kiểm tra kết nối/i }));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "TEST_CONNECTION", requestId: expect.any(String) });
    expect(await screen.findByText("Kết nối thành công.")).toBeInTheDocument();
  });
});
