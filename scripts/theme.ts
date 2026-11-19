// Brand palette. Dark is the portfolio's own scheme; light uses the darker lime
// from logo-mark-light.svg so the accent keeps contrast on a pale background.

export type Theme = {
  name: 'dark' | 'light';
  bg: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  // Accent for text and the portrait; on light it needs to be darker to read.
  accentText: string;
  heat: [string, string, string, string, string];
};

export const dark: Theme = {
  name: 'dark',
  bg: '#151515',
  fg: '#f2f2f2',
  muted: '#8c8c8c',
  line: '#2b2b2b',
  accent: '#c8f04b',
  accentText: '#c8f04b',
  heat: ['#222222', '#3d4a1c', '#647b2b', '#98b83b', '#c8f04b'],
};

export const light: Theme = {
  name: 'light',
  bg: '#f2f2f2',
  fg: '#151515',
  muted: '#5f5f5f',
  line: '#dadada',
  accent: '#8aa82a',
  accentText: '#556a14',
  heat: ['#e2e2e2', '#d6e6a3', '#b3cf5f', '#8aa82a', '#556a14'],
};

export const themes = [dark, light];

export const FONT = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// Monospace advance width as a share of the font size, close enough for layout.
export const CHAR = 0.6;
