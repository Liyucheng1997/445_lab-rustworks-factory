// 模型（四）：剧情相关——登陆舱残骸、求救信标
(function () {
'use strict';
const X = G.gfx, C = X.C, PI = Math.PI, TAU = PI * 2;

X.def('wreck', () => {
  const b = X.b(), hull = '#bdb7aa', burn = '#3b332c', stripe = '#c8622a';
  b.cyl(0, 0, 0.1, 1.75, 0.04, '#33271b', { seg: 16, sz: 0.62 });            // 撞击坑
  b.cyl(0.1, 0.04, 0.1, 1.2, 0.03, '#241b13', { seg: 14, sz: 0.6 });
  // 舱体：斜插进地里
  b.cyl(-0.15, 0.56, 0, 0.62, 1.9, hull, { axis: 'x', seg: 18, rz: 0.13 });
  b.cyl(0.98, 0.42, 0, 0.62, 0.55, burn, { axis: 'x', seg: 18, r2: 0.22, rz: 0.13 });   // 烧焦的头锥
  b.cyl(-0.45, 0.6, 0, 0.64, 0.2, stripe, { axis: 'x', seg: 18, rz: 0.13 });
  b.cyl(0.35, 0.5, 0, 0.635, 0.12, C.dsteel, { axis: 'x', seg: 18, rz: 0.13 });
  b.cyl(-1.12, 0.69, 0, 0.5, 0.2, C.dark, { axis: 'x', seg: 14, rz: 0.13 });           // 尾部引擎
  b.cyl(-1.26, 0.71, 0, 0.36, 0.14, C.black, { axis: 'x', seg: 12, rz: 0.13 });
  // 舱门掀开，露出里面
  b.box(-0.1, 1.08, 0.05, 0.7, 0.06, 0.5, C.black, { rz: 0.13 });
  b.box(-0.1, 1.2, -0.4, 0.74, 0.05, 0.56, hull, { rx: -1.0 });
  b.box(0.3, 0.2, 0.62, 0.5, 0.36, 0.02, '#16242c');                                     // 舷窗
  // 断掉的尾翼和散落的碎片
  b.beam([-0.9, 0.9, -0.3], [-1.35, 1.35, -0.75], 0.06, stripe, 0.4);
  b.box(-1.2, 0.02, 0.75, 0.6, 0.05, 0.34, hull, { ry: 0.5, rz: 0.1 });
  b.box(1.1, 0.02, -0.7, 0.3, 0.06, 0.22, C.dsteel, { ry: -0.7 });
  b.box(0.6, 0.02, 0.85, 0.2, 0.08, 0.14, burn, { ry: 0.3 });
  b.rod([-0.6, 0.3, 0.6], [-0.95, 0.02, 0.95], 0.03, C.copper, 5);
  for (const [x, z] of [[0.75, 0.3], [0.9, -0.2], [0.6, -0.45]]) b.box(x, 0.5, z * 1.2, 0.3, 0.3, 0.03, burn, { ry: z, rz: 0.13 });
  return {
    s: b.build(), h: 1.0,
    fx: (e, t, F) => {
      F.smoke(0.95, 0.75, 0, 0.26, 0.55);
      F.glow(1.0, 0.3, 0.25, 0.9, 1, 0.45, 0.1, 0.25 + 0.12 * Math.sin(t * 7));
    },
  };
});

X.def('beacon', () => {
  const b = X.b(), body = '#5d6470', hi = '#e7b23c';
  b.cyl(0, 0, 0, 1.45, 0.26, C.dark, { seg: 8, ry: PI / 8 }).cyl(0, 0.26, 0, 1.3, 0.3, body, { seg: 8, ry: PI / 8 }).cyl(0, 0.56, 0, 1.05, 0.1, C.dsteel, { seg: 16 });
  for (let k = 0; k < 4; k++) { // 四组储能罐
    const a = k * PI / 2 + PI / 4, x = Math.cos(a) * 0.95, z = Math.sin(a) * 0.95;
    b.cyl(x, 0.56, z, 0.24, 0.6, '#3d5f86', { seg: 12 }).cyl(x, 1.16, z, 0.26, 0.06, C.dsteel, { seg: 12 }).cyl(x, 0.8, z, 0.25, 0.08, hi, { seg: 12 });
    b.rod([x, 1.1, z], [x * 0.15, 1.7, z * 0.15], 0.04, C.copper, 6);
    b.beam([x * 1.2, 0.5, z * 1.2], [x * 0.12, 2.1, z * 0.12], 0.06, C.steel);
  }
  b.box(0, 0.66, 0, 0.34, 2.2, 0.34, C.steel);                                    // 主桅
  for (let y = 1.1; y < 2.8; y += 0.45) b.box(0, y, 0, 0.42, 0.06, 0.42, C.dsteel);
  b.cyl(0, 2.86, 0, 0.26, 0.12, C.dsteel, { seg: 12 });
  b.box(0, 0.3, 1.2, 0.7, 0.34, 0.2, C.dark).box(0, 0.42, 1.305, 0.5, 0.14, 0.01, '#5fd0ff');
  // 旋转的抛物面天线
  const d = X.b();
  d.cyl(0, 0, 0, 0.14, 0.3, C.dsteel, { seg: 10 });
  d.cyl(0, 0.52, 0.34, 0.2, 0.34, C.lsteel, { seg: 20, r2: 0.95, rx: 0.75 });
  d.cyl(0, 0.6, 0.42, 0.9, 0.03, '#d9dde0', { seg: 20, rx: 0.75 });
  d.rod([0, 0.55, 0.36], [0, 1.02, 0.86], 0.03, C.dark, 6).sph(0, 1.04, 0.88, 0.08, hi, { seg: 8 });
  d.beam([0, 0.2, 0], [0, 0.42, 0.24], 0.1, C.dsteel);
  const tip = X.b().sph(0, 3.72, 0, 0.11, '#9fe8ff', { seg: 10 }).cyl(0, 3.3, 0, 0.03, 0.4, '#9fe8ff', { seg: 6 }).build();
  const ringG = y => X.b().tor(0, y, 0, 0.36, 0.045, '#7fe0ff', { axis: 'y', seg: 20 }).build();
  const ring = (y, th) => ({ g: ringG(y), glow: true, fn: (e, t, L) => (e.charge || 0) >= th && L.identity() });
  return {
    s: b.build(), h: 2.6,
    parts: [
      { g: d.build(), fn: (e, t, L) => L.makeRotationY((e.anim || 0) * 0.9 + (e.charge >= 1 ? t * 0.6 : 0)).setPosition(0, 2.98, 0) },
      { g: tip, glow: true, fn: (e, t, L) => (e.working || e.charge >= 1) && L.identity() },
      ring(1.0, 0.25), ring(1.45, 0.5), ring(1.9, 0.75), ring(2.35, 1),
      ...X.lamp(1.0, 0.72, 1.1),
    ],
    fx: (e, t, F) => {
      const c = e.charge || 0;
      if (e.working) F.glow(0, 3.72, 0, 1.2 + c * 1.6 + Math.sin(t * 6) * 0.2, 0.4, 0.85, 1, 0.5 + c * 0.4);
      if (c >= 1) { const p = (t * 0.7) % 1; F.glow(0, 3.72, 0, 2 + p * 9, 0.4, 0.85, 1, 0.9 * (1 - p)); F.glow(0, 3.72, 0, 2.6, 0.6, 0.9, 1, 0.9); }
    },
  };
});
})();
