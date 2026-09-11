import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete, type AutocompleteOption } from "../entrypoints/sidepanel/components/Autocomplete";

const options: AutocompleteOption[] = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", hint: "anthropic/claude-3.5-sonnet" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "google/gemini-pro", label: "Gemini Pro" }
];

describe("Autocomplete", () => {
  it("renders the selected option's label in the input", () => {
    render(<Autocomplete id="ac" value="openai/gpt-5.4-mini" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("GPT-5.4 Mini");
  });

  it("opens the listbox with all options when clicked", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
  });

  it("filters options by label (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("claude");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    expect(within(listbox).getByRole("option")).toHaveTextContent("Claude 3.5 Sonnet");
  });

  it("filters options by id when label does not match", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("gemini");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    expect(within(listbox).getByRole("option")).toHaveTextContent("Gemini Pro");
  });

  it("moves highlight with ArrowDown / ArrowUp", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    const first = within(listbox).getAllByRole("option")[0];
    expect(first).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    const second = within(listbox).getAllByRole("option")[1];
    expect(second).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("commits highlighted option on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete id="ac" value="" options={options} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("openai/gpt-5.4-mini");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes without changing value on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete id="ac" value="openai/gpt-5.4-mini" options={options} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("GPT-5.4 Mini");
  });

  it("closes on click outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button data-testid="outside">Outside</button>
        <Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />
      </div>
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} disabled />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} loading />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByTestId("autocomplete-skeleton")).toBeInTheDocument();
  });

  it("renders hint when present and different from label", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    const row = screen.getByRole("option", { name: /Claude 3\.5 Sonnet/ });
    expect(within(row).getByText("anthropic/claude-3.5-sonnet")).toBeInTheDocument();
  });
});
