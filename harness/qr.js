"use strict";

// Byte-mode QR symbols, error correction M. Enough for a store link and its ad parameters.

const TOTAL = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
];
const EC_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];
const EC_WORDS = [0, 10, 16, 26, 36, 48, 64, 72, 88, 110, 130, 150, 176, 198, 216, 240, 280, 308, 338, 364, 416];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function mul(a, b) {
  if (!a || !b) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function ecPolynomial(degree) {
  let poly = Uint8Array.from([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data, gen) {
  const ecLen = gen.length - 1;
  let result = new Uint8Array(data.length + ecLen);
  result.set(data);
  while (result.length >= gen.length) {
    const coeff = result[0];
    for (let i = 0; i < gen.length; i++) result[i] ^= mul(gen[i], coeff);
    let offset = 0;
    while (offset < result.length && result[offset] === 0) offset++;
    result = result.slice(offset);
  }
  const out = new Uint8Array(gen.length - 1);
  if (result.length) out.set(result, out.length - result.length);
  return out;
}

function codewords(text) {
  const bytes = Array.from(Buffer.from(text, "utf8"));
  let version = 1;
  while (version <= 20) {
    const dataWords = TOTAL[version] - EC_WORDS[version];
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataWords * 8) break;
    version++;
  }
  if (version > 20) throw new Error("Link is too long for a QR code");

  const dataWords = TOTAL[version] - EC_WORDS[version];
  const bits = [];
  function put(value, length) {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  }
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capacity = dataWords * 8;
  for (let i = 0; i < Math.min(4, capacity - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  for (let i = 0; data.length < dataWords; i++) data.push(i % 2 ? 0x11 : 0xec);

  const blocks = EC_BLOCKS[version];
  const group2 = TOTAL[version] % blocks;
  const group1 = blocks - group2;
  const data1 = Math.floor(dataWords / blocks);
  const ecLen = Math.floor(TOTAL[version] / blocks) - data1;
  const gen = ecPolynomial(ecLen);
  const parts = [];
  let offset = 0;
  for (let b = 0; b < blocks; b++) {
    const size = b < group1 ? data1 : data1 + 1;
    const chunk = Uint8Array.from(data.slice(offset, offset + size));
    parts.push({ data: chunk, ec: remainder(chunk, gen) });
    offset += size;
  }
  const out = [];
  const max = Math.max(...parts.map((p) => p.data.length));
  for (let i = 0; i < max; i++) parts.forEach((p) => { if (i < p.data.length) out.push(p.data[i]); });
  for (let i = 0; i < ecLen; i++) parts.forEach((p) => out.push(p.ec[i]));
  return { version, words: out };
}

function alignmentCenters(version) {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const coords = [size - 7];
  for (let i = 1; i < count - 1; i++) coords.push(coords[i - 1] - step);
  coords.push(6);
  return coords.reverse();
}

function encodeModules(text) {
  const { version, words } = codewords(text);
  const size = version * 4 + 17;
  const dark = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  function set(row, col, value) {
    dark[row][col] = Boolean(value);
    reserved[row][col] = true;
  }

  [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([row, col]) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = row + r;
        const x = col + c;
        if (y < 0 || x < 0 || y >= size || x >= size) continue;
        const edge = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(y, x, edge || core);
      }
    }
  });
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const centers = alignmentCenters(version);
  centers.forEach((row) => {
    centers.forEach((col) => {
      if (reserved[row][col]) return;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          set(row + r, col + c, r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
        }
      }
    });
  });

  const formatBits = formatInfo(0);
  writeFormat(dark, reserved, size, formatBits);
  set(size - 8, 8, true);

  let row = size - 1;
  let col = size - 1;
  let dir = -1;
  let bit = 7;
  let index = 0;
  while (col > 0) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (!reserved[row][x]) {
          dark[row][x] = index < words.length && ((words[index] >>> bit) & 1) === 1;
          bit--;
          if (bit < 0) {
            index++;
            bit = 7;
          }
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

  let best = 0;
  let bestScore = Infinity;
  let bestGrid = null;
  for (let mask = 0; mask < 8; mask++) {
    const grid = dark.map((line) => line.slice());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!reserved[y][x] && maskAt(mask, y, x)) grid[y][x] = !grid[y][x];
      }
    }
    writeFormat(grid, null, size, formatInfo(mask));
    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = mask;
      bestGrid = grid;
    }
  }
  return bestGrid;
}

function formatInfo(mask) {
  const data = mask; // level M is 00, so the 5 data bits are just the mask
  let rest = data << 10;
  const gen = 0x537;
  while (bitLength(rest) - 11 >= 0) rest ^= gen << (bitLength(rest) - 11);
  return ((data << 10) | rest) ^ 0x5412;
}

function bitLength(n) {
  let d = 0;
  while (n) {
    d++;
    n >>>= 1;
  }
  return d;
}

function writeFormat(grid, reserved, size, bits) {
  for (let i = 0; i < 15; i++) {
    const on = ((bits >>> i) & 1) === 1;
    let y;
    if (i < 6) y = i;
    else if (i < 8) y = i + 1;
    else y = size - 15 + i;
    grid[y][8] = on;
    if (reserved) reserved[y][8] = true;

    let x;
    if (i < 8) x = size - i - 1;
    else if (i < 9) x = 15 - i;
    else x = 15 - i - 1;
    grid[8][x] = on;
    if (reserved) reserved[8][x] = true;
  }
  grid[size - 8][8] = true;
  if (reserved) reserved[size - 8][8] = true;
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

function penalty(grid) {
  const size = grid.length;
  let points = 0;
  for (let row = 0; row < size; row++) {
    let runCol = 0;
    let runRow = 0;
    let lastCol = null;
    let lastRow = null;
    for (let col = 0; col < size; col++) {
      const down = grid[row][col];
      if (down === lastCol) runCol++;
      else {
        if (runCol >= 5) points += 3 + (runCol - 5);
        lastCol = down;
        runCol = 1;
      }
      const across = grid[col][row];
      if (across === lastRow) runRow++;
      else {
        if (runRow >= 5) points += 3 + (runRow - 5);
        lastRow = across;
        runRow = 1;
      }
    }
    if (runCol >= 5) points += 3 + (runCol - 5);
    if (runRow >= 5) points += 3 + (runRow - 5);
  }
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const sum = grid[row][col] + grid[row][col + 1] + grid[row + 1][col] + grid[row + 1][col + 1];
      if (sum === 0 || sum === 4) points += 3;
    }
  }
  for (let row = 0; row < size; row++) {
    let bitsCol = 0;
    let bitsRow = 0;
    for (let col = 0; col < size; col++) {
      bitsCol = ((bitsCol << 1) & 0x7ff) | (grid[row][col] ? 1 : 0);
      if (col >= 10 && (bitsCol === 0x5d0 || bitsCol === 0x05d)) points += 40;
      bitsRow = ((bitsRow << 1) & 0x7ff) | (grid[col][row] ? 1 : 0);
      if (col >= 10 && (bitsRow === 0x5d0 || bitsRow === 0x05d)) points += 40;
    }
  }
  let dark = 0;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) dark += grid[row][col] ? 1 : 0;
  const k = Math.abs(Math.ceil(dark * 100 / (size * size) / 5) - 10);
  return points + k * 10;
}

function qrSvg(text) {
  const grid = encodeModules(text);
  const n = grid.length;
  const quiet = 4;
  const size = n + quiet * 2;
  let marks = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!grid[y][x]) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < n && grid[y][x + w]) w++;
      marks += `<rect x="${x + quiet}" y="${y + quiet}" width="${w}" height="1"/>`;
      x += w;
    }
  }
  return `<svg class="qr-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code to download the app"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${marks}</g></svg>`;
}

module.exports = { qrSvg };
