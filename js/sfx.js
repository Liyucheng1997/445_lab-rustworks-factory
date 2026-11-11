// 音效：全部用 WebAudio 实时合成，不需要音频文件
(function () {
'use strict';
let ac = null, master = null, noiseBuf = null;
const last = {};
G.muted = localStorage.getItem('rustworks-muted') === '1';

function ctx() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function env(g, t, vol, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function tone(f, dur, type, vol, slide, delay) {
  const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  env(g, t, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, fc, q, type, delay) {
  const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = fc; f.Q.value = q || 1;
  env(g, t, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const GAP = { build: 45, mine: 60, click: 30, pick: 60 };
G.sfx = function (name) {
  if (G.muted) return;
  const now = performance.now();
  if (now - (last[name] || 0) < (GAP[name] || 0)) return;
  last[name] = now;
  if (!ctx()) return;
  switch (name) {
    case 'build': noise(0.14, 0.5, 260, 0.7, 'lowpass'); tone(120, 0.12, 'square', 0.1, -50); tone(880, 0.035, 'square', 0.04, 0, 0.02); break;
    case 'pick': noise(0.1, 0.3, 1400, 1.2); tone(240, 0.09, 'triangle', 0.14, 80); break;
    case 'mine': noise(0.06, 0.4, 2400, 2.5); noise(0.12, 0.2, 500, 1, 'lowpass'); tone(170, 0.05, 'square', 0.06, -40); break;
    case 'chop': noise(0.09, 0.45, 700, 1.5); tone(110, 0.08, 'triangle', 0.14, -30); break;
    case 'craft': tone(620, 0.07, 'triangle', 0.11); tone(930, 0.1, 'triangle', 0.09, 0, 0.06); break;
    case 'research': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, 0, i * 0.1)); break;
    case 'click': tone(1100, 0.03, 'square', 0.035); break;
    case 'rotate': tone(520, 0.04, 'square', 0.05, 200); break;
    case 'deny': tone(150, 0.13, 'sawtooth', 0.09, -40); break;
  }
};
G.toggleMute = function () {
  G.muted = !G.muted; localStorage.setItem('rustworks-muted', G.muted ? '1' : '0');
  G.ui && G.ui.toast(G.muted ? '音效：关' : '音效：开');
};
})();
