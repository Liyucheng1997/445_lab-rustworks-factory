// 模型（一）：箱子、传送带、地下带、分流器、机械臂、管道、电线杆
(function () {
'use strict';
const X = G.gfx, T = X.T, PI = Math.PI;
const defs = X.modelDefs = {};
X.def = (pid, fn) => { defs[pid] = fn; };
const C = X.C = {
  steel: '#8d959c', dsteel: '#535a60', lsteel: '#b9c0c6', iron: '#70777d', dark: '#2b2e31', black: '#141516',
  rust: '#8b5636', brass: '#b8923c', copper: '#c4733a', wood: '#94663a', dwood: '#5f3f22', lwood: '#b18250',
  stone: '#a0968a', dstone: '#6f665b', yellow: '#d6a11e', red: '#b33a2e', teal: '#2e9e8d', blue: '#3d6ea6',
  purple: '#8a55b0', orange: '#d67f26', glass: '#8cc4e0', white: '#d9dde0', green: '#4f9c4c', rubber: '#303132', fire: '#ffb347',
};

// ---------- 箱子 ----------
X.def('wooden-chest', () => {
  const b = X.b();
  b.box(0, 0, 0, 0.78, 0.5, 0.68, C.wood).box(0, 0.5, 0, 0.84, 0.1, 0.74, C.lwood);
  for (const y of [0.16, 0.32]) b.box(0, y, 0.341, 0.78, 0.02, 0.01, C.dwood);
  for (const x of [-0.3, 0.3]) b.box(x, 0, 0, 0.07, 0.62, 0.76, C.dsteel);
  b.box(0, 0.36, 0.36, 0.12, 0.16, 0.04, C.brass);
  return { s: b.build(), h: 0.6 };
});
function metalChest(body, trim, ribs) {
  const b = X.b();
  b.box(0, 0, 0, 0.8, 0.52, 0.7, body).box(0, 0.52, 0, 0.86, 0.1, 0.76, trim);
  for (const [x, z] of [[-0.38, -0.33], [0.38, -0.33], [-0.38, 0.33], [0.38, 0.33]]) b.box(x, 0, z, 0.08, 0.56, 0.08, trim);
  b.box(0, 0.02, 0, 0.84, 0.06, 0.74, trim);
  if (ribs) for (const x of [-0.19, 0, 0.19]) b.box(x, 0.08, 0.351, 0.04, 0.42, 0.02, trim);
  b.box(0, 0.34, 0.37, 0.16, 0.14, 0.05, C.brass).box(0, 0.62, 0, 0.3, 0.03, 0.08, C.dark);
  return { s: b.build(), h: 0.62 };
}
X.def('iron-chest', () => metalChest(C.iron, C.dsteel, false));
X.def('steel-chest', () => metalChest(C.lsteel, C.steel, true));

// ---------- 传送带 ----------
function beltTex(col) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#34363a'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  g.fillStyle = '#232427'; g.fillRect(0, 0, 64, 3);
  g.strokeStyle = col; g.lineWidth = 7; g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(12, 46); g.lineTo(32, 24); g.lineTo(52, 46); g.stroke();
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, 3); t.anisotropy = 4;
  return t;
}
X.buildBelts = function () {
  X.belt = {};
  for (const [pid, rail, chev] of [['belt', '#9a8a52', '#e2b93b'], ['fast-belt', '#9a4a40', '#e8563e']]) {
    const tex = beltTex(chev), mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const fs = X.b(), ss = X.b();
    for (const x of [-0.45, 0.45]) fs.box(x, 0, 0, 0.09, 0.25, 1, rail).box(x, 0.25, 0, 0.11, 0.03, 1, C.dsteel);
    fs.box(0, 0.03, 0, 0.82, 0.13, 1, C.dark);
    for (const z of [-0.3, 0.3]) fs.box(0, 0, z, 0.96, 0.08, 0.1, C.black);
    ss.quad([-0.4, 0.18, 0.5], [0.4, 0.18, 0.5], [0.4, 0.18, -0.5], [-0.4, 0.18, -0.5], [0, 1, 0], '#fff', [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const o = { tex, speed: G.PROTOS[pid].speed, S: new X.Pool(fs.build(), X.matMain), sS: new X.Pool(ss.build(), mat, { shadow: false }) };
    for (const [k, px, a1] of [['A', -0.5, 0], ['B', 0.5, PI]]) {
      const f = X.b(), s = X.b();
      f.ring(px, -0.5, 0.01, 0.1, PI / 2, a1, 0, 0.25, rail).ring(px, -0.5, 0.9, 0.99, PI / 2, a1, 0, 0.25, rail);
      f.ring(px, -0.5, 0.0, 0.11, PI / 2, a1, 0.25, 0.28, C.dsteel).ring(px, -0.5, 0.89, 1.0, PI / 2, a1, 0.25, 0.28, C.dsteel);
      f.ring(px, -0.5, 0.1, 0.9, PI / 2, a1, 0.03, 0.16, C.dark);
      s.ring(px, -0.5, 0.1, 0.9, PI / 2, a1, 0.18, 0.18, '#fff', 8, true);
      o[k] = new X.Pool(f.build(), X.matMain); o['s' + k] = new X.Pool(s.build(), mat, { shadow: false });
    }
    X.belt[pid] = o;
  }
  X.belt['underground-belt'] = X.belt['splitter'] = X.belt['belt'];
};
// 地下带：入口罩在前半（北），出口罩在后半（南）
function hood(sign) { // sign=-1 罩在北侧；开口朝向带子露出的一侧
  const b = X.b(), zo = sign * 0.02, zb = sign * 0.49; // 开口处 / 背面
  for (const x of [-0.44, 0.44]) { // 侧墙：开口处高，向后逐级降低
    b.box(x, 0, (zo + sign * 0.12), 0.11, 0.58, 0.24, C.dsteel).box(x, 0, (zo + sign * 0.33), 0.11, 0.4, 0.2, C.dsteel);
  }
  b.box(0, 0.395, (zo + zb) / 2, 0.99, 0.07, 0.6, C.iron, { rx: sign * 0.626 }); // 斜顶
  b.box(0, 0.56, zo, 0.99, 0.09, 0.07, C.yellow);                    // 开口上沿警示条
  for (const x of [-0.3, 0, 0.3]) b.box(x, 0.585, zo + sign * 0.001, 0.1, 0.092, 0.072, C.black);
  b.box(0, 0.16, zo + sign * 0.06, 0.78, 0.4, 0.02, C.black);        // 洞口
  b.box(0, 0, zb - sign * 0.03, 0.99, 0.26, 0.06, C.dsteel);         // 背板
  b.box(0, 0.47, zo + sign * 0.22, 0.5, 0.03, 0.22, C.dark, { rx: sign * 0.626 });
  return b.build();
}
X.def('underground-belt', () => ({ s: hood(-1), alt: hood(1), h: 0.6 }));
X.def('splitter', () => {
  const b = X.b();
  b.box(0, 0, 0, 1.98, 0.14, 0.5, C.dark);
  for (const x of [-0.94, 0, 0.94]) b.box(x, 0, 0, 0.12, 0.56, 0.5, C.dsteel);
  b.box(0, 0.42, 0, 1.98, 0.16, 0.5, C.steel).box(0, 0.58, 0, 1.7, 0.05, 0.34, C.dsteel);
  b.box(0, 0.44, 0.251, 1.9, 0.06, 0.01, C.yellow).box(0, 0.44, -0.251, 1.9, 0.06, 0.01, C.yellow);
  for (const x of [-0.5, 0.5]) b.cyl(x, 0.63, 0, 0.12, 0.08, C.brass, { seg: 8 });
  b.box(0, 0.63, 0, 0.9, 0.05, 0.06, C.dark);
  return { s: b.build(), h: 0.7 };
});

// ---------- 机械臂 ----------
function inserter(pid, col, r) {
  X.def(pid, () => {
    const b = X.b();
    b.box(0, 0, 0, 0.64, 0.1, 0.64, C.dark).box(0, 0.1, 0, 0.5, 0.06, 0.5, C.dsteel);
    b.cyl(0, 0.16, 0, 0.2, 0.2, C.iron, { seg: 10 }).cyl(0, 0.36, 0, 0.23, 0.05, col, { seg: 10 });
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) b.cyl(x, 0.1, z, 0.04, 0.04, C.lsteel, { seg: 6 });
    const a = X.b(), ex = r > 1 ? 0.8 : 0.4, ey = r > 1 ? 1.2 : 0.95, hx = r * 0.92, hy = 0.5;
    a.cyl(0, 0.41, 0, 0.16, 0.12, C.dsteel, { seg: 10 });
    a.box(0, 0.45, 0, 0.2, 0.2, 0.24, col);
    a.beam([0, 0.55, 0], [ex, ey, 0], 0.11, col, 0.14);
    a.cyl(ex, ey, 0, 0.09, 0.2, C.dsteel, { axis: 'z', seg: 8 });
    a.beam([ex, ey, 0], [hx, hy + 0.12, 0], 0.08, C.lsteel, 0.1);
    a.rod([0.1, 0.62, 0.09], [ex, ey - 0.05, 0.09], 0.02, C.black, 5);
    a.box(hx, hy + 0.04, 0, 0.14, 0.12, 0.2, C.dsteel);
    for (const z of [-0.1, 0.1]) a.box(hx, hy - 0.14, z, 0.05, 0.2, 0.03, C.dark, { rx: z * 2 });
    return {
      s: b.build(), h: 0.9, reach: r,
      parts: [{ g: a.build(), world: true, fn: (e, t, L) => { const d = e.dir, ang = Math.atan2(-G.DY[d], -G.DX[d]) + PI * (e.ang || 0); L.makeRotationY(-ang).setPosition(e.x + 0.5, 0, e.y + 0.5); return true; } }],
    };
  });
}
inserter('burner-inserter', C.rust, 1); inserter('inserter', C.teal, 1); inserter('long-inserter', C.purple, 2); inserter('fast-inserter', C.orange, 1);

// ---------- 管道 ----------
X.def('pipe', () => {
  const b = X.b(), a = X.b();
  b.cyl(0, 0, 0, 0.1, 0.2, C.dark, { seg: 8 }).sph(0, 0.32, 0, 0.21, C.steel);
  b.cyl(0, 0.5, 0, 0.08, 0.05, C.dsteel, { seg: 8 });
  a.cyl(0, 0.32, -0.25, 0.15, 0.5, C.steel, { axis: 'z', seg: 12 });
  a.cyl(0, 0.32, -0.46, 0.2, 0.07, C.dsteel, { axis: 'z', seg: 12 });
  return { s: b.build(), arm: a.build(), h: 0.55 };
});

// ---------- 电线杆 ----------
X.def('small-pole', () => {
  const b = X.b();
  b.cyl(0, 0, 0, 0.12, 0.12, C.dstone, { seg: 8 }).cyl(0, 0, 0, 0.075, 2.35, C.wood, { seg: 8, r2: 0.06 });
  b.box(0, 2.08, 0, 0.92, 0.08, 0.1, C.dwood);
  b.beam([0, 1.8, 0], [0.3, 2.08, 0], 0.04, C.dwood).beam([0, 1.8, 0], [-0.3, 2.08, 0], 0.04, C.dwood);
  for (const x of [-0.38, 0.38]) b.cyl(x, 2.16, 0, 0.045, 0.14, C.white, { seg: 8 }).cyl(x, 2.3, 0, 0.03, 0.04, C.copper, { seg: 6 });
  return { s: b.build(), h: 2.4, wire: [[-0.38, 2.32], [0.38, 2.32]] };
});
X.def('medium-pole', () => {
  const b = X.b();
  b.box(0, 0, 0, 0.4, 0.1, 0.4, C.dark).box(0, 0.1, 0, 0.16, 3.0, 0.16, C.steel);
  for (let y = 0.5; y < 3; y += 0.6) b.box(0, y, 0, 0.2, 0.05, 0.2, C.dsteel);
  for (const y of [2.6, 3.0]) { b.box(0, y, 0, y > 2.8 ? 1.2 : 0.8, 0.07, 0.09, C.dsteel); }
  for (const x of [-0.52, 0.52]) b.cyl(x, 3.07, 0, 0.05, 0.16, C.white, { seg: 8 }).cyl(x, 3.23, 0, 0.03, 0.04, C.copper, { seg: 6 });
  for (const x of [-0.32, 0.32]) b.cyl(x, 2.67, 0, 0.04, 0.12, C.white, { seg: 8 });
  b.box(0.12, 1.0, 0, 0.12, 0.3, 0.2, C.dark);
  return { s: b.build(), h: 3.2, wire: [[-0.52, 3.25], [0.52, 3.25]] };
});
})();
