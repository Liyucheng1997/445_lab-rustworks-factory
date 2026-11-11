// 地图生成与地形烘焙
'use strict';
G.W = 256; G.H = 256;
G.CHUNK = 32; G.BAKE = 16; // 每格烘焙像素
G.ORE_ITEMS = [null, 'iron-ore', 'copper-ore', 'coal', 'stone'];
G.ORE_COLORS = [null, ['#4d6a86', '#7d9bb5'], ['#a8562a', '#de8c4f'], ['#1d1d1d', '#454545'], ['#9c8f72', '#cfc3a3']];

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
G.hash2 = hash2;
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) {
  let t = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 31) * amp; n += amp; amp *= 0.5; f *= 2; }
  return t / n;
}

G.newWorld = function (seed) {
  const W = G.W, H = G.H, N = W * H;
  const w = {
    seed, tile: new Uint8Array(N), ore: new Uint8Array(N), oreAmt: new Int32Array(N),
    deco: new Uint8Array(N), grid: new Array(N).fill(null),
  };
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const h = fbm(x / 40, y / 40, seed);
    const m = fbm(x / 25, y / 25, seed + 99);
    const dStart = Math.hypot(x - cx, y - cy);
    let t = m > 0.58 ? 3 : (m < 0.38 ? 1 : 0);
    if (h < 0.3 && dStart > 18) t = 2;
    w.tile[i] = t;
    if (t !== 2) {
      const tr = fbm(x / 14, y / 14, seed + 7);
      if (tr > 0.6 && hash2(x, y, seed + 3) < (tr - 0.55) * 1.6 && dStart > 7) w.deco[i] = 1;
      else if (hash2(x, y, seed + 5) < 0.006 && dStart > 7) w.deco[i] = 2;
    }
  }
  // 起点附近的湖
  const lake = (lx, ly, r) => {
    for (let y = ly - r - 2; y <= ly + r + 2; y++) for (let x = lx - r - 2; x <= lx + r + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - lx, y - ly) + (fbm(x / 4, y / 4, seed + 11) - 0.5) * 3;
      if (d < r) { const i = y * W + x; w.tile[i] = 2; w.deco[i] = 0; }
    }
  };
  lake(cx + 22, cy + 12, 6);
  // 矿区
  const patch = (px, py, r, type, rich) => {
    for (let y = py - r - 3; y <= py + r + 3; y++) for (let x = px - r - 3; x <= px + r + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (w.tile[i] === 2) continue;
      const d = Math.hypot(x - px, y - py) + (fbm(x / 5, y / 5, seed + type * 17) - 0.5) * 5;
      if (d < r) {
        w.ore[i] = type; w.deco[i] = 0;
        w.oreAmt[i] = Math.floor(rich * (1.2 - d / r) * (0.8 + hash2(x, y, seed) * 0.4)) + 150;
      }
    }
  };
  patch(cx + 13, cy - 8, 8, 1, 1800);
  patch(cx - 14, cy - 9, 7, 2, 1600);
  patch(cx + 1, cy + 16, 6, 3, 1500);
  patch(cx - 15, cy + 11, 5, 4, 1200);
  let rs = seed;
  const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < 34; k++) {
    const a = rnd() * Math.PI * 2, dist = 40 + rnd() * 90;
    const px = Math.round(cx + Math.cos(a) * dist), py = Math.round(cy + Math.sin(a) * dist);
    patch(px, py, 5 + rnd() * 8, 1 + (k % 4), 2000 + dist * 25);
  }
  // 起点空地
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) w.deco[y * W + x] = 0;
  return w;
};

G.inMap = (x, y) => x >= 0 && y >= 0 && x < G.W && y < G.H;
G.entAt = (x, y) => (G.inMap(x, y) ? G.world.grid[y * G.W + x] : null);

// 区块脏标记（矿石耗尽、树木被砍时通知渲染层重建）
G.dirtyChunks = new Set();
G.markTileDirty = (x, y) => G.dirtyChunks.add(((y / G.CHUNK) | 0) * 1000 + ((x / G.CHUNK) | 0));
