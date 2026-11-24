// news-image-20261123 — "The World in One Day": a newspaper front page summing up
// Monday 23 November 2026, drawn programmatically (Node 22, standard library only).
// No network, no external images, no fonts: a small PNG encoder (zlib) and a hand-written
// 5x7 bitmap font. Deterministic: the same bytes on every run.
//
// Stories (all first reported / happened on 23 Nov 2026):
//  1. COP31 climate talks in Antalya collapse with no deal (Principia, BusinessWorld)
//  2. Nvidia reinstates Jensen Huang as CEO after Trump pressed the board (BusinessWorld)
//  3. Ukraine says sea drones sank the Russian corvette Mercury at Benghazi, Libya (AZE.US, Principia)
//  4. Sweets-factory fire near Jakarta kills at least 24, ~30 missing (BusinessWorld, Principia)
//  5. Belgium national strike grounds flights at Brussels and Charleroi (news roundup 23 Nov)
//  6. EU proposes cutting ~60 Russian banks from SWIFT (AZE.US, 23 Nov 2026)
// Also: Russian strikes kill at least 15 around Kyiv; India pledges $1.62bn for flood-hit
// Nepal; BepiColombo enters orbit around Mercury (Principia, 23 Nov 2026).
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- canvas
const PAPER: [number, number, number] = [246, 241, 227];
const INK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [179, 39, 30];
const BLUE: [number, number, number] = [31, 78, 121];
const TEAL: [number, number, number] = [14, 107, 107];
const GREEN: [number, number, number] = [46, 125, 50];
const GOLD: [number, number, number] = [192, 138, 0];
const ORANGE: [number, number, number] = [214, 96, 20];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT: [number, number, number] = [232, 226, 205];

type RGB = [number, number, number];
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0]; px[i * 3 + 1] = PAPER[1]; px[i * 3 + 2] = PAPER[2];
}
function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void { rect(x, y, w, t, c); }
function vline(x: number, y: number, h: number, c: RGB, t = 1): void { rect(x, y, t, h, c); }
function outline(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) set(x, y, c);
}
function ring(cx: number, cy: number, r: number, c: RGB, t = 3): void {
  for (let y = cy - r - t; y <= cy + r + t; y++)
    for (let x = cx - r - t; x <= cx + r + t; x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (Math.abs(d - r) <= t / 2) set(x, y, c);
    }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const sign = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const d0 = sign(x, y, x0, y0, x1, y1), d1 = sign(x, y, x1, y1, x2, y2), d2 = sign(x, y, x2, y2, x0, y0);
      if (!((d0 < 0 || d1 < 0 || d2 < 0) && (d0 > 0 || d1 > 0 || d2 > 0))) set(x, y, c);
    }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, '1' = ink.
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '\u2022': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01000', '01000', '11110', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  j: ['00010', '00000', '00110', '00010', '00010', '00010', '01100'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  n: ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  p: ['00000', '00000', '11110', '10001', '10001', '11110', '10000', '10000'].slice(0, 7),
  q: ['00000', '00000', '01111', '10001', '10001', '01111', '00001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  t: ['01000', '01000', '11100', '01000', '01000', '01000', '00110'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  w: ['00000', '00000', '10001', '10101', '10101', '10101', '01010'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
};

// ---------------------------------------------------------------- text
function charWidth(scale: number): number { return 6 * scale; }
function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * charWidth(scale) - scale;
}
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT['?'];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === '1') rect(x + col * scale, y + r * scale, scale, scale, c);
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of s) { drawChar(cx, y, ch, scale, c); cx += charWidth(scale); }
  return cx;
}
function drawCentred(y: number, s: string, scale: number, c: RGB, x0 = 28, x1 = 996): void {
  drawText(x0 + Math.floor((x1 - x0 - textWidth(s, scale)) / 2), y, s, scale, c);
}
// Greedy word wrap; returns lines that fit maxWidth. A word wider than the
// column is split into chunks that glue onto each other without a space,
// so no text ever overflows the column.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const tokens: { t: string; glue: boolean }[] = [];
  for (const w of s.split(' ')) {
    let rest = w;
    let first = true;
    while (textWidth(rest, scale) > maxWidth) {
      const n = Math.max(1, Math.floor(maxWidth / charWidth(scale)));
      tokens.push({ t: rest.slice(0, n), glue: !first });
      rest = rest.slice(n);
      first = false;
    }
    tokens.push({ t: rest, glue: !first });
  }
  const lines: string[] = [];
  let cur = '';
  for (const tok of tokens) {
    const trial = cur === '' ? tok.t : tok.glue ? cur + tok.t : cur + ' ' + tok.t;
    if (textWidth(trial, scale) <= maxWidth || cur === '') cur = trial;
    else { lines.push(cur); cur = tok.t; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, s: string, maxWidth: number, scale: number, c: RGB, lh?: number): number {
  const lines = wrap(s, maxWidth, scale);
  const step = lh ?? 7 * scale + 2 * scale;
  lines.forEach((ln, i) => drawText(x, y + i * step, ln, scale, c));
  return y + lines.length * step;
}

// ---------------------------------------------------------------- PNG encoder (RGB, filter 0, zlib level 9)
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- page layout
const M = 28; // margin; content spans x 28..996

// Masthead: black band, paper title, gold date.
rect(M, 24, 968, 118, INK);
drawCentred(46, 'THE WORLD IN ONE DAY', 5, WHITE);
drawCentred(104, 'MONDAY 23 NOVEMBER 2026', 2, [232, 185, 60]);
rect(M, 150, 968, 6, RED);

// ---- Lead story: COP31, with a globe + thermometer graphic on the right.
drawText(M, 176, 'CLIMATE  -  ANTALYA, TURKEY', 2, RED);
drawWrapped(M, 202, 'CLIMATE TALKS COLLAPSE', 600, 4, INK, 30);
drawWrapped(M, 244, 'AFTER RECORD-LONG SUMMIT', 600, 3, BLUE, 24);
drawWrapped(M, 288, 'The UN climate summit in Antalya, Turkey, ended on 23 November with no agreement, the longest COP on record, after the EU and others rejected a final text silent on phasing out fossil fuels.', 600, 2, INK, 15);
// Globe graphic.
disc(800, 268, 78, BLUE);
disc(778, 246, 26, GREEN); disc(822, 288, 30, GREEN); disc(806, 232, 14, GREEN);
ring(800, 268, 78, INK, 3);
line(722, 268, 878, 268, [255, 255, 255]);
// Thermometer: rising heat, no deal.
rect(918, 196, 26, 128, WHITE); outline(918, 196, 26, 128, RED, 3);
rect(922, 236, 18, 84, RED);
disc(931, 336, 24, RED); ring(931, 336, 24, INK, 2);
drawText(906, 372, 'HOT', 2, RED);
// NO DEAL stamp.
outline(660, 352, 196, 46, RED, 4);
drawText(676, 364, 'NO DEAL', 3, RED);
hline(M, 436, 968, INK, 3);

// ---- Story columns (3 per row). kicker, headline, body, small icon.
function column(x: number, y: number, w: number, bar: RGB, kicker: string, headline: string, body: string, icon: (ix: number, iy: number) => void): void {
  rect(x, y, w, 8, bar);
  drawText(x, y + 20, kicker, 2, RED);
  drawWrapped(x, y + 44, headline, w, 3, INK, 22);
  drawWrapped(x, y + 118, body, w, 2, INK, 15);
  icon(x, y + 196);
}
const ROW1 = 456, ROW2 = 716, COLW = 312;

// Nvidia: computer chip.
column(M, ROW1, COLW, GREEN, 'TECH  -  NVIDIA', 'HUANG BACK AT NVIDIA',
  'Nvidia reinstated Jensen Huang as CEO after President Trump said he pressed the board. Shares jumped.',
  (ix, iy) => {
    rect(ix + 8, iy + 4, 56, 44, GREEN);
    rect(ix + 20, iy + 14, 32, 24, WHITE);
    drawText(ix + 28, iy + 20, 'NV', 2, GREEN);
    for (let i = 0; i < 4; i++) { rect(ix + 14 + i * 14, iy, 4, 4, INK); rect(ix + 14 + i * 14, iy + 48, 4, 4, INK); }
  });
// Ukraine sea drones: waves, ship, drone.
column(356, ROW1, COLW, BLUE, 'WAR AT SEA  -  LIBYA', 'UKRAINE SAYS IT SANK RUSSIAN WARSHIP',
  'Kyiv said its sea drones sank the Russian corvette Mercury at Benghazi, Libya, and hit a cargo ship.',
  (ix, iy) => {
    for (let r = 0; r < 3; r++) {
      const yy = iy + 34 + r * 8;
      for (let xx = ix; xx < ix + 130; xx += 12) line(xx, yy, xx + 6, yy - 4, BLUE);
    }
    tri(ix + 30, iy + 6, ix + 96, iy + 6, ix + 63, iy + 30, INK);
    line(ix + 63, iy + 6, ix + 63, iy - 10, INK);
    tri(ix + 63, iy - 10, ix + 63, iy + 2, ix + 80, iy - 2, RED);
    drawText(ix + 104, iy - 6, 'x', 2, RED);
  });
// Indonesia factory fire: flame over a building.
column(684, ROW1, COLW, ORANGE, 'DISASTER  -  INDONESIA', '24 KILLED IN FACTORY FIRE',
  'A fire at a sweets factory near Jakarta killed at least 24 people. About 30 more were missing.',
  (ix, iy) => {
    rect(ix + 8, iy + 26, 72, 24, INK);
    tri(ix + 20, iy + 26, ix + 68, iy + 26, ix + 44, iy - 6, ORANGE);
    tri(ix + 34, iy + 26, ix + 56, iy + 26, ix + 45, iy + 6, RED);
    drawText(ix + 92, iy + 16, '24', 3, RED);
  });
// Belgium strike: grounded plane.
column(M, ROW2, COLW, TEAL, 'LABOUR  -  BELGIUM', 'BELGIUM STRIKE GROUNDS FLIGHTS',
  'A national strike shut Belgium\'s airports. Nearly all flights at Brussels and Charleroi were cancelled.',
  (ix, iy) => {
    rect(ix + 10, iy + 14, 90, 12, TEAL);
    tri(ix + 100, iy + 14, ix + 128, iy + 20, ix + 100, iy + 26, TEAL);
    tri(ix + 44, iy + 26, ix + 66, iy + 26, ix + 55, iy + 44, TEAL);
    line(ix + 118, iy + 2, ix + 134, iy + 18, RED); line(ix + 134, iy + 2, ix + 118, iy + 18, RED);
  });
// EU sanctions: circle of stars, EU in the middle.
column(356, ROW2, COLW, BLUE, 'SANCTIONS  -  BRUSSELS', 'EU TO CUT 60 RUSSIAN BANKS FROM SWIFT',
  'The EU proposed cutting about 60 Russian banks off SWIFT and sanctioning more than 70 shadow-fleet ships.',
  (ix, iy) => {
    ring(ix + 36, iy + 24, 22, BLUE, 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      disc(Math.round(ix + 36 + Math.cos(a) * 22), Math.round(iy + 24 + Math.sin(a) * 22), 2, GOLD);
    }
    drawText(ix + 28, iy + 18, 'EU', 2, BLUE);
    drawText(ix + 74, iy + 16, '60', 3, RED);
  });
// Also on 23 November: three short items.
column(684, ROW2, COLW, INK, 'ALSO ON 23 NOVEMBER', 'MORE OF THE DAY',
  '\u2022 Russian strikes killed at least 15 people around Kyiv. \u2022 India pledged $1.62bn for flood-hit Nepal. \u2022 BepiColombo entered orbit around Mercury.',
  (_ix, _iy) => { /* no icon: the three bullets fill this column */ });

// Footer.
hline(M, 972, 968, INK, 2);
drawCentred(984, '23 NOVEMBER 2026  -  ONE DAY, ONE PICTURE', 2, INK);

// ---------------------------------------------------------------- run
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePNG();
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes, ${W}x${H})`);
