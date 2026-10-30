"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { qrSvg } = require("../harness/qr");

const TOTAL = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
];
const EC_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];
const EC_WORDS = [0, 10, 16, 26, 36, 48, 64, 72, 88, 110, 130, 150, 176, 198, 216, 240, 280, 308, 338, 364, 416];
const ALIGN = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

function gridFromSvg(svg) {
  const view = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const full = Number(view[1]);
  const quiet = 4;
  const n = full - quiet * 2;
  const grid = Array.from({ length: n }, () => Array(n).fill(false));
  const re = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1"\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const x = Number(m[1]) - quiet;
    const y = Number(m[2]) - quiet;
    const w = Number(m[3]);
    for (let i = 0; i < w; i++) grid[y][x + i] = true;
  }
  return grid;
}

function reservedMap(version) {
  const size = version * 4 + 17;
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  function mark(row, col) {
    if (row >= 0 && col >= 0 && row < size && col < size) reserved[row][col] = true;
  }
  [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([row, col]) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) mark(row + r, col + c);
    }
  });
  for (let i = 8; i < size - 8; i++) {
    mark(6, i);
    mark(i, 6);
  }
  const centers = ALIGN[version];
  centers.forEach((row) => {
    centers.forEach((col) => {
      if (reserved[row][col]) return;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) mark(row + r, col + c);
      }
    });
  });
  for (let i = 0; i < 15; i++) {
    let y;
    if (i < 6) y = i;
    else if (i < 8) y = i + 1;
    else y = size - 15 + i;
    mark(y, 8);
    let x;
    if (i < 8) x = size - i - 1;
    else if (i < 9) x = 15 - i;
    else x = 15 - i - 1;
    mark(8, x);
  }
  mark(size - 8, 8);
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      mark(b, a);
      mark(a, b);
    }
  }
  return reserved;
}

function maskAt(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row * col) % 3) + ((row + col) % 2)) % 2 === 0;
  }
}

function readFormat(grid) {
  const size = grid.length;
  let bits = 0;
  for (let i = 0; i < 15; i++) {
    let y;
    if (i < 6) y = i;
    else if (i < 8) y = i + 1;
    else y = size - 15 + i;
    if (grid[y][8]) bits |= 1 << i;
  }
  const data = (bits ^ 0x5412) >>> 10;
  return { level: data >>> 3, mask: data & 7 };
}

function readCodewords(grid, version, mask) {
  const size = grid.length;
  const reserved = reservedMap(version);
  const bits = [];
  let row = size - 1;
  let col = size - 1;
  let dir = -1;
  while (col > 0) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (!reserved[row][x]) {
          let on = grid[row][x];
          if (maskAt(mask, row, x)) on = !on;
          bits.push(on ? 1 : 0);
        }
      }
      row += dir;
      if (row < 0 || row >= size) {
        row -= dir;
        dir = -dir;
        col -= 2;
        break;
      }
    }
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length && words.length < TOTAL[version]; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
    words.push(value);
  }
  return words;
}

function dataCodewords(words, version) {
  const blocks = EC_BLOCKS[version];
  const dataWords = TOTAL[version] - EC_WORDS[version];
  const group2 = TOTAL[version] % blocks;
  const group1 = blocks - group2;
  const data1 = Math.floor(dataWords / blocks);
  const ecLen = Math.floor(TOTAL[version] / blocks) - data1;
  const sizes = [];
  for (let b = 0; b < blocks; b++) sizes.push(b < group1 ? data1 : data1 + 1);
  const max = Math.max(...sizes);
  const parts = sizes.map(() => []);
  let offset = 0;
  for (let i = 0; i < max; i++) {
    for (let b = 0; b < blocks; b++) {
      if (i < sizes[b]) parts[b].push(words[offset++]);
    }
  }
  offset += ecLen * blocks;
  assert.equal(offset, TOTAL[version]);
  return parts.flat();
}

function payloadFromData(data, version) {
  const bits = [];
  data.forEach((word) => {
    for (let i = 7; i >= 0; i--) bits.push((word >>> i) & 1);
  });
  let at = 0;
  function take(n) {
    let value = 0;
    for (let i = 0; i < n; i++) value = (value << 1) | bits[at++];
    return value;
  }
  const mode = take(4);
  assert.equal(mode, 0b0100);
  const countBits = version < 10 ? 8 : 16;
  const length = take(countBits);
  const bytes = [];
  for (let i = 0; i < length; i++) bytes.push(take(8));
  return Buffer.from(bytes).toString("utf8");
}

const VERSION_INFO = [
  0, 0, 0, 0, 0, 0, 0,
  0x07c94, 0x085bc, 0x09a99, 0x0a4d3, 0x0bbf6, 0x0c762, 0x0d847, 0x0e60d,
  0x0f928, 0x10b78, 0x1145d, 0x12a17, 0x13532, 0x149a6,
];

function readVersion(grid) {
  const size = grid.length;
  let bits = 0;
  for (let i = 0; i < 18; i++) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    if (grid[b][a]) bits |= 1 << i;
  }
  return bits;
}

function decode(svg) {
  const grid = gridFromSvg(svg);
  const version = (grid.length - 17) / 4;
  assert.equal(version, Math.round(version));
  const format = readFormat(grid);
  assert.equal(format.level, 0);
  const words = readCodewords(grid, version, format.mask);
  return payloadFromData(dataCodewords(words, version), version);
}

test("QR round-trip recovers a short code and a store link", () => {
  assert.equal(decode(qrSvg("LPC")), "LPC");
  const link = "https://example.com/app?pid=craigslist&c=onboarding&af_sub1=click123";
  assert.equal(decode(qrSvg(link)), link);
  const long = "https://example.com/" + "a".repeat(140);
  const svg = qrSvg(long);
  assert.equal(decode(svg), long);
  const grid = gridFromSvg(svg);
  const version = (grid.length - 17) / 4;
  assert.ok(version >= 7);
  assert.equal(readVersion(grid), VERSION_INFO[version]);
});
