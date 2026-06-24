import { render, screen } from "@testing-library/react";
import App from "../entrypoints/sidepanel/App";

test("renders the sidebar ready state", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Personal AI Sidebar" })).toBeInTheDocument();
  expect(screen.getByText("Ready.")).toBeInTheDocument();
});
