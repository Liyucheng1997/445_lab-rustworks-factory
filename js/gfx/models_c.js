// 模型（三）：锅炉、蒸汽机、抽水泵、玩家、物品
(function () {
'use strict';
const X = G.gfx, T = X.T, C = X.C, PI = Math.PI, TAU = PI * 2;
X.eul = new T.Euler();
function flange(b, x, y, z, axis) { b.cyl(x, y, z, 0.15, 0.3, C.steel, { axis, seg: 12 }).cyl(x, y, z, 0.2, 0.08, C.dsteel, { axis, seg: 12 }); }

X.def('boiler', () => {
  const b = X.b(), tank = '#a39686';
  b.box(0, 0, 0, 2.9, 0.14, 1.9, C.dark);
  b.cyl(0, 0.8, -0.25, 0.62, 2.5, tank, { axis: 'x', seg: 18 });
  for (const x of [-1.25, 1.25]) b.cyl(x, 0.8, -0.25, 0.66, 0.08, C.dsteel, { axis: 'x', seg: 18 });
  for (const x of [-0.6, 0.6]) b.cyl(x, 0.8, -0.25, 0.64, 0.06, C.rust, { axis: 'x', seg: 18 });
  for (const x of [-0.9, 0.9]) b.box(x, 0.14, -0.25, 0.2, 0.4, 1.0, C.dsteel);
  b.box(0, 0.14, 0.5, 1.4, 0.82, 0.74, '#6e5c4b').box(0, 0.96, 0.5, 1.5, 0.07, 0.8, C.dsteel);
  b.box(0, 0.24, 0.872, 0.8, 0.46, 0.02, C.dark).box(0, 0.3, 0.885, 0.62, 0.3, 0.01, C.black);
  b.cyl(0, 0.32, 0.5, 0.15, 2.96, C.steel, { axis: 'x', seg: 12 });
  for (const x of [-1.44, 1.44]) b.cyl(x, 0.32, 0.5, 0.2, 0.1, C.dsteel, { axis: 'x', seg: 12 });
  flange(b, 0, 0.32, -0.86, 'z');
  b.rod([0, 0.32, -0.75], [0, 1.2, -0.6], 0.09, C.steel, 8);
  b.cyl(0.95, 1.3, -0.25, 0.17, 0.85, C.dark, { seg: 10 }).cyl(0.95, 2.15, -0.25, 0.2, 0.06, C.dsteel, { seg: 10 });
  b.cyl(-0.5, 1.4, -0.25, 0.14, 0.14, C.brass, { seg: 10 }).cyl(-0.5, 1.5, 0, 0.13, 0.04, C.white, { axis: 'z', seg: 12 });
  const glow = X.b().box(0, 0.32, 0.89, 0.58, 0.26, 0.02, '#ffb040').box(0, 0.36, 0.895, 0.36, 0.14, 0.02, '#fff0b0').build();
  return {
    s: b.build(), h: 1.6,
    parts: [{ g: glow, glow: true, fn: (e, t, L) => e.working && L.makeScale(1, 0.85 + Math.sin(t * 15 + e.id) * 0.15, 1) }],
    fx: (e, t, F) => { if (e.working) { F.glow(0, 0.4, 1.05, 1.4, 1, 0.5, 0.1, 0.8); F.smoke(0.95, 2.3, -0.25, 0.3, 0.3); } },
  };
});

X.def('steam-engine', () => {
  const b = X.b(), body = '#8f979d';
  b.box(0, 0, 0, 2.8, 0.18, 4.8, C.dark);
  b.cyl(0, 0.32, 0, 0.15, 4.96, C.steel, { axis: 'z', seg: 12 });
  for (const z of [-2.44, 2.44]) b.cyl(0, 0.32, z, 0.2, 0.1, C.dsteel, { axis: 'z', seg: 12 });
  // 汽缸
  b.cyl(-0.2, 1.0, -1.05, 0.72, 2.2, body, { axis: 'z', seg: 18 });
  for (const z of [-2.15, -1.05, 0.05]) b.cyl(-0.2, 1.0, z, 0.77, 0.1, C.dsteel, { axis: 'z', seg: 18 });
  for (const z of [-1.8, -0.3]) b.box(-0.2, 0.18, z, 1.3, 0.4, 0.25, C.dsteel);
  b.cyl(-0.2, 1.72, -1.05, 0.16, 0.3, C.brass, { seg: 10 }).cyl(-0.2, 2.0, -1.05, 0.08, 0.3, C.dark, { seg: 8 });
  b.rod([-0.2, 0.4, -2.3], [-0.2, 0.9, -2.2], 0.1, C.steel, 8);
  // 发电机
  b.box(-0.1, 0.18, 1.45, 2.0, 0.5, 1.7, '#566675');
  b.cyl(-0.1, 1.05, 1.45, 0.82, 1.5, '#566675', { axis: 'z', seg: 18 });
  for (const z of [0.95, 1.45, 1.95]) b.cyl(-0.1, 1.05, z, 0.86, 0.22, C.copper, { axis: 'z', seg: 18 });
  for (const z of [0.68, 2.22]) b.cyl(-0.1, 1.05, z, 0.88, 0.06, C.dsteel, { axis: 'z', seg: 18 });
  for (let k = -2; k <= 2; k++) b.box(-0.1 + k * 0.22, 1.86, 1.45, 0.07, 0.1, 1.2, C.dark);
  b.box(0.95, 0.18, 2.0, 0.4, 0.8, 0.5, C.dark).box(0.95, 0.72, 2.255, 0.26, 0.16, 0.01, '#5fd08a');
  b.box(1.1, 0.18, 0.25, 0.3, 0.8, 0.2, C.dsteel);
  const wheel = X.b().gear(0, 0, 0, 0.88, 0.16, C.iron, { axis: 'x', teeth: 16, tooth: 0.9, hole: 0.5 }).cyl(0, 0, 0, 0.16, 0.3, C.brass, { axis: 'x', seg: 10 });
  for (let k = 0; k < 3; k++) wheel.box(0, -0.06, 0, 0.08, 0.12, 1.2, C.dsteel, { rx: k * PI / 3 });
  const rod = X.b().box(0, -0.05, 0, 0.1, 0.1, 1.5, C.lsteel).box(0, -0.1, -0.7, 0.2, 0.2, 0.2, C.brass).build();
  return {
    s: b.build(), h: 2.0,
    parts: [
      { g: wheel.build(), fn: (e, t, L) => L.makeRotationX((e.anim || 0) * TAU * 2.5).setPosition(1.1, 1.0, 0.25) },
      { g: rod, fn: (e, t, L) => L.makeTranslation(0.85, 1.0, -0.7 + Math.sin((e.anim || 0) * TAU * 2.5) * 0.3) },
    ],
    fx: (e, t, F) => { if (e.working) F.smoke(-0.2, 2.35, -1.05, 0.2, 0.5, 0.9); },
  };
});

X.def('offshore-pump', () => {
  const b = X.b();
  b.box(0, 0, 0.05, 0.66, 0.12, 0.7, C.dark).box(0, 0.12, 0.08, 0.54, 0.44, 0.5, '#4d7fa5');
  b.cyl(0, 0.56, 0.08, 0.2, 0.2, C.dsteel, { seg: 10 }).cyl(0, 0.76, 0.08, 0.12, 0.08, C.brass, { seg: 8 });
  b.cyl(0, 0.32, -0.36, 0.15, 0.3, C.steel, { axis: 'z', seg: 12 }).cyl(0, 0.32, -0.46, 0.2, 0.08, C.dsteel, { axis: 'z', seg: 12 });
  b.rod([0, 0.34, 0.3], [0, 0.0, 0.85], 0.11, C.steel, 8).box(0, 0.36, 0.335, 0.3, 0.14, 0.02, C.black);
  return { s: b.build(), h: 0.85 };
});

// ---------- 玩家 ----------
X.buildPlayer = function () {
  const suit = '#c9772b', dk = '#3a3f45', g = new T.Group();
  const mk = (b, x, y, z) => { const m = new T.Mesh(b.build(), X.matMain); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const torso = X.b().box(0, 0, 0, 0.4, 0.4, 0.24, suit).box(0, 0, 0, 0.42, 0.07, 0.26, dk).box(0, 0.2, -0.125, 0.22, 0.14, 0.02, dk)
    .box(0, 0.24, -0.135, 0.06, 0.05, 0.01, '#6fe0ff').box(0, 0.04, 0.19, 0.3, 0.36, 0.15, C.dsteel).box(0, 0.4, 0.19, 0.24, 0.05, 0.12, C.dark)
    .cyl(0.1, 0.42, 0.2, 0.012, 0.3, C.dark, { seg: 5 }).box(0, 0.4, 0, 0.5, 0.06, 0.2, suit);
  const head = X.b().sph(0, 0, 0, 0.17, '#e4e8ea', { seg: 14 }).box(0, -0.04, -0.13, 0.22, 0.11, 0.08, '#18222e').box(0, -0.16, 0, 0.2, 0.05, 0.2, dk);
  const limb = (w, h, d, c, c2) => X.b().box(0, -h, 0, w, h, d, c).box(0, -h, 0, w + 0.02, h * 0.28, d + 0.02, c2);
  const P = { g, torso: mk(torso, 0, 0.42, 0), head: mk(head, 0, 1.02, 0) };
  P.legL = mk(limb(0.14, 0.42, 0.16, suit, dk), -0.1, 0.42, 0); P.legR = mk(limb(0.14, 0.42, 0.16, suit, dk), 0.1, 0.42, 0);
  P.armL = mk(limb(0.1, 0.36, 0.12, suit, dk), -0.26, 0.8, 0); P.armR = mk(limb(0.1, 0.36, 0.12, suit, dk), 0.26, 0.8, 0);
  X.scene.add(g);
  return P;
};

// ---------- 物品模型（用于图标） ----------
X.itemModel = function (id) {
  const it = G.ITEMS[id], c = it.c, b = X.b();
  switch (it.icon) {
    case 'ore':
      for (const [x, y, z, r] of [[-0.2, 0.2, 0.15, 0.3], [0.25, 0.22, 0.1, 0.32], [0, 0.2, -0.25, 0.28], [0.05, 0.55, 0, 0.24], [-0.3, 0.12, -0.2, 0.16]])
        b.sph(x, y, z, r, c, { ico: 0, ry: x * 9 + z * 5, sy: 0.85 });
      return { g: b.build(), flat: true };
    case 'plate':
      b.box(0, 0, 0, 0.9, 0.08, 0.6, c).box(0.04, 0.08, -0.02, 0.9, 0.08, 0.6, c, { ry: 0.16 }).box(-0.02, 0.16, 0.02, 0.9, 0.08, 0.6, c, { ry: -0.08 });
      return { g: b.build() };
    case 'brick':
      b.box(-0.24, 0, 0, 0.44, 0.2, 0.26, c).box(0.24, 0, 0.02, 0.44, 0.2, 0.26, c).box(0, 0.2, 0, 0.44, 0.2, 0.26, c, { ry: 0.1 });
      return { g: b.build() };
    case 'gear':
      b.gear(0, 0.3, 0, 0.46, 0.14, c, { teeth: 10, hole: 0.14, rx: -0.55 });
      return { g: b.build() };
    case 'cable':
      for (let k = 0; k < 3; k++) b.tor(0, 0.08 + k * 0.11, 0, 0.3, 0.065, c, { axis: 'y', seg: 18 });
      b.cyl(0, 0, 0, 0.14, 0.42, '#5a4a3a', { seg: 10 }).cyl(0, 0, 0, 0.38, 0.03, '#5a4a3a', { seg: 12 }).cyl(0, 0.4, 0, 0.38, 0.03, '#5a4a3a', { seg: 12 });
      return { g: b.build() };
    case 'circuit':
      b.box(0, 0, 0, 0.9, 0.05, 0.66, '#2f8f44').box(0, 0.05, 0, 0.34, 0.07, 0.34, '#1b1b1d');
      for (let k = 0; k < 4; k++) b.box(-0.18 + k * 0.12, 0.05, 0.2, 0.05, 0.03, 0.08, '#d8c060').box(-0.18 + k * 0.12, 0.05, -0.2, 0.05, 0.03, 0.08, '#d8c060');
      b.cyl(-0.32, 0.05, 0.2, 0.06, 0.12, '#c44', { seg: 8 }).cyl(0.32, 0.05, -0.18, 0.06, 0.1, '#46c', { seg: 8 }).box(0.3, 0.05, 0.2, 0.16, 0.05, 0.1, '#d8c060');
      return { g: b.build() };
    case 'pack':
      b.box(0, 0, 0, 0.56, 0.74, 0.14, '#e3e5e6').box(0, 0.4, 0.075, 0.5, 0.22, 0.01, c).box(0, 0.4, 0, 0.6, 0.06, 0.16, c);
      for (let k = 0; k < 4; k++) b.box(-0.18 + k * 0.12, 0.05, 0.075, 0.07, 0.2, 0.01, '#d4b04a');
      b.box(0, 0.74, 0, 0.4, 0.05, 0.1, '#888');
      b.tf(0, 0, 0, { rx: -0.35, ry: 0.5 });
      return { g: b.build() };
    case 'wood':
      for (const [y, z] of [[0.14, -0.15], [0.14, 0.15], [0.38, 0]]) b.cyl(0, y, z, 0.14, 0.9, c, { axis: 'x', seg: 10 }).cyl(0.451, y, z, 0.11, 0.01, '#d9b07a', { axis: 'x', seg: 10 });
      return { g: b.build() };
    case 'pipe':
      b.cyl(0, 0.2, 0, 0.15, 0.8, C.steel, { axis: 'x', seg: 12 });
      for (const x of [-0.38, 0.38]) b.cyl(x, 0.2, 0, 0.2, 0.08, C.dsteel, { axis: 'x', seg: 12 });
      return { g: b.build() };
  }
  return null;
};
})();
