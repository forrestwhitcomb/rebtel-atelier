import type { Component } from "@rebtel-atelier/spec";

export const countryPickerComponent: Component = {
  id: "CountryPicker",
  name: "CountryPicker",
  paletteGroup: "productSpecific",
  axes: [],
  supportedStates: ["default"],
  baseSpec: {
    kind: "primitive",
    id: "CountryPicker:base",
    type: "CountryPicker",
    props: {
      countries: [
        {
          code: "US",
          name: "United States",
          flag: "🇺🇸",
        },
        {
          code: "SE",
          name: "Sweden",
          flag: "🇸🇪",
        },
        {
          code: "IN",
          name: "India",
          flag: "🇮🇳",
        },
        {
          code: "NG",
          name: "Nigeria",
          flag: "🇳🇬",
        },
        {
          code: "PH",
          name: "Philippines",
          flag: "🇵🇭",
        },
      ],
      selectedCode: null,
      bg: { token: "color.input-bg" },
      fg: { token: "color.input-text" },
      border: { token: "color.input-border" },
      radius: { token: "radius.sm" },
      labelColor: { token: "color.input-label" },
    },
    children: [],
  },
  draft: {
    axisOverrides: [],
    stateOverrides: [],
  },
  published: {
    axisOverrides: [
      {
        axisSelection: {},
        props: {
          bg: { token: "color.input-bg" },
          fg: { token: "color.input-text" },
          border: { token: "color.input-border" },
          radius: { token: "radius.sm" },
          labelColor: { token: "color.input-label" },
        },
      },
    ],
    stateOverrides: [],
  },
  publishedVersion: 1,
  propSchema: {
    countries: { category: "content", contentKind: "text", label: "Countries (JSON)" },
    selectedCode: { category: "content", contentKind: "text", label: "Selected country code" },
    bg: { category: "token", tokenCategory: "color", label: "Background" },
    fg: { category: "token", tokenCategory: "color", label: "Text color" },
    border: { category: "token", tokenCategory: "color", label: "Border color" },
    radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
    labelColor: { category: "token", tokenCategory: "color", label: "Label color" },
  },
};
