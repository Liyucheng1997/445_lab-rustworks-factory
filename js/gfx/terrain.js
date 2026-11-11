// 地形：着色器地面/水面、阴影承接面、按区块实例化的矿石/树木/岩石
(function () {
'use strict';
const X = G.gfx, T = X.T;
const ORE_RGB = [null, [0.36, 0.50, 0.62], [0.78, 0.42, 0.22], [0.10, 0.10, 0.11], [0.70, 0.64, 0.50]];
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();

const VERT = `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `
uniform sampler2D tTile; uniform sampler2D tOre; uniform float uTime; uniform vec3 uLight; uniform vec3 uPl; varying vec2 vW;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float t = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ t += noise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return t / 0.9375; }
void main(){
  vec2 w = vW;
  if (w.x < 0.0 || w.y < 0.0 || w.x > 256.0 || w.y > 256.0) { gl_FragColor = vec4(0.012, 0.014, 0.016, 1.0); return; }
  vec2 warp = (vec2(fbm(w * 0.9), fbm(w * 0.9 + 31.7)) - 0.5) * 0.9;
  vec4 m = texture2D(tTile, (w + warp) / 256.0);
  float n1 = fbm(w * 1.7), n2 = noise(w * 14.0), n3 = fbm(w * 0.13 + 7.0), n4 = noise(w * 41.0);
  float tuft = smoothstep(0.55, 0.8, noise(w * 6.0 + 3.0)) * n4;
  vec3 grass = mix(vec3(0.29, 0.35, 0.16), vec3(0.39, 0.44, 0.20), n1) * (0.86 + 0.28 * n3) * (0.9 + 0.2 * n2);
  grass += vec3(0.05, 0.07, 0.01) * tuft;
  vec3 dgrass = mix(vec3(0.17, 0.24, 0.12), vec3(0.26, 0.31, 0.15), n1) * (0.82 + 0.36 * n3) * (0.9 + 0.2 * n2);
  dgrass += vec3(0.03, 0.05, 0.01) * tuft;
  vec3 sand = mix(vec3(0.47, 0.39, 0.27), vec3(0.60, 0.51, 0.36), n1) * (0.86 + 0.28 * n3) * (0.93 + 0.14 * n2);
  sand *= 0.93 + 0.07 * step(0.82, n4);
  float pebble = smoothstep(0.80, 0.86, noise(w * 9.0 + 50.0));
  sand = mix(sand, sand * 0.72, pebble * 0.6);
  float sSand = smoothstep(0.42, 0.58, m.r + (n1 - 0.5) * 0.5);
  float sDark = smoothstep(0.42, 0.58, m.b + (n1 - 0.5) * 0.5);
  vec3 col = mix(grass, dgrass, sDark);
  col = mix(col, sand, sSand);
  // 矿区地表染色
  vec4 ore = texture2D(tOre, (w + warp * 0.5) / 256.0);
  float so = smoothstep(0.25, 0.6, ore.a + (n1 - 0.5) * 0.3);
  col = mix(col, mix(vec3(0.33, 0.29, 0.24), ore.rgb, 0.45) * (0.75 + 0.3 * n2), so * 0.8);
  // 水
  float wv = m.g + (n1 - 0.5) * 0.16;
  float sWater = smoothstep(0.46, 0.52, wv);
  float depth = smoothstep(0.5, 1.0, m.g);
  vec3 wcol = mix(vec3(0.20, 0.45, 0.48), vec3(0.07, 0.24, 0.35), depth);
  float r1 = noise(w * 1.3 + vec2(uTime * 0.22, uTime * 0.13)), r2 = noise(w * 2.1 - vec2(uTime * 0.17, -uTime * 0.21));
  wcol *= 0.9 + 0.2 * r1;
  float cau = (smoothstep(0.46, 0.5, r1) - smoothstep(0.5, 0.54, r1)) + (smoothstep(0.47, 0.5, r2) - smoothstep(0.5, 0.53, r2));
  wcol += vec3(0.05, 0.07, 0.07) * cau * (1.0 - 0.5 * depth);
  float wet = smoothstep(0.26, 0.46, wv) * (1.0 - sWater);
  col = mix(col, col * 0.62, wet);
  float foam = smoothstep(0.50, 0.54, wv) * (1.0 - smoothstep(0.56, 0.64 + 0.03 * sin(uTime * 1.3 + w.x * 0.8 + w.y), wv));
  col = mix(col, wcol, sWater);
  col += foam * 0.16 * (0.6 + 0.4 * n2);
  float pl = uPl.z * smoothstep(10.0, 1.0, distance(w, uPl.xy));
  col *= mix(uLight, vec3(1.05, 0.97, 0.84), pl * 0.7);
  gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
  #include <colorspace_fragment>
}`;

X.initTerrain = function () {
  const w = G.world, N = G.W * G.H;
  const td = new Uint8Array(N * 4), od = X.oreData = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const t = w.tile[i];
    td[i * 4] = t === 1 ? 255 : 0; td[i * 4 + 1] = t === 2 ? 255 : 0; td[i * 4 + 2] = t === 3 ? 255 : 0; td[i * 4 + 3] = 255;
    setOreTexel(i);
  }
  // 把地块掩码模糊一下，让地貌边界变圆滑（水只模糊一次，保持岸线位置）
  const blur = (ch, passes) => {
    const W = G.W, H = G.H, a = new Float32Array(N), b = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = td[i * 4 + ch];
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += a[yy * W + xx]; n++; } }
        b[y * W + x] = s / n;
      }
      a.set(b);
    }
    for (let i = 0; i < N; i++) td[i * 4 + ch] = a[i];
  };
  blur(0, 2); blur(2, 2); blur(1, 1);
  const mk = d => { const t = new T.DataTexture(d, G.W, G.H, T.RGBAFormat); t.magFilter = t.minFilter = T.LinearFilter; t.needsUpdate = true; return t; };
  X.tileTex = mk(td); X.oreTex = mk(od);
  const geo = new T.PlaneGeometry(G.W + 400, G.H + 400); geo.rotateX(-Math.PI / 2);
  X.terrainMat = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { tTile: { value: X.tileTex }, tOre: { value: X.oreTex }, uTime: { value: 0 }, uLight: X.uLight, uPl: X.uPl } });
  const ground = new T.Mesh(geo, X.terrainMat); ground.position.set(G.W / 2, 0, G.H / 2); ground.frustumCulled = false;
  X.scene.add(ground);
  const sh = new T.Mesh(geo, new T.ShadowMaterial({ opacity: 0.5, depthWrite: false }));
  X.shadowMesh = sh;
  sh.position.set(G.W / 2, 0.01, G.H / 2); sh.receiveShadow = true; sh.renderOrder = 1; sh.frustumCulled = false;
  X.scene.add(sh);
  // 共享几何
  X.lumpGeo = deform(new T.IcosahedronGeometry(1, 0), 0.25, 1);
  X.rockGeo = deform(new T.DodecahedronGeometry(1, 0), 0.22, 2);
  X.leafGeo = deform(new T.IcosahedronGeometry(1, 1), 0.2, 3);
  X.trunkGeo = new T.CylinderGeometry(0.07, 0.12, 1, 6); X.trunkGeo.translate(0, 0.5, 0);
  X.matOre = new T.MeshStandardMaterial({ flatShading: true, roughness: 0.5, metalness: 0.0 });
  X.matLeaf = new T.MeshStandardMaterial({ flatShading: true, roughness: 0.95 });
  X.chunkObjs = {};
};
function setOreTexel(i) {
  const o = G.world.ore[i], d = X.oreData, c = ORE_RGB[o];
  d[i * 4] = c ? c[0] * 255 : 0; d[i * 4 + 1] = c ? c[1] * 255 : 0; d[i * 4 + 2] = c ? c[2] * 255 : 0; d[i * 4 + 3] = c ? 255 : 0;
}
function deform(g, amt, seed) {
  const p = g.attributes.position, key = {};
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(2) + p.getY(i).toFixed(2) + p.getZ(i).toFixed(2);
    if (key[k] == null) key[k] = 1 + (G.hash2(i, seed, 5) - 0.5) * 2 * amt;
    p.setXYZ(i, p.getX(i) * key[k], p.getY(i) * key[k], p.getZ(i) * key[k]);
  }
  g.computeVertexNormals();
  return g;
}

function inst(geo, mat, list, shadow) { // list: [x,y,z, sx,sy,sz, ry, r,g,b]
  if (!list.length) return null;
  const n = list.length / 10, m = new T.InstancedMesh(geo, mat, n);
  for (let i = 0; i < n; i++) {
    const o = i * 10;
    _m.compose(_p.set(list[o], list[o + 1], list[o + 2]), _q.setFromEuler(_e.set(0, list[o + 6], 0)), _s.set(list[o + 3], list[o + 4], list[o + 5]));
    m.setMatrixAt(i, _m); m.setColorAt(i, _c.setRGB(list[o + 7], list[o + 8], list[o + 9], T.SRGBColorSpace));
  }
  m.castShadow = shadow; m.receiveShadow = true;
  m.computeBoundingSphere();
  X.scene.add(m);
  return m;
}
function buildChunk(ck, cr) {
  const w = G.world, C = G.CHUNK, h = G.hash2, key = cr * 1000 + ck;
  const old = X.chunkObjs[key];
  if (old) for (const m of old) if (m) { X.scene.remove(m); m.dispose(); }
  const ore = [], trunk = [], leaf = [], rock = [];
  for (let ty = 0; ty < C; ty++) for (let tx = 0; tx < C; tx++) {
    const x = ck * C + tx, y = cr * C + ty, i = y * G.W + x;
    const o = w.ore[i];
    if (o) {
      const cnt = Math.min(7, 3 + Math.floor(w.oreAmt[i] / 450)), c = ORE_RGB[o];
      for (let k = 0; k < cnt; k++) {
        const s = 0.1 + h(x, y, k * 7 + 3) * 0.13, br = 0.7 + h(x, y, k * 7 + 4) * 0.6;
        ore.push(x + 0.1 + h(x, y, k * 7 + 1) * 0.8, s * 0.25, y + 0.1 + h(x, y, k * 7 + 2) * 0.8, s, s * 0.75, s, h(x, y, k * 7 + 5) * 6.28, c[0] * br, c[1] * br, c[2] * br);
      }
    }
    const d = w.deco[i];
    if (d === 1) {
      const cx = x + 0.5 + (h(x, y, 77) - 0.5) * 0.4, cz = y + 0.5 + (h(x, y, 78) - 0.5) * 0.4, H = 1.1 + h(x, y, 79) * 0.9;
      const dead = h(x, y, 80) < 0.07;
      trunk.push(cx, 0, cz, 1 + H * 0.3, H, 1 + H * 0.3, 0, 0.36, 0.25, 0.15);
      if (!dead) for (let k = 0; k < 4; k++) {
        const r = (0.62 - k * 0.1) * (0.85 + h(x, y, 90 + k) * 0.3), g = 0.26 + h(x, y, 95 + k) * 0.16 + k * 0.03;
        leaf.push(cx + (h(x, y, 100 + k) - 0.5) * 0.5, H * (0.72 + k * 0.2), cz + (h(x, y, 105 + k) - 0.5) * 0.5, r, r * 0.8, r, h(x, y, 110 + k) * 6.28, g * 0.62, g * 1.15, g * 0.38);
      }
    } else if (d === 2) {
      const s = 0.3 + h(x, y, 81) * 0.14, g = 0.42 + h(x, y, 82) * 0.12;
      rock.push(x + 0.5, s * 0.35, y + 0.5, s * 1.15, s * 0.8, s, h(x, y, 83) * 6.28, g, g * 0.97, g * 0.9);
      rock.push(x + 0.25 + h(x, y, 84) * 0.5, 0.05, y + 0.72, s * 0.45, s * 0.35, s * 0.45, h(x, y, 85) * 6.28, g * 0.9, g * 0.88, g * 0.8);
    }
  }
  X.chunkObjs[key] = [inst(X.lumpGeo, X.matOre, ore, true), inst(X.trunkGeo, X.matLeaf, trunk, true), inst(X.leafGeo, X.matLeaf, leaf, true), inst(X.rockGeo, X.matOre, rock, true)];
}

X.updateTerrain = function (t, x0, y0, x1, y1) {
  X.terrainMat.uniforms.uTime.value = t;
  const C = G.CHUNK;
  if (G.dirtyChunks.size) {
    const w = G.world;
    for (const k of G.dirtyChunks) {
      const ck = k % 1000, cr = (k / 1000) | 0;
      for (let ty = 0; ty < C; ty++) for (let tx = 0; tx < C; tx++) setOreTexel((cr * C + ty) * G.W + ck * C + tx);
      if (X.chunkObjs[k]) buildChunk(ck, cr);
    }
    G.dirtyChunks.clear(); X.oreTex.needsUpdate = true;
  }
  let built = 0;
  for (let cr = Math.max(0, Math.floor(y0 / C)); cr <= Math.min(G.H / C - 1, Math.floor(y1 / C)); cr++)
    for (let ck = Math.max(0, Math.floor(x0 / C)); ck <= Math.min(G.W / C - 1, Math.floor(x1 / C)); ck++)
      if (!X.chunkObjs[cr * 1000 + ck] && built++ < 2) buildChunk(ck, cr);
};
})();
