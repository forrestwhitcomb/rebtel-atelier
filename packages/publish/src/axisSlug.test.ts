import { describe, expect, it } from "vitest";
import {
  parseAxisSelection,
  roundTrip,
  serializeAxisSelection,
} from "./axisSlug.js";

describe("serializeAxisSelection", () => {
  it("pretty single-axis: just key=value", () => {
    expect(serializeAxisSelection({ style: "primary" }, "pretty")).toBe("style=primary");
  });

  it("pretty multi-axis: + as conjunction", () => {
    expect(
      serializeAxisSelection({ style: "primary", size: "md" }, "pretty"),
    ).toBe("style=primary+size=md");
  });

  it("branch single-axis: hyphen separator", () => {
    expect(serializeAxisSelection({ style: "primary" }, "branch")).toBe("style-primary");
  });

  it("branch multi-axis: underscore between axes", () => {
    expect(
      serializeAxisSelection({ style: "primary", size: "md" }, "branch"),
    ).toBe("style-primary_size-md");
  });

  it("empty selection serializes to empty string", () => {
    expect(serializeAxisSelection({}, "pretty")).toBe("");
    expect(serializeAxisSelection({}, "branch")).toBe("");
  });
});

describe("parseAxisSelection", () => {
  it("parses pretty form back to a record", () => {
    expect(parseAxisSelection("style=primary+size=md", "pretty")).toEqual({
      style: "primary",
      size: "md",
    });
  });

  it("parses branch form back to a record", () => {
    expect(parseAxisSelection("style-primary_size-md", "branch")).toEqual({
      style: "primary",
      size: "md",
    });
  });

  it("empty string parses to {}", () => {
    expect(parseAxisSelection("", "pretty")).toEqual({});
    expect(parseAxisSelection("", "branch")).toEqual({});
  });

  it("throws on malformed pretty input", () => {
    expect(() => parseAxisSelection("style", "pretty")).toThrow(/Cannot parse/);
    expect(() => parseAxisSelection("=primary", "pretty")).toThrow(/Cannot parse/);
    expect(() => parseAxisSelection("style=", "pretty")).toThrow(/Cannot parse/);
  });

  it("throws on duplicate axis keys", () => {
    expect(() => parseAxisSelection("style=primary+style=secondary", "pretty")).toThrow(
      /Duplicate axis/,
    );
  });
});

describe("round-trip identity", () => {
  const cases: Array<{ name: string; sel: Record<string, string> }> = [
    { name: "single axis", sel: { style: "primary" } },
    { name: "two axes", sel: { style: "primary", size: "md" } },
    { name: "three axes", sel: { style: "primary", size: "md", tone: "neutral" } },
    { name: "single empty axes", sel: {} },
  ];
  for (const { name, sel } of cases) {
    it(`pretty round-trip preserves ${name}`, () => {
      expect(roundTrip(sel, "pretty")).toEqual(sel);
    });
    it(`branch round-trip preserves ${name}`, () => {
      expect(roundTrip(sel, "branch")).toEqual(sel);
    });
  }
});
