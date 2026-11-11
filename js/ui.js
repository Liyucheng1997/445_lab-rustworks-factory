// 界面：快捷栏、背包与合成、建筑面板、科技树、提示
'use strict';
const $ = s => document.querySelector(s);
const fmt = n => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
function slotHTML(item, count, act, extra = '', tip) {
  if (!item) return `<div class="slot empty" data-act="${act}" ${extra}></div>`;
  return `<div class="slot" data-act="${act}" data-item="${item}" ${extra} data-tip="${esc(tip || G.itemTip(item))}"><img src="${G.iconURL(item)}">${count != null ? `<span class="cnt">${fmt(count)}</span>` : ''}</div>`;
}
function bar(frac, cls = '') { return `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></i></div>`; }

// 增量更新 DOM：只改动有变化的节点和属性。整块重写 innerHTML 会让鼠标下的元素不停被销毁重建（悬停闪烁）
function morph(a, b) {
  if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  const aa = a.attributes;
  for (let i = aa.length - 1; i >= 0; i--) if (!b.hasAttribute(aa[i].name)) a.removeAttribute(aa[i].name);
  for (const at of b.attributes) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  morphKids(a, b);
}
function morphKids(a, b) {
  const ac = a.childNodes, bc = b.childNodes;
  for (let i = 0; i < bc.length; i++) {
    const x = ac[i], y = bc[i];
    if (!x) a.appendChild(y.cloneNode(true));
    else if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) a.replaceChild(y.cloneNode(true), x);
    else morph(x, y);
  }
  while (ac.length > bc.length) a.removeChild(a.lastChild);
}
Object.defineProperty(Element.prototype, 'mHTML', {
  set(html) {
    if (this._mh === html) return;
    this._mh = html;
    const t = document.createElement('template'); t.innerHTML = html;
    morphKids(this, t.content);
  },
});

const UI = G.ui = {
  openEnt: null, invOpen: false, techOpen: false, tab: 0, _dirty: true,
  dirty() { this._dirty = true; },
  refresh() { this._dirty = true; this.update(); },
  toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2600);
  },
  init() {
    document.addEventListener('mousedown', ev => this.onMouse(ev));
    document.addEventListener('contextmenu', ev => { if (ev.target.closest('.panel,#quickbar')) ev.preventDefault(); });
    document.addEventListener('mousemove', ev => this.onTip(ev));
    $('#btn-inv').onclick = () => this.toggleInventory();
    $('#btn-tech').onclick = () => this.toggleTech();
    $('#btn-help').onclick = () => $('#help').classList.toggle('hidden');
    $('#btn-save').onclick = () => { if (G.save()) this.toast('已保存'); };
    $('#btn-new').onclick = () => { if (confirm('开始新游戏？当前存档会被覆盖。')) { G.noSave = true; localStorage.removeItem('rustworks-save-v1'); location.reload(); } };
    $('#help').onclick = () => $('#help').classList.add('hidden');
    if (!G.stats.intro && !G.stats.won && G.tick < 600) this.showIntro(0);
    else if (!localStorage.getItem('rustworks-seen-help')) { $('#help').classList.remove('hidden'); localStorage.setItem('rustworks-seen-help', '1'); }
    this.update();
  },
  closeAll() { this.invOpen = false; this.techOpen = false; this.openEnt = null; this.dirty(); this.update(); },
  toggleInventory() { const o = this.invOpen || this.openEnt; this.closeAll(); this.invOpen = !o; this.dirty(); this.update(); },
  toggleTech() { const o = this.techOpen; this.closeAll(); this.techOpen = !o; this.dirty(); this.update(); },
  openEntity(e) {
    if (e.type === 'belt' || e.type === 'underground' || e.type === 'splitter') return;
    if (e.pid === 'wreck') (G.stats.tut || (G.stats.tut = {})).wreck = 1;
    this.closeAll(); this.openEnt = e; this.invOpen = true; this.dirty(); this.update();
  },

  // ---------- 鼠标 ----------
  onMouse(ev) {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    ev.preventDefault();
    const act = el.dataset.act, item = el.dataset.item, right = ev.button === 2, pl = G.player, e = this.openEnt;
    G.sfx('click');
    switch (act) {
      case 'inv': {
        if (!item) break;
        if (e && !right) {
          const n = G.insert(e, item, Math.min(G.inv.count(item), ev.shiftKey ? G.inv.count(item) : G.ITEMS[item].stack), true);
          if (n) G.inv.remove(item, n); else this.toast('无法放入');
        } else pl.cursor = pl.cursor === item ? null : item;
        break;
      }
      case 'craft': {
        const rid = el.dataset.r;
        const n = ev.shiftKey ? G.craftableCount(rid) : right ? 5 : 1;
        if (n) G.craft(rid, n); else this.toast('材料不足');
        break;
      }
      case 'queue': G.cancelCraft(+el.dataset.i); break;
      case 'tab': this.tab = +el.dataset.i; break;
      case 'quick': {
        const i = +el.dataset.i;
        if (right) { pl.quick[i] = pl.cursor || null; }
        else if (pl.cursor && pl.quick[i] !== pl.cursor) pl.quick[i] = pl.cursor;
        else if (pl.quick[i] && G.inv.count(pl.quick[i])) pl.cursor = pl.cursor === pl.quick[i] ? null : pl.quick[i];
        break;
      }
      case 'take': this.takeFromEnt(el.dataset.k, item); break;
      case 'recipe': this.setRecipe(el.dataset.r); break;
      case 'tech': if (!G.techDone.has(el.dataset.t)) { G.research.cur = el.dataset.t; this.toast('开始研究：' + G.TECHS[el.dataset.t].name); } break;
      case 'close': this.closeAll(); break;
      case 'intro-next': if (this.introPage < this.INTRO.length - 1) this.showIntro(this.introPage + 1); else this.endIntro(); break;
      case 'intro-skip': this.endIntro(); break;
      case 'win-close': $('#win').classList.add('hidden'); break;
      case 'hintoff': (G.stats.tut || (G.stats.tut = {})).off = 1; break;
    }
    this.dirty(); this.update();
  },
  takeFromEnt(k, item) {
    const e = this.openEnt; if (!e) return;
    const give = (it, n) => G.inv.add(it, n);
    if (k === 'fuel' || k === 'src' || k === 'out') { const s = e[k]; if (s) { const n = give(s.item, s.count); s.count -= n; if (!s.count) e[k] = null; } }
    else if (k.startsWith('slot')) { const i = +k.slice(4), s = e.slots[i]; if (s) { const n = give(s.item, s.count); s.count -= n; if (!s.count) e.slots[i] = null; } }
    else if (k === 'ins' || k === 'outs' || k === 'packs') { const n = give(item, e[k][item] || 0); e[k][item] -= n; if (!e[k][item]) delete e[k][item]; }
  },
  setRecipe(rid) {
    const e = this.openEnt; if (!e || e.type !== 'assembler') return;
    for (const m of [e.ins, e.outs]) for (const k in m) if (m[k] > 0) G.inv.add(k, m[k]);
    if (e.craftIn) for (const k in e.craftIn) G.inv.add(k, e.craftIn[k]);
    e.ins = {}; e.outs = {}; e.crafting = false; e.craftIn = null; e.prog = 0;
    e.recipe = e.recipe === rid ? null : rid;
  },
  onTip(ev) {
    const tip = $('#tip'), el = ev.target.closest && ev.target.closest('[data-tip]');
    this._tipEl = el || null;
    if (!el) { tip.style.display = 'none'; return; }
    tip.innerHTML = this._tipSrc = el.dataset.tip; tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, ev.clientX + 16) + 'px';
    tip.style.top = Math.min(innerHeight - r.height - 8, ev.clientY + 16) + 'px';
  },

  // ---------- 刷新 ----------
  update() {
    const pl = G.player;
    // 快捷栏
    $('#quickbar').mHTML = pl.quick.map((it, i) => {
      const sel = it && pl.cursor === it ? 'sel' : '';
      const c = it ? G.inv.count(it) : null;
      return `<div class="qwrap ${sel}"><span class="key">${(i + 1) % 10}</span>${slotHTML(it, c, 'quick', `data-i="${i}" ${it && !c ? 'style="opacity:.35"' : ''}`, it ? G.itemTip(it) + '<small>左键选取，手持物品时左键绑定，右键清除</small>' : '空快捷栏：手持物品时点这里绑定')}</div>`;
    }).join('');
    // 手持
    $('#cursor-info').mHTML = pl.cursor ? `<img src="${G.iconURL(pl.cursor)}"> ${G.itemName(pl.cursor)} ×${G.inv.count(pl.cursor)}<small>${G.ITEMS[pl.cursor].place ? ' R 旋转 · Q 放下' : ' 左键建筑可放入 · Q 放下'}</small>` : '';
    // 手搓队列
    $('#queue').mHTML = pl.queue.slice(0, 12).map((q, i) => {
      const top = G.RECIPES[q.recipe], it = Object.keys(top.out)[0];
      const p = i === 0 ? (q.idx + q.prog) / q.steps.length : 0;
      return `<div class="qitem" data-act="queue" data-i="${i}" data-tip="${G.itemName(it)}<br><small>点击取消</small>"><img src="${G.iconURL(it)}">${i === 0 ? `<b style="height:${p * 100}%"></b>` : ''}</div>`;
    }).join('');
    // 研究条
    const cur = G.research.cur;
    $('#research').mHTML = cur ? `<div>研究中：${G.TECHS[cur].name}</div>${bar((G.techProgress[cur] || 0) / G.TECHS[cur].count, 'blue')}` : `<div class="dim">未在研究 — 按 T 选择科技</div>`;
    $('#hint').mHTML = this.hintHTML();
    this.updateInfo();
    // 面板
    $('#panel-inv').classList.toggle('hidden', !this.invOpen);
    $('#panel-tech').classList.toggle('hidden', !this.techOpen);
    if (this.invOpen) {
      if (this.openEnt && this.openEnt.dead) this.openEnt = null;
      if (this._dirty) this.renderInventory();
      const side = $('#side');
      if (this.openEnt) { side.mHTML = this.entityHTML(this.openEnt); this._sideCraft = false; }
      else if (this._dirty || !this._sideCraft) { side.mHTML = this.craftHTML(); this._sideCraft = true; }
    }
    if (this.techOpen) $('#tech-body').mHTML = this.techHTML();
    // 鼠标停着不动时，提示内容（如"有 N 个"）也跟着数据更新
    const te = this._tipEl;
    if (te) {
      if (!te.isConnected || te.dataset.tip == null) { $('#tip').style.display = 'none'; this._tipEl = null; }
      else if (te.dataset.tip !== this._tipSrc) $('#tip').innerHTML = this._tipSrc = te.dataset.tip;
    }
    this._dirty = false;
  },
  renderInventory() {
    const items = G.ITEM_ORDER.filter(k => G.inv.count(k) > 0);
    const slots = [];
    for (const k of items) { let c = G.inv.count(k); const st = G.ITEMS[k].stack; while (c > 0) { slots.push([k, Math.min(c, st)]); c -= st; } }
    let h = '';
    for (let i = 0; i < 80; i++) h += slots[i] ? slotHTML(slots[i][0], slots[i][1], 'inv', '', `${G.itemTip(slots[i][0], true)}<small>背包里共 ${G.inv.count(slots[i][0])} 个 · ${this.openEnt ? '左键放入建筑 · 右键拿在手上' : '左键拿在手上'}</small>`) : slotHTML(null, 0, 'inv');
    $('#inv-grid').mHTML = h;
    $('#inv-title').textContent = `背包（${G.inv.slotsUsed()}/80）`;
  },
  craftHTML() {
    let h = `<div class="tabs">${G.CRAFT_GROUPS.map((g, i) => `<div class="tab ${i === this.tab ? 'on' : ''}" data-act="tab" data-i="${i}">${g.name}</div>`).join('')}</div><div class="grid craft">`;
    for (const it of G.CRAFT_GROUPS[this.tab].items) {
      const r = G.CRAFT_RECIPES.find(x => x.out[it]);
      if (!r) continue;
      const locked = r.lock && !G.unlocked.has(r.id);
      if (locked) { h += `<div class="slot locked" data-tip="${esc(G.recipeTip(r.id, 'locked'))}"><img src="${G.iconURL(it)}"></div>`; continue; }
      const n = G.craftableCount(r.id);
      h += `<div class="slot ${n ? '' : 'cant'}" data-act="craft" data-r="${r.id}" data-tip="${esc(G.recipeTip(r.id, 'hand'))}"><img src="${G.iconURL(it)}">${n ? `<span class="cnt">${fmt(n)}</span>` : ''}</div>`;
    }
    return h + '</div>';
  },
  techHTML() {
    let h = '';
    for (const id in G.TECHS) {
      const t = G.TECHS[id], done = G.techDone.has(id), avail = t.pre.every(p => G.techDone.has(p));
      const prog = (G.techProgress[id] || 0) / t.count, cur = G.research.cur === id;
      const cls = done ? 'done' : cur ? 'cur' : avail ? 'avail' : 'locked';
      h += `<div class="tech ${cls}" ${avail && !done ? `data-act="tech" data-t="${id}"` : ''}>
        <div class="tname">${t.name}${done ? ' ✔' : ''}</div>
        <div class="tunlock">${t.unlock.map(r => `<img src="${G.iconURL(Object.keys(G.RECIPES[r].out)[0])}" data-tip="${esc(G.itemTip(Object.keys(G.RECIPES[r].out)[0]))}">`).join('')}</div>
        <div class="tcost">${t.packs.map(p => `<img src="${G.iconURL(p)}">`).join('')} ×${t.count} · ${t.time}s/单位</div>
        ${t.pre.length ? `<div class="tpre">前置：${t.pre.map(p => G.TECHS[p].name).join('、')}</div>` : ''}
        ${!done && prog > 0 ? bar(prog, 'blue') : ''}
      </div>`;
    }
    return h;
  },

  // ---------- 任务线：按当前进度显示下一步 ----------
  hintHTML() {
    const S = G.stats, f = S.tut || (S.tut = {});
    if (f.off) return '';
    const ents = G.ents, has = t => ents.some(e => e.type === t);
    const drills = ents.filter(e => e.type === 'drill');
    const steps = [
      ['wreck', '搜刮残骸', () => !ents.some(e => e.pid === 'wreck'), '走到身旁冒烟的<b>登陆舱残骸</b>边，左键点开它，把里面的补给点进背包'],
      ['place', '第一台钻机', () => drills.length > 0, '按 <b>1</b> 拿起燃料钻机，左键放到蓝色的铁矿上。<b>R</b> 旋转，黄色出料口朝向你打算放熔炉的那一格'],
      ['out', '接上熔炉', () => drills.some(d => { const t = G.dropTile(d); return !!G.entAt(t[0], t[1]); }), '按 <b>2</b> 拿起石炉，放到闪烁的黄点上（钻机出料口正前方）。石炉四面都能进料'],
      ['fuel', '点火', () => drills.some(d => d.fuel || d.burn > 0), '这些机器烧燃料，<b>不用电</b>：左键点开钻机，再点左边背包里的<b>木材</b>或<b>煤</b>放进去。石炉也要放'],
      ['plate', '第一炉铁板', () => Object.keys(S.produced).length > 0, '等石炉炼出铁板，点开石炉，点产物格取回。燃料不够就按住<b>右键</b>砍树、挖煤'],
      ['auto', '自动取货', () => has('inserter') || has('belt'), '石炉里的成品堆到 100 个就会停工，钻机也会跟着堵住。手搓一个<b>燃料机械臂</b>和一个<b>木箱</b>：机械臂贴着石炉放（蓝点对着石炉、黄点对着箱子），它会自动把铁板搬进箱子，燃料会自己从石炉里分'],
      ['more', '扩建', () => drills.length > 1, '按 <b>E</b> 打开背包，在右侧手搓更多钻机、石炉、传送带和机械臂，把铜矿、煤矿也开起来'],
      ['lab', '研究站', () => has('lab'), '通讯阵列得从头造。先手搓一座<b>研究站</b>（电路板 ×10、铁齿轮 ×10、传送带 ×4）'],
      ['power', '通电', () => G.nets.some(n => n.supply > 0 && n.cons.length > 0), '研究站要用电：水边放<b>抽水泵</b> → 管道 → <b>锅炉</b>（加燃料）→ <b>蒸汽机</b>，再用<b>电线杆</b>把电送过去'],
      ['research', '第一项科技', () => G.techDone.size > 0, '手搓<b>基础数据卡</b>放进研究站，按 <b>T</b> 选一项科技。之后用组装机自动生产数据卡'],
      ['tech', '深空通讯', () => G.techDone.has('beacon'), '一路研究下去，直到解锁最终科技<b>深空通讯</b>。工厂越自动化，研究越快'],
      ['beacon', '求救信标', () => has('beacon'), '造出<b>求救信标</b>（钢板 ×50、电路板 ×100、铜线 ×100、铁齿轮 ×50），放下并接入电网'],
      ['win', '发出信号', () => !!S.won, '信标耗电 500 kW，持续供电约 2 分钟即可充满。确保发电够用，别让它断电'],
    ];
    for (let i = 0; i < steps.length; i++) {
      const [k, name, ok, text] = steps[i];
      if (f[k]) continue;
      if (ok()) { f[k] = 1; continue; }
      return `<div class="hint"><span class="x" data-act="hintoff" data-tip="关闭任务提示">✕</span><b>任务 ${i + 1}/${steps.length} · ${name}</b><div>${text}</div></div>`;
    }
    return '';
  },

  // ---------- 开场剧情 ----------
  INTRO: [
    ['坠落', '货运船<b>「长庚号」</b>在掠过这颗锈红色行星时，主引擎毫无征兆地熄了火。<br><br>你是船上唯一的随船工程师。弹射、过载、黑视——登陆舱拖着火砸进了一片荒原。'],
    ['清点', '你活了下来，但通讯阵列烧成了一坨渣，没有人知道你在这里。<br><br>好消息只有一个：这颗星球遍地是矿。铁、铜、煤、石头，就裸露在地表。你身上还带着一台钻机、一座石炉和几块铁板，残骸里也许还能翻出点别的。'],
    ['目标', '救援不会自己来。你得从一台钻机开始，搭起一整座自动化工厂，一步步把科技补回来，最后造出<b>求救信标</b>，把信号送进深空。<br><br>先去搜刮身旁的残骸。左上角的<b>任务</b>会告诉你下一步。'],
  ],
  showIntro(i) {
    this.introPage = i;
    const p = this.INTRO[i], last = i === this.INTRO.length - 1;
    $('#intro').classList.remove('hidden');
    $('#intro').innerHTML = `<div class="ibox"><img class="iart" src="${G.iconURL('wreck')}">
      <div class="ich">第 ${'一二三'[i]} 幕 · ${p[0]}</div><div class="itext">${p[1]}</div>
      <div class="idots">${this.INTRO.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ibtns">${last ? '' : '<button data-act="intro-skip">跳过</button>'}<button class="primary" data-act="intro-next">${last ? '开始求生' : '继续'}</button></div></div>`;
  },
  endIntro() {
    G.stats.intro = 1; $('#intro').classList.add('hidden');
    if (!localStorage.getItem('rustworks-seen-help')) { $('#help').classList.remove('hidden'); localStorage.setItem('rustworks-seen-help', '1'); }
  },
  win() {
    const sec = Math.floor((G.stats.won || G.tick) / 60), hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
    const top = Object.entries(G.stats.produced).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $('#win').classList.remove('hidden');
    $('#win').innerHTML = `<div class="ibox"><img class="iart" src="${G.iconURL('beacon')}">
      <div class="ich">信号已发出</div>
      <div class="itext">信标的光柱刺破了锈色的云层。四十分钟后，接收器里传来一句带着杂音的回话：<br><b>「长庚号幸存者，这里是救援船，坐标已确认，原地等待。」</b><br><br>你回头看了一眼身后轰鸣的工厂——从一台钻机开始，都是你亲手搭起来的。</div>
      <div class="istats">用时 <b>${hh ? hh + ' 小时 ' : ''}${mm} 分 ${ss} 秒</b> · 建筑 <b>${G.ents.length}</b> 座 · 科技 <b>${G.techDone.size}</b> 项</div>
      <div class="iprod">${top.map(([k, v]) => `<span><img src="${G.iconURL(k)}">${fmt(v)}</span>`).join('')}</div>
      <div class="ibtns"><button class="primary" data-act="win-close">继续建设</button></div></div>`;
  },

  // ---------- 建筑面板 ----------
  entityHTML(e) {
    const p = e.proto, name = G.itemName(e.pid);
    const slot = (k, s, label) => `<div class="lab">${label}</div>` + slotHTML(s && s.item, s && s.count, 'take', `data-k="${k}"`, s ? G.itemName(s.item) + '<br><small>点击取回</small>' : '');
    const power = () => {
      if (p.energy !== 'electric') return '';
      if (!e.net) return '';
      return `<div>电力满足率</div>${bar(e.net.sat, e.net.sat < 0.99 ? 'yellow' : 'green')}`;
    };
    const fuel = () => (p.energy === 'burner' ? `<div class="row">${slot('fuel', e.fuel, e.fuel ? '燃料' : '燃料 — 点左边背包里的木材或煤放入')}</div>${bar(e.burn / ((e.fuelItem && G.ITEMS[e.fuelItem].fuel) || 4e6), 'orange')}` : '');
    let h = `<div class="ehead"><img src="${G.iconURL(e.pid)}"><b>${name}</b><span class="x" data-act="close">✕</span></div>`;
    { const st = G.entStatus(e); if (st) h += `<div class="statusline ${st.icon ? 'warn' : 'dim'}">${st.icon ? '⚠ ' : ''}${st.text}</div>`; }
    h += G.ioHTML(e);
    const status = e.working ? '<span class="ok">工作中</span>' : '<span class="dim">闲置</span>';
    switch (e.type) {
      case 'container': {
        if (e.pid === 'wreck') h += '<div class="dim" style="margin-bottom:6px">登陆舱还在冒烟。能用的东西都在这了，点击格子取出。</div>';
        h += `<div class="grid">${e.slots.map((s, i) => slotHTML(s && s.item, s && s.count, 'take', `data-k="slot${i}"`, s ? G.itemName(s.item) + '<br><small>点击取回</small>' : '')).join('')}</div>`;
        break;
      }
      case 'furnace':
        h += `<div>${status}</div>${fuel()}<div class="row">${slot('src', e.src, '原料')}<div class="arrow">➜</div>${slot('out', e.out, '产物')}</div>${bar(e.prog)}`;
        break;
      case 'drill': {
        const [x0, y0, a] = G.drillArea(e); let left = 0;
        for (let y = y0; y < y0 + a; y++) for (let x = x0; x < x0 + a; x++) if (G.inMap(x, y)) left += G.world.oreAmt[y * G.W + x] * (G.world.ore[y * G.W + x] ? 1 : 0);
        h += `<div>${status} · 剩余矿量 ${fmt(left)}</div>${fuel()}${power()}<div>开采进度</div>${bar(e.prog)}<div class="dim">产量 ${(p.speed).toFixed(2)}/秒</div>`;
        break;
      }
      case 'assembler': {
        const r = e.recipe && G.RECIPES[e.recipe];
        h += `<div>${status}</div>${power()}`;
        if (r) {
          h += `<div class="row">${Object.keys(r.in).map(k => slotHTML(k, e.ins[k] || 0, 'take', 'data-k="ins"', `${G.itemName(k)} 需 ${r.in[k]}<br><small>点击取回</small>`)).join('')}<div class="arrow">➜</div>${Object.keys(r.out).map(k => slotHTML(k, e.outs[k] || 0, 'take', 'data-k="outs"', G.itemName(k) + '<br><small>点击取回</small>')).join('')}</div>${bar(e.prog)}<div class="dim">每次 ${(r.time / p.speed).toFixed(1)} 秒</div>`;
        }
        h += `<div class="lab">选择配方</div><div class="grid craft">`;
        for (const rc of G.CRAFT_RECIPES) {
          if (rc.lock && !G.unlocked.has(rc.id)) continue;
          const it = Object.keys(rc.out)[0];
          h += `<div class="slot ${e.recipe === rc.id ? 'sel' : ''}" data-act="recipe" data-r="${rc.id}" data-tip="${esc(G.recipeTip(rc.id, 'machine'))}"><img src="${G.iconURL(it)}"></div>`;
        }
        h += '</div>';
        break;
      }
      case 'lab': {
        const cur = G.research.cur;
        h += `<div>${status}</div>${power()}<div class="row">${['red-pack', 'green-pack'].map(k => slotHTML(k, e.packs[k] || 0, 'take', 'data-k="packs"', G.itemName(k))).join('')}</div>${bar(e.prog, 'blue')}<div>${cur ? '当前研究：' + G.TECHS[cur].name : '<span class="warn">未选择研究（按 T）</span>'}</div>`;
        break;
      }
      case 'boiler':
        h += `<div>${status}</div>${fuel()}<div>水 ${e.boxes[0].a.toFixed(0)}/200</div>${bar(e.boxes[0].a / 200, 'blue')}<div>蒸汽 ${e.boxes[1].a.toFixed(0)}/200</div>${bar(e.boxes[1].a / 200)}`;
        break;
      case 'engine':
        h += `<div>蒸汽 ${e.boxes[0].a.toFixed(0)}/200</div>${bar(e.boxes[0].a / 200)}<div>输出 ${G.fmtPower(e.output || 0)} / ${G.fmtPower(p.power)}</div>${bar((e.output || 0) / p.power, 'green')}`;
        break;
      case 'solar':
        h += `<div>输出 ${G.fmtPower(e.output || 0)} / ${G.fmtPower(p.power)}</div>`;
        break;
      case 'pipe': case 'pump': {
        const b = e.boxes[0];
        h += `<div>${b.f ? (b.f === 'water' ? '水' : '蒸汽') : '空'} ${b.a.toFixed(0)}/${b.cap}</div>${bar(b.a / b.cap, 'blue')}`;
        break;
      }
      case 'beacon':
        h += `${power()}<div>充能 ${(e.charge * 100).toFixed(0)}%</div>${bar(e.charge, 'blue')}<div class="dim">${e.charge >= 1 ? '信号已发出。' : `耗电 ${G.fmtPower(p.power)}，满功率下约 ${p.chargeTime} 秒充满；电力不足会变慢，断电会暂停。`}</div>`;
        break;
      case 'pole': {
        const n = e.net;
        h += n ? `<div>发电能力 ${G.fmtPower(n.supply)}</div><div>用电需求 ${G.fmtPower(n.demand)}</div>${bar(n.supply ? n.used / n.supply : 0, 'green')}<div>满足率 ${(n.sat * 100).toFixed(0)}%</div><div class="dim">电网内用电设备 ${n.cons.length} 台，发电设备 ${n.prods.length} 台</div>` : '';
        break;
      }
      case 'inserter':
        h += `${fuel()}${power()}<div class="dim">手上：${e.hand ? G.itemName(e.hand) : '无'}</div>`;
        break;
    }
    return h;
  },
  updateInfo() {
    const m = G.mouse, el = $('#info');
    if (!m.inside) { el.mHTML = ''; return; }
    const [wx, wy] = G.screenToWorld(m.x, m.y), pk = G.pick(wx, wy), tx = pk.tx, ty = pk.ty;
    if (!G.inMap(tx, ty)) { el.mHTML = ''; return; }
    const e = pk.e, w = G.world, i = ty * G.W + tx;
    let h = '';
    if (e) {
      h = `<b>${G.itemName(e.pid)}</b>`;
      if (G.DESC[e.pid]) h += `<div class="idesc">${G.DESC[e.pid]}</div>`;
      h += G.ioHTML(e);
      const st = G.entStatus(e);
      if (st) h += `<div class="${st.icon ? 'warn' : 'dim'}">${st.icon ? '⚠ ' : ''}${st.text}</div>`;
      if (e.proto.energy === 'electric') h += `<div>耗电 ${G.fmtPower(e.proto.power)}</div>`;
      if (e.proto.energy === 'burner') h += `<div>燃料功率 ${G.fmtPower(e.proto.power)}</div>`;
      if (e.type === 'assembler' && e.recipe) h += `<div>配方：${G.itemName(Object.keys(G.RECIPES[e.recipe].out)[0])}</div>`;
      if (e.type === 'engine' || e.type === 'solar') h += `<div>输出 ${G.fmtPower(e.output || 0)}</div>`;
      if (e.type === 'belt' || e.type === 'underground' || e.type === 'splitter') h += `<div>速度 ${(e.proto.speed * 8).toFixed(0)} 件/秒</div>`;
      h += e.proto.fixed ? '<div class="dim">左键打开，取出里面的补给</div>' : `<div class="dim">右键拆除${e.type !== 'belt' ? ' · 左键打开' : ''} · R 旋转</div>`;
    } else if (w.deco[i]) h = `<b>${w.deco[i] === 1 ? '树木' : '岩石'}</b><div class="dim">右键采集</div>`;
    else if (w.ore[i]) h = `<b>${G.itemName(G.ORE_ITEMS[w.ore[i]])}</b><div>储量 ${w.oreAmt[i]}</div><div class="dim">右键开采</div>`;
    else if (w.tile[i] === 2) h = '<b>水</b>';
    el.mHTML = h;
  },
};
