// 3D 渲染核心：渲染器、斜投影相机、光照、几何构建器、实例池
(function () {
'use strict';
const T = window.THREE;
const X = G.gfx = { K: 0.58, CAMH: 100, pools: [], T };
const _c = new T.Color(), _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler();
const _v = new T.Vector3(), _v2 = new T.Vector3(), _s = new T.Vector3(1, 1, 1);

X.init = function (canvas) {
  const r = X.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  const sc = X.scene = new T.Scene();
  sc.background = new T.Color('#0a0c0e');
  const cam = X.camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  cam.up.set(0, 0, -1);
  X.hemi = new T.HemisphereLight(0xeaf0ff, 0x9a8468, 1.55); sc.add(X.hemi);
  const sun = X.sun = new T.DirectionalLight(0xfff1dc, 2.7);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
  sc.add(sun); sc.add(sun.target);
  X.plight = new T.PointLight(0xffe2b0, 0, 13, 1.5); sc.add(X.plight);
  X.uLight = { value: new T.Vector3(1, 1, 1) }; X.uPl = { value: new T.Vector3(0, 0, 0) };
  X.makeMaterials();
};

X.resize = function (w, h) {
  X.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  X.renderer.setSize(w, h, true);
};

// 斜投影：地面不压缩，高度沿屏幕向上偏移 K 倍
X.updateCamera = function (cx, cz, s) {
  const cam = X.camera, hw = G.vw / 2 / s, hh = G.vh / 2 / s;
  cam.position.set(cx, X.CAMH, cz); cam.lookAt(cx, 0, cz);
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
  cam.updateProjectionMatrix();
  const e = cam.projectionMatrix.elements;
  e[9] = X.K / hh; e[13] += X.K * X.CAMH / hh;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld();
  // 太阳跟随视野
  const sun = X.sun, R = Math.max(hw, hh) * 1.15 + 8;
  sun.target.position.set(cx, 0, cz - hh * 0.1);
  sun.position.set(cx - 42, 72, cz + 20 - hh * 0.1);
  sun.target.updateMatrixWorld();
  const sh = sun.shadow.camera;
  if (Math.abs(sh.right - R) > 0.5) { sh.left = -R; sh.right = R; sh.top = R; sh.bottom = -R; sh.updateProjectionMatrix(); }
};

// ---------- 材质 ----------
function grime(mat, amt, seams) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vOp; varying vec3 vOn;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vOp = transformed; vOn = normal;
        #ifdef USE_INSTANCING
          vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWp; varying vec3 vOp; varying vec3 vOn;
        float gHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float gNoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(gHash(i), gHash(i+vec3(1,0,0)), f.x), mix(gHash(i+vec3(0,1,0)), gHash(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(gHash(i+vec3(0,0,1)), gHash(i+vec3(1,0,1)), f.x), mix(gHash(i+vec3(0,1,1)), gHash(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float gB = gNoise(vOp * 2.6 + 3.1) * 0.6 + gNoise(vOp * 10.0) * 0.4;
        float gS = gHash(floor(vOp * 24.0));
        float gH = smoothstep(0.0, 0.5, vWp.y);
        diffuseColor.rgb *= (${(1 - amt * 1.6).toFixed(2)} + ${(amt * 1.6).toFixed(2)} * gH) * (1.0 - ${amt.toFixed(2)} + ${(amt * 1.7).toFixed(2)} * gB) * (0.95 + 0.1 * gS);
        // 锈迹与污渍：靠近地面更重，沿竖直方向拉出流痕
        float gR = gNoise(vec3(vOp.x * 7.0, vOp.y * 1.6, vOp.z * 7.0) + 9.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.20, 0.11), ${(amt * 1.1).toFixed(2)} * smoothstep(0.55, 0.85, gB * 0.6 + gR * 0.5) * (1.0 - 0.55 * gH));
        ${seams ? `// 面板接缝
        vec3 gP = abs(fract(vOp * 2.3 + 0.5) - 0.5), gW = step(abs(vOn), vec3(0.7));
        vec3 gD = mix(vec3(1.0), gP, gW);
        float gM = min(gD.x, min(gD.y, gD.z));
        diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.03, gM));
        diffuseColor.rgb *= 1.0 + 0.1 * (smoothstep(0.03, 0.045, gM) - smoothstep(0.045, 0.09, gM));` : ''}`);
  };
  return mat;
}
X.makeMaterials = function () {
  X.matMain = grime(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.0 }), 0.24, true);
  X.matFlat = grime(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), 0.12, false);
  X.matGlow = new T.MeshBasicMaterial({ vertexColors: true });
  X.matGhostOk = new T.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.72, emissive: 0x0c4a1c, roughness: 0.7 });
  X.matGhostBad = new T.MeshStandardMaterial({ color: 0xff8a7a, vertexColors: true, transparent: true, opacity: 0.6, emissive: 0x7a0c06, roughness: 0.7 });
};

// ---------- 几何构建器（顶点色，合并为单个 BufferGeometry） ----------
function xf(x, y, z, o) {
  return _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0)), _s.set(o.sx || 1, o.sy || 1, o.sz || 1));
}
class B {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv && g.attributes.uv.array;
    _c.set(color);
    for (let i = 0, k = 0; i < P.length; i += 3, k += 2) {
      this.p.push(P[i], P[i + 1], P[i + 2]); this.n.push(N[i], N[i + 1], N[i + 2]); this.c.push(_c.r, _c.g, _c.b);
      this.u.push(U ? U[k] : 0, U ? U[k + 1] : 0);
    }
    g.dispose(); if (g !== geo) geo.dispose();
    return this;
  }
  // 底面在 y 的长方体
  box(x, y, z, w, h, d, c, o = {}) { return this.add(new T.BoxGeometry(w, h, d), c, xf(x, y + h / 2, z, o)); }
  // 圆柱：axis 为 y 时 y 是底面；x/z 轴时 (x,y,z) 是中心
  cyl(x, y, z, r, h, c, o = {}) {
    const g = new T.CylinderGeometry(o.r2 != null ? o.r2 : r, r, h, o.seg || 14);
    if (o.axis === 'x') g.rotateZ(-Math.PI / 2); else if (o.axis === 'z') g.rotateX(Math.PI / 2);
    return this.add(g, c, xf(x, o.axis ? y : y + h / 2, z, o));
  }
  sph(x, y, z, r, c, o = {}) {
    const g = o.ico != null ? new T.IcosahedronGeometry(r, o.ico) : new T.SphereGeometry(r, o.seg || 14, 10, 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI);
    return this.add(g, c, xf(x, y, z, o));
  }
  tor(x, y, z, R, r, c, o = {}) {
    const g = new T.TorusGeometry(R, r, 8, o.seg || 20);
    if (o.axis === 'y') g.rotateX(Math.PI / 2); else if (o.axis === 'x') g.rotateY(Math.PI / 2);
    return this.add(g, c, xf(x, y, z, o));
  }
  // 两点之间的方梁 / 圆杆
  beam(a, b, w, c, d) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    _q.setFromUnitVectors(_v.set(1, 0, 0), _v2.set(dx / L, dy / L, dz / L));
    _m.compose(_v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(1, 1, 1));
    return this.add(new T.BoxGeometry(L, w, d || w), c, _m);
  }
  rod(a, b, r, c, seg) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    _q.setFromUnitVectors(_v.set(0, 1, 0), _v2.set(dx / L, dy / L, dz / L));
    _m.compose(_v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(1, 1, 1));
    return this.add(new T.CylinderGeometry(r, r, L, seg || 10), c, _m);
  }
  // 齿轮：(x,y,z) 为中心，axis 为旋转轴
  gear(x, y, z, r, th, c, o = {}) {
    const n = o.teeth || 10, sh = new T.Shape(), tr = o.tooth || 0.8;
    for (let i = 0; i < n * 2; i++) {
      const a0 = i * Math.PI / n + 0.06, a1 = (i + 1) * Math.PI / n - 0.06, rad = i % 2 ? r * tr : r;
      sh[i ? 'lineTo' : 'moveTo'](Math.cos(a0) * rad, Math.sin(a0) * rad); sh.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad);
    }
    sh.closePath();
    if (o.hole) { const h = new T.Path(); h.absarc(0, 0, o.hole, 0, Math.PI * 2, true); sh.holes.push(h); }
    const g = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -th / 2);
    if (o.axis === 'x') g.rotateY(Math.PI / 2); else if (o.axis !== 'z') g.rotateX(Math.PI / 2);
    return this.add(g, c, xf(x, y, z, o));
  }
  // 四边形（自动修正绕序使法线朝 n）
  quad(a, b, c2, d, n, col, uv) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c2[0] - a[0], wy = c2[1] - a[1], wz = c2[2] - a[2];
    const flip = ((uy * wz - uz * wy) * n[0] + (uz * wx - ux * wz) * n[1] + (ux * wy - uy * wx) * n[2]) < 0;
    const idx = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3], P = [a, b, c2, d];
    _c.set(col);
    for (const i of idx) {
      this.p.push(P[i][0], P[i][1], P[i][2]); this.n.push(n[0], n[1], n[2]); this.c.push(_c.r, _c.g, _c.b);
      this.u.push(uv ? uv[i][0] : 0, uv ? uv[i][1] : 0);
    }
    return this;
  }
  // 圆弧棱柱（传送带弯道的护栏/底座）：圆心 (px,pz)，半径 r0..r1，角度 a0→a1（atan2(z,x)）
  ring(px, pz, r0, r1, a0, a1, y0, y1, col, N = 8, uvTop) {
    for (let i = 0; i < N; i++) {
      const A = a0 + (a1 - a0) * i / N, Bn = a0 + (a1 - a0) * (i + 1) / N;
      const ca = Math.cos(A), sa = Math.sin(A), cb = Math.cos(Bn), sb = Math.sin(Bn);
      const i0 = [px + ca * r0, 0, pz + sa * r0], o0 = [px + ca * r1, 0, pz + sa * r1], i1 = [px + cb * r0, 0, pz + sb * r0], o1 = [px + cb * r1, 0, pz + sb * r1];
      const at = (p, y) => [p[0], y, p[2]];
      this.quad(at(i0, y1), at(o0, y1), at(o1, y1), at(i1, y1), [0, 1, 0], col, uvTop && [[0, i / N], [1, i / N], [1, (i + 1) / N], [0, (i + 1) / N]]);
      if (y1 > y0) {
        const cm = Math.cos((A + Bn) / 2), sm = Math.sin((A + Bn) / 2);
        this.quad(at(o0, y0), at(o1, y0), at(o1, y1), at(o0, y1), [cm, 0, sm], col);
        this.quad(at(i0, y0), at(i1, y0), at(i1, y1), at(i0, y1), [-cm, 0, -sm], col);
      }
    }
    return this;
  }
  // 对已累积的全部顶点做整体变换
  tf(x, y, z, o = {}) {
    const m = xf(x, y, z, o).clone(), nm = new T.Matrix3().getNormalMatrix(m), P = this.p, N = this.n;
    for (let i = 0; i < P.length; i += 3) {
      _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); P[i] = _v.x; P[i + 1] = _v.y; P[i + 2] = _v.z;
      _v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(nm).normalize(); N[i] = _v.x; N[i + 1] = _v.y; N[i + 2] = _v.z;
    }
    return this;
  }
  join(o) {
    for (const k of ['p', 'n', 'c', 'u']) { const a = this[k], b = o[k]; for (let i = 0; i < b.length; i++) a.push(b[i]); }
    return this;
  }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
X.B = B;
X.b = () => new B();

// ---------- 实例池 ----------
class Pool {
  constructor(geo, mat, o = {}) { this.geo = geo; this.mat = mat; this.o = o; this.cap = o.cap || 32; this.n = 0; this.make(); X.pools.push(this); }
  make() {
    const old = this.mesh, m = this.mesh = new T.InstancedMesh(this.geo, this.mat, this.cap);
    m.frustumCulled = false; m.castShadow = this.o.shadow !== false; m.receiveShadow = this.o.receive !== false;
    if (this.o.order) m.renderOrder = this.o.order;
    if (old) { m.instanceMatrix.array.set(old.instanceMatrix.array); X.scene.remove(old); old.dispose(); }
    m.count = 0; X.scene.add(m);
  }
  begin() { this.n = 0; }
  push(mat) { if (this.n >= this.cap) { this.cap *= 2; this.make(); } this.mesh.setMatrixAt(this.n++, mat); }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; }
}
X.Pool = Pool;

// 水平贴片池（物品图标、辉光、烟雾），每个实例带一个 vec4 数据
class QuadPool {
  constructor(mat, order) { this.mat = mat; this.order = order; this.cap = 256; this.n = 0; this.make(); X.pools.push(this); }
  make() {
    const old = this.mesh, g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const d = this.data = new Float32Array(this.cap * 4);
    g.setAttribute('aD', new T.InstancedBufferAttribute(d, 4));
    const m = this.mesh = new T.InstancedMesh(g, this.mat, this.cap);
    m.frustumCulled = false; m.renderOrder = this.order; m.count = 0;
    if (old) { X.scene.remove(old); old.geometry.dispose(); old.dispose(); }
    X.scene.add(m);
  }
  begin() { this.n = 0; }
  push(x, y, z, s, a, b, c, d) {
    if (this.n >= this.cap) return;
    const i = this.n++, D = this.data;
    this.mesh.setMatrixAt(i, _m.makeScale(s, 1, s).setPosition(x, y, z));
    D[i * 4] = a; D[i * 4 + 1] = b; D[i * 4 + 2] = c; D[i * 4 + 3] = d;
  }
  end() {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.geometry.attributes.aD.needsUpdate = true;
    if (this.n >= this.cap) { this.cap *= 2; this.make(); }
  }
}
X.QuadPool = QuadPool;
const QV = `attribute vec4 aD; varying vec2 vUv; varying vec4 vD;
  void main(){ vUv = uv; vD = aD; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
X.quadMat = (frag, o) => new T.ShaderMaterial(Object.assign({ vertexShader: QV, fragmentShader: frag, transparent: true, depthWrite: false }, o));
})();
