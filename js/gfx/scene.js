// 每帧场景同步：建筑实例、传送带与物品、玩家、放置预览、烟雾与辉光
(function () {
'use strict';
const X = G.gfx, T = X.T, PI = Math.PI, TAU = PI * 2;
const M = new T.Matrix4(), L = new T.Matrix4(), W = new T.Matrix4(), _v = new T.Vector3();
const ROT = [0, 1, 2, 3].map(d => new T.Matrix4().makeRotationY(-d * PI / 2));
const puffs = [], smk = new WeakMap();
let night = 0;
X.time = 0;

X.setup = function () {
  X.initTerrain(); X.buildModels(); X.bakeIcons();
  X.player = X.buildPlayer();
};

// 传送带上物品的世界坐标
X.laneXY = function (tx, ty, d, curveFrom, lane, pos) {
  const lat = lane === 0 ? -0.22 : 0.22, cx = tx + 0.5, cy = ty + 0.5;
  if (curveFrom < 0) {
    const rd = (d + 1) % 4;
    return [cx + G.DX[d] * (pos - 0.5) + G.DX[rd] * lat, cy + G.DY[d] * (pos - 0.5) + G.DY[rd] * lat];
  }
  const ein = curveFrom, px = cx + (-G.DX[ein] + G.DX[d]) * 0.5, py = cy + (-G.DY[ein] + G.DY[d]) * 0.5;
  const right = d === (ein + 1) % 4, r = right ? 0.5 - lat : 0.5 + lat;
  const a0 = Math.atan2(-G.DY[d], -G.DX[d]); let da = Math.atan2(G.DY[ein], G.DX[ein]) - a0;
  while (da > PI) da -= TAU; while (da < -PI) da += TAU;
  const a = a0 + da * pos;
  return [px + Math.cos(a) * r, py + Math.sin(a) * r];
};
function beltItems(lanes, tx, ty, d, cf, hideFrom, hideTo) {
  for (let l = 0; l < 2; l++) for (const it of lanes[l]) {
    if (it.pos >= hideFrom && it.pos <= hideTo) continue;
    const xy = X.laneXY(tx, ty, d, cf, l, it.pos), c = X.cell[it.item];
    X.itemPool.push(xy[0], 0.3, xy[1], 0.56, c[0], c[1], 0, 0);
  }
}
function base(e) { M.copy(ROT[e.dir]).setPosition(e.x + e.w / 2, 0, e.y + e.h / 2); }

// 特效接口：坐标为模型局部坐标
const F = {
  e: null,
  glow(x, y, z, s, r, g, b, i) { _v.set(x, y, z).applyMatrix4(M); X.glowPool.push(_v.x, _v.y, _v.z, s * (1 + night * 0.7), r, g, b, i * (1 + night * 0.9)); },
  smoke(x, y, z, size, period, light) {
    if (X.time < (smk.get(F.e) || 0) || puffs.length > 700) return;
    smk.set(F.e, X.time + period * (0.7 + Math.random() * 0.6));
    _v.set(x, y, z).applyMatrix4(M);
    puffs.push({ x: _v.x, y: _v.y, z: _v.z, s: size, life: 0, max: 2.4 + Math.random() * 1.2, vx: 0.22 + Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.1, c: light || 0.22 + Math.random() * 0.08 });
  },
};

function drawEnt(e, t) {
  const ty = e.type;
  if (ty === 'belt') {
    const b = X.belt[e.pid], k = e.curveFrom < 0 ? 'S' : (e.curveFrom === (e.dir + 1) % 4 ? 'A' : 'B');
    base(e); b[k].push(M); b['s' + k].push(M);
    beltItems(e.lanes, e.x, e.y, e.dir, e.curveFrom, 2, 2);
    return;
  }
  const m = X.models[e.pid];
  if (ty === 'underground') {
    const b = X.belt.belt, inn = e.mode === 'in';
    base(e); b.S.push(M); b.sS.push(M); (inn ? m.pool : m.poolAlt).push(M);
    beltItems(e.lanes, e.x, e.y, e.dir, -1, inn ? 0.42 : -1, inn ? 2 : 0.58);
    return;
  }
  if (ty === 'splitter') {
    const b = X.belt.belt;
    for (let s = 0; s < 2; s++) {
      const st = G.splitterSegTile(e, s);
      M.copy(ROT[e.dir]).setPosition(st[0] + 0.5, 0, st[1] + 0.5); b.S.push(M); b.sS.push(M);
      beltItems(e.segs[s].lanes, st[0], st[1], e.dir, -1, 2, 2);
    }
    base(e); m.pool.push(M);
    return;
  }
  base(e); m.pool.push(M);
  if (ty === 'pipe') {
    const c = e.fconn; let any = false;
    for (let d = 0; d < 4; d++) if (c && c[d]) { any = true; L.copy(ROT[d]).setPosition(e.x + 0.5, 0, e.y + 0.5); m.poolArm.push(L); }
    if (!any) for (const d of [0, 2]) { L.copy(ROT[d]).setPosition(e.x + 0.5, 0, e.y + 0.5); m.poolArm.push(L); }
  }
  if (m.parts) for (const p of m.parts) {
    if (!p.fn(e, t, L)) continue;
    if (p.world) p.pool.push(L); else { W.multiplyMatrices(M, L); p.pool.push(W); }
  }
  if (ty === 'inserter' && e.hand) {
    const d = e.dir, a = Math.atan2(-G.DY[d], -G.DX[d]) + PI * (e.ang || 0), r = m.reach * 0.92, c = X.cell[e.hand];
    X.itemPool.push(e.x + 0.5 + Math.cos(a) * r, 0.52, e.y + 0.5 + Math.sin(a) * r, 0.5, c[0], c[1], 0, 0);
  }
  if (m.fx) { F.e = e; m.fx(e, t, F); }
  if (night > 0.03) { // 夜间灯光
    if (ty === 'pole') { const h = m.wire[0][1]; X.glowPool.push(e.x + 0.5, h, e.y + 0.5, 1.3, 1, 0.85, 0.55, night * 0.9); X.glowPool.push(e.x + 0.5, 0.06, e.y + 0.5, 7, 1, 0.8, 0.5, night * 0.2); }
    else if (e.working && (ty === 'assembler' || ty === 'drill')) X.glowPool.push(e.x + e.w / 2, 0.06, e.y + e.h / 2 + 1, 5, 0.6, 0.8, 1, night * 0.16);
  }
}
// 建造/拆除时的扬尘
X.dust = function (cx, cz, w, h) {
  const n = Math.min(14, 4 + Math.round((w + h) * 1.5));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, c = 0.5 + Math.random() * 0.12;
    puffs.push({ x: cx + Math.cos(a) * w * 0.5, y: 0.12, z: cz + Math.sin(a) * h * 0.5, s: 0.3 + Math.random() * 0.2, life: 0, max: 0.6 + Math.random() * 0.5,
      vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2, c, dust: 1 });
  }
};

function updatePlayer(t, dt) {
  const P = X.player, pl = G.player;
  P.g.position.set(pl.x, 0, pl.y);
  let da = -(pl.facing + PI / 2) - P.g.rotation.y;
  while (da > PI) da -= TAU; while (da < -PI) da += TAU;
  P.g.rotation.y += da * Math.min(1, dt * 14);
  const sw = pl.moving ? Math.sin(t * 13) * 0.75 : 0, bob = pl.moving ? Math.abs(Math.sin(t * 13)) * 0.03 : 0;
  P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
  P.armL.rotation.x = -sw * 0.7;
  P.armR.rotation.x = pl.mining ? 1.3 + Math.sin(t * 20) * 0.35 : sw * 0.7;
  P.torso.position.y = 0.42 + bob; P.head.position.y = 1.02 + bob;
  if (pl.mining && G.mouse.inside) {
    const w = G.screenToWorld(G.mouse.x, G.mouse.y);
    X.glowPool.push(w[0], 0.3, w[1], 0.5 + Math.random() * 0.3, 1, 0.8, 0.4, 0.5 + Math.random() * 0.4);
  }
}

function updateGhost() {
  const pl = G.player, item = pl.cursor, pid = item && G.ITEMS[item].place, ms = G.mouse;
  if (!pid || !ms.inside) { if (X.ghost) X.ghost.visible = false; return; }
  if (X.ghostPid !== pid) {
    if (X.ghost) X.scene.remove(X.ghost);
    X.ghost = X.previewGroup(pid); X.ghostPid = pid; X.ghostOk = null;
    X.ghost.traverse(o => { o.renderOrder = 7; });
    X.scene.add(X.ghost);
  }
  const p = G.PROTOS[pid], dir = p.rot === false ? 0 : pl.buildDir, wh = G.dims(p, dir), w = G.screenToWorld(ms.x, ms.y);
  const x = Math.round(w[0] - wh[0] / 2), y = Math.round(w[1] - wh[1] / 2);
  const ok = G.canBuild(pid, x, y, dir) && pl.reachable(x + wh[0] / 2, y + wh[1] / 2);
  if (ok !== X.ghostOk) { X.ghostOk = ok; X.ghost.traverse(o => { if (o.isMesh) o.material = ok ? X.matGhostOk : X.matGhostBad; }); }
  X.ghost.position.set(x + wh[0] / 2, 0.03, y + wh[1] / 2); X.ghost.rotation.y = -dir * PI / 2; X.ghost.visible = true;
}

X.frame = function (t) {
  const dt = Math.max(0, Math.min(0.1, t - X.time)); X.time = t;
  // 昼夜光照
  const dl = G.daylight, sm = dl * dl * (3 - 2 * dl), warm = 4 * sm * (1 - sm);
  night = 1 - sm;
  X.sun.intensity = 2.7 * sm + 0.1; X.sun.color.setRGB(1, 0.94 - warm * 0.22, 0.85 - warm * 0.42);
  X.hemi.intensity = 1.55 * (0.44 + 0.56 * sm); X.hemi.color.setRGB(0.92 - 0.4 * night, 0.94 - 0.28 * night, 1);
  X.uLight.value.set(1 - 0.58 * night + warm * 0.05, 1 - 0.52 * night - warm * 0.03, 1 - 0.36 * night - warm * 0.12);
  X.shadowMesh.material.opacity = 0.5 * (0.2 + 0.8 * sm);
  X.plight.intensity = night * 13; X.plight.position.set(G.player.x, 3.2, G.player.y + 0.8);
  X.uPl.value.set(G.player.x, G.player.y, night);
  const cam = G.cam, s = 32 * cam.z, hw = G.vw / 2 / s, hh = G.vh / 2 / s;
  X.updateCamera(cam.x, cam.y, s);
  const x0 = cam.x - hw - 3, x1 = cam.x + hw + 3, y0 = cam.y - hh - 2, y1 = cam.y + hh + 6;
  X.updateTerrain(t, x0, y0, x1, y1);
  for (const p of X.pools) p.begin();
  for (const k of ['belt', 'fast-belt']) { const b = X.belt[k]; b.tex.offset.y = -((t * b.speed * 3) % 1); }
  const ents = G.ents;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.x + e.w < x0 || e.x > x1 || e.y + e.h < y0 || e.y > y1) continue;
    drawEnt(e, t);
  }
  updatePlayer(t, dt); updateGhost();
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.life += dt;
    if (p.life > p.max) { puffs.splice(i, 1); continue; }
    const k = p.life / p.max;
    if (p.dust) { p.y += dt * 0.25; p.x += p.vx * dt * (1 - k); p.z += p.vz * dt * (1 - k); X.smokePool.push(p.x, p.y, p.z, p.s * (1 + k * 2.5), p.c * 1.1, p.c, p.c * 0.82, 0.5 * (1 - k)); continue; }
    p.y += dt * (0.55 - k * 0.25); p.x += p.vx * dt * (0.4 + k); p.z += p.vz * dt;
    const sc = p.c * (1 - night * 0.55);
    X.smokePool.push(p.x, p.y, p.z, p.s * (1 + k * 3.2), sc, sc, sc, 0.55 * (1 - k) * Math.min(1, p.life * 5));
  }
  for (const p of X.pools) p.end();
  X.renderer.render(X.scene, X.camera);
};
})();
