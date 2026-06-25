import { render } from "@testing-library/react";
import { SkeletonPanel } from "../entrypoints/sidepanel/components/Skeleton";
import { expect, test } from "vitest";

test("renders skeleton rows", () => {
  const { container } = render(<SkeletonPanel />);
  // We added animate-pulse to 4 main skeleton rows + headers, so it should find them
  expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4);
});
