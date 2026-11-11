// 锈星工坊 —— 静态数据：物品、配方、建筑、科技
'use strict';
const G = window.G = {};
G.VERSION = '1.0';
G.TPS = 60;
G.DX = [0, 1, 0, -1];
G.DY = [-1, 0, 1, 0];

// ---------- 物品 ----------
// icon: 绘制类型；c: 主色；fuel: 燃值(J)；place: 放置后生成的建筑
G.ITEMS = {
  'wood':           { name: '木材', stack: 100, icon: 'wood', c: '#9a6a3a', fuel: 2e6 },
  'coal':           { name: '煤', stack: 50, icon: 'ore', c: '#2b2b2b', fuel: 4e6 },
  'stone':          { name: '石头', stack: 50, icon: 'ore', c: '#b0a58a' },
  'iron-ore':       { name: '铁矿', stack: 50, icon: 'ore', c: '#5f7f9a' },
  'copper-ore':     { name: '铜矿', stack: 50, icon: 'ore', c: '#c8733a' },
  'iron-plate':     { name: '铁板', stack: 100, icon: 'plate', c: '#a9b4bd' },
  'copper-plate':   { name: '铜板', stack: 100, icon: 'plate', c: '#d98a4e' },
  'steel-plate':    { name: '钢板', stack: 100, icon: 'plate', c: '#dfe6ea' },
  'stone-brick':    { name: '石砖', stack: 100, icon: 'brick', c: '#b98d63' },
  'iron-gear':      { name: '铁齿轮', stack: 100, icon: 'gear', c: '#9aa6af' },
  'copper-cable':   { name: '铜线', stack: 200, icon: 'cable', c: '#e0904f' },
  'circuit':        { name: '电路板', stack: 200, icon: 'circuit', c: '#3fae4f' },
  'red-pack':       { name: '基础数据卡', stack: 200, icon: 'pack', c: '#e0463c' },
  'green-pack':     { name: '物流数据卡', stack: 200, icon: 'pack', c: '#45c24c' },
  'pipe':           { name: '管道', stack: 100, icon: 'pipe', c: '#8c949a', place: 'pipe' },
  'stone-furnace':  { name: '石炉', stack: 50, icon: 'ent', place: 'stone-furnace' },
  'steel-furnace':  { name: '钢炉', stack: 50, icon: 'ent', place: 'steel-furnace' },
  'burner-drill':   { name: '燃料钻机', stack: 50, icon: 'ent', place: 'burner-drill' },
  'electric-drill': { name: '电力钻机', stack: 50, icon: 'ent', place: 'electric-drill' },
  'belt':           { name: '传送带', stack: 100, icon: 'ent', place: 'belt' },
  'fast-belt':      { name: '高速传送带', stack: 100, icon: 'ent', place: 'fast-belt' },
  'underground-belt': { name: '地下传送带', stack: 50, icon: 'ent', place: 'underground-belt' },
  'splitter':       { name: '分流器', stack: 50, icon: 'ent', place: 'splitter' },
  'burner-inserter':{ name: '燃料机械臂', stack: 50, icon: 'ent', place: 'burner-inserter' },
  'inserter':       { name: '机械臂', stack: 50, icon: 'ent', place: 'inserter' },
  'long-inserter':  { name: '长臂机械臂', stack: 50, icon: 'ent', place: 'long-inserter' },
  'fast-inserter':  { name: '高速机械臂', stack: 50, icon: 'ent', place: 'fast-inserter' },
  'wooden-chest':   { name: '木箱', stack: 50, icon: 'ent', place: 'wooden-chest' },
  'iron-chest':     { name: '铁箱', stack: 50, icon: 'ent', place: 'iron-chest' },
  'steel-chest':    { name: '钢箱', stack: 50, icon: 'ent', place: 'steel-chest' },
  'boiler':         { name: '锅炉', stack: 50, icon: 'ent', place: 'boiler' },
  'steam-engine':   { name: '蒸汽机', stack: 10, icon: 'ent', place: 'steam-engine' },
  'offshore-pump':  { name: '抽水泵', stack: 20, icon: 'ent', place: 'offshore-pump' },
  'small-pole':     { name: '小型电线杆', stack: 50, icon: 'ent', place: 'small-pole' },
  'medium-pole':    { name: '中型电线杆', stack: 50, icon: 'ent', place: 'medium-pole' },
  'assembler-1':    { name: '组装机 I', stack: 50, icon: 'ent', place: 'assembler-1' },
  'assembler-2':    { name: '组装机 II', stack: 50, icon: 'ent', place: 'assembler-2' },
  'lab':            { name: '研究站', stack: 10, icon: 'ent', place: 'lab' },
  'solar-panel':    { name: '太阳能板', stack: 50, icon: 'ent', place: 'solar-panel' },
  'beacon':         { name: '求救信标', stack: 1, icon: 'ent', place: 'beacon' },
};
G.ITEM_ORDER = Object.keys(G.ITEMS);

// ---------- 建筑原型 ----------
// w,h 为朝北时的尺寸；energy: 'burner' | 'electric' | null；power: 功率(W)
G.PROTOS = {
  'stone-furnace':  { type: 'furnace', w: 2, h: 2, speed: 1, energy: 'burner', power: 90e3 },
  'steel-furnace':  { type: 'furnace', w: 2, h: 2, speed: 2, energy: 'burner', power: 90e3 },
  'burner-drill':   { type: 'drill', w: 2, h: 2, speed: 0.25, energy: 'burner', power: 150e3, area: 2 },
  'electric-drill': { type: 'drill', w: 3, h: 3, speed: 0.5, energy: 'electric', power: 90e3, area: 5 },
  'belt':           { type: 'belt', w: 1, h: 1, speed: 1.875, walk: true },
  'fast-belt':      { type: 'belt', w: 1, h: 1, speed: 3.75, walk: true },
  'underground-belt': { type: 'underground', w: 1, h: 1, speed: 1.875, maxDist: 5, walk: true },
  'splitter':       { type: 'splitter', w: 2, h: 1, speed: 1.875, walk: true },
  'burner-inserter':{ type: 'inserter', w: 1, h: 1, cycle: 1.7, reach: 1, energy: 'burner', power: 94e3 },
  'inserter':       { type: 'inserter', w: 1, h: 1, cycle: 1.2, reach: 1, energy: 'electric', power: 13e3 },
  'long-inserter':  { type: 'inserter', w: 1, h: 1, cycle: 0.86, reach: 2, energy: 'electric', power: 20e3 },
  'fast-inserter':  { type: 'inserter', w: 1, h: 1, cycle: 0.43, reach: 1, energy: 'electric', power: 46e3 },
  'wooden-chest':   { type: 'container', w: 1, h: 1, slots: 16, rot: false },
  'iron-chest':     { type: 'container', w: 1, h: 1, slots: 32, rot: false },
  'steel-chest':    { type: 'container', w: 1, h: 1, slots: 48, rot: false },
  'boiler':         { type: 'boiler', w: 3, h: 2, energy: 'burner', power: 1.8e6 },
  'steam-engine':   { type: 'engine', w: 3, h: 5, power: 900e3 },
  'offshore-pump':  { type: 'pump', w: 1, h: 1 },
  'pipe':           { type: 'pipe', w: 1, h: 1, rot: false },
  'small-pole':     { type: 'pole', w: 1, h: 1, supply: 2.5, reach: 7.5, rot: false },
  'medium-pole':    { type: 'pole', w: 1, h: 1, supply: 3.5, reach: 9, rot: false },
  'assembler-1':    { type: 'assembler', w: 3, h: 3, speed: 0.5, energy: 'electric', power: 75e3, rot: false },
  'assembler-2':    { type: 'assembler', w: 3, h: 3, speed: 0.75, energy: 'electric', power: 150e3, rot: false },
  'lab':            { type: 'lab', w: 3, h: 3, energy: 'electric', power: 60e3, rot: false },
  'solar-panel':    { type: 'solar', w: 3, h: 3, power: 60e3, rot: false },
  // 最终目标：通电充能 2 分钟后发出求救信号
  'beacon':         { type: 'beacon', w: 3, h: 3, energy: 'electric', power: 500e3, chargeTime: 120, rot: false },
  // 出生点的登陆舱残骸：装着开局补给，不能拆
  'wreck':          { type: 'container', w: 3, h: 2, slots: 8, rot: false, fixed: true, name: '登陆舱残骸' },
};
for (const k in G.PROTOS) G.PROTOS[k].id = k;

// ---------- 配方 ----------
// cat: 'craft'（手搓/组装机） | 'smelt'（熔炉）；lock: 需研究解锁
G.RECIPES = {};
function R(id, out, inp, time, opt = {}) {
  G.RECIPES[id] = Object.assign({ id, out: typeof out === 'string' ? { [out]: 1 } : out, in: inp, time, cat: 'craft', lock: false }, opt);
}
R('s-iron', 'iron-plate', { 'iron-ore': 1 }, 3.2, { cat: 'smelt' });
R('s-copper', 'copper-plate', { 'copper-ore': 1 }, 3.2, { cat: 'smelt' });
R('s-brick', 'stone-brick', { 'stone': 2 }, 3.2, { cat: 'smelt' });
R('s-steel', 'steel-plate', { 'iron-plate': 5 }, 16, { cat: 'smelt', lock: true });

R('wooden-chest', 'wooden-chest', { 'wood': 2 }, 0.5);
R('iron-chest', 'iron-chest', { 'iron-plate': 8 }, 0.5);
R('steel-chest', 'steel-chest', { 'steel-plate': 8 }, 0.5, { lock: true });
R('iron-gear', 'iron-gear', { 'iron-plate': 2 }, 0.5);
R('copper-cable', { 'copper-cable': 2 }, { 'copper-plate': 1 }, 0.5);
R('circuit', 'circuit', { 'iron-plate': 1, 'copper-cable': 3 }, 0.5);
R('pipe', 'pipe', { 'iron-plate': 1 }, 0.5);
R('stone-furnace', 'stone-furnace', { 'stone': 5 }, 0.5);
R('steel-furnace', 'steel-furnace', { 'steel-plate': 6, 'stone-brick': 10 }, 3, { lock: true });
R('burner-drill', 'burner-drill', { 'iron-gear': 3, 'stone-furnace': 1, 'iron-plate': 3 }, 2);
R('electric-drill', 'electric-drill', { 'circuit': 3, 'iron-gear': 5, 'iron-plate': 10 }, 2);
R('belt', { 'belt': 2 }, { 'iron-gear': 1, 'iron-plate': 1 }, 0.5);
R('fast-belt', 'fast-belt', { 'iron-gear': 5, 'belt': 1 }, 0.5, { lock: true });
R('underground-belt', { 'underground-belt': 2 }, { 'iron-plate': 10, 'belt': 5 }, 1, { lock: true });
R('splitter', 'splitter', { 'circuit': 5, 'iron-plate': 5, 'belt': 4 }, 1, { lock: true });
R('burner-inserter', 'burner-inserter', { 'iron-plate': 1, 'iron-gear': 1 }, 0.5);
R('inserter', 'inserter', { 'circuit': 1, 'iron-gear': 1, 'iron-plate': 1 }, 0.5);
R('long-inserter', 'long-inserter', { 'inserter': 1, 'iron-gear': 1, 'iron-plate': 1 }, 0.5, { lock: true });
R('fast-inserter', 'fast-inserter', { 'inserter': 1, 'circuit': 2, 'iron-plate': 2 }, 0.5, { lock: true });
R('boiler', 'boiler', { 'stone-furnace': 1, 'pipe': 4 }, 0.5);
R('steam-engine', 'steam-engine', { 'iron-gear': 8, 'pipe': 5, 'iron-plate': 10 }, 0.5);
R('offshore-pump', 'offshore-pump', { 'circuit': 2, 'pipe': 1, 'iron-gear': 1 }, 0.5);
R('small-pole', { 'small-pole': 2 }, { 'wood': 1, 'copper-cable': 2 }, 0.5);
R('medium-pole', 'medium-pole', { 'steel-plate': 2, 'iron-plate': 2, 'copper-plate': 2 }, 0.5, { lock: true });
R('assembler-1', 'assembler-1', { 'circuit': 3, 'iron-gear': 5, 'iron-plate': 9 }, 0.5, { lock: true });
R('assembler-2', 'assembler-2', { 'circuit': 3, 'iron-gear': 5, 'iron-plate': 20, 'assembler-1': 1 }, 0.5, { lock: true });
R('lab', 'lab', { 'circuit': 10, 'iron-gear': 10, 'belt': 4 }, 2);
R('solar-panel', 'solar-panel', { 'steel-plate': 5, 'circuit': 15, 'copper-plate': 5 }, 10, { lock: true });
R('red-pack', 'red-pack', { 'copper-plate': 1, 'iron-gear': 1 }, 5);
R('green-pack', 'green-pack', { 'inserter': 1, 'belt': 1 }, 6, { lock: true });
R('beacon', 'beacon', { 'steel-plate': 50, 'circuit': 100, 'copper-cable': 100, 'iron-gear': 50 }, 30, { lock: true });

// 熔炉按输入物品自动选择配方
G.SMELT_BY_INPUT = {};
for (const r of Object.values(G.RECIPES)) if (r.cat === 'smelt') G.SMELT_BY_INPUT[Object.keys(r.in)[0]] = r;

// ---------- 科技 ----------
G.TECHS = {
  'automation':   { name: '自动化', packs: ['red-pack'], count: 10, time: 10, pre: [], unlock: ['assembler-1', 'long-inserter'] },
  'logistics':    { name: '物流学', packs: ['red-pack'], count: 20, time: 15, pre: [], unlock: ['underground-belt', 'splitter'] },
  'electronics':  { name: '电子学', packs: ['red-pack'], count: 30, time: 15, pre: ['automation'], unlock: ['fast-inserter'] },
  'steel':        { name: '钢铁冶炼', packs: ['red-pack'], count: 50, time: 5, pre: [], unlock: ['s-steel', 'steel-chest'] },
  'logistic-pack':{ name: '物流数据卡', packs: ['red-pack'], count: 75, time: 5, pre: ['logistics'], unlock: ['green-pack'] },
  'automation-2': { name: '自动化 2', packs: ['red-pack', 'green-pack'], count: 40, time: 15, pre: ['electronics', 'logistic-pack'], unlock: ['assembler-2'] },
  'power-grid':   { name: '电网扩展', packs: ['red-pack', 'green-pack'], count: 120, time: 30, pre: ['steel', 'logistic-pack'], unlock: ['medium-pole'] },
  'logistics-2':  { name: '物流学 2', packs: ['red-pack', 'green-pack'], count: 200, time: 30, pre: ['logistic-pack'], unlock: ['fast-belt'] },
  'adv-material': { name: '高级材料', packs: ['red-pack', 'green-pack'], count: 75, time: 30, pre: ['steel', 'logistic-pack'], unlock: ['steel-furnace'] },
  'solar':        { name: '太阳能', packs: ['red-pack', 'green-pack'], count: 100, time: 30, pre: ['steel', 'electronics', 'logistic-pack'], unlock: ['solar-panel'] },
  'beacon':       { name: '深空通讯', packs: ['red-pack', 'green-pack'], count: 300, time: 30, pre: ['automation-2', 'power-grid', 'logistics-2', 'adv-material', 'solar'], unlock: ['beacon'] },
};

G.CRAFT_RECIPES = Object.values(G.RECIPES).filter(r => r.cat === 'craft');
G.CRAFT_GROUPS = [
  { name: '物流', items: ['wooden-chest', 'iron-chest', 'steel-chest', 'belt', 'fast-belt', 'underground-belt', 'splitter', 'burner-inserter', 'inserter', 'long-inserter', 'fast-inserter', 'small-pole', 'medium-pole', 'pipe'] },
  { name: '生产', items: ['burner-drill', 'electric-drill', 'stone-furnace', 'steel-furnace', 'assembler-1', 'assembler-2', 'boiler', 'steam-engine', 'offshore-pump', 'solar-panel', 'lab', 'beacon'] },
  { name: '中间品', items: ['iron-gear', 'copper-cable', 'circuit', 'red-pack', 'green-pack'] },
];

G.fmtPower = w => w >= 1e6 ? (w / 1e6).toFixed(2) + ' MW' : (w / 1e3).toFixed(1) + ' kW';
G.itemName = id => (G.ITEMS[id] ? G.ITEMS[id].name : (G.PROTOS[id] && G.PROTOS[id].name) || id);
