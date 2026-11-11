// 渲染入口：3D 场景 + 2D 叠加层（电线、状态图标、选中框、放置提示）+ 小地图
'use strict';
G.cam = { x: 128, y: 128, z: 1 };
G.altMode = true; // 默认显示进出方向和配方图标，按 Alt 关闭

G.screenToWorld = function (sx, sy) {
  const s = 32 * G.cam.z;
  return [(sx - G.vw / 2) / s + G.cam.x, (sy - G.vh / 2) / s + G.cam.y];
};
// 模型在屏幕上会向上（北）伸出，拾取时要把这部分算进去
G.pickHeight = function (e) {
  const m = G.gfx.models[e.pid];
  if (!m || e.type === 'pole' || e.type === 'inserter') return 0.45;
  return m.h * 0.8;
};
G.pick = function (wx, wy) {
  const tx = Math.floor(wx), ty = Math.floor(wy), K = G.gfx.K;
  for (let k = 3; k >= 0; k--) {
    const e = G.entAt(tx, ty + k);
    if (e && wy >= e.y - G.pickHeight(e) * K) return { e, tx, ty };
  }
  if (G.inMap(tx, ty + 1) && !G.world.deco[ty * G.W + tx] && G.world.deco[(ty + 1) * G.W + tx] === 1) return { e: null, tx, ty: ty + 1 };
  return { e: null, tx, ty };
};

G.render = function (t) {
  G.gfx.frame(t);
  const g = G.ctx, cam = G.cam, s = 32 * cam.z, dpr = G.dpr, K = G.gfx.K, X = G.gfx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, G.overlay.width, G.overlay.height);
  g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (G.vw / 2 - cam.x * s), dpr * (G.vh / 2 - cam.y * s));
  const hw = G.vw / 2 / s, hh = G.vh / 2 / s;
  const x0 = cam.x - hw - 10, x1 = cam.x + hw + 10, y0 = cam.y - hh - 10, y1 = cam.y + hh + 10;
  const vis = [];
  for (const e of G.ents) if (e.x + e.w >= x0 && e.x <= x1 && e.y + e.h >= y0 && e.y <= y1) vis.push(e);
  // 电线
  g.lineCap = 'round'; g.globalAlpha = 0.45 + 0.55 * G.daylight;
  for (const e of vis) if (e.type === 'pole') for (const o of e.links) {
    const wa = X.models[e.pid].wire, wb = X.models[o.pid].wire;
    for (let k = 0; k < 2; k++) {
      const ax = e.x + 0.5 + wa[k][0], ay = e.y + 0.5 - wa[k][1] * K, bx = o.x + 0.5 + wb[k][0], by = o.y + 0.5 - wb[k][1] * K;
      const sag = 0.25 + Math.hypot(bx - ax, by - ay) * 0.05;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
      g.strokeStyle = 'rgba(30,18,10,0.6)'; g.lineWidth = 0.07; g.stroke();
      g.strokeStyle = '#c9783c'; g.lineWidth = 0.035; g.stroke();
    }
  }
  g.globalAlpha = 1;
  // 状态与 Alt 模式
  const pulse = 0.72 + 0.28 * Math.sin(t * 5);
  for (const e of vis) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2 - G.pickHeight(e) * K * 0.6;
    if (G.altMode) drawAlt(g, e, cx, cy);
    const st = G.entStatus(e);
    if (st && st.icon) { g.globalAlpha = pulse; statusIcon(g, cx, cy, st.icon, st.col, e.w > 1 ? 1 : 0.72); g.globalAlpha = 1; }
  }
  G.drawCursor(g, t);
};

function statusIcon(g, x, y, ch, col, k) {
  g.fillStyle = 'rgba(0,0,0,0.72)'; g.beginPath(); g.arc(x, y, 0.36 * k, 0, 7); g.fill();
  g.strokeStyle = col; g.lineWidth = 0.06 * k; g.stroke();
  g.fillStyle = col; g.font = `bold ${0.42 * k}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y + 0.02 * k);
}
function drawAlt(g, e, cx, cy) {
  let item = null;
  if (e.type === 'assembler' && e.recipe) item = Object.keys(G.RECIPES[e.recipe].out)[0];
  else if (e.type === 'furnace') item = e.out ? e.out.item : (e.crafting ? Object.keys(G.RECIPES[e.crafting].out)[0] : null);
  else if (e.type === 'container') { const s = e.slots.find(Boolean); item = s && s.item; }
  if (item) {
    const r = e.w >= 3 ? 0.6 : e.w >= 2 ? 0.45 : 0.3;
    g.fillStyle = 'rgba(0,0,0,0.62)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.03; g.stroke();
    g.drawImage(G.icon(item), cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  }
  if (e.type === 'inserter' || e.type === 'drill') {
    const d = e.dir, gx = e.x + e.w / 2, gy = e.y + e.h / 2;
    if (e.type === 'inserter') { g.fillStyle = 'rgba(90,200,255,0.95)'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.03; g.beginPath(); g.arc(gx - G.DX[d] * 0.5, gy - G.DY[d] * 0.5, 0.09, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = 'rgba(255,220,80,0.95)'; g.save(); g.translate(gx + G.DX[d] * (e.w / 2 + 0.12), gy + G.DY[d] * (e.h / 2 + 0.12)); g.rotate(d * Math.PI / 2);
    g.beginPath(); g.moveTo(-0.16, 0.06); g.lineTo(0, -0.14); g.lineTo(0.16, 0.06); g.fill(); g.restore();
  }
}
function brackets(g, bx, by, bw, bh, col) {
  const L = Math.min(0.3, bw * 0.3);
  g.lineWidth = 0.07; g.lineCap = 'butt';
  for (const pass of [0, 1]) {
    g.strokeStyle = pass ? col : 'rgba(0,0,0,0.6)'; g.lineWidth = pass ? 0.06 : 0.11;
    for (const [cx, cy, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      g.beginPath(); g.moveTo(cx + sx * L, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * L); g.stroke();
    }
  }
}
const IN_RGB = '90,200,255', OUT_RGB = '255,205,70';
// 给一格打上带字的标签（取 / 放 / 进 / 出）
function tileTag(g, tx, ty, rgb, label) {
  g.fillStyle = `rgba(${rgb},0.2)`; g.fillRect(tx + 0.07, ty + 0.07, 0.86, 0.86);
  g.strokeStyle = `rgba(${rgb},0.95)`; g.lineWidth = 0.05; g.strokeRect(tx + 0.07, ty + 0.07, 0.86, 0.86);
  g.font = 'bold 0.4px "Microsoft YaHei", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 0.11; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeText(label, tx + 0.5, ty + 0.53);
  g.fillStyle = `rgb(${rgb})`; g.fillText(label, tx + 0.5, ty + 0.53);
}
function flowArrow(g, ax, ay, bx, by, rgb) {
  const a = Math.atan2(by - ay, bx - ax);
  for (const pass of [0, 1]) {
    g.strokeStyle = g.fillStyle = pass ? `rgb(${rgb})` : 'rgba(0,0,0,0.75)'; g.lineWidth = pass ? 0.07 : 0.14; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx - Math.cos(a) * 0.12, by - Math.sin(a) * 0.12); g.stroke();
    const s = pass ? 0.2 : 0.25;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - Math.cos(a - 0.5) * s, by - Math.sin(a - 0.5) * s); g.lineTo(bx - Math.cos(a + 0.5) * s, by - Math.sin(a + 0.5) * s); g.closePath(); g.fill();
  }
}
// 鼠标指着一台机器时，画出它的进出：自己的取/放/出格子，以及所有往它送料、从它取货的机械臂和钻机
function drawIO(g, e) {
  if (e.type === 'inserter') {
    const [px, py, qx, qy] = G.insIO(e);
    tileTag(g, px, py, IN_RGB, '取'); tileTag(g, qx, qy, OUT_RGB, '放');
    flowArrow(g, px + 0.5, py + 0.5, qx + 0.5, qy + 0.5, '255,255,255');
    return;
  }
  if (e.type === 'drill') { const [tx, ty] = G.dropTile(e); if (G.entAt(tx, ty) !== e) tileTag(g, tx, ty, OUT_RGB, '出'); }
  for (const o of G.ents) {
    if (o === e) continue;
    if (o.type === 'inserter') {
      const [px, py, qx, qy] = G.insIO(o);
      if (G.entAt(qx, qy) === e) { flowArrow(g, px + 0.5, py + 0.5, qx + 0.5, qy + 0.5, IN_RGB); tileTag(g, o.x, o.y, IN_RGB, '进'); }
      else if (G.entAt(px, py) === e) { flowArrow(g, px + 0.5, py + 0.5, qx + 0.5, qy + 0.5, OUT_RGB); tileTag(g, o.x, o.y, OUT_RGB, '出'); }
    } else if (o.type === 'drill') {
      const [tx, ty] = G.dropTile(o);
      if (G.entAt(tx, ty) === e) { flowArrow(g, o.x + o.w / 2, o.y + o.h / 2, tx + 0.5, ty + 0.5, IN_RGB); tileTag(g, tx, ty, IN_RGB, '进'); }
    }
  }
}
function area(g, x, y, w, h, rgb) {
  g.fillStyle = `rgba(${rgb},0.13)`; g.fillRect(x, y, w, h);
  g.strokeStyle = `rgba(${rgb},0.65)`; g.lineWidth = 0.04; g.strokeRect(x, y, w, h);
}

// ---------- 鼠标指针：放置提示 / 选中框 ----------
G.drawCursor = function (g, t) {
  const m = G.mouse; if (!m.inside) return;
  const [wx, wy] = G.screenToWorld(m.x, m.y), K = G.gfx.K;
  const item = G.player.cursor, pid = item && G.ITEMS[item].place;
  if (pid) {
    const p = G.PROTOS[pid], dir = p.rot === false ? 0 : G.player.buildDir;
    const [w, h] = G.dims(p, dir);
    const x = Math.round(wx - w / 2), y = Math.round(wy - h / 2);
    const ok = G.canBuild(pid, x, y, dir) && G.player.reachable(x + w / 2, y + h / 2);
    const mark = (tx, ty, col, r) => { g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.04; g.beginPath(); g.arc(tx + 0.5, ty + 0.5, r, 0, 7); g.fill(); g.stroke(); };
    if (p.type === 'drill') { const [ax, ay, a] = G.drillArea({ proto: p, x, y, w, h }); area(g, ax, ay, a, a, '90,170,255'); }
    // 手持能接矿的建筑时，标出各钻机还空着的出料位置
    if (p.type === 'furnace' || p.type === 'container' || G.isBeltLike({ type: p.type })) for (const o of G.ents) if (o.type === 'drill') {
      const [tx, ty] = G.dropTile(o);
      if (!G.entAt(tx, ty)) { g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); mark(tx, ty, 'rgba(255,205,70,0.95)', 0.2); g.globalAlpha = 1; }
    }
    if (p.energy === 'electric' || p.type === 'pole') { // 已有电线杆的供电范围
      g.fillStyle = 'rgba(90,170,255,0.09)';
      for (const o of G.ents) if (o.type === 'pole') { const s = o.proto.supply; g.fillRect(o.x + 0.5 - s, o.y + 0.5 - s, s * 2, s * 2); }
    }
    if (p.type === 'pole') {
      const s = p.supply; area(g, x + 0.5 - s, y + 0.5 - s, s * 2, s * 2, '120,200,255');
      const hk = G.gfx.models[pid].wire[0][1] * K;
      for (const o of G.ents) if (o.type === 'pole' && Math.hypot(o.x - x, o.y - y) <= Math.min(p.reach, o.proto.reach)) {
        g.strokeStyle = 'rgba(120,230,120,0.85)'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(x + 0.5, y + 0.5 - hk); g.lineTo(o.x + 0.5, o.y + 0.5 - G.gfx.models[o.pid].wire[0][1] * K); g.stroke();
      }
    }
    g.fillStyle = ok ? 'rgba(80,255,120,0.07)' : 'rgba(255,60,60,0.2)'; g.fillRect(x, y, w, h);
    g.strokeStyle = ok ? 'rgba(120,255,150,0.8)' : 'rgba(255,90,70,0.9)'; g.lineWidth = 0.04; g.strokeRect(x, y, w, h);
    if (p.type === 'inserter') {
      const px = x - G.DX[dir] * p.reach, py = y - G.DY[dir] * p.reach, qx = x + G.DX[dir] * p.reach, qy = y + G.DY[dir] * p.reach;
      tileTag(g, px, py, IN_RGB, '取'); tileTag(g, qx, qy, OUT_RGB, '放'); flowArrow(g, px + 0.5, py + 0.5, qx + 0.5, qy + 0.5, '255,255,255');
    }
    if (p.type === 'drill') { const [tx, ty] = G.dropTile({ x, y, w, h, dir }); tileTag(g, tx, ty, OUT_RGB, '出'); }
    if (p.rot !== false && p.type !== 'inserter' && p.type !== 'drill' && p.type !== 'furnace') { // 方向箭头
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(dir * Math.PI / 2);
      g.fillStyle = 'rgba(255,225,90,0.95)'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.04;
      g.beginPath(); g.moveTo(-0.2, 0.1); g.lineTo(0, -0.22); g.lineTo(0.2, 0.1); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    return;
  }
  const pk = G.pick(wx, wy), e = pk.e, tx = pk.tx, ty = pk.ty;
  let bx, by, bw, bh, lift = 0;
  if (e) { bx = e.x; by = e.y; bw = e.w; bh = e.h; lift = G.pickHeight(e) * K; }
  else if (G.inMap(tx, ty) && (G.world.deco[ty * G.W + tx] || G.world.ore[ty * G.W + tx])) { bx = tx; by = ty; bw = bh = 1; lift = G.world.deco[ty * G.W + tx] === 1 ? 1.0 : 0; }
  else return;
  const ok = G.player.reachable(bx + bw / 2, by + bh / 2);
  if (e && e.type === 'drill') { const [ax, ay, a] = G.drillArea(e); area(g, ax, ay, a, a, '90,170,255'); }
  if (e && e.type === 'pole') { const s = e.proto.supply; area(g, e.x + 0.5 - s, e.y + 0.5 - s, s * 2, s * 2, '90,170,255'); }
  if (e) drawIO(g, e);
  brackets(g, bx, by - lift, bw, bh + lift, ok ? 'rgba(255,215,90,0.98)' : 'rgba(255,90,70,0.9)');
  if (G.player.mining && G.player.mineTarget) {
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(bx, by + bh + 0.1, bw, 0.16);
    g.fillStyle = '#f3c74a'; g.fillRect(bx + 0.02, by + bh + 0.12, (bw - 0.04) * G.player.mineProg, 0.12);
  }
};

// ---------- 小地图 ----------
G.minimap = { cv: null };
G.drawMinimap = function () {
  const mm = G.minimap, wd = G.world;
  if (!mm.cv) mm.cv = document.getElementById('minimap');
  const cv = mm.cv, g = cv.getContext('2d'), S = cv.width;
  const img = g.createImageData(S, S), d = img.data;
  const R = 48, cx = Math.floor(G.player.x), cy = Math.floor(G.player.y), scale = S / (R * 2);
  const oreCol = [null, [90, 130, 170], [210, 120, 60], [30, 30, 30], [180, 165, 130]];
  const tileCol = [[78, 96, 46], [128, 110, 76], [30, 72, 96], [56, 74, 38]];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = cx - R + Math.floor(px / scale), y = cy - R + Math.floor(py / scale), o = (py * S + px) * 4;
    let c = [10, 12, 14];
    if (G.inMap(x, y)) {
      const i = y * G.W + x;
      c = wd.ore[i] ? oreCol[wd.ore[i]] : (wd.deco[i] === 1 ? [40, 66, 30] : tileCol[wd.tile[i]]);
      const e = wd.grid[i];
      if (e) c = G.isBeltLike(e) ? [220, 180, 60] : (e.type === 'pole' ? [200, 120, 60] : [150, 160, 170]);
    }
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#ffb347'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.arc(S / 2, S / 2, 3, 0, 7); g.fill(); g.stroke();
  const vw = G.vw / (32 * G.cam.z) * scale, vh = G.vh / (32 * G.cam.z) * scale;
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.strokeRect(S / 2 - vw / 2, S / 2 - vh / 2, vw, vh);
};
