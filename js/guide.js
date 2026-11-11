// 物品说明：用途、来源，以及合成提示的生成
(function () {
'use strict';
// 用途说明
G.DESC = {
  'wood': '燃料，也用来造木箱和小型电线杆。',
  'coal': '最常用的燃料，比木材耐烧一倍。',
  'stone': '造石炉，或炼成石砖。',
  'iron-ore': '放进熔炉炼成铁板。',
  'copper-ore': '放进熔炉炼成铜板。',
  'iron-plate': '最基础的材料，几乎所有东西都要用。',
  'copper-plate': '用来做铜线，进而做电路板。',
  'steel-plate': '高级材料，用于钢箱、钢炉、太阳能板和求救信标。',
  'stone-brick': '造钢炉用。',
  'iron-gear': '机械零件。钻机、传送带、机械臂、组装机都要用。',
  'copper-cable': '做电路板和小型电线杆。1 块铜板出 2 根。',
  'circuit': '电子元件，所有用电设备的核心材料。',
  'red-pack': '放进研究站，用来研究科技。',
  'green-pack': '进阶科技要用的第二种数据卡。',
  'pipe': '输送水和蒸汽。把抽水泵、锅炉、蒸汽机连起来。',
  'stone-furnace': '把矿石炼成板材。烧燃料，不用电，四面都能进料。',
  'steel-furnace': '速度是石炉的两倍，同样烧燃料。',
  'burner-drill': '放在矿石上自动采矿。烧燃料，不用电。矿石从黄色出料口吐出来，前面要有熔炉、箱子或传送带接着。',
  'electric-drill': '用电的钻机，采矿范围 5×5，速度是燃料钻机的两倍。',
  'belt': '运送物品。物品沿箭头方向移动，机械臂可以从上面取放。',
  'fast-belt': '速度是普通传送带的两倍。',
  'underground-belt': '让传送带从地下穿过其他建筑。要放两个：一个入口、一个出口，方向相同，中间最多隔 4 格。',
  'splitter': '把一条传送带平均分成两条，也可以把两条并成一条。',
  'burner-inserter': '把物品从身后（取）抓到身前（放）。可以把传送带上的煤自动送进钻机、熔炉当燃料，也能把熔炉的成品取进箱子。烧燃料，没燃料时会自己从身后的箱子、传送带或机器的燃料格里取。',
  'inserter': '用电的机械臂，在传送带、箱子、机器之间搬东西。身后是取货格，身前是放货格。',
  'long-inserter': '能隔一格抓取和放下，可以跨过一条传送带。',
  'fast-inserter': '速度接近普通机械臂的三倍。',
  'wooden-chest': '存放物品，16 格。',
  'iron-chest': '存放物品，32 格。',
  'steel-chest': '存放物品，48 格。',
  'boiler': '烧燃料把水变成蒸汽。两侧接水，另一面的口出蒸汽，接到蒸汽机。',
  'steam-engine': '用蒸汽发电，最大 900 kW。一头接锅炉的蒸汽口，再用电线杆把电送出去。',
  'offshore-pump': '只能放在水边，源源不断抽水，不耗电。出水口用管道接到锅炉。',
  'small-pole': '输电。给周围 5×5 范围内的机器供电，两根杆之间最远 7.5 格。',
  'medium-pole': '输电。供电范围 7×7，两根杆之间最远 9 格。',
  'assembler-1': '按选定的配方自动生产物品，需要电。用机械臂送原料、取成品。',
  'assembler-2': '比组装机 I 快 50%。',
  'lab': '消耗数据卡研究科技，需要电。多放几座研究更快。',
  'solar-panel': '白天发电 60 kW，夜里不发电。不需要燃料。',
  'beacon': '最终目标。接入电网后持续充能约 2 分钟，充满即发出求救信号。',
  'wreck': '你坠毁的登陆舱，里面还有一些补给。',
};
// 不能手搓的东西从哪来
const DIG = '按住右键手挖，或把钻机放在矿上自动开采';
G.SOURCE = {
  'wood': '按住右键砍树', 'coal': DIG, 'stone': DIG + '；敲碎岩石也能得到', 'iron-ore': DIG, 'copper-ore': DIG,
  'iron-plate': '把铁矿放进熔炉炼出来', 'copper-plate': '把铜矿放进熔炉炼出来', 'stone-brick': '把石头放进熔炉炼出来（2 个石头出 1 块）',
  'steel-plate': '把铁板放进熔炉再炼一次（5 块铁板出 1 块），需先研究「钢铁冶炼」',
};

const fmtList = m => Object.entries(m).map(([k, v]) => `${G.itemName(k)} ×${v}`).join('、');
G.techFor = function (rid) { for (const id in G.TECHS) if (G.TECHS[id].unlock.includes(rid)) return G.TECHS[id]; return null; };
G.craftRecipeOf = it => G.CRAFT_RECIPES.find(x => x.out[it]);

// 一样东西怎么获得（一句话）
G.howTo = function (it) {
  if (G.SOURCE[it]) return G.SOURCE[it];
  const r = G.craftRecipeOf(it);
  if (!r) return '';
  if (r.lock && !G.unlocked.has(r.id)) { const t = G.techFor(r.id); return `需先研究「${t ? t.name : '?'}」`; }
  return `可手搓：${fmtList(r.in)}${r.out[it] > 1 ? `（一次出 ${r.out[it]} 个）` : ''}`;
};
// 从零开始做 n 次配方，总共要多少原料（不能再拆的那些）
G.rawCost = function (rid, n, acc) {
  const r = G.RECIPES[rid];
  for (const it in r.in) {
    const need = r.in[it] * n, sub = G.craftRecipeOf(it);
    if (sub) G.rawCost(sub.id, Math.ceil(need / sub.out[it]), acc); else acc[it] = (acc[it] || 0) + need;
  }
  return acc;
};
// 按现在的背包，做 1 次还缺哪些原料
G.shortage = function (rid) {
  const inv = Object.assign({}, G.inv.items), miss = {};
  (function go(id, n) {
    const r = G.RECIPES[id];
    for (const it in r.in) {
      let need = r.in[it] * n;
      const use = Math.min(inv[it] || 0, need);
      inv[it] = (inv[it] || 0) - use; need -= use;
      if (!need) continue;
      const sub = G.recipeFor(it);
      if (sub) go(sub.id, Math.ceil(need / sub.out[it])); else miss[it] = (miss[it] || 0) + need;
    }
  })(rid, 1);
  return miss;
};

// 物品提示：名字 + 用途 + 来源
G.itemTip = function (it, withSource) {
  const d = G.DESC[it], how = withSource ? G.howTo(it) : '';
  return `<b>${G.itemName(it)}</b>${d ? `<div class='tdesc'>${d}</div>` : ''}${how ? `<div class='tget'>获得：${how}</div>` : ''}`;
};
// 配方提示：材料逐条写明怎么来，再给出合计原料和缺口
G.recipeTip = function (rid, mode) { // mode: 'hand' 手搓面板 | 'machine' 组装机选配方 | 'locked'
  const r = G.RECIPES[rid], it = Object.keys(r.out)[0];
  let h = `<b>${G.itemName(it)}</b>${r.out[it] > 1 ? ` ×${r.out[it]}` : ''}`;
  if (G.DESC[it]) h += `<div class='tdesc'>${G.DESC[it]}</div>`;
  if (mode === 'locked') { const t = G.techFor(rid); h += `<div class='twarn'>未解锁：需先研究「${t ? t.name : '?'}」（按 T 打开科技）</div>`; }
  h += `<div class='tsec'>材料（做一次耗时 ${r.time} 秒）</div>`;
  for (const k in r.in) {
    const have = G.inv.count(k), ok = mode !== 'hand' || have >= r.in[k];
    h += `<div class='ing${ok ? '' : ' miss'}'><img src='${G.iconURL(k)}'> ${G.itemName(k)} ×${r.in[k]}${mode === 'hand' ? ` <small>(有 ${have})</small>` : ''}</div><div class='thow'>${G.howTo(k)}</div>`;
  }
  const raw = G.rawCost(rid, 1, {});
  if (Object.keys(raw).some(k => !(k in r.in)) || Object.keys(raw).length !== Object.keys(r.in).length) h += `<div class='tsec'>从头做起合计要</div><div>${fmtList(raw)}</div>`;
  if (mode === 'hand') {
    const miss = G.shortage(rid);
    h += Object.keys(miss).length ? `<div class='twarn'>还缺：${fmtList(miss)}</div>` : `<div class='tok'>材料够了。缺的中间零件会自动一起搓。</div>`;
    h += `<small>左键 ×1 · 右键 ×5 · Shift 全部</small>`;
  }
  return h;
};
})();
