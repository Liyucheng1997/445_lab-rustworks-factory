// 建筑：创建、放置、拆除、库存操作、电网与管网拓扑
'use strict';
G.ents = [];
G.nextId = 1;
G.isBeltLike = e => e && (e.type === 'belt' || e.type === 'underground' || e.type === 'splitter');

// ---------- 槽位工具 ----------
G.slotsAdd = function (slots, item, count) {
  const st = G.ITEMS[item].stack; let left = count;
  for (const s of slots) if (s && s.item === item && s.count < st) { const n = Math.min(st - s.count, left); s.count += n; left -= n; if (!left) return count; }
  for (let i = 0; i < slots.length && left; i++) if (!slots[i]) { const n = Math.min(st, left); slots[i] = { item, count: n }; left -= n; }
  return count - left;
};
G.slotsSpace = function (slots, item) {
  const st = G.ITEMS[item].stack; let n = 0;
  for (const s of slots) n += !s ? st : (s.item === item ? st - s.count : 0);
  return n;
};
G.slotsRemove = function (slots, item, count) {
  let left = count;
  for (let i = slots.length - 1; i >= 0 && left; i--) {
    const s = slots[i];
    if (s && s.item === item) { const n = Math.min(s.count, left); s.count -= n; left -= n; if (!s.count) slots[i] = null; }
  }
  return count - left;
};
// 单格 {item,count}；dry=只计算不修改
function slotAdd(e, key, item, count, cap, dry) {
  const s = e[key];
  if (s && s.item !== item) return 0;
  const have = s ? s.count : 0, n = Math.max(0, Math.min(count, cap - have));
  if (!n || dry) return n;
  if (s) s.count += n; else e[key] = { item, count: n };
  return n;
}
function mapAdd(m, item, count, cap, dry) {
  const n = Math.max(0, Math.min(count, cap - (m[item] || 0)));
  if (n && !dry) m[item] = (m[item] || 0) + n;
  return n;
}

// ---------- 几何 ----------
G.dims = (proto, dir) => (dir % 2 === 1 ? [proto.h, proto.w] : [proto.w, proto.h]);
G.rotPt = function (x, y, w, h, r) {
  for (let i = 0; i < r; i++) { const nx = h - 1 - y; y = x; x = nx; const t = w; w = h; h = t; }
  return [x, y];
};
// 流体接口（朝北时）：[x, y, 方向, 槽位]
const FLUID_CONN = {
  pipe: [[0, 0, 0, 0], [0, 0, 1, 0], [0, 0, 2, 0], [0, 0, 3, 0]],
  pump: [[0, 0, 0, 0]],
  boiler: [[0, 1, 3, 0], [2, 1, 1, 0], [1, 0, 0, 1]],
  engine: [[1, 0, 0, 0], [1, 4, 2, 0]],
};
G.fluidConns = function (e) {
  const def = FLUID_CONN[e.type]; if (!def) return [];
  const p = e.proto;
  return def.map(([x, y, d, b]) => { const [rx, ry] = G.rotPt(x, y, p.w, p.h, e.dir); return { x: e.x + rx, y: e.y + ry, d: (d + e.dir) % 4, b }; });
};
G.drillArea = function (e) {
  const a = e.proto.area, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const x0 = Math.round(cx - a / 2), y0 = Math.round(cy - a / 2);
  return [x0, y0, a];
};
G.dropTile = function (e) { // 钻机出料位置
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, half = (e.dir % 2 ? e.w : e.h) / 2;
  return [Math.floor(cx + G.DX[e.dir] * (half + 0.5)), Math.floor(cy + G.DY[e.dir] * (half + 0.5))];
};

// ---------- 创建 ----------
G.createEntity = function (pid, x, y, dir) {
  const p = G.PROTOS[pid];
  if (p.rot === false) dir = 0;
  const [w, h] = G.dims(p, dir);
  const e = { id: G.nextId++, pid, proto: p, type: p.type, x, y, w, h, dir, sat: 0, working: false, anim: 0 };
  switch (p.type) {
    case 'furnace': Object.assign(e, { fuel: null, src: null, out: null, prog: 0, burn: 0 }); break;
    case 'drill': Object.assign(e, { fuel: null, burn: 0, prog: 0, outBuf: null }); break;
    case 'belt': e.lanes = [[], []]; e.curveFrom = -1; break;
    case 'underground': e.lanes = [[], []]; e.mode = 'in'; e.pair = null; break;
    case 'splitter': e.segs = [{ lanes: [[], []] }, { lanes: [[], []] }]; e.toggle = [0, 0]; break;
    case 'inserter': Object.assign(e, { hand: null, ang: 0, fuel: null, burn: 0, state: 0 }); break;
    case 'container': e.slots = new Array(p.slots).fill(null); break;
    case 'boiler': Object.assign(e, { fuel: null, burn: 0, boxes: [{ f: 'water', a: 0, cap: 200, only: 'water' }, { f: 'steam', a: 0, cap: 200, only: 'steam' }] }); break;
    case 'engine': e.boxes = [{ f: 'steam', a: 0, cap: 200, only: 'steam' }]; e.output = 0; break;
    case 'pump': e.boxes = [{ f: 'water', a: 0, cap: 100, only: 'water' }]; break;
    case 'pipe': e.boxes = [{ f: null, a: 0, cap: 100 }]; break;
    case 'pole': e.net = null; e.links = []; break;
    case 'assembler': Object.assign(e, { recipe: null, ins: {}, outs: {}, prog: 0, crafting: false }); break;
    case 'lab': Object.assign(e, { packs: {}, prog: 0, busy: false, unitTech: null }); break;
    case 'solar': e.output = 0; break;
    case 'beacon': e.charge = 0; break;
  }
  return e;
};

// ---------- 放置合法性 ----------
G.canPlace = function (pid, x, y, dir, ignore) {
  const p = G.PROTOS[pid];
  if (p.rot === false) dir = 0;
  const [w, h] = G.dims(p, dir), wd = G.world;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
    if (!G.inMap(tx, ty)) return false;
    const i = ty * G.W + tx;
    if (wd.tile[i] === 2 || wd.deco[i]) return false;
    const o = wd.grid[i];
    if (o && o !== ignore) return false;
  }
  if (p.type === 'pump') {
    const bx = x - G.DX[dir], by = y - G.DY[dir];
    if (!G.inMap(bx, by) || wd.tile[by * G.W + bx] !== 2) return false;
  }
  if (p.type === 'drill') {
    const [x0, y0, a] = G.drillArea({ proto: p, x, y, w, h });
    let any = false;
    for (let ty = y0; ty < y0 + a && !any; ty++) for (let tx = x0; tx < x0 + a; tx++) if (G.inMap(tx, ty) && wd.ore[ty * G.W + tx]) { any = true; break; }
    if (!any) return false;
  }
  // 玩家脚下不能放有碰撞的建筑
  if (!p.walk && G.player) {
    const pl = G.player, r = 0.3;
    if (pl.x + r > x && pl.x - r < x + w && pl.y + r > y && pl.y - r < y + h) return false;
  }
  return true;
};

G.addEntity = function (e) {
  G.ents.push(e);
  for (let ty = e.y; ty < e.y + e.h; ty++) for (let tx = e.x; tx < e.x + e.w; tx++) G.world.grid[ty * G.W + tx] = e;
  if (e.type === 'underground') G.pairUnderground(e);
  G.topologyChanged(e);
};
G.removeEntity = function (e) {
  const i = G.ents.indexOf(e); if (i >= 0) G.ents.splice(i, 1);
  for (let ty = e.y; ty < e.y + e.h; ty++) for (let tx = e.x; tx < e.x + e.w; tx++) if (G.world.grid[ty * G.W + tx] === e) G.world.grid[ty * G.W + tx] = null;
  if (e.type === 'underground' && e.pair) { e.pair.pair = null; e.pair = null; }
  e.dead = true;
  G.topologyChanged(e);
};
G.topologyChanged = function (e) {
  if (G.isBeltLike(e)) {
    for (let ty = e.y - 1; ty <= e.y + e.h; ty++) for (let tx = e.x - 1; tx <= e.x + e.w; tx++) {
      const n = G.entAt(tx, ty); if (n && n.type === 'belt') G.updateBeltShape(n);
    }
  }
  G.powerDirty = true;
  if (G.FLUID_TYPES.has(e.type)) G.fluidDirty = true;
};
G.FLUID_TYPES = new Set(['pipe', 'pump', 'boiler', 'engine']);

// ---------- 传送带拓扑 ----------
// n 是否把物品输出到 (tx,ty)
G.outputsInto = function (n, tx, ty) {
  if (!n) return false;
  if (n.type === 'belt' || (n.type === 'underground' && n.mode === 'out'))
    return n.x + G.DX[n.dir] === tx && n.y + G.DY[n.dir] === ty;
  if (n.type === 'splitter') {
    for (let s = 0; s < 2; s++) { const [sx, sy] = G.splitterSegTile(n, s); if (sx + G.DX[n.dir] === tx && sy + G.DY[n.dir] === ty) return true; }
  }
  return false;
};
G.updateBeltShape = function (e) {
  const d = e.dir, bx = e.x - G.DX[d], by = e.y - G.DY[d];
  e.curveFrom = -1;
  if (G.outputsInto(G.entAt(bx, by), e.x, e.y)) return;
  let feeders = [];
  for (const sd of [(d + 1) % 4, (d + 3) % 4]) {
    const n = G.entAt(e.x + G.DX[sd], e.y + G.DY[sd]);
    if (G.outputsInto(n, e.x, e.y)) feeders.push((sd + 2) % 4);
  }
  if (feeders.length === 1) e.curveFrom = feeders[0];
};
G.splitterSegTile = function (e, s) {
  // 段 0 在行进方向左侧
  if (s === 0) return [e.x + (e.dir === 2 ? 1 : 0), e.y + (e.dir === 3 ? 1 : 0)];
  return [e.x + (e.dir === 0 ? 1 : 0), e.y + (e.dir === 1 ? 1 : 0)];
};
G.pairUnderground = function (e) {
  const d = e.dir, md = e.proto.maxDist;
  for (let k = 1; k <= md; k++) {
    const n = G.entAt(e.x - G.DX[d] * k, e.y - G.DY[d] * k);
    if (n && n.type === 'underground' && n.dir === d) {
      if (n.mode === 'in' && !n.pair) { e.mode = 'out'; e.pair = n; n.pair = e; }
      return;
    }
  }
};

// ---------- 电网 ----------
G.nets = [];
G.rebuildPower = function () {
  G.powerDirty = false;
  const poles = G.ents.filter(e => e.type === 'pole');
  const par = new Map(); poles.forEach(p => par.set(p, p));
  const find = p => { while (par.get(p) !== p) { par.set(p, par.get(par.get(p))); p = par.get(p); } return p; };
  for (const p of poles) p.links = [];
  // 所有够得着的电线杆都算连通，但只画最小生成树上的电线，避免蜘蛛网
  const pairs = [];
  for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++) {
    const a = poles[i], b = poles[j], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d <= Math.min(a.proto.reach, b.proto.reach)) pairs.push([d, a, b]);
  }
  pairs.sort((p, q) => p[0] - q[0]);
  for (const [, a, b] of pairs) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) { par.set(ra, rb); a.links.push(b); }
  }
  const map = new Map(); G.nets = [];
  for (const p of poles) {
    const root = find(p);
    if (!map.has(root)) { const n = { id: G.nets.length, poles: [], cons: [], prods: [], demand: 0, supply: 0, sat: 0 }; map.set(root, n); G.nets.push(n); }
    const n = map.get(root); n.poles.push(p); p.net = n;
  }
  for (const e of G.ents) {
    const isCons = e.proto.energy === 'electric', isProd = e.type === 'engine' || e.type === 'solar';
    if (!isCons && !isProd) continue;
    e.net = null;
    for (const p of poles) {
      const s = p.proto.supply, cx = p.x + 0.5, cy = p.y + 0.5;
      if (e.x < cx + s && e.x + e.w > cx - s && e.y < cy + s && e.y + e.h > cy - s) { e.net = p.net; break; }
    }
    if (e.net) (isCons ? e.net.cons : e.net.prods).push(e);
  }
};

// ---------- 管网 ----------
G.fluidPairs = [];
G.rebuildFluids = function () {
  G.fluidDirty = false; G.fluidPairs = [];
  for (const e of G.ents) {
    if (!G.FLUID_TYPES.has(e.type)) continue;
    e.fconn = [false, false, false, false];
  }
  for (const e of G.ents) {
    if (!G.FLUID_TYPES.has(e.type)) continue;
    for (const c of G.fluidConns(e)) {
      const nx = c.x + G.DX[c.d], ny = c.y + G.DY[c.d], n = G.entAt(nx, ny);
      if (!n || n === e || !G.FLUID_TYPES.has(n.type)) continue;
      const back = G.fluidConns(n).find(k => k.x === nx && k.y === ny && k.d === (c.d + 2) % 4);
      if (!back) continue;
      if (e.type === 'pipe') e.fconn[c.d] = true;
      if (e.id < n.id) G.fluidPairs.push([e.boxes[c.b], n.boxes[back.b]]);
    }
  }
};

// ---------- 物品进出（机械臂/钻机/玩家共用） ----------
const AUTO_FUEL = 5;
G.isFuel = item => !!G.ITEMS[item].fuel;
// 燃料耗尽：没有燃料物品，且剩余热量不够再跑一帧（不能只判断 burn<=0，剩一点零头时同样动不了）
G.noFuel = e => !e.fuel && e.burn < e.proto.power / G.TPS;
G.hasFuelSlot = e => e.proto.energy === 'burner';
// 返回实际放入数量；manual=玩家手动（上限更高）
G.insert = function (e, item, count, manual, dry) {
  if (G.hasFuelSlot(e) && G.isFuel(item) && !(e.type === 'furnace' && G.SMELT_BY_INPUT[item] && e.fuel && e.fuel.item !== item)) {
    const n = slotAdd(e, 'fuel', item, count, manual ? G.ITEMS[item].stack : AUTO_FUEL, dry);
    if (n || e.type !== 'furnace') return n;
  }
  switch (e.type) {
    case 'container': return dry ? Math.min(count, G.slotsSpace(e.slots, item)) : G.slotsAdd(e.slots, item, count);
    case 'furnace': {
      const r = G.SMELT_BY_INPUT[item];
      if (!r || (r.lock && !G.unlocked.has(r.id))) return 0;
      return slotAdd(e, 'src', item, count, manual ? G.ITEMS[item].stack : r.in[item] * 3, dry);
    }
    case 'assembler': {
      const r = e.recipe && G.RECIPES[e.recipe];
      if (!r || !r.in[item]) return 0;
      return mapAdd(e.ins, item, count, manual ? Math.max(G.ITEMS[item].stack, r.in[item]) : r.in[item] * 2, dry);
    }
    case 'lab':
      if (item !== 'red-pack' && item !== 'green-pack') return 0;
      return mapAdd(e.packs, item, count, manual ? 200 : 4, dry);
  }
  return 0;
};
G.canAccept = (e, item) => !!e && (G.isBeltLike(e) || G.insert(e, item, 1, false, true) > 0);
// 取一个物品（机械臂用）；want(item) 判断目标是否需要
G.takeOne = function (e, want) {
  switch (e.type) {
    case 'container':
      for (let i = 0; i < e.slots.length; i++) { const s = e.slots[i]; if (s && want(s.item)) { s.count--; const it = s.item; if (!s.count) e.slots[i] = null; return it; } }
      return null;
    case 'furnace':
      if (e.out && want(e.out.item)) { const it = e.out.item; if (!--e.out.count) e.out = null; return it; }
      return null;
    case 'assembler':
      for (const k in e.outs) if (e.outs[k] > 0 && want(k)) { e.outs[k]--; return k; }
      return null;
  }
  return null;
};
// 拆除时归还的物品
G.entityContents = function (e) {
  const out = [];
  const add = (item, n) => { if (item && n > 0) out.push([item, n]); };
  for (const k of ['fuel', 'src', 'out']) if (e[k]) add(e[k].item, e[k].count);
  if (e.outBuf) add(e.outBuf, 1);
  if (e.craftIn) for (const k in e.craftIn) add(k, e.craftIn[k]);
  if (e.slots) for (const s of e.slots) if (s) add(s.item, s.count);
  if (e.ins) for (const k in e.ins) add(k, e.ins[k]);
  if (e.outs) for (const k in e.outs) add(k, e.outs[k]);
  if (e.packs) for (const k in e.packs) add(k, e.packs[k]);
  if (e.hand) add(e.hand, 1);
  const lanesOf = e.lanes ? [e.lanes] : (e.segs ? e.segs.map(s => s.lanes) : []);
  for (const ls of lanesOf) for (const l of ls) for (const it of l) add(it.item, 1);
  return out;
};

// 钻机吐不出矿时，看看前面那座建筑到底卡在哪
G.blockReason = function (n, item) {
  const nm = G.itemName(n.pid), it = G.itemName(item), warn = text => ({ text, icon: '!', col: '#ffc020' });
  if (n.type === 'furnace') {
    if (G.noFuel(n)) return warn(`前方的${nm}燃料烧完了：给它加木材或煤，它才能继续炼`);
    if (n.out && n.out.count >= G.ITEMS[n.out.item].stack) return warn(`前方${nm}里的${G.itemName(n.out.item)}堆满了（${n.out.count} 个）：点开它把成品取走，或在旁边放机械臂和箱子自动取`);
    if (n.src && n.src.item !== item) return warn(`前方${nm}里正在炼${G.itemName(n.src.item)}，不能混入${it}`);
    if (!G.SMELT_BY_INPUT[item]) return warn(`${nm}炼不了${it}（燃料格也满了）：改用箱子或传送带来接`);
    return { text: `前方的${nm}还没炼完，腾出位置后会继续（正常现象）` };
  }
  if (n.type === 'container') return warn(`前方的${nm}装满了：取走一些，或换更大的箱子`);
  if (G.isBeltLike(n)) return { text: '传送带上暂时没有空位，物品走开后会继续' };
  if (n.proto.energy === 'burner' && G.isFuel(item)) return { text: `前方${nm}的燃料格已满，烧掉一些后会继续` };
  return warn(`前方的${nm}不接收${it}：换成熔炉、箱子或传送带`);
};

// ---------- 状态诊断：机器为什么不工作 ----------
// 返回 { text, icon, col } 或 null；icon 为空表示只在文字里提示，不在地图上画图标
G.entStatus = function (e) {
  const p = e.proto, RED = '#ff5040', YEL = '#ffc020';
  if (p.energy === 'burner' && G.noFuel(e)) {
    if (e.type === 'inserter') return { text: '缺少燃料：会自己从身后的箱子、传送带或机器的燃料格里取一个，也可以手动放入木材或煤', icon: '🔥', col: '#ff8040' };
    let extra = '';
    if (e.type === 'drill') { const t = G.dropTile(e); if (!G.entAt(t[0], t[1])) extra = '。另外黄色出料口前方是空地，要放熔炉、箱子或传送带'; }
    return { text: '缺少燃料：这台机器烧木材或煤，不用电' + extra, icon: '🔥', col: '#ff8040' };
  }
  if (p.energy === 'electric') {
    if (!e.net) return { text: '未接入电网：在旁边放电线杆，连到蒸汽机或太阳能板', icon: '⚡', col: RED };
    if (e.net.supply <= 0) return { text: '电网里没有发电（夜晚太阳能板不发电）', icon: '⚡', col: RED };
    if (e.net.sat < 0.99 && (e.demand || 0) > 0) return { text: '电力不足，机器在降速运行', icon: '⚡', col: YEL };
  }
  if ((e.type === 'engine' || e.type === 'solar') && !e.net) return { text: '未接入电网：在旁边放电线杆', icon: '⚡', col: YEL };
  switch (e.type) {
    case 'drill': {
      if (e.depleted) return { text: '范围内的矿已采空', icon: '✕', col: RED };
      const t = G.dropTile(e), n = G.entAt(t[0], t[1]);
      if (!n) return { text: '出料口前方是空地：把熔炉、箱子或传送带放在黄色出料口正前方', icon: '!', col: YEL };
      if (e.outBuf) return G.blockReason(n, e.outBuf);
      break;
    }
    case 'furnace':
      if (e.out && e.out.count >= G.ITEMS[e.out.item].stack) return { text: `${G.itemName(e.out.item)}堆满了（${e.out.count} 个），已停工：点开取走，或放机械臂和箱子自动取`, icon: '!', col: YEL };
      if (!e.src && !e.crafting) return { text: '等待原料（铁矿、铜矿或石头）' };
      break;
    case 'assembler':
      if (!e.recipe) return { text: '未选择配方：左键点开后选一个' };
      if (!e.crafting) return { text: '等待原料' };
      break;
    case 'lab':
      if (!G.research.cur) return { text: '未选择研究：按 T 选一项科技' };
      if (!e.busy) return { text: '等待数据卡' };
      break;
    case 'boiler':
      if (e.boxes[0].a < 1) return { text: '没有水：用管道连到抽水泵', icon: '!', col: YEL };
      break;
    case 'engine':
      if (e.boxes[0].a < 1) return { text: '没有蒸汽：把锅炉的蒸汽口接到这里', icon: '!', col: YEL };
      break;
  }
  return null;
};

// ---------- 进出说明：这台机器从哪进、往哪出 ----------
G.insIO = function (e) { // 机械臂的 [取货格x, 取货格y, 放货格x, 放货格y]
  const r = e.proto.reach, d = e.dir;
  return [e.x - G.DX[d] * r, e.y - G.DY[d] * r, e.x + G.DX[d] * r, e.y + G.DY[d] * r];
};
// 一座建筑肯收什么 / 能被取走什么
G.acceptsText = function (n) {
  if (G.isBeltLike(n) || n.type === 'container') return '任何物品';
  switch (n.type) {
    case 'furnace': return '燃料和矿石';
    case 'assembler': return n.recipe ? '配方要用的材料' : '东西（但要先给它选配方）';
    case 'lab': return '数据卡';
  }
  return n.proto.energy === 'burner' ? '燃料（木材、煤）' : null;
};
G.givesText = function (n) {
  if (G.isBeltLike(n)) return '带上的物品';
  switch (n.type) { case 'container': return '里面的物品'; case 'furnace': return '炼好的成品'; case 'assembler': return '做好的成品'; }
  return null;
};
G.ioLines = function (e) {
  const L = [], nm = n => G.itemName(n.pid);
  if (e.type === 'inserter') {
    const [px, py, qx, qy] = G.insIO(e), src = G.entAt(px, py), tgt = G.entAt(qx, qy);
    if (!src) L.push(['取', '身后是空地，没有东西可取', 1]);
    else { const g = G.givesText(src); L.push(['取', g ? `从${nm(src)}拿${g}` : `${nm(src)}不能被机械臂取货`, g ? 0 : 1]); }
    if (!tgt) L.push(['放', '前方是空地，没有地方放', 1]);
    else { const a = G.acceptsText(tgt); L.push(['放', a ? `给${nm(tgt)}送${a}` : `${nm(tgt)}不收东西`, a ? 0 : 1]); }
    if (src && tgt) L.push(['', '只会拿前方那台机器肯收的东西']);
  } else if (e.type === 'drill') {
    const t = G.dropTile(e), n = G.entAt(t[0], t[1]);
    if (e.proto.energy === 'burner') L.push(['进', '燃料：手动放，或用机械臂从传送带、箱子送进来']);
    L.push(['出', n ? `矿石从黄色出料口吐进${nm(n)}` : '矿石从黄色出料口吐出，前方现在是空地', n ? 0 : 1]);
  } else if (e.type === 'furnace') {
    L.push(['进', '燃料和矿石，四面都能进：钻机直接吐进来，或用机械臂送']);
    L.push(['出', '成品留在炉里：手动取，或用机械臂取到箱子、传送带']);
  } else if (e.type === 'assembler') {
    L.push(['进', '配方材料：用机械臂送，或手动放']); L.push(['出', '成品留在机器里：用机械臂取，或手动取']);
  } else if (e.type === 'lab') L.push(['进', '数据卡：用机械臂送，或手动放']);
  else if (e.type === 'boiler') { L.push(['进', '燃料用机械臂送或手动放；水从两侧的管道口进']); L.push(['出', '蒸汽从另一面的管道口出，接蒸汽机']); }
  else if (e.type === 'container') L.push(['', '机械臂可以往里放，也可以从里面取']);
  else if (G.isBeltLike(e)) L.push(['', '物品沿箭头方向走；机械臂可以从带上取，也可以往带上放']);
  return L;
};
G.ioHTML = function (e) {
  return G.ioLines(e).map(([tag, text, bad]) => `<div class="io${bad ? ' bad' : ''}">${tag ? `<i class="t${tag === '取' || tag === '进' ? ' in' : ' out'}">${tag}</i>` : ''}${text}</div>`).join('');
};
