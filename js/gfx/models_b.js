// 模型（二）：钻机、熔炉、组装机、研究站、太阳能板
(function () {
'use strict';
const X = G.gfx, C = X.C, PI = Math.PI, TAU = PI * 2;

// 状态灯：工作时绿灯，否则红灯
X.lamp = function (x, y, z) {
  const on = X.b().sph(x, y, z, 0.07, '#7dff7d', { seg: 8 }).build(), off = X.b().sph(x, y, z, 0.07, '#ff5540', { seg: 8 }).build();
  const id = (e, t, L) => L.identity();
  return [{ g: on, glow: true, fn: (e, t, L) => e.working && id(e, t, L) }, { g: off, glow: true, fn: (e, t, L) => !e.working && id(e, t, L) }];
};
function chute(b, z, w) {
  b.box(0, 0.12, z, w, 0.3, 0.34, C.dsteel).box(0, 0.42, z, w + 0.08, 0.05, 0.38, C.yellow);
  b.box(0, 0.16, z - 0.171, w - 0.14, 0.2, 0.01, C.black);
}

X.def('burner-drill', () => {
  const b = X.b(), body = '#86705a';
  b.box(0, 0, 0, 1.86, 0.2, 1.86, C.dark).box(0, 0.2, 0.1, 1.72, 0.4, 1.5, body).box(0, 0.6, 0.1, 1.62, 0.05, 1.4, C.dsteel);
  // 锅炉与烟囱（靠北）
  b.cyl(0.5, 0.2, -0.3, 0.3, 0.85, C.iron, { seg: 12 }).cyl(0.5, 1.05, -0.3, 0.32, 0.06, C.dsteel, { seg: 12 });
  for (const y of [0.75, 0.95]) b.cyl(0.5, y, -0.3, 0.31, 0.04, C.rust, { seg: 12 });
  b.cyl(0.5, 1.11, -0.3, 0.1, 0.6, C.dark, { seg: 8 }).cyl(0.5, 1.68, -0.3, 0.13, 0.06, C.dsteel, { seg: 8 });
  b.box(0.5, 0.26, 0.851, 0.44, 0.26, 0.02, C.dark).box(0.5, 0.3, 0.86, 0.32, 0.16, 0.01, C.black);
  // 井架（靠南，避免挡住北侧的传送带）
  for (const [x, z] of [[-0.78, -0.1], [0.0, -0.1], [-0.78, 0.68], [0.0, 0.68]]) b.box(x, 0.2, z, 0.07, 1.25, 0.07, C.rust);
  b.box(-0.39, 1.4, 0.29, 0.95, 0.09, 0.95, C.dsteel).box(-0.39, 1.49, 0.29, 0.4, 0.18, 0.4, body).box(-0.39, 1.67, 0.29, 0.3, 0.03, 0.3, C.dark);
  b.beam([-0.78, 0.65, 0.68], [0.0, 1.38, 0.68], 0.045, C.rust).beam([0.0, 0.65, 0.68], [-0.78, 1.38, 0.68], 0.045, C.rust);
  b.beam([0.0, 0.65, -0.1], [0.0, 1.38, 0.68], 0.045, C.rust, 0.045);
  chute(b, -0.82, 0.5);
  b.rod([0.3, 0.9, -0.3], [-0.2, 1.45, 0.2], 0.03, C.copper, 6);
  for (const [x, z] of [[-0.75, 0.75], [0.75, 0.75], [0.75, -0.6], [-0.75, -0.6]]) b.cyl(x, 0.65, z, 0.04, 0.03, C.lsteel, { seg: 6 });
  const d = X.b();
  d.cyl(0, 0.5, 0, 0.07, 0.95, C.lsteel, { seg: 8 }).cyl(0, 0.08, 0, 0.05, 0.5, C.steel, { seg: 8, r2: 0.3 });
  for (let k = 0; k < 4; k++) d.box(Math.cos(k * PI / 2) * 0.17, 0.3 + k * 0.05, Math.sin(k * PI / 2) * 0.17, 0.22, 0.05, 0.07, C.dark, { ry: -k * PI / 2 });
  d.gear(0, 1.22, 0, 0.3, 0.1, C.brass, { teeth: 8 });
  return {
    s: b.build(), h: 1.5,
    parts: [{ g: d.build(), fn: (e, t, L) => L.makeRotationY((e.anim || 0) * TAU * 3).setPosition(-0.39, Math.sin((e.anim || 0) * 40) * 0.03, 0.29) }],
    fx: (e, t, F) => { if (e.working) { F.glow(0.5, 0.4, 0.95, 0.8, 1, 0.5, 0.12, 0.9); F.smoke(0.5, 1.8, -0.3, 0.2, 0.3); } },
  };
});

X.def('electric-drill', () => {
  const b = X.b(), body = '#5f7460', hz = C.yellow;
  b.box(0, 0, 0, 2.86, 0.28, 2.86, C.dark).box(0, 0.28, 0, 2.62, 0.2, 2.62, body);
  for (const [x, z] of [[-0.92, -0.92], [0.92, -0.92], [-0.92, 0.92], [0.92, 0.92]]) { // 四角电机舱
    b.box(x, 0.48, z, 0.72, 0.56, 0.72, body).box(x, 1.04, z, 0.64, 0.05, 0.64, C.dsteel);
    for (let k = -1; k <= 1; k++) b.box(x + k * 0.17, 1.09, z, 0.09, 0.02, 0.46, C.black);
    if (z > 0) b.box(x, 0.6, z + 0.361, 0.46, 0.3, 0.01, C.dark).box(x, 0.84, z + 0.365, 0.5, 0.05, 0.02, hz);
  }
  // 中央钻塔：底座环 + 四根立柱 + 顶部轴承座
  b.cyl(0, 0.48, 0, 0.82, 0.26, C.dsteel, { seg: 16 }).cyl(0, 0.74, 0, 0.66, 0.08, C.iron, { seg: 16 });
  for (const [x, z] of [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]]) b.box(x, 0.48, z, 0.11, 1.2, 0.11, C.steel);
  for (const z of [-0.52, 0.52]) b.box(0, 1.6, z, 1.15, 0.09, 0.11, C.steel);
  for (const x of [-0.52, 0.52]) b.box(x, 1.6, 0, 0.11, 0.09, 1.15, C.steel);
  b.beam([-0.52, 0.8, 0.52], [0.52, 1.6, 0.52], 0.05, C.dsteel).beam([0.52, 0.8, 0.52], [-0.52, 1.6, 0.52], 0.05, C.dsteel);
  b.box(0, 1.6, 0, 0.5, 0.12, 0.5, body).box(0, 1.06, 0.58, 0.9, 0.12, 0.02, hz);
  for (let k = -2; k <= 2; k++) b.box(k * 0.18, 1.06, 0.585, 0.07, 0.12, 0.02, C.black, { rz: 0.5 });
  chute(b, -1.3, 0.72);
  b.rod([0.92, 1.0, 0.7], [0.52, 1.55, 0.52], 0.035, C.copper, 6).rod([-0.92, 1.0, 0.7], [-0.52, 1.55, 0.52], 0.035, C.black, 6);
  const d = X.b();
  d.cyl(0, 0.5, 0, 0.12, 1.5, C.lsteel, { seg: 10 }).gear(0, 1.82, 0, 0.5, 0.14, C.brass, { teeth: 12, hole: 0.0 }).cyl(0, 1.89, 0, 0.2, 0.08, C.dsteel, { seg: 10 });
  d.box(0, 1.2, 0, 0.9, 0.12, 0.16, C.lsteel).box(0, 1.2, 0, 0.16, 0.12, 0.9, C.lsteel);
  d.cyl(0, 0.82, 0, 0.42, 0.14, C.steel, { seg: 12, r2: 0.3 });
  for (let k = 0; k < 6; k++) d.box(Math.cos(k * PI / 3) * 0.36, 0.84, Math.sin(k * PI / 3) * 0.36, 0.16, 0.14, 0.06, C.dark, { ry: -k * PI / 3 });
  return {
    s: b.build(), h: 1.9,
    parts: [{ g: d.build(), fn: (e, t, L) => L.makeRotationY((e.anim || 0) * TAU * 2) }, ...X.lamp(1.12, 1.16, 1.12)],
  };
});

// ---------- 熔炉 ----------
function fireGlow(x, y, z, w, h) {
  const g = X.b().box(x, y, z, w, h, 0.02, '#ffb040').box(x, y, z + 0.005, w * 0.6, h * 0.6, 0.02, '#fff0b0').build();
  return { g, glow: true, fn: (e, t, L) => e.working && L.makeScale(1, 0.85 + Math.sin(t * 17 + e.id) * 0.15, 1) };
}
X.def('stone-furnace', () => {
  const b = X.b();
  b.box(0, 0, 0, 1.84, 0.4, 1.74, C.dstone).box(0, 0.4, 0, 1.68, 0.5, 1.58, C.stone).box(0, 0.9, 0, 1.54, 0.34, 1.44, C.dstone).box(0, 1.24, 0, 1.3, 0.14, 1.2, C.stone);
  for (let k = 0; k < 9; k++) { // 凸出的石块
    const x = -0.68 + (k % 5) * 0.34 + (k > 4 ? 0.17 : 0), y = k > 4 ? 0.94 : 0.46;
    if (Math.abs(x) < 0.42 && y < 0.9) continue;
    b.box(x, y, (k > 4 ? 0.72 : 0.79), 0.3, 0.2, 0.03, k % 2 ? C.stone : '#8c8376');
  }
  b.box(0, 0.12, 0.8, 0.84, 0.74, 0.1, C.dstone).box(0, 0.18, 0.846, 0.64, 0.56, 0.02, C.black).box(0, 0.86, 0.82, 0.96, 0.1, 0.14, C.stone);
  b.box(0, 0.1, 0.9, 0.9, 0.06, 0.2, C.dsteel);
  b.cyl(0.36, 1.38, -0.3, 0.27, 0.8, C.dstone, { seg: 8, r2: 0.2 }).cyl(0.36, 2.18, -0.3, 0.24, 0.08, C.stone, { seg: 8 }).cyl(0.36, 2.2, -0.3, 0.15, 0.07, C.black, { seg: 8 });
  return {
    s: b.build(), h: 1.6, parts: [fireGlow(0, 0.22, 0.86, 0.56, 0.42)],
    fx: (e, t, F) => { if (e.working) { F.glow(0, 0.4, 1.0, 1.3, 1, 0.5, 0.1, 0.8); F.smoke(0.36, 2.35, -0.3, 0.3, 0.3); } },
  };
});
X.def('steel-furnace', () => {
  const b = X.b();
  b.box(0, 0, 0, 1.86, 0.2, 1.8, C.dark).box(0, 0.2, 0, 1.7, 1.3, 1.6, C.steel).box(0, 1.5, 0, 1.78, 0.1, 1.68, C.dsteel);
  for (const x of [-0.85, -0.42, 0.42, 0.85]) b.box(x, 0.2, 0.801, 0.07, 1.3, 0.03, C.dsteel);
  b.box(0, 0.75, 0.801, 1.7, 0.07, 0.03, C.dsteel);
  b.box(0, 0.28, 0.82, 0.7, 0.42, 0.04, C.dark).box(0, 0.32, 0.845, 0.56, 0.3, 0.01, C.black);
  b.box(0, 0.95, 0.82, 0.5, 0.3, 0.03, C.dark).box(0, 0.99, 0.84, 0.4, 0.2, 0.01, '#5a2a12');
  for (const x of [-0.4, 0.4]) b.cyl(x, 1.6, -0.35, 0.2, 0.75, C.dsteel, { seg: 10 }).cyl(x, 2.35, -0.35, 0.23, 0.07, C.steel, { seg: 10 }).cyl(x, 2.37, -0.35, 0.14, 0.06, C.black, { seg: 8 });
  b.box(0, 1.6, 0.3, 1.2, 0.16, 0.6, C.iron).rod([-0.75, 1.68, 0.3], [0.75, 1.68, 0.3], 0.05, C.copper, 6);
  b.box(0, 0.2, 0.92, 0.8, 0.06, 0.2, C.dsteel);
  return {
    s: b.build(), h: 1.8, parts: [fireGlow(0, 0.34, 0.86, 0.5, 0.26), fireGlow(0, 1.0, 0.85, 0.36, 0.16)],
    fx: (e, t, F) => { if (e.working) { F.glow(0, 0.5, 1.0, 1.3, 1, 0.55, 0.15, 0.8); F.smoke(-0.4, 2.5, -0.35, 0.28, 0.4); F.smoke(0.4, 2.5, -0.35, 0.28, 0.4); } },
  };
});

// ---------- 组装机 ----------
function assembler(pid, body, trim, two) {
  X.def(pid, () => {
    const b = X.b();
    b.box(0, 0, 0, 2.9, 0.22, 2.9, C.dark).box(0, 0.22, 0, 2.6, 1.1, 2.6, body);
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) b.box(x, 0.22, z, 0.3, 1.24, 0.3, trim);
    b.box(0, 1.32, 0, 2.7, 0.1, 2.7, trim).box(0, 1.42, 0, 2.3, 0.05, 2.3, C.dsteel);
    // 正面：观察窗与进料口
    b.box(0, 0.72, 1.301, 1.5, 0.42, 0.02, '#16242c').box(0, 0.68, 1.31, 1.6, 0.05, 0.04, trim).box(0, 1.14, 1.31, 1.6, 0.05, 0.04, trim);
    for (const x of [-0.78, -0.26, 0.26, 0.78]) b.box(x, 0.7, 1.31, 0.05, 0.46, 0.04, trim);
    b.box(0, 0.22, 1.34, 0.9, 0.3, 0.1, C.yellow).box(0, 0.27, 1.395, 0.74, 0.18, 0.01, C.black);
    for (const x of [-1.0, 1.0]) for (let k = 0; k < 3; k++) b.box(x, 0.36 + k * 0.1, 1.301, 0.34, 0.04, 0.02, C.black);
    // 顶部设备
    b.box(-0.75, 1.47, -0.75, 0.75, 0.42, 0.75, trim).box(-0.75, 1.89, -0.75, 0.62, 0.04, 0.62, C.dark);
    for (let k = -1; k <= 1; k++) b.box(-0.75 + k * 0.17, 1.93, -0.75, 0.08, 0.02, 0.5, C.black);
    b.cyl(0.8, 1.47, -0.8, 0.22, 0.5, C.iron, { seg: 10 }).cyl(0.8, 1.97, -0.8, 0.25, 0.05, C.dsteel, { seg: 10 });
    b.rod([-0.4, 1.6, -0.75], [0.6, 1.6, -0.8], 0.045, C.copper, 6).rod([0.8, 1.75, -0.6], [0.8, 1.52, 0.2], 0.04, C.black, 6);
    b.cyl(0, 1.47, 0.15, 0.2, 0.1, C.dark, { seg: 10 });
    if (two) { b.box(-0.85, 1.47, 0.6, 0.5, 0.3, 0.9, body).box(-0.85, 1.77, 0.6, 0.4, 0.03, 0.8, C.black); b.cyl(0.8, 2.02, -0.8, 0.1, 0.4, C.dark, { seg: 8 }); }
    const g1 = X.b().gear(0, 0, 0, 0.72, 0.12, C.lsteel, { teeth: 12, hole: 0.16 }).cyl(0, -0.02, 0, 0.3, 0.2, C.brass, { seg: 10 }).build();
    const g2 = X.b().gear(0, 0, 0, 0.36, 0.1, C.brass, { teeth: 7, hole: 0.08 }).cyl(0, -0.04, 0, 0.12, 0.2, C.dark, { seg: 8 }).build();
    return {
      s: b.build(), h: 1.7,
      parts: [
        { g: g1, fn: (e, t, L) => L.makeRotationY((e.anim || 0) * 1.6).setPosition(0, 1.6, 0.15) },
        { g: g2, fn: (e, t, L) => L.makeRotationY(-(e.anim || 0) * 1.6 * 12 / 7 + 0.2).setPosition(0.98, 1.6, 0.55) },
        ...X.lamp(1.15, 1.5, 1.15),
      ],
    };
  });
}
assembler('assembler-1', '#868d92', C.dsteel, false);
assembler('assembler-2', '#55799b', '#2f4a63', true);

X.def('lab', () => {
  const b = X.b();
  b.cyl(0, 0, 0, 1.5, 0.3, C.dark, { seg: 8, ry: PI / 8 }).cyl(0, 0.3, 0, 1.4, 0.4, '#777a8c', { seg: 8, ry: PI / 8 }).cyl(0, 0.7, 0, 1.2, 0.12, '#494c5c', { seg: 16 });
  b.sph(0, 0.82, 0, 1.02, '#9fd0e8', { half: true, seg: 20 });
  for (let k = 0; k < 4; k++) b.tor(0, 0.82, 0, 1.03, 0.035, '#494c5c', { ry: k * PI / 4, seg: 24 });
  b.cyl(0, 1.8, 0, 0.14, 0.1, '#494c5c', { seg: 8 });
  for (let k = 0; k < 8; k++) {
    const a = k * PI / 4 + PI / 8, x = Math.cos(a) * 1.33, z = Math.sin(a) * 1.33;
    b.box(x, 0.34, z, 0.5, 0.22, 0.06, k % 2 ? '#1b2a3a' : C.dark, { ry: PI / 2 - a });
  }
  b.box(0, 0.3, 1.36, 0.6, 0.3, 0.16, C.dsteel).box(0, 0.6, 1.36, 0.5, 0.03, 0.12, '#5fd0ff');
  const r = X.b().tor(0, 0, 0, 1.22, 0.05, C.brass, { axis: 'y', seg: 28 });
  for (let k = 0; k < 3; k++) r.sph(Math.cos(k * TAU / 3) * 1.22, 0, Math.sin(k * TAU / 3) * 1.22, 0.12, C.lsteel, { seg: 8 });
  const core = X.b().sph(0, 1.86, 0, 0.1, '#9fe8ff', { seg: 8 }).build();
  return {
    s: b.build(), h: 1.9,
    parts: [
      { g: r.build(), fn: (e, t, L) => { L.makeRotationFromEuler(X.eul.set(0.35, (e.anim || 0) * 1.5, 0, 'YXZ')).setPosition(0, 1.25, 0); return true; } },
      { g: core, glow: true, fn: (e, t, L) => e.working && L.identity() },
    ],
    fx: (e, t, F) => { if (e.working) F.glow(0, 1.5, 0, 2.6 + Math.sin(t * 4 + e.id) * 0.3, 0.3, 0.75, 1, 0.55); },
  };
});

X.def('solar-panel', () => {
  const p = X.b();
  p.box(0, 0, 0, 2.8, 0.08, 2.8, C.steel);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    p.box(-0.9 + i * 0.9, 0.08, -0.9 + j * 0.9, 0.84, 0.02, 0.84, '#1d3a78');
    p.box(-0.9 + i * 0.9, 0.1, -0.9 + j * 0.9, 0.02, 0.006, 0.84, '#6f8fd0').box(-0.9 + i * 0.9, 0.1, -0.9 + j * 0.9, 0.84, 0.006, 0.02, '#6f8fd0');
  }
  p.tf(0, 0.62, 0, { rx: 0.26 });
  const b = X.b();
  b.box(0, 0, 0, 2.2, 0.08, 2.2, C.dark);
  for (const [x, z, h] of [[-1.1, -1.1, 0.95], [1.1, -1.1, 0.95], [-1.1, 1.1, 0.38], [1.1, 1.1, 0.38]]) b.box(x, 0, z, 0.1, h, 0.1, C.dsteel);
  b.box(0, 0.08, 0, 0.5, 0.3, 0.5, C.dsteel).beam([0, 0.3, 0.3], [0, 0.55, -0.6], 0.06, C.dsteel);
  b.join(p);
  return { s: b.build(), h: 1.0 };
});
})();
