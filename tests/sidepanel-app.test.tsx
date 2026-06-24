import { render, screen } from "@testing-library/react";
import App from "../entrypoints/sidepanel/App";

test("renders the sidebar after settings load", async () => {
  render(<App />);

  expect(await screen.findByText(/Add your OpenAI API key/)).toBeInTheDocument();
});
