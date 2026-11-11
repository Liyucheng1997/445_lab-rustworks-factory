// 模型实例池、预览组、3D 渲染的物品图标与图集
(function () {
'use strict';
const X = G.gfx, T = X.T, PI = Math.PI;
const L = new T.Matrix4();

X.buildModels = function () {
  X.models = {};
  for (const k in X.modelDefs) {
    const m = X.models[k] = X.modelDefs[k]();
    m.pool = new X.Pool(m.s, X.matMain);
    if (m.alt) m.poolAlt = new X.Pool(m.alt, X.matMain);
    if (m.arm) m.poolArm = new X.Pool(m.arm, X.matMain);
    for (const p of m.parts || []) p.pool = new X.Pool(p.g, p.glow ? X.matGlow : X.matMain, { shadow: !p.glow, receive: !p.glow });
  }
  X.buildBelts();
};

// 以原点为中心、朝北的独立模型组（用于图标与放置预览）
X.previewGroup = function (pid) {
  const g = new T.Group(), p = G.PROTOS[pid], bl = X.belt[pid], m = X.models[pid];
  const add = (geo, mat, mx) => { const me = new T.Mesh(geo, mat); if (mx) me.applyMatrix4(mx); g.add(me); return me; };
  const belt = x => { add(bl.S.geo, X.matMain, L.makeTranslation(x, 0, 0)); add(bl.sS.geo, bl.sS.mat, L.makeTranslation(x, 0, 0)); };
  if (p.type === 'belt') belt(0);
  else if (p.type === 'underground') { belt(0); add(m.s, X.matMain); }
  else if (p.type === 'splitter') { belt(-0.5); belt(0.5); add(m.s, X.matMain); }
  else {
    add(m.s, X.matMain);
    if (m.arm) { add(m.arm, X.matMain); add(m.arm, X.matMain, L.makeRotationY(PI)); }
    const e = { x: -p.w / 2, y: -p.h / 2, w: p.w, h: p.h, dir: 0, ang: 0.3, anim: 0, working: false, id: 0 };
    for (const part of m.parts || []) if (part.fn(e, 0, L)) add(part.g, part.glow ? X.matGlow : X.matMain, L);
  }
  return g;
};

X.bakeIcons = function () {
  const S = 128, cv = document.createElement('canvas');
  const r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(S, S, false);
  const sc = new T.Scene();
  sc.add(new T.HemisphereLight(0xffffff, 0xb0a090, 2.3));
  const sun = new T.DirectionalLight(0xfff4e0, 3.4); sun.position.set(-3, 5, 4); sc.add(sun);
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const atlas = document.createElement('canvas'); atlas.width = atlas.height = 1024;
  const ag = atlas.getContext('2d'), box = new T.Box3(), ctr = new T.Vector3(), v = new T.Vector3();
  X.icons = {}; X.cell = {};
  G.ITEM_ORDER.concat(['wreck']).forEach((id, i) => { // 残骸没有对应物品，但面板标题要用它的图标
    const it = G.ITEMS[id] || { place: id };
    let obj;
    if (it.place) obj = X.previewGroup(it.place);
    else { const im = X.itemModel(id); obj = new T.Mesh(im.g, im.flat ? X.matFlat : X.matMain); }
    sc.add(obj); obj.updateMatrixWorld(true);
    box.setFromObject(obj); box.getCenter(ctr);
    cam.position.set(ctr.x + 7, ctr.y + 10, ctr.z + 12); cam.lookAt(ctr); cam.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).applyMatrix4(cam.matrixWorldInverse);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const h = Math.max(x1 - x0, y1 - y0) / 2 * 1.04, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    cam.left = mx - h; cam.right = mx + h; cam.bottom = my - h; cam.top = my + h; cam.updateProjectionMatrix();
    r.render(sc, cam);
    const c2 = document.createElement('canvas'); c2.width = c2.height = S;
    c2.getContext('2d').drawImage(cv, 0, 0);
    X.icons[id] = c2;
    const col = i % 8, row = (i / 8) | 0;
    X.cell[id] = [col, row];
    ag.fillStyle = 'rgba(0,0,0,0.32)'; ag.beginPath(); ag.ellipse(col * 128 + 70, row * 128 + 90, 44, 26, 0, 0, 7); ag.fill();
    ag.drawImage(c2, col * 128 + 6, row * 128 + 6, 116, 116);
    sc.remove(obj);
  });
  r.dispose(); r.forceContextLoss();
  const tex = X.atlasTex = new T.CanvasTexture(atlas); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  X.itemPool = new X.QuadPool(X.quadMat(`uniform sampler2D map; uniform vec3 uLight; varying vec2 vUv; varying vec4 vD;
    void main(){ vec4 c = texture2D(map, vec2((vD.x + vUv.x) / 8.0, 1.0 - (vD.y + 1.0 - vUv.y) / 8.0));
      if (c.a < 0.02) discard; c.rgb *= mix(vec3(1.0), uLight, 0.65); gl_FragColor = c;
      #include <colorspace_fragment>
    }`, { uniforms: { map: { value: tex }, uLight: X.uLight } }), 3);
  X.smokePool = new X.QuadPool(X.quadMat(`varying vec2 vUv; varying vec4 vD;
    void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vD.rgb, smoothstep(1.0, 0.15, d) * vD.a);
      #include <colorspace_fragment>
    }`), 5);
  X.glowPool = new X.QuadPool(X.quadMat(`varying vec2 vUv; varying vec4 vD;
    void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vD.rgb, pow(max(0.0, 1.0 - d), 1.8) * vD.a); }`, { blending: T.AdditiveBlending }), 6);
};
const urls = {};
G.icon = id => X.icons[id];
G.iconURL = id => urls[id] || (urls[id] = X.icons[id].toDataURL());
})();
