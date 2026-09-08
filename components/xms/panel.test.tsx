import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "@/components/xms/panel";

/**
 * Review finding 14: panel eyebrows were shouted sentences rather than
 * eyebrows, over a hundred characters of uppercase mono ("7 IN THE MONTH;
 * HOURS ARE THE SERVER'S", "WEIGHTED PIPELINE AND COMMITTED PROJECT DEMAND
 * STACKED ON THE ALLOCATED HOURS; THE LIGHTER SHADES ARE DEMAND"), with
 * engineering language leaking into the product. Design System section 4:
 * ALL-CAPS accent eyebrow, ink title, one-line subtitle.
 */
describe("Panel header", () => {
  it("draws the eyebrow above the title and the subtitle under it", () => {
    render(
      <Panel title="People" caption="This month" subtitle="7 people, with their hours for the month.">
        <p>body</p>
      </Panel>,
    );
    const header = screen.getByRole("region", { name: "People" }).querySelector("header");
    expect(header?.querySelector(".xms-caption")).toHaveTextContent("This month");
    expect(header).toHaveTextContent("7 people, with their hours for the month.");
    // The subtitle is body text, never the uppercase mono eyebrow.
    expect(header?.querySelectorAll(".xms-caption")).toHaveLength(1);
  });

  it("omits both lines when neither is given", () => {
    render(
      <Panel title="Properties">
        <p>body</p>
      </Panel>,
    );
    const header = screen.getByRole("region", { name: "Properties" }).querySelector("header");
    expect(header?.querySelector(".xms-caption")).toBeNull();
    expect(header).toHaveTextContent("Properties");
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

const relative = (file: string) => file.slice(process.cwd().length + 1).split(sep).join("/");

/** Every caption literal in a file, with the interpolated expressions removed. */
export function captionsIn(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/caption=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const literal = match[1] ?? match[2] ?? "";
    found.push(literal.replace(/\$\{[^}]*\}/g, "").trim());
  }
  return found;
}

/**
 * The screens the review named. The rule is not applied to the whole product
 * yet, because older screens carry the same habit and moving all of them is a
 * separate pass; nothing new may be added to these two trees.
 */
describe("capacity and time panel eyebrows", () => {
  const files = ["components/capacity", "components/time"].flatMap((root) => walk(join(process.cwd(), root)));

  it("finds the panels to check", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.flatMap((file) => captionsIn(readFileSync(file, "utf8"))).length).toBeGreaterThan(5);
  });

  it("reads captions as short noun phrases, never as sentences", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const caption of captionsIn(readFileSync(file, "utf8"))) {
        if (caption.length > 40 || caption.includes(";")) offenders.push(`${relative(file)}: ${caption}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("recognizes the shape the review objected to", () => {
    const source = 'caption={`${n} in the month; hours are the server\'s`}';
    expect(captionsIn(source)).toEqual(["in the month; hours are the server's"]);
  });
});
