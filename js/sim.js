// 模拟：传送带、机械臂、钻机、熔炉、组装机、研究站、蒸汽发电、管网与电网
'use strict';
const GAP = 0.25;

// ---------- 传送带 ----------
function laneEntry(lane, p, item) {
  const last = lane[lane.length - 1];
  if (last && last.pos < p + GAP) return false;
  lane.push({ item, pos: p }); return true;
}
function laneInsert(lane, p, item) { // 中途插入（侧面上料/机械臂）
  let i = 0;
  while (i < lane.length && lane[i].pos > p) i++;
  if (i > 0 && lane[i - 1].pos - p < GAP) return false;
  if (i < lane.length && p - lane[i].pos < GAP) return false;
  lane.splice(i, 0, { item, pos: p }); return true;
}
function moveLane(lane, sp, end, tryOut) {
  if (!lane.length) return false;
  const f = lane[0];
  if (f.pos + sp >= end && tryOut && tryOut(f.item, f.pos + sp - end)) lane.shift();
  let lim = end, moved = false;
  for (const it of lane) { const np = Math.min(it.pos + sp, lim); if (np > it.pos) { it.pos = np; moved = true; } lim = it.pos - GAP; }
  return moved;
}
// 把物品从 fromDir 方向推到 (tx,ty) 的传送带上，lane 为源车道
G.pushToTile = function (tx, ty, fromDir, lane, item, over) {
  const n = G.entAt(tx, ty);
  if (!n) return false;
  const p0 = Math.min(over, 0.2);
  if (n.type === 'belt') {
    if (n.dir === fromDir || n.curveFrom === fromDir) return laneEntry(n.lanes[lane], p0, item);
    if (n.dir === (fromDir + 2) % 4) return false;
    const side = (fromDir + 2) % 4; // 源在目标的哪一侧
    return laneInsert(n.lanes[side === (n.dir + 3) % 4 ? 0 : 1], 0.5, item);
  }
  if (n.type === 'underground') {
    if (n.dir !== fromDir || n.mode !== 'in') return false;
    return laneEntry(n.lanes[lane], p0, item);
  }
  if (n.type === 'splitter') {
    if (n.dir !== fromDir) return false;
    const s = segIndex(n, tx, ty);
    return laneEntry(n.segs[s].lanes[lane], p0, item);
  }
  return false;
};
function segIndex(e, tx, ty) { const [x, y] = G.splitterSegTile(e, 0); return x === tx && y === ty ? 0 : 1; }
G.lanesAt = function (e, tx, ty) {
  if (e.type === 'splitter') return e.segs[segIndex(e, tx, ty)].lanes;
  return e.lanes;
};
G.beltTake = function (e, tx, ty, want) {
  const lanes = G.lanesAt(e, tx, ty);
  for (const lane of lanes) for (let i = 0; i < lane.length; i++) if (want(lane[i].item)) { const it = lane[i].item; lane.splice(i, 1); return it; }
  return null;
};
G.beltDrop = function (e, tx, ty, fromDir, item) {
  const lanes = G.lanesAt(e, tx, ty), bd = e.dir;
  const li = fromDir === (bd + 3) % 4 ? 0 : 1;
  return laneInsert(lanes[li], 0.5, item) || (fromDir === bd || fromDir === (bd + 2) % 4 ? laneInsert(lanes[0], 0.5, item) : false);
};

function beltTick(e) {
  const sp = e.proto.speed / G.TPS, d = e.dir;
  let moved = false;
  if (e.type === 'belt') {
    const tx = e.x + G.DX[d], ty = e.y + G.DY[d];
    for (let l = 0; l < 2; l++) moved = moveLane(e.lanes[l], sp, 1, (it, over) => G.pushToTile(tx, ty, d, l, it, over)) || moved;
  } else if (e.type === 'underground') {
    if (e.mode === 'in') {
      for (let l = 0; l < 2; l++) moved = moveLane(e.lanes[l], sp, 0.5, e.pair ? (it) => laneEntry(e.pair.lanes[l], 0.5, it) : null) || moved;
    } else {
      const tx = e.x + G.DX[d], ty = e.y + G.DY[d];
      for (let l = 0; l < 2; l++) moved = moveLane(e.lanes[l], sp, 1, (it, over) => G.pushToTile(tx, ty, d, l, it, over)) || moved;
    }
  } else if (e.type === 'splitter') {
    for (let s = 0; s < 2; s++) for (let l = 0; l < 2; l++) {
      moved = moveLane(e.segs[s].lanes[l], sp, 1, (it, over) => {
        const pref = e.toggle[l];
        for (const k of [pref, 1 - pref]) {
          const [sx, sy] = G.splitterSegTile(e, k);
          if (G.pushToTile(sx + G.DX[d], sy + G.DY[d], d, l, it, over)) { e.toggle[l] = 1 - k; return true; }
        }
        return false;
      }) || moved;
    }
  }
  if (moved) e.anim += sp;
}

// ---------- 能量 ----------
function burn(e, j) {
  if (e.burn >= j) { e.burn -= j; return true; }
  if (e.fuel) {
    e.burn += G.ITEMS[e.fuel.item].fuel; e.fuelItem = e.fuel.item;
    if (!--e.fuel.count) e.fuel = null;
    e.burn -= j; return true;
  }
  return false;
}
// 返回本帧可用的速度系数（0..1），并登记电力需求
function energy(e, active) {
  const p = e.proto;
  if (p.energy === 'burner') return active && burn(e, p.power / G.TPS) ? 1 : 0;
  e.demand = active ? p.power : 0;
  return active ? e.sat : 0;
}

// 把物品放到建筑前方（钻机）
G.outputItem = function (e, item) {
  const [tx, ty] = G.dropTile(e);
  const n = G.entAt(tx, ty);
  if (!n) return false;
  if (G.isBeltLike(n)) return G.beltDrop(n, tx, ty, e.dir, item);
  return G.insert(n, item, 1) > 0;
};

function drillTick(e) {
  if (e.outBuf) { if (G.outputItem(e, e.outBuf)) e.outBuf = null; else { e.working = false; e.demand = 0; return; } }
  const w = G.world, [x0, y0, a] = G.drillArea(e);
  let idx = e.oreIdx;
  if (idx == null || !w.ore[idx]) {
    idx = null;
    for (let ty = y0; ty < y0 + a && idx == null; ty++) for (let tx = x0; tx < x0 + a; tx++) {
      if (!G.inMap(tx, ty)) continue; const i = ty * G.W + tx;
      if (w.ore[i]) { idx = i; break; }
    }
    e.oreIdx = idx;
  }
  if (idx == null) { e.working = false; e.demand = 0; e.depleted = true; return; }
  const f = energy(e, true);
  e.working = f > 0;
  if (!f) return;
  e.anim += f * e.proto.speed / G.TPS;
  e.prog += f * e.proto.speed / G.TPS;
  if (e.prog >= 1) {
    e.prog -= 1;
    const item = G.ORE_ITEMS[w.ore[idx]];
    if (--w.oreAmt[idx] <= 0) { w.ore[idx] = 0; w.oreAmt[idx] = 0; G.markTileDirty(idx % G.W, (idx / G.W) | 0); }
    if (!G.outputItem(e, item)) e.outBuf = item;
  }
}

function furnaceTick(e) {
  const p = e.proto;
  if (!e.crafting) {
    const r = e.src && G.SMELT_BY_INPUT[e.src.item];
    if (r && (!r.lock || G.unlocked.has(r.id))) {
      const need = r.in[e.src.item], res = Object.keys(r.out)[0];
      if (e.src.count >= need && (!e.out || (e.out.item === res && e.out.count < G.ITEMS[res].stack))) {
        e.src.count -= need; e.craftIn = { [e.src.item]: need }; if (!e.src.count) e.src = null;
        e.crafting = r.id; e.prog = 0;
      }
    }
  }
  if (!e.crafting) { e.working = false; return; }
  const f = energy(e, true);
  e.working = f > 0;
  if (!f) return;
  const r = G.RECIPES[e.crafting];
  e.prog += f * p.speed / G.TPS / r.time;
  if (e.prog >= 1) {
    const res = Object.keys(r.out)[0];
    if (e.out && e.out.item === res) e.out.count += r.out[res]; else e.out = { item: res, count: r.out[res] };
    e.crafting = null; e.craftIn = null; e.prog = 0;
    G.stats.produced[res] = (G.stats.produced[res] || 0) + r.out[res];
  }
}

function assemblerTick(e) {
  const r = e.recipe && G.RECIPES[e.recipe];
  if (!r) { e.working = false; e.demand = 0; return; }
  if (!e.crafting) {
    let ok = true;
    for (const k in r.in) if ((e.ins[k] || 0) < r.in[k]) { ok = false; break; }
    for (const k in r.out) if ((e.outs[k] || 0) + r.out[k] > Math.max(G.ITEMS[k].stack, r.out[k] * 2)) ok = false;
    if (ok) {
      for (const k in r.in) e.ins[k] -= r.in[k];
      e.craftIn = Object.assign({}, r.in);
      e.crafting = true; e.prog = 0;
    }
  }
  const f = energy(e, e.crafting);
  e.working = e.crafting && f > 0;
  if (!e.working) return;
  e.anim += f / G.TPS;
  e.prog += f * e.proto.speed / G.TPS / r.time;
  if (e.prog >= 1) {
    for (const k in r.out) { e.outs[k] = (e.outs[k] || 0) + r.out[k]; G.stats.produced[k] = (G.stats.produced[k] || 0) + r.out[k]; }
    e.crafting = false; e.craftIn = null; e.prog = 0;
  }
}

function labTick(e) {
  const cur = G.research.cur, t = cur && G.TECHS[cur];
  if (!e.busy && t && !G.techDone.has(cur)) {
    if (t.packs.every(pk => (e.packs[pk] || 0) >= 1)) {
      for (const pk of t.packs) e.packs[pk]--;
      e.busy = true; e.prog = 0; e.unitTech = cur;
    }
  }
  const f = energy(e, e.busy);
  e.working = e.busy && f > 0;
  if (!e.working) return;
  e.anim += f / G.TPS;
  const ut = G.TECHS[e.unitTech];
  e.prog += f / G.TPS / ut.time;
  if (e.prog >= 1) {
    e.busy = false; e.prog = 0;
    G.addResearchUnit(e.unitTech);
  }
}

function inserterTick(e) {
  const p = e.proto, d = e.dir, r = p.reach;
  const sx = e.x - G.DX[d] * r, sy = e.y - G.DY[d] * r, tx = e.x + G.DX[d] * r, ty = e.y + G.DY[d] * r;
  const moving = e.hand ? e.ang < 1 : e.ang > 0;
  // 燃料机械臂：没燃料时从来源拿燃料给自己
  if (p.energy === 'burner' && G.noFuel(e)) {
    const src = G.entAt(sx, sy);
    if (src && !G.isBeltLike(src)) {
      let it = G.takeOne(src, G.isFuel);
      // 来源是烧燃料的机器时，从它的燃料格里分一个（至少给它留一个）
      if (!it && src.fuel && src.fuel.count > 1 && src.type !== 'inserter') { it = src.fuel.item; src.fuel.count--; }
      if (it) e.fuel = { item: it, count: 1 };
    }
    else if (src) { const it = G.beltTake(src, sx, sy, G.isFuel); if (it) e.fuel = { item: it, count: 1 }; }
  }
  const f = energy(e, moving);
  if (moving) {
    if (!f) return;
    const sp = f * 2 / (p.cycle * G.TPS);
    e.ang = e.hand ? Math.min(1, e.ang + sp) : Math.max(0, e.ang - sp);
    return;
  }
  if ((G.tick + e.id) % 3) return;
  const tgt = G.entAt(tx, ty);
  if (!tgt || tgt === e) return;
  if (!e.hand) {
    if (p.energy === 'electric' && !(e.net && e.sat > 0)) return;
    if (p.energy === 'burner' && G.noFuel(e)) return;
    const src = G.entAt(sx, sy);
    if (!src || src === tgt) return;
    const want = it => G.canAccept(tgt, it);
    const it = G.isBeltLike(src) ? G.beltTake(src, sx, sy, want) : G.takeOne(src, want);
    if (it) e.hand = it;
  } else {
    let ok = G.isBeltLike(tgt) ? G.beltDrop(tgt, tx, ty, d, e.hand) : G.insert(tgt, e.hand, 1) > 0;
    if (!ok && p.energy === 'burner' && G.isFuel(e.hand) && G.noFuel(e)) { e.fuel = { item: e.hand, count: 1 }; ok = true; }
    if (ok) e.hand = null;
  }
}

function boilerTick(e) {
  const [wb, sb] = e.boxes;
  const amt = Math.min(1, wb.a, sb.cap - sb.a);
  if (amt <= 0.001) { e.working = false; return; }
  if (!burn(e, amt * 30e3)) { e.working = false; return; }
  wb.a -= amt; sb.a += amt; e.working = true;
}

// 求救信标：持续供电充能，充满即通关
function beaconTick(e) {
  if (e.charge >= 1) { e.working = false; e.demand = 0; return; }
  const f = energy(e, true);
  e.working = f > 0;
  if (!f) return;
  e.anim += f / G.TPS;
  e.charge += f / G.TPS / e.proto.chargeTime;
  if (e.charge >= 1) { e.charge = 1; if (!G.stats.won) { G.stats.won = G.tick; G.sfx && G.sfx('research'); G.ui && G.ui.win(); } }
}

// ---------- 电网求解 ----------
function solvePower() {
  for (const e of G.ents) if (e.proto.energy === 'electric' && !e.net) e.sat = 0;
  for (const n of G.nets) {
    let supply = 0, demand = 0;
    for (const p of n.prods) {
      p.maxOut = p.type === 'solar' ? p.proto.power * G.daylight : Math.min(p.proto.power, p.boxes[0].a * 30e3 * G.TPS);
      supply += p.maxOut;
    }
    for (const c of n.cons) demand += c.demand || 0;
    const sat = supply <= 0 ? 0 : (demand <= 0 ? 1 : Math.min(1, supply / demand));
    const used = Math.min(demand, supply), frac = supply > 0 ? used / supply : 0;
    for (const p of n.prods) {
      p.output = p.maxOut * frac;
      if (p.type === 'engine') { p.boxes[0].a = Math.max(0, p.boxes[0].a - p.output / G.TPS / 30e3); p.working = p.output > 1; p.anim += p.output / p.proto.power / G.TPS; }
    }
    for (const c of n.cons) c.sat = sat;
    n.supply = supply; n.demand = demand; n.used = used; n.sat = sat;
  }
}

function fluidTick() {
  for (const e of G.ents) if (e.type === 'pump') { e.boxes[0].a = e.boxes[0].cap; }
  for (const [a, b] of G.fluidPairs) {
    const fl = a.a > 0.01 ? a.f : (b.a > 0.01 ? b.f : null);
    if (!fl) continue;
    if (a.a > 0.01 && b.a > 0.01 && a.f !== b.f) continue;
    if ((a.only && a.only !== fl) || (b.only && b.only !== fl)) continue;
    let diff = (a.a - b.a) * 0.45;
    if (diff > 0) diff = Math.min(diff, b.cap - b.a); else diff = Math.max(diff, -(a.cap - a.a));
    a.a -= diff; b.a += diff;
    a.f = b.f = fl;
  }
  for (const e of G.ents) if (e.type === 'pipe' && e.boxes[0].a < 0.01) { e.boxes[0].a = 0; e.boxes[0].f = null; }
}

// ---------- 研究 ----------
G.addResearchUnit = function (id) {
  if (G.techDone.has(id)) return;
  G.techProgress[id] = (G.techProgress[id] || 0) + 1;
  if (G.techProgress[id] >= G.TECHS[id].count) G.finishTech(id);
};
G.finishTech = function (id) {
  G.techDone.add(id);
  for (const r of G.TECHS[id].unlock) G.unlocked.add(r);
  if (G.research.cur === id) G.research.cur = null;
  G.ui && G.ui.toast('研究完成：' + G.TECHS[id].name);
  G.sfx && G.sfx('research');
  G.ui && G.ui.refresh();
};

// ---------- 主循环一帧 ----------
G.tick = 0;
G.stats = { produced: {} };
G.daylight = 1;
// 昼夜：一个周期 7 分钟。白天 → 黄昏 → 夜晚 → 黎明
const DAY_LEN = 25200;
G.daylightAt = function (tick) {
  const p = (tick % DAY_LEN) / DAY_LEN;
  if (p < 0.5) return 1; if (p < 0.62) return 1 - (p - 0.5) / 0.12;
  if (p < 0.8) return 0; if (p < 0.92) return (p - 0.8) / 0.12;
  return 1;
};
G.step = function () {
  G.tick++;
  G.daylight = G.daylightAt(G.tick);
  if (G.powerDirty) G.rebuildPower();
  if (G.fluidDirty) G.rebuildFluids();
  solvePower();
  const ents = G.ents;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    switch (e.type) {
      case 'belt': case 'underground': case 'splitter': beltTick(e); break;
      case 'inserter': inserterTick(e); break;
      case 'drill': drillTick(e); break;
      case 'furnace': furnaceTick(e); break;
      case 'assembler': assemblerTick(e); break;
      case 'lab': labTick(e); break;
      case 'boiler': boilerTick(e); break;
      case 'beacon': beaconTick(e); break;
    }
  }
  fluidTick();
};
