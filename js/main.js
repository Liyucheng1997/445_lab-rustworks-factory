// 玩家、输入、建造/拆除、手搓、存档、主循环
'use strict';
G.unlocked = new Set();
G.techDone = new Set();
G.techProgress = {};
G.research = { cur: null };
G.mouse = { x: 0, y: 0, inside: false, left: false, right: false };
const INV_SLOTS = 80, REACH = 10;

// ---------- 背包 ----------
G.inv = {
  items: {},
  count(it) { return this.items[it] || 0; },
  slotsUsed(extra) {
    let n = 0; const m = Object.assign({}, this.items);
    if (extra) for (const k in extra) m[k] = (m[k] || 0) + extra[k];
    for (const k in m) if (m[k] > 0) n += Math.ceil(m[k] / G.ITEMS[k].stack);
    return n;
  },
  space(it) {
    const st = G.ITEMS[it].stack, c = this.count(it);
    return (INV_SLOTS - this.slotsUsed()) * st + (c % st ? st - c % st : 0);
  },
  add(it, n) {
    const k = Math.min(n, this.space(it));
    if (k > 0) { this.items[it] = this.count(it) + k; G.ui && G.ui.dirty(); }
    if (k < n) G.ui && G.ui.toast('背包已满');
    return k;
  },
  remove(it, n) {
    const k = Math.min(n, this.count(it));
    this.items[it] -= k; if (!this.items[it]) delete this.items[it];
    if (G.player.cursor === it && !this.count(it)) G.player.cursor = null;
    G.ui && G.ui.dirty();
    return k;
  },
};

G.player = {
  x: 128.5, y: 128.5, facing: 0, moving: false, cursor: null, buildDir: 0,
  mining: false, mineTarget: null, mineProg: 0, quick: new Array(10).fill(null), queue: [],
  reachable(x, y) { return Math.hypot(x - this.x, y - this.y) <= REACH; },
};

// ---------- 碰撞 ----------
function solidAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (!G.inMap(tx, ty)) return true;
  const i = ty * G.W + tx, w = G.world;
  if (w.tile[i] === 2 || w.deco[i]) return true;
  const e = w.grid[i];
  return !!(e && !e.proto.walk);
}
function blocked(x, y) {
  const r = 0.22;
  return solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
}

// ---------- 建造 ----------
const REPLACE_GROUP = { belt: 'belt', inserter: 'inserter', container: 'container', furnace: 'furnace', assembler: 'assembler', pole: 'pole', drill: 'drill' };
function replaceTarget(pid, x, y, dir) {
  const p = G.PROTOS[pid], [w, h] = G.dims(p, dir), o = G.entAt(x, y);
  if (!o || o.x !== x || o.y !== y || o.w !== w || o.h !== h) return null;
  if (!REPLACE_GROUP[p.type] || REPLACE_GROUP[o.type] !== REPLACE_GROUP[p.type]) return null;
  if (o.pid === pid && (o.dir === dir || p.rot === false)) return null;
  return G.canPlace(pid, x, y, dir, o) ? o : null;
}
G.canBuild = (pid, x, y, dir) => G.canPlace(pid, x, y, dir) || !!replaceTarget(pid, x, y, dir);

G.tryBuild = function (wx, wy) {
  const pl = G.player, item = pl.cursor, pid = item && G.ITEMS[item].place;
  if (!pid || !G.inv.count(item)) return false;
  const p = G.PROTOS[pid], dir = p.rot === false ? 0 : pl.buildDir, [w, h] = G.dims(p, dir);
  const x = Math.round(wx - w / 2), y = Math.round(wy - h / 2);
  if (!pl.reachable(x + w / 2, y + h / 2)) return false;
  const old = G.canPlace(pid, x, y, dir) ? null : replaceTarget(pid, x, y, dir);
  if (!old && !G.canPlace(pid, x, y, dir)) return false;
  const e = G.createEntity(pid, x, y, dir);
  if (old) {
    if (old.pid === pid) { // 仅改方向
      old.dir = dir; G.topologyChanged(old); G.removeEntity(old); old.dead = false; G.addEntity(old); return true;
    }
    for (const k of ['lanes', 'hand', 'fuel', 'burn', 'src', 'out', 'recipe', 'ins', 'outs', 'crafting', 'craftIn', 'prog']) if (k in old && k in e) e[k] = old[k];
    if (old.slots && e.slots) { for (const s of old.slots) if (s) { const n = G.slotsAdd(e.slots, s.item, s.count); if (n < s.count) G.inv.add(s.item, s.count - n); } }
    G.removeEntity(old); G.inv.add(old.pid, 1);
  }
  G.addEntity(e);
  G.inv.remove(item, 1);
  G.sfx('build'); G.gfx.dust(x + w / 2, y + h / 2, w, h);
  return true;
};

G.mineEntity = function (e) {
  if (e.proto.fixed) return false;
  const back = G.entityContents(e);
  let need = { [e.pid]: 1 }; for (const [it, n] of back) need[it] = (need[it] || 0) + n;
  if (G.inv.slotsUsed(need) > INV_SLOTS) { G.ui.toast('背包空间不足'); return false; }
  G.removeEntity(e);
  G.sfx('pick'); G.gfx.dust(e.x + e.w / 2, e.y + e.h / 2, e.w, e.h);
  G.inv.add(e.pid, 1);
  for (const [it, n] of back) G.inv.add(it, n);
  if (G.ui.openEnt === e) G.ui.closeAll();
  return true;
};

function updateMining() {
  const pl = G.player, m = G.mouse;
  pl.mining = false;
  if (!m.right || !m.inside) { pl.mineTarget = null; pl.mineProg = 0; return; }
  const [wx, wy] = G.screenToWorld(m.x, m.y), pk = G.pick(wx, wy), tx = pk.tx, ty = pk.ty;
  if (!G.inMap(tx, ty)) return;
  const e = pk.e, i = ty * G.W + tx, w = G.world;
  let key, time;
  if (e && e.proto.fixed) { pl.mineTarget = null; return; }
  if (e) { key = 'e' + e.id; time = 0.4; }
  else if (w.deco[i]) { key = 'd' + i; time = w.deco[i] === 1 ? 0.6 : 1.4; }
  else if (w.ore[i]) { key = 'o' + i; time = 1.0; }
  else { pl.mineTarget = null; return; }
  const cx = e ? e.x + e.w / 2 : tx + 0.5, cy = e ? e.y + e.h / 2 : ty + 0.5;
  if (!pl.reachable(cx, cy)) return;
  if (pl.mineTarget !== key) { pl.mineTarget = key; pl.mineProg = 0; }
  pl.mining = true;
  pl.facing = Math.atan2(cy - pl.y, cx - pl.x);
  pl.mineProg += 1 / G.TPS / time;
  if (!e && G.tick % 16 === 0) G.sfx(w.deco[i] === 1 ? 'chop' : 'mine');
  if (pl.mineProg < 1) return;
  pl.mineProg = 0;
  if (e) { G.mineEntity(e); pl.mineTarget = null; }
  else if (w.deco[i]) {
    if (w.deco[i] === 1) G.inv.add('wood', 4); else { G.inv.add('stone', 20); G.inv.add('coal', 5); }
    w.deco[i] = 0; pl.mineTarget = null; G.markTileDirty(tx, ty);
    G.sfx('pick'); G.gfx.dust(tx + 0.5, ty + 0.5, 1, 1);
  } else if (w.ore[i]) {
    if (G.inv.add(G.ORE_ITEMS[w.ore[i]], 1) && --w.oreAmt[i] <= 0) { w.ore[i] = 0; G.markTileDirty(tx, ty); }
    G.sfx('pick');
  }
}

function updatePlayer() {
  const pl = G.player, k = G.keys;
  let dx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), dy = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
  pl.moving = !!(dx || dy);
  if (pl.moving) {
    const len = Math.hypot(dx, dy), sp = 8.9 / G.TPS;
    dx = dx / len * sp; dy = dy / len * sp;
    if (!blocked(pl.x + dx, pl.y)) pl.x += dx;
    if (!blocked(pl.x, pl.y + dy)) pl.y += dy;
    if (!pl.mining) pl.facing = Math.atan2(dy, dx);
  }
  updateMining();
  // 手搓队列
  const q = pl.queue[0];
  if (q) {
    const r = G.RECIPES[q.steps[q.idx]];
    q.prog += 1 / G.TPS / r.time;
    if (q.prog >= 1) {
      q.prog = 0; q.idx++;
      if (q.idx >= q.steps.length) {
        const top = G.RECIPES[q.recipe];
        for (const it in top.out) G.inv.add(it, top.out[it]);
        pl.queue.shift(); G.sfx('craft');
      }
      G.ui.dirty();
    }
  }
}

G.updatePlayer = updatePlayer;

// ---------- 手搓 ----------
G.recipeFor = function (item) {
  return G.CRAFT_RECIPES.find(r => r.out[item] && (!r.lock || G.unlocked.has(r.id)) && !r.noHand);
};
function plan(rid, inv, steps, depth) {
  const r = G.RECIPES[rid];
  for (const it in r.in) {
    const need = r.in[it];
    while ((inv[it] || 0) < need) {
      const sub = G.recipeFor(it);
      if (!sub || depth > 6) return false;
      if (!plan(sub.id, inv, steps, depth + 1)) return false;
      inv[it] = (inv[it] || 0) + sub.out[it];
    }
    inv[it] -= need;
  }
  steps.push(rid);
  return true;
}
G.canCraft = function (rid, n = 1) {
  const inv = Object.assign({}, G.inv.items), steps = [];
  for (let k = 0; k < n; k++) if (!plan(rid, inv, steps, 0)) return false;
  return true;
};
G.craftableCount = function (rid) {
  const inv = Object.assign({}, G.inv.items); let n = 0;
  while (n < 999) { const steps = []; if (!plan(rid, inv, steps, 0)) break; n++; }
  return n;
};
G.craft = function (rid, n) {
  let done = 0;
  for (let k = 0; k < n; k++) {
    const inv = Object.assign({}, G.inv.items), steps = [];
    if (!plan(rid, inv, steps, 0)) break;
    const refund = {};
    for (const it in G.inv.items) { const d = G.inv.items[it] - (inv[it] || 0); if (d > 0) refund[it] = d; }
    for (const it in inv) { if (inv[it] > 0) G.inv.items[it] = inv[it]; else delete G.inv.items[it]; }
    G.player.queue.push({ recipe: rid, steps, idx: 0, prog: 0, refund });
    done++;
  }
  if (!done) G.ui.toast('材料不足');
  G.ui.dirty();
  return done;
};
G.cancelCraft = function (i) {
  const q = G.player.queue[i]; if (!q) return;
  G.player.queue.splice(i, 1);
  for (const it in q.refund) G.inv.add(it, q.refund[it]);
};

// ---------- 存档 ----------
const SAVE_KEY = 'rustworks-save-v1';
function b64(arr) { const u8 = new Uint8Array(arr.buffer); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(s, Type) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Type(u8.buffer); }
const SKIP = new Set(['proto', 'net', 'links', 'pair', 'fconn', 'type', 'sat', 'demand', 'maxOut', 'oreIdx']);
G.save = function () {
  try {
    const w = G.world;
    const ents = G.ents.map(e => { const o = {}; for (const k in e) if (!SKIP.has(k)) o[k] = e[k]; if (e.pair) o.pairId = e.pair.id; return o; });
    const pl = G.player;
    const data = {
      v: 1, seed: w.seed, tile: b64(w.tile), ore: b64(w.ore), oreAmt: b64(w.oreAmt), deco: b64(w.deco), ents,
      player: { x: pl.x, y: pl.y, inv: G.inv.items, quick: pl.quick, queue: pl.queue },
      research: G.research, techDone: [...G.techDone], techProgress: G.techProgress, tick: G.tick, nextId: G.nextId, stats: G.stats,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) { console.error(err); G.ui && G.ui.toast('存档失败：' + err.message); return false; }
};
G.load = function () {
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
  const d = JSON.parse(raw);
  const w = { seed: d.seed, tile: unb64(d.tile, Uint8Array), ore: unb64(d.ore, Uint8Array), oreAmt: unb64(d.oreAmt, Int32Array), deco: unb64(d.deco, Uint8Array), grid: new Array(G.W * G.H).fill(null) };
  G.world = w; G.ents = [];
  const byId = {};
  for (const o of d.ents) {
    const e = G.createEntity(o.pid, o.x, o.y, o.dir);
    Object.assign(e, o); e.proto = G.PROTOS[o.pid]; e.type = e.proto.type;
    G.ents.push(e); byId[e.id] = e;
    for (let ty = e.y; ty < e.y + e.h; ty++) for (let tx = e.x; tx < e.x + e.w; tx++) w.grid[ty * G.W + tx] = e;
  }
  for (const e of G.ents) { if (e.pairId) e.pair = byId[e.pairId]; delete e.pairId; }
  for (const e of G.ents) if (e.type === 'belt') G.updateBeltShape(e);
  Object.assign(G.player, { x: d.player.x, y: d.player.y, quick: d.player.quick, queue: d.player.queue || [] });
  G.inv.items = d.player.inv;
  G.research = d.research; G.techDone = new Set(d.techDone); G.techProgress = d.techProgress;
  G.tick = d.tick; G.nextId = d.nextId; G.stats = d.stats || { produced: {} };
  G.resetUnlocks();
  G.powerDirty = G.fluidDirty = true;
  return true;
};
G.resetUnlocks = function () {
  G.unlocked = new Set(Object.values(G.RECIPES).filter(r => !r.lock).map(r => r.id));
  for (const t of G.techDone) for (const r of G.TECHS[t].unlock) G.unlocked.add(r);
};
G.newGame = function () {
  G.world = G.newWorld((Math.random() * 1e6) | 0);
  G.ents = []; G.nextId = 1; G.tick = 0;
  G.inv.items = { 'burner-drill': 1, 'stone-furnace': 1, 'iron-plate': 8, 'wood': 10 };
  Object.assign(G.player, { x: 128.5, y: 128.5, cursor: null, queue: [], quick: ['burner-drill', 'stone-furnace', 'belt', 'burner-inserter', 'inserter', 'wooden-chest', 'small-pole', 'assembler-1', 'electric-drill', 'lab'] });
  G.research = { cur: null }; G.techDone = new Set(); G.techProgress = {}; G.stats = { produced: {} };
  G.resetUnlocks();
  // 登陆舱残骸：就在出生点旁边，装着开局补给
  const wk = G.createEntity('wreck', 125, 125, 0);
  for (let ty = 125; ty < 127; ty++) for (let tx = 125; tx < 128; tx++) { const i = ty * G.W + tx; G.world.deco[i] = 0; if (G.world.tile[i] === 2) G.world.tile[i] = 0; }
  G.addEntity(wk);
  for (const [it, n] of [['iron-plate', 20], ['copper-plate', 10], ['coal', 12], ['wood', 6], ['iron-gear', 4]]) G.slotsAdd(wk.slots, it, n);
  G.dirtyChunks.clear();
  G.powerDirty = G.fluidDirty = true;
};

// ---------- 输入 ----------
G.keys = {};
function setupInput() {
  const cv = G.canvas;
  addEventListener('keydown', ev => {
    if (ev.target.tagName === 'INPUT') return;
    G.keys[ev.code] = true;
    const pl = G.player;
    switch (ev.code) {
      case 'KeyE': G.ui.toggleInventory(); break;
      case 'KeyT': G.ui.toggleTech(); break;
      case 'Escape': if (pl.cursor) pl.cursor = null; else G.ui.closeAll(); break;
      case 'KeyQ': {
        if (pl.cursor) { pl.cursor = null; break; }
        const [wx, wy] = G.screenToWorld(G.mouse.x, G.mouse.y), e = G.pick(wx, wy).e;
        if (e && G.inv.count(e.pid)) { pl.cursor = e.pid; if (e.proto.rot !== false) pl.buildDir = e.dir; }
        break;
      }
      case 'KeyR': {
        const rev = ev.shiftKey ? 3 : 1;
        G.sfx('rotate');
        if (pl.cursor && G.ITEMS[pl.cursor].place) { pl.buildDir = (pl.buildDir + rev) % 4; break; }
        const [wx, wy] = G.screenToWorld(G.mouse.x, G.mouse.y), e = G.pick(wx, wy).e;
        if (e) G.rotateEntity(e, rev);
        break;
      }
      case 'AltLeft': case 'AltRight': G.altMode = !G.altMode; ev.preventDefault(); break;
      case 'F5': ev.preventDefault(); if (G.save()) G.ui.toast('已保存'); break;
      case 'KeyM': G.toggleMute(); break;
    }
    if (/^Digit\d$/.test(ev.code)) {
      const i = (+ev.code.slice(5) + 9) % 10, it = pl.quick[i];
      pl.cursor = it && G.inv.count(it) ? (pl.cursor === it ? null : it) : null;
    }
  });
  addEventListener('keyup', ev => { G.keys[ev.code] = false; if (ev.code.startsWith('Alt')) ev.preventDefault(); });
  addEventListener('blur', () => { G.keys = {}; G.mouse.left = G.mouse.right = false; });
  cv.addEventListener('mousemove', ev => {
    G.mouse.x = ev.offsetX; G.mouse.y = ev.offsetY; G.mouse.inside = true;
    if (G.mouse.left && G.player.cursor && G.ITEMS[G.player.cursor].place) { // 拖动连续放置：沿路径插值，快速拖动也不漏格
      const [wx, wy] = G.screenToWorld(ev.offsetX, ev.offsetY), m = G.mouse;
      const lx = m.bx == null ? wx : m.bx, ly = m.by == null ? wy : m.by, n = Math.max(1, Math.ceil(Math.hypot(wx - lx, wy - ly) / 0.5));
      for (let k = 1; k <= n && G.player.cursor; k++) G.tryBuild(lx + (wx - lx) * k / n, ly + (wy - ly) * k / n);
      m.bx = wx; m.by = wy;
    }
  });
  cv.addEventListener('mouseleave', () => { G.mouse.inside = false; });
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('mousedown', ev => {
    G.mouse.x = ev.offsetX; G.mouse.y = ev.offsetY;
    const [wx, wy] = G.screenToWorld(ev.offsetX, ev.offsetY);
    if (ev.button === 2) { G.mouse.right = true; return; }
    if (ev.button !== 0) return;
    G.mouse.left = true;
    const pl = G.player;
    if (pl.cursor && G.ITEMS[pl.cursor].place) { G.mouse.bx = wx; G.mouse.by = wy; G.tryBuild(wx, wy); return; }
    const e = G.pick(wx, wy).e;
    if (!e) return;
    if (pl.cursor) { // 手持物品点击建筑 = 放入
      const n = G.insert(e, pl.cursor, Math.min(G.inv.count(pl.cursor), G.ITEMS[pl.cursor].stack), true);
      if (n) { G.inv.remove(pl.cursor, n); G.ui.toast(`放入 ${G.itemName(pl.cursor)} ×${n}`); }
      return;
    }
    if (pl.reachable(e.x + e.w / 2, e.y + e.h / 2)) G.ui.openEntity(e);
    else G.ui.toast('距离太远');
  });
  addEventListener('mouseup', ev => { if (ev.button === 0) G.mouse.left = false; if (ev.button === 2) G.mouse.right = false; });
  cv.addEventListener('wheel', ev => {
    ev.preventDefault();
    G.cam.z = Math.max(0.45, Math.min(3, G.cam.z * (ev.deltaY > 0 ? 0.88 : 1.14)));
  }, { passive: false });
}

G.rotateEntity = function (e, rev) {
  const p = e.proto;
  if (p.rot === false || e.type === 'underground') return;
  const nd = (e.dir + rev) % 4, [w, h] = G.dims(p, nd);
  if ((w !== e.w || h !== e.h) && !G.canPlace(e.pid, e.x, e.y, nd, e)) return;
  G.removeEntity(e); e.dead = false;
  e.dir = nd; e.w = w; e.h = h;
  if (e.type === 'belt') { /* 车道保持 */ }
  G.addEntity(e);
};

// ---------- 主循环 ----------
function resize() {
  G.vw = innerWidth; G.vh = innerHeight; G.dpr = Math.min(2, window.devicePixelRatio || 1);
  G.gfx.resize(G.vw, G.vh);
  const ov = G.overlay; ov.width = Math.round(G.vw * G.dpr); ov.height = Math.round(G.vh * G.dpr);
  G.ctx = ov.getContext('2d');
}
G.start = function () {
  G.canvas = document.getElementById('game'); G.overlay = document.getElementById('overlay');
  G.gfx.init(G.canvas);
  resize(); addEventListener('resize', resize);
  if (/[?&]sandbox=1/.test(location.search)) { G.noSave = true; G.save = () => true; G.newGame(); } // 试玩模式：全新地图，不读不写存档
  else if (!G.load()) G.newGame();
  G.gfx.setup();
  setupInput();
  G.ui.init(); G.drawMinimap();
  let last = performance.now(), acc = 0, uiT = 0, mmT = 0, saveT = 0;
  const frame = now => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    acc += dt;
    let n = 0;
    while (acc >= 1 / G.TPS && n < 6) { G.updatePlayer(); G.step(); acc -= 1 / G.TPS; n++; }
    if (n === 6) acc = 0;
    G.cam.x = G.player.x; G.cam.y = G.player.y;
    G.render(now / 1000);
    uiT += dt; mmT += dt; saveT += dt;
    if (uiT > 0.1) { uiT = 0; G.ui.update(); }
    if (mmT > 0.5) { mmT = 0; G.drawMinimap(); }
    if (saveT > 60) { saveT = 0; G.save(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener('beforeunload', () => { if (!G.noSave) G.save(); });
};
