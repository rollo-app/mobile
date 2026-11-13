import { useState } from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Section } from "../components";

describe("Section", () => {
  it("renders without crashing when title and footer are empty strings", async () => {
    await render(
      <Section title="" footer="">
        <Text>content</Text>
      </Section>,
    );

    expect(screen.getByText("content")).toBeVisible();
  });

  it("shows the title and footer when present", async () => {
    await render(
      <Section title="Title" footer="Footer">
        <Text>content</Text>
      </Section>,
    );

    expect(screen.getByText("Title")).toBeVisible();
    expect(screen.getByText("Footer")).toBeVisible();
  });
});

describe("Section row identity", () => {
  it("keeps a row's state with its own key when earlier rows go away", async () => {
    const Counter = ({ label }: { label: string }) => {
      const [id] = useState(() => Math.random());
      return <Text testID={label}>{String(id)}</Text>;
    };
    const view = (keys: string[]) => (
      <Section>
        {keys.map((k) => (
          <Counter key={k} label={k} />
        ))}
      </Section>
    );
    await render(view(["a", "b"]));
    const before = screen.getByTestId("b").props.children;
    await screen.rerender(view(["b"]));
    expect(screen.getByTestId("b").props.children).toBe(before);
  });
});
