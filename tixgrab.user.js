// ==UserScript==
// @name         TixGrab
// @namespace    https://by-jass.tixgrab
// @version      1.2.0
// @description  tixgrab by jass: hold shift and click one seat, it picks every connected seat at once and hits reserve
// @author       Jass
// @match        https://*.ticketmaster.com/*
// @match        https://*.ticketmaster.ca/*
// @match        https://*.ticketmaster.co.uk/*
// @match        https://*.ticketmaster.com.au/*
// @match        https://*.ticketmaster.co.nz/*
// @match        https://*.ticketmaster.ie/*
// @match        https://*.ticketmaster.de/*
// @match        https://*.ticketmaster.fr/*
// @match        https://*.ticketmaster.es/*
// @match        https://*.ticketmaster.it/*
// @match        https://*.ticketmaster.nl/*
// @match        https://*.ticketmaster.be/*
// @match        https://*.ticketmaster.at/*
// @match        https://*.ticketmaster.ch/*
// @match        https://*.ticketmaster.dk/*
// @match        https://*.ticketmaster.fi/*
// @match        https://*.ticketmaster.no/*
// @match        https://*.ticketmaster.se/*
// @match        https://*.ticketmaster.pl/*
// @match        https://*.ticketmaster.cz/*
// @match        https://*.ticketmaster.ae/*
// @match        https://*.ticketmaster.sg/*
// @match        https://*.ticketmaster.co.za/*
// @match        https://*.ticketmaster.cl/*
// @match        https://*.ticketmaster.com.mx/*
// @match        https://*.ticketmaster.com.br/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__tixgrabLoaded) return;
  window.__tixgrabLoaded = true;

  const STATE_KEY = 'tixgrab_state';
  const RES_KEY = 'tixgrab_reserved';
  const IGNORE = /queue|checkout|authori[sz]ation|log-?in|sign-?in|payment|captcha|waiting-?room/i;
  const DONE = /checkout|authori[sz]ation/i;
  const HARD_CAP = 8;
  const QTY = ['max', 1, 2, 3, 4, 5, 6, 7, 8];
  const ignored = () => IGNORE.test(location.href);
  const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  const st = { on: true, qty: 'max', reserve: true, sound: true, guard: true, popups: true };
  try {
    const o = JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}');
    for (const k of ['on', 'reserve', 'sound', 'guard', 'popups']) if (typeof o[k] === 'boolean') st[k] = o[k];
  } catch (_) {}
  const save = () => { try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ on: st.on, reserve: st.reserve, sound: st.sound, guard: st.guard, popups: st.popups })); } catch (_) {} };
  const engineOn = () => st.on && !ignored();

  const h = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    for (const k in props || {}) { if (k === 'text') e.textContent = props[k]; else e.setAttribute(k, props[k]); }
    for (const c of kids) if (c) e.append(c);
    return e;
  };
  function addCss(root, css) {
    try { const s = new CSSStyleSheet(); s.replaceSync(css); root.adoptedStyleSheets = [s]; }
    catch (_) { const el = document.createElement('style'); el.textContent = css; root.appendChild(el); }
  }
  const mc = new MessageChannel();
  let waiters = [];
  mc.port1.onmessage = () => { const w = waiters; waiters = []; w.forEach((f) => f()); };
  const yieldNow = () => new Promise((res) => { waiters.push(res); mc.port2.postMessage(0); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05;
  };
  const parentOf = (el) => { if (el.parentElement) return el.parentElement; const r = el.getRootNode && el.getRootNode(); return r && r.host ? r.host : null; };
  function* walk(r) { for (const el of r.querySelectorAll('*')) { yield el; if (el.shadowRoot) yield* walk(el.shadowRoot); } }

  const logs = [];
  let ui = null;
  const pad2 = (n) => String(n).padStart(2, '0');
  function log(obj) {
    const d = new Date();
    const line = JSON.stringify(Object.assign({ t: pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) }, obj));
    logs.push(line);
    if (logs.length > 80) logs.shift();
    if (ui) ui.addLine(line);
  }

  const UI_CSS = `
    :host { all: initial; }
    .card { --pu: #c792ff; --ye: #ffd400; --gr: #39ff6a; --cy: #4de1ff; --pk: #ff6ac1; --or: #ffb454; --bl: #6ea8ff; --rd: #ff5c6c; --li: #b9ff7a; --gy: #7d8590;
      position: fixed; top: 8px; right: 8px; width: 344px; box-sizing: border-box; padding: 14px 16px 12px; background: #05040a; color: var(--gy);
      font: 13px/1.6 "Roboto Mono", ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
      border: 1px solid rgba(199,146,255,.55); border-radius: 10px;
      box-shadow: 0 0 0 1px #1a1030, 0 0 22px rgba(199,146,255,.25), 0 0 34px rgba(255,212,0,.12), inset 0 0 26px rgba(199,146,255,.07);
      user-select: none; z-index: 2147483647; text-transform: lowercase; }
    .card * { text-shadow: 0 0 6px currentColor; }
    .card[hidden] { display: none; }
    .c-pu { color: var(--pu); } .c-ye { color: var(--ye); } .c-gr { color: var(--gr); } .c-cy { color: var(--cy); } .c-pk { color: var(--pk); }
    .c-or { color: var(--or); } .c-bl { color: var(--bl); } .c-rd { color: var(--rd); } .c-li { color: var(--li); } .c-gy { color: var(--gy); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; cursor: move; }
    .title { font-size: 20px; font-weight: 700; letter-spacing: .02em; }
    .title span { text-shadow: 0 0 9px currentColor, 0 0 22px currentColor; }
    .by { font-size: 11px; margin-top: -2px; }
    .rst { cursor: pointer; background: transparent; border: 1px solid currentColor; border-radius: 6px; width: 28px; height: 28px; font: 16px/1 inherit; transition: box-shadow .2s, transform .15s; }
    .rst:hover { box-shadow: 0 0 12px currentColor; }
    .rst:active { transform: rotate(180deg) scale(.92); }
    .code { margin-top: 10px; white-space: pre; }
    .line { display: flex; align-items: center; gap: 8px; min-height: 26px; }
    .ind { white-space: pre; }
    .sw { position: relative; width: 38px; height: 18px; border: 1px solid #6b2c35; border-radius: 10px; background: #12060a; cursor: pointer; transition: box-shadow .25s, background .25s, border-color .25s; flex: none; }
    .sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #6b2c35; transition: transform .25s, background .25s, box-shadow .25s; }
    .sw.on { border-color: var(--gr); background: #06260f; box-shadow: 0 0 12px rgba(57,255,106,.75); }
    .sw.on::after { transform: translateX(20px); background: var(--gr); box-shadow: 0 0 9px var(--gr); }
    .q { cursor: pointer; min-width: 52px; text-align: center; border: 1px solid currentColor; border-radius: 5px; background: #0c0a14; padding: 0 8px; font: inherit; transition: box-shadow .2s, transform .12s, opacity .2s; }
    .q:hover { box-shadow: 0 0 10px currentColor; }
    .q:active { transform: scale(.92); }
    .q.v-str { color: var(--li); } .q.v-num { color: var(--or); } .q.v-bool { color: var(--pu); } .q.v-off { color: var(--rd); opacity: .85; }
    .log { margin-top: 10px; height: 190px; box-sizing: border-box; padding: 8px 9px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;
      border: 1px solid rgba(77,225,255,.3); border-radius: 7px; background: #04030a; box-shadow: inset 0 0 14px rgba(77,225,255,.08);
      font-size: 10.5px; line-height: 1.45; }
    .log * { text-shadow: 0 0 4px currentColor; }
    .l { white-space: pre-wrap; word-break: break-all; animation: ln .25s ease-out; }
    @keyframes ln { from { opacity: 0; transform: translateY(4px); } }
    .foot { margin-top: 8px; font-size: 10.5px; }
    .caret { animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  `;
  const KEYCOL = { t: 'c-gy', pack: 'c-pu', selected: 'c-gr', reserve: 'c-or', dialog: 'c-cy', limit: 'c-ye', orphan: 'c-pk', done: 'c-gr', error: 'c-rd', power: 'c-pk', quantity: 'c-cy', sound: 'c-bl', guard: 'c-li', popups: 'c-pu', idle: 'c-gy', scan: 'c-bl', text: 'c-cy', say: 'c-rd', clicked: 'c-or', page: 'c-cy' };
  const BADVAL = /fail|not available|unavailable|sorry|gave up|no seat|not found|not ready|missed|skipped/i;
  function buildUI() {
    const host = h('div', { 'data-tixgrab': '' });
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    addCss(root, UI_CSS);
    const card = h('div', { class: 'card' });
    card.hidden = true;
    const span = (cls, text) => h('span', { class: cls, text });
    const reset = h('button', { class: 'rst c-cy', title: 'reset', text: '\u21bb' });
    const title = h('div', { class: 'title' }, span('c-pu', '_tix'), span('c-ye', 'grab'));
    const head = h('div', { class: 'head' }, h('div', {}, title, h('div', { class: 'by c-gr', text: 'by_jass' })), reset);
    const sw = h('div', { class: 'sw', role: 'switch', tabindex: '0' });
    const qBtn = h('button', { class: 'q' });
    const resBtn = h('button', { class: 'q' });
    const sndBtn = h('button', { class: 'q' });
    const grdBtn = h('button', { class: 'q' });
    const popBtn = h('button', { class: 'q' });
    const row = (k, kc, ctl, last) => h('div', { class: 'line' }, span('ind', '  '), span(kc, '"' + k + '":'), ctl, span('c-gy', last ? '' : ','));
    const code = h('div', { class: 'code' },
      h('div', { class: 'line' }, span('c-ye', '{')),
      row('power', 'c-pk', sw), row('quantity', 'c-cy', qBtn), row('reserve', 'c-or', resBtn), row('sound', 'c-bl', sndBtn), row('guard', 'c-li', grdBtn), row('popups', 'c-pu', popBtn, true),
      h('div', { class: 'line' }, span('c-ye', '}'))
    );
    const logEl = h('div', { class: 'log' });
    const foot = h('div', { class: 'foot' }, span('c-gy', '// shift+t to hide'), span('caret c-ye', '_'));
    card.append(head, code, logEl, foot);
    root.append(card);

    sw.addEventListener('click', () => setPower(!st.on));
    sw.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPower(!st.on); } });
    qBtn.addEventListener('click', () => setQty(QTY[(QTY.indexOf(st.qty) + 1) % QTY.length]));
    resBtn.addEventListener('click', () => setFlag('reserve', !st.reserve));
    sndBtn.addEventListener('click', () => setFlag('sound', !st.sound));
    grdBtn.addEventListener('click', () => setFlag('guard', !st.guard));
    popBtn.addEventListener('click', () => setFlag('popups', !st.popups));
    reset.addEventListener('click', resetAll);

    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target === reset) return;
      const r = card.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      card.style.right = 'auto'; card.style.left = Math.max(0, e.clientX - drag.dx) + 'px'; card.style.top = Math.max(0, e.clientY - drag.dy) + 'px';
    });
    head.addEventListener('pointerup', () => { drag = null; });

    function valSpan(v, k) {
      if (typeof v === 'number') return span('c-or', String(v));
      if (typeof v === 'boolean') return span('c-pu', String(v));
      const sv = String(v);
      if (k === 'error' || k === 'say' || BADVAL.test(sv)) return span('c-rd', '"' + sv + '"');
      if (k === 't') return span('c-gy', '"' + sv + '"');
      return span('c-li', '"' + sv + '"');
    }
    function addLine(text) {
      let o = null;
      try { o = JSON.parse(text); } catch (_) {}
      const d = h('div', { class: 'l' });
      if (!o) d.textContent = text;
      else {
        d.append(span('c-ye', '{'));
        const ks = Object.keys(o);
        ks.forEach((k, i) => {
          d.append(span(KEYCOL[k] || 'c-cy', '"' + k + '"'), span('c-gy', ':'), valSpan(o[k], k), span('c-gy', i < ks.length - 1 ? ',\u200b' : ''));
        });
        d.append(span('c-ye', '}'));
      }
      logEl.appendChild(d);
      while (logEl.childNodes.length > 40) logEl.removeChild(logEl.firstChild);
    }
    function clear() { while (logEl.firstChild) logEl.removeChild(logEl.firstChild); }
    function render() {
      const val = (btn, cls, text) => { btn.className = 'q ' + cls; btn.textContent = text; };
      sw.classList.toggle('on', st.on);
      sw.setAttribute('aria-checked', String(st.on));
      if (st.qty === 'max') val(qBtn, 'v-str', '"max"'); else val(qBtn, 'v-num', String(st.qty));
      val(resBtn, st.reserve ? 'v-str' : 'v-off', st.reserve ? '"auto"' : '"off"');
      val(sndBtn, st.sound ? 'v-bool' : 'v-off', String(st.sound));
      val(grdBtn, st.guard ? 'v-bool' : 'v-off', String(st.guard));
      val(popBtn, st.popups ? 'v-bool' : 'v-off', String(st.popups));
    }
    logs.slice(-40).forEach(addLine);
    ui = { host, card, render, addLine, clear, toggle() { card.hidden = !card.hidden; render(); }, hide() { card.hidden = true; } };
    render();
    document.documentElement.appendChild(host);
  }
  function togglePopup() {
    if (ignored()) return;
    if (!ui) buildUI();
    else if (!ui.host.isConnected) document.documentElement.appendChild(ui.host);
    ui.toggle();
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.code !== 'KeyT' || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    togglePopup();
  }, true);

  let audio = null, resumeArmed = false;
  function primeAudio() {
    try {
      if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
      if (audio && audio.state === 'suspended') {
        audio.resume().catch(() => {});
        if (!resumeArmed) {
          resumeArmed = true;
          const again = () => { resumeArmed = false; if (audio && audio.state === 'suspended') audio.resume().catch(() => {}); };
          ['pointerdown', 'keydown', 'mousemove'].forEach((t) => window.addEventListener(t, again, { once: true, capture: true }));
        }
      }
    } catch (_) {}
  }
  let lastSeatAt = 0;
  function tone(delay, freq, dur, vol, type) {
    if (!st.sound) return;
    primeAudio();
    if (!audio) return;
    const t = audio.currentTime + 0.005 + delay;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const TICK = { seat: [1900, 0.035, 0.3], reserve: [1250, 0.07, 0.42] };
  const tick = (delay, spec) => tone(delay, spec[0], spec[1], spec[2]);
  function seatTick() {
    if (!st.sound) return;
    primeAudio();
    if (!audio) return;
    const now = audio.currentTime, at = Math.max(now, lastSeatAt + 0.045);
    lastSeatAt = at;
    tick(at - now, TICK.seat);
  }
  function chime() {
    [[1568, 0], [1976, 0.1], [2349, 0.2], [3136, 0.32]].forEach(([f, d]) => tone(d, f, 0.28, 0.22, 'sine'));
    tone(0.32, 4698, 0.3, 0.07, 'sine');
  }
  function errorSound() {
    tone(0, 392, 0.14, 0.26, 'square');
    tone(0.15, 311, 0.14, 0.26, 'square');
    tone(0.3, 233, 0.3, 0.28, 'square');
  }

  function markReserved() {
    const t = String(Date.now());
    try { sessionStorage.setItem(RES_KEY, t); } catch (_) {}
    try { if (!window.name || window.name.startsWith('tixgrab_')) window.name = 'tixgrab_' + t; } catch (_) {}
  }
  function takeReservedFlag() {
    let t = 0;
    try { t = +sessionStorage.getItem(RES_KEY) || 0; } catch (_) {}
    if (!t) { const m = /^tixgrab_(\d+)$/.exec(window.name || ''); if (m) t = +m[1]; }
    try { sessionStorage.removeItem(RES_KEY); } catch (_) {}
    if (/^tixgrab_\d+$/.test(window.name || '')) { try { window.name = ''; } catch (_) {} }
    return t && Date.now() - t < 10 * 60 * 1000;
  }

  let suspended = false, announced = false;
  function onIgnored() {
    if (!suspended) {
      suspended = true;
      epoch++; stage = 'idle'; stopDialogs();
      if (ui) ui.hide();
    }
    if (!announced && DONE.test(location.href) && takeReservedFlag()) {
      announced = true;
      log({ done: 'reserved', page: 'checkout' });
      chime();
    }
  }

  let epoch = 0, stage = 'idle', ctx = null, siteLimit = 0, cutWait = false, orphanTries = 0, swallowUntil = 0, errorAt = 0;

  const STRONG = 'input[type=checkbox],input[type=radio],input[type=button],input[type=submit],input[type=reset],button,summary,a[href],[role=checkbox],[role=radio],[role=button],[role=switch],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=tab],[role=link],[aria-checked],[aria-pressed]';
  const WEAK = 'label,[data-seat],[data-seat-id],[data-seatid],[class*="seat" i],[onclick]';
  const TAKEN = /\b(selected|sold|taken|unavailable|disabled|occupied|reserved|booked|checked)\b/i;
  const NATIVE = /^(INPUT|BUTTON|A|SELECT|SUMMARY|LABEL|TEXTAREA)$/;

  function isAvailable(el) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') && el.checked) return false;
    for (const a of ['aria-checked', 'aria-pressed', 'aria-selected']) if (el.getAttribute(a) === 'true') return false;
    const cls = el.getAttribute('class');
    return !(cls && TAKEN.test(cls));
  }
  const parseRGB = (v) => { const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(v || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
  function toHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let hh = 0, ss = 0;
    if (d) { ss = d / (1 - Math.abs(2 * l - 1)); hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
    return { h: hh, s: ss, l };
  }
  function paint(el, d) {
    const cs = getComputedStyle(el), svg = el instanceof SVGElement, container = svg && /^(g|use|svg|a)$/i.test(el.tagName);
    if (!container) {
      const c = svg ? (parseRGB(cs.fill) || parseRGB(cs.stroke)) : parseRGB(cs.backgroundColor);
      if (c && c.a >= 0.1) return c;
    }
    if (d < 2) for (const k of el.children) { const r = paint(k, d + 1); if (r) return r; }
    if (container) { const c = parseRGB(cs.fill); if (c && c.a >= 0.1) return c; }
    return null;
  }
  function sameKind(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    const x = toHsl(a), y = toHsl(b);
    const hd = Math.min(Math.abs(x.h - y.h), 360 - Math.abs(x.h - y.h));
    const chromatic = x.s > 0.15 && y.s > 0.15;
    return Math.abs(x.l - y.l) <= 0.22 && Math.abs(x.s - y.s) <= 0.3 && (!chromatic || hd <= 22);
  }
  function seatLike(el, rc, cs) {
    if (NATIVE.test(el.tagName) || rc.width > 64 || rc.height > 64) return false;
    if (el instanceof SVGElement || /seat/i.test(el.getAttribute('class') || '') || el.hasAttribute('data-seat')) return true;
    const br = cs.borderRadius || '';
    return /%/.test(br) ? parseFloat(br) >= 40 : parseFloat(br) >= Math.min(rc.width, rc.height) / 2 - 1;
  }
  function isSelectedLike(el) {
    if (el.tagName === 'INPUT' && el.checked) return true;
    for (const a of ['aria-checked', 'aria-pressed', 'aria-selected']) if (el.getAttribute(a) === 'true') return true;
    if (/\b(selected|checked|chosen|picked)\b/i.test(el.getAttribute('class') || '')) return true;
    try {
      const rc = el.getBoundingClientRect();
      if (rc.width > 90 || rc.height > 90) return false;
      const c = paint(el, 0);
      if (!c) return false;
      const { h: hh, s: ss } = toHsl(c);
      return ss >= 0.35 && hh >= 85 && hh <= 175;
    } catch (_) { return false; }
  }
  function sig(el) {
    let s = (el.getAttribute('class') || '') + '|' + (el.getAttribute('aria-checked') || '') + (el.getAttribute('aria-pressed') || '') + (el.getAttribute('aria-selected') || '') + '|' + (el.checked ? 1 : 0) + '|' + el.childElementCount;
    try { const cs = getComputedStyle(el); s += '|' + cs.backgroundColor + cs.fill + cs.stroke + cs.color + cs.borderColor; } catch (_) {}
    return s;
  }

  function seedAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.hasAttribute && el.hasAttribute('data-tixgrab')) return null;
      if (el === document.documentElement || el === document.body) continue;
      const rc = el.getBoundingClientRect();
      if (rc.width < 4 || rc.height < 4 || rc.width > 90 || rc.height > 90) continue;
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === 'none' || cs.visibility === 'hidden') continue;
      if (!(el.matches(STRONG) || el.matches(WEAK) || cs.cursor === 'pointer')) continue;
      if (!isAvailable(el) || isSelectedLike(el)) return null;
      let top = el, p = parentOf(el);
      while (p && p !== document.body) {
        const r2 = p.getBoundingClientRect();
        if (r2.width > 90 || r2.height > 90) break;
        const c2 = getComputedStyle(p);
        if (!(c2.cursor === 'pointer' || p.matches(STRONG) || p.matches(WEAK))) break;
        top = p; p = parentOf(p);
      }
      return top;
    }
    return null;
  }

  function scanRoot(seedEl, R) {
    if (seedEl.getRootNode() !== document) return document;
    for (let p = seedEl.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const r = p.getBoundingClientRect();
      if (r.left <= R.l && r.top <= R.t && r.right >= R.r && r.bottom >= R.b) return p;
    }
    return document;
  }
  function scanSeats(R, S, root) {
    const lo = S * 0.5, hi = S * 1.7;
    const near = [], all = new Set(), strong = new Set();
    for (const el of walk(root || document)) {
      if (el.hasAttribute('data-tixgrab')) continue;
      const rc = el.getBoundingClientRect();
      if (rc.width < lo || rc.height < lo || rc.width > hi || rc.height > hi) continue;
      if (rc.right < R.l || rc.left > R.r || rc.bottom < R.t || rc.top > R.b) continue;
      near.push({ el, rc });
      const tag = el.tagName;
      if (tag === 'HTML' || tag === 'BODY') continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      const sg = el.matches(STRONG);
      if (!sg && !el.matches(WEAK)) {
        if (cs.cursor !== 'pointer') continue;
        const p = parentOf(el);
        if (p && getComputedStyle(p).cursor === 'pointer') continue;
      }
      if (!isAvailable(el)) continue;
      all.add(el);
      if (sg) strong.add(el);
    }
    const list = [...all], hasDesc = new Set();
    for (const el of list) { let p = parentOf(el); while (p) { hasDesc.add(p); p = parentOf(p); } }
    let kept = list.filter((el) => strong.has(el) || !hasDesc.has(el));
    const ks = new Set(kept);
    kept = kept.filter((el) => {
      if (el.tagName === 'LABEL' && el.control && ks.has(el.control)) return false;
      let p = parentOf(el);
      while (p) { if (ks.has(p) && strong.has(p)) return false; p = parentOf(p); }
      return true;
    });
    const items = kept.map((el) => { const r = el.getBoundingClientRect(); return { el, cand: true, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, color: paint(el, 0) }; });
    if (!items.length) return items;
    const tags = new Set(kept.map((e) => e.tagName)), anySvg = kept.some((e) => e instanceof SVGElement);
    for (const { el, rc } of near) {
      if (all.has(el)) continue;
      if (!(tags.has(el.tagName) || (anySvg && el instanceof SVGElement))) continue;
      const x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
      if (items.some((i) => Math.hypot(i.x - x, i.y - y) < S * 0.4)) continue;
      items.push({ el, cand: false, x, y, w: rc.width, h: rc.height, color: null });
    }
    return items;
  }
  function nearestSeed(items, x, y, S) {
    let best = null, bd = Infinity;
    for (const it of items) {
      if (!it.cand) continue;
      const d = Math.hypot(it.x - x, it.y - y);
      if (d < bd) { bd = d; best = it; }
    }
    return best && bd <= Math.max(S * 0.8, 12) ? best : null;
  }

  const angDiff = (a, b) => { let d = Math.abs(a - b) % Math.PI; if (d > Math.PI / 2) d = Math.PI - d; return d; };
  function chainFrom(items, seed) {
    const R = Math.PI / 180, P = { span: 1.5, ang: 28, cons: 25, vote: 1.12 };
    let E = items;
    if (E.length > 900) E = E.slice().sort((p, q) => Math.hypot(p.x - seed.x, p.y - seed.y) - Math.hypot(q.x - seed.x, q.y - seed.y)).slice(0, 900);
    if (E.length < 2) return [seed];
    const phi = new Map();
    for (const a of E) {
      const ds = [];
      for (const b of E) if (b !== a) ds.push({ b, d: Math.hypot(b.x - a.x, b.y - a.y) });
      ds.sort((p, q) => p.d - q.d);
      const near = ds[0].d;
      let sc = 0, ss = 0, cnt = 0;
      for (const q of ds) { if (q.d > near * P.vote || cnt >= 4) break; const th = Math.atan2(q.b.y - a.y, q.b.x - a.x); sc += Math.cos(2 * th); ss += Math.sin(2 * th); cnt++; }
      let ang = 0.5 * Math.atan2(ss, sc);
      if (cnt > 1 && Math.hypot(sc, ss) / cnt < 0.5) ang = Math.atan2(ds[0].b.y - a.y, ds[0].b.x - a.x);
      phi.set(a, ang);
    }
    const cosA = Math.cos(P.ang * R);
    const look = (a, sign) => {
      const t = phi.get(a), ux = Math.cos(t) * sign, uy = Math.sin(t) * sign;
      let best = null, bd = Infinity;
      for (const b of E) {
        if (b === a) continue;
        const vx = b.x - a.x, vy = b.y - a.y, d = Math.hypot(vx, vy);
        if (d >= bd || (vx * ux + vy * uy) / d < cosA) continue;
        bd = d; best = b;
      }
      return best ? { b: best, d: bd } : null;
    };
    const side = new Map();
    for (const a of E) side.set(a, [look(a, 1), look(a, -1)]);
    const has = (a, b) => side.get(a).some((s) => s && s.b === b);
    let id = 0;
    for (const e of E) e.__id = id++;
    const links = [], seen = new Set();
    for (const a of E) for (const s of side.get(a)) {
      if (!s || !has(s.b, a) || angDiff(phi.get(a), phi.get(s.b)) > P.cons * R) continue;
      const k = Math.min(a.__id, s.b.__id) + ':' + Math.max(a.__id, s.b.__id);
      if (seen.has(k)) continue;
      seen.add(k); links.push({ a, b: s.b, d: s.d });
    }
    if (!links.length) return [seed];
    const m = median(links.map((e) => e.d)), adj = new Map();
    for (const e of links) {
      if (!(e.a.cand && e.b.cand && e.d <= P.span * m)) continue;
      if (!adj.has(e.a)) adj.set(e.a, []);
      if (!adj.has(e.b)) adj.set(e.b, []);
      adj.get(e.a).push(e.b); adj.get(e.b).push(e.a);
    }
    const comp = new Set([seed]), q = [seed];
    while (q.length) { const n = q.pop(); for (const k of adj.get(n) || []) if (!comp.has(k)) { comp.add(k); q.push(k); } }
    if (comp.size < 2) return [seed];
    const start = [...comp].find((n) => (adj.get(n) || []).length <= 1) || seed;
    const out = [start], used = new Set([start]);
    let cur = start;
    for (;;) { const nx = (adj.get(cur) || []).find((n) => !used.has(n)); if (!nx) break; out.push(nx); used.add(nx); cur = nx; }
    return out.includes(seed) ? out : [seed];
  }
  function windowOf(L, ci, want, guard, cap) {
    const M = Math.max(1, Math.min(want, L));
    let best = null;
    for (let s = Math.max(0, ci - M + 1); s <= Math.min(ci, L - M); s++) {
      const l = s, r = L - s - M, o = (l === 1 ? 1 : 0) + (r === 1 ? 1 : 0), d = Math.abs(ci - (s + (M - 1) / 2));
      if (!best || o < best.o || (o === best.o && d < best.d)) best = { s, o, l, r, d };
    }
    let a = best.s, b = best.s + M;
    if (guard) {
      if (best.l === 1 && b - a < cap) a = 0;
      if (best.r === 1 && b - a < cap) b = L;
    }
    return { a, b };
  }

  function hover(el, x, y) {
    const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 0 };
    const P = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    const ptr = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new P('pointerover', { ...base, ...ptr }));
    el.dispatchEvent(new P('pointerenter', { ...base, ...ptr, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseover', base));
    el.dispatchEvent(new MouseEvent('mouseenter', { ...base, bubbles: false }));
    el.dispatchEvent(new P('pointermove', { ...base, ...ptr }));
    el.dispatchEvent(new MouseEvent('mousemove', base));
  }
  function clickEl(el, x, y) {
    const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0 };
    const P = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    const ptr = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new P('pointerdown', { ...base, ...ptr, buttons: 1 }));
    el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    el.dispatchEvent(new P('pointerup', { ...base, ...ptr, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0, detail: 1 }));
  }
  const pressCenter = (el) => { const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; hover(el, x, y); clickEl(el, x, y); };

  function makeTarget(it) {
    return { el: it.el, pgx: it.x + window.scrollX, pgy: it.y + window.scrollY, S: Math.max(it.w, it.h), again: false, before: sig(it.el) };
  }
  function findAnyAt(t) {
    const x = t.pgx - window.scrollX, y = t.pgy - window.scrollY;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest && el.closest('[data-tixgrab]')) continue;
      const r = el.getBoundingClientRect(), sz = Math.max(r.width, r.height);
      if (sz < t.S * 0.6 || sz > t.S * 1.6) continue;
      if (Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) > Math.max(10, t.S * 0.7)) continue;
      return el;
    }
    return null;
  }
  function fireTarget(t) {
    let el = t.el;
    if (!el.isConnected) { el = findAnyAt(t); if (!el) return; t.el = el; }
    if (t.again && !isAvailable(el)) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    try { hover(el, x, y); t.before = sig(el); clickEl(el, x, y); } catch (_) {}
  }
  function flipTarget(t) {
    const el = t.el.isConnected ? t.el : findAnyAt(t);
    if (el) { try { pressCenter(el); } catch (_) {} }
  }
  function picked(t) {
    const el = t.el.isConnected ? t.el : findAnyAt(t);
    if (!el) return false;
    return isSelectedLike(el) || sig(el) !== t.before;
  }

  async function pickOne(t, my) {
    const start = performance.now();
    let retried = false, i = 0;
    fireTarget(t);
    for (;;) {
      if (my !== epoch) return false;
      if (picked(t)) { seatTick(); return true; }
      if (cutWait) return false;
      const now = performance.now();
      if (now - start >= 260) return false;
      if (!retried && now - start >= 100) { retried = true; t.again = true; fireTarget(t); }
      if (++i < 40) await yieldNow(); else await sleep(3);
    }
  }

  async function verifySeats(T, my) {
    const t0 = performance.now();
    let tries = 0, i = 0, nextAt = t0 + 70;
    for (;;) {
      if (my !== epoch) return;
      const lost = T.filter((t) => !picked(t));
      if (!lost.length) return;
      if (cutWait) return;
      const now = performance.now();
      if (now - t0 >= 700) { log({ selected: 'missed', n: lost.length }); return; }
      if (tries < 3 && now >= nextAt) {
        tries++; nextAt = now + 110;
        lost.forEach((t) => { t.again = true; fireTarget(t); });
        log({ selected: 'retry', n: lost.length });
      }
      if (++i < 40) await yieldNow(); else await sleep(3);
    }
  }

  const RES_EXACT = /^(reserve( now)?|reserve (seats?|tickets?)|reserve selected( seats?| tickets?)?)$/i;
  function findReserve() {
    let best = null, bs = 0;
    for (const el of document.querySelectorAll('button,[role=button],a,input[type=submit],input[type=button],[data-testid*="reserve" i],[data-bdd*="reserve" i]')) {
      if (el.closest('[data-tixgrab]')) continue;
      const txt = (el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      let score = 0;
      if (RES_EXACT.test(txt)) score = 3;
      else if (/\breserve\b/i.test(txt) && txt.length < 40) score = 2;
      else if (/reserve/i.test((el.getAttribute('data-testid') || '') + (el.getAttribute('data-bdd') || ''))) score = 1;
      if (score > bs && visible(el)) { best = el; bs = score; }
    }
    return best;
  }
  const enabled = (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !/\bdisabled\b/i.test(el.getAttribute('class') || '');
  async function reserveNow(my, t0) {
    stage = 'reserve';
    const end = performance.now() + 4000;
    let b = null, sawDisabled = false, i = 0;
    while (performance.now() < end) {
      if (my !== epoch) return;
      if (!b || !b.isConnected) b = findReserve();
      if (b && enabled(b)) {
        markReserved();
        try { pressCenter(b); } catch (_) {}
        log({ reserve: 'clicked', ms: Math.round(performance.now() - t0) });
        tick(0, TICK.reserve);
        watchDialogs();
        return;
      }
      sawDisabled = sawDisabled || !!b;
      if (++i < 80) await yieldNow(); else await sleep(8);
    }
    log({ reserve: sawDisabled ? 'button not ready' : 'button not found' });
  }

  async function grab(seedEl, x, y) {
    const my = ++epoch, t0 = performance.now();
    stage = 'select'; cutWait = false; orphanTries = 0; ctx = null;
    watchDialogs();
    const rc0 = seedEl.getBoundingClientRect(), S = Math.max(rc0.width, rc0.height), Rg = Math.max(90, S * 16);
    const region = { l: x - Rg, t: y - Rg, r: x + Rg, b: y + Rg };
    const root = scanRoot(seedEl, region);
    let items = [];
    try { items = scanSeats(region, S, root); } catch (_) {}
    let seed = nearestSeed(items, x, y, S);
    if (!seed && root !== document) {
      try { items = scanSeats(region, S, document); } catch (_) {}
      seed = nearestSeed(items, x, y, S);
    }
    if (!seed) { stage = 'idle'; log({ pack: 0, why: 'no seat found under the click' }); return; }
    for (const it of items) if (it.cand && it !== seed && !sameKind(it.color, seed.color)) it.cand = false;
    let chain = [];
    try { chain = chainFrom(items, seed); } catch (_) { chain = [seed]; }
    const cap = Math.min(HARD_CAP, siteLimit || HARD_CAP);
    const want = st.qty === 'max' ? cap : Math.min(st.qty, cap);
    const { a, b } = windowOf(chain.length, Math.max(0, chain.indexOf(seed)), want, st.guard, cap);
    const all = chain.map(makeTarget), T = all.slice(a, b);
    ctx = { all, a, b, T };
    log({ pack: chain.length, pick: T.length, want: st.qty, scan: Math.round(performance.now() - t0) });
    T.forEach((t) => { fireTarget(t); seatTick(); });
    log({ selected: T.length, ms: Math.round(performance.now() - t0) });
    await verifySeats(T, my);
    if (my !== epoch) return;
    let live = T.filter(picked);
    if (!live.length) { stage = 'idle'; log({ reserve: 'skipped', why: 'no seat registered' }); return; }
    if (siteLimit && live.length > siteLimit) {
      live.slice(siteLimit).forEach(flipTarget);
      log({ limit: siteLimit, trimmed: live.length - siteLimit });
      live = live.slice(0, siteLimit);
      ctx.T = live;
      await sleep(60);
      if (my !== epoch) return;
    }
    if (!st.reserve) { stage = 'idle'; log({ reserve: 'off', seats: live.length }); return; }
    await reserveNow(my, t0);
  }

  function onError(text) {
    if (performance.now() - errorAt < 1500) return;
    errorAt = performance.now();
    epoch++; stage = 'idle';
    log({ error: 'tickets not available', say: norm(text).slice(0, 60) });
    errorSound();
  }
  async function afterLimit(n) {
    const my = epoch;
    const T = ctx ? ctx.T : [];
    const live = T.filter(picked);
    if (live.length > n) {
      live.slice(n).forEach(flipTarget);
      ctx.T = live.slice(0, n);
      log({ limit: n, trimmed: live.length - n });
    }
    await sleep(90);
    if (my !== epoch) return;
    if (st.reserve) await reserveNow(my, performance.now());
  }
  async function extendOne() {
    const c = ctx, my = epoch;
    if (!c || orphanTries >= 3) { log({ orphan: 'gave up' }); return; }
    orphanTries++;
    const L = c.all.length;
    let t = null;
    if (L - c.b === 1) t = c.all[c.b];
    else if (c.a === 1) t = c.all[0];
    else if (c.b < L) t = c.all[c.b];
    else if (c.a > 0) t = c.all[c.a - 1];
    if (!t) { log({ orphan: 'no seat found' }); return; }
    stage = 'select';
    const gotIt = await pickOne(t, my);
    if (my !== epoch) return;
    const i = c.all.indexOf(t);
    if (i >= c.b) c.b = i + 1; else c.a = i;
    if (gotIt) c.T.push(t);
    log({ selected: 'extra', why: 'single seat left open', n: c.T.length });
    if (st.reserve) await reserveNow(my, performance.now());
  }

  const DLG = '[role=dialog],[role=alertdialog],[aria-modal="true"],dialog[open],[class*="modal" i],[class*="dialog" i],[class*="popup" i],[class*="overlay" i],[data-testid*="modal" i],[data-testid*="dialog" i],[data-testid*="alert" i]';
  const OK_TIERS = [/^agree\s*(&|and)\s*continue$/, /^accept\s*(&|and)\s*continue$/, /^continue$/, /^agree$/, /^accept$/, /^ok(ay)?$/, /^got it$/, /^confirm$/, /^yes(,.*)?$/, /^submit$/, /^proceed$/, /^understood$|^i understand$/, /^try again$|^retry$/, /^close$|^dismiss$/];
  const LOOSE = [/agree/, /accept/, /continue/, /\bok\b/, /confirm/, /submit/, /close|dismiss/];
  const NO = /^(cancel|no|no thanks|not now|back|go back|decline|exit|leave|x|\u00d7)$/;
  const BAD = /panel|remove|delete|clear/;
  const ERR = /(went wrong|sorry|not available|unavailable|no longer|error|failed|unable to|could(?: ?n.t| not)|expired|already taken|just taken|try again)/i;
  const ORPHAN = /single seat|one seat|leav(e|ing) (a |1 )?(single |one )?seat|seats?.{0,25}(left|leaving) (open|empty|alone)|orphan/i;
  const LIMIT_RE = /(?:limit(?: of| is)?|maximum(?: of)?|max(?:imum)?|up to)\D{0,20}(\d+)/i;
  const norm = (s) => s.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().toLowerCase();
  const clickedAt = new WeakMap();
  function parseLimit(text) {
    if (!/ticket|seat/i.test(text)) return 0;
    const m = LIMIT_RE.exec(text), n = m ? +m[1] : 0;
    return n >= 1 && n <= 12 ? n : 0;
  }
  function findDialogs() {
    const out = [];
    for (const d of document.querySelectorAll(DLG)) {
      if (d.closest('[data-tixgrab]') || !visible(d)) continue;
      const r = d.getBoundingClientRect();
      if (r.width < 120 || r.height < 60) continue;
      const aria = d.matches('[role=dialog],[role=alertdialog],[aria-modal="true"],dialog[open]');
      if (!aria) { const cs = getComputedStyle(d); if (!/fixed|absolute|sticky/.test(cs.position)) continue; }
      const btns = [];
      for (const b of d.querySelectorAll('button,[role=button],a[href],input[type=button],input[type=submit]')) {
        if (!visible(b)) continue;
        const text = norm(b.innerText || b.textContent || b.value || '');
        const label = norm(b.getAttribute('aria-label') || '');
        btns.push({ el: b, text: text || label, icon: !text && /close|dismiss/.test(label) });
      }
      if (btns.length) out.push({ el: d, btns, aria, text: (d.innerText || '').slice(0, 500) });
    }
    return out;
  }
  const panelLike = (d) => /select your ticket type|ticket selection/i.test(d.text) || d.btns.some((b) => RES_EXACT.test(b.text) || /ticket selection panel|your tickets/i.test(b.text));
  function chooseButton(btns, allowIcon, allowSingle) {
    let best = null, bi = 1e9;
    for (const b of btns) {
      if (NO.test(b.text) || BAD.test(b.text) || !enabled(b.el)) continue;
      let i = OK_TIERS.findIndex((re) => re.test(b.text));
      if (i < 0) { const j = LOOSE.findIndex((re) => re.test(b.text)); if (j >= 0) i = OK_TIERS.length + j; }
      if (i < 0 && b.icon && allowIcon) i = OK_TIERS.length + LOOSE.length;
      if (i < 0 && allowSingle && btns.filter((x) => !NO.test(x.text) && !BAD.test(x.text)).length === 1 && b.text) i = OK_TIERS.length + LOOSE.length + 1;
      if (i >= 0 && i < bi) { bi = i; best = b; }
    }
    return best;
  }
  function handleDialogs() {
    if (!engineOn() || !st.popups || performance.now() > watchUntil) return;
    const nowD = performance.now();
    if (nowD - lastDlg < 30) return;
    lastDlg = nowD;
    for (const d of findDialogs()) {
      if (panelLike(d)) continue;
      const isErr = ERR.test(d.text), n = parseLimit(d.text);
      const c = chooseButton(d.btns, isErr, d.aria);
      if (!c) continue;
      const last = clickedAt.get(c.el) || 0;
      if (performance.now() - last < 700) continue;
      clickedAt.set(c.el, performance.now());
      if (n) { siteLimit = n; cutWait = true; }
      try { pressCenter(c.el); } catch (_) {}
      log({ dialog: 'cleared', clicked: c.text || 'close', text: norm(d.text).slice(0, 44) });
      if (n) { log({ limit: n }); if (stage === 'reserve') afterLimit(n); }
      else if (stage === 'reserve' && ORPHAN.test(d.text)) extendOne();
      else if (isErr && stage !== 'idle') onError(d.text);
      return;
    }
  }
  let dmo = null, dTimer = null, watchUntil = 0, lastDlg = 0;
  function watchDialogs() {
    watchUntil = performance.now() + 10000;
    if (!dmo) { dmo = new MutationObserver(handleDialogs); dmo.observe(document.documentElement, { subtree: true, childList: true, attributes: true }); }
    if (!dTimer) dTimer = setInterval(() => { if (performance.now() > watchUntil) stopDialogs(); else handleDialogs(); }, 50);
  }
  function stopDialogs() { if (dmo) { dmo.disconnect(); dmo = null; } if (dTimer) { clearInterval(dTimer); dTimer = null; } }

  const block = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const shiftOnly = (e) => e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
  function onDown(e) {
    if (!e.isTrusted) return;
    if (e.type === 'mousedown') { if (Date.now() < swallowUntil) block(e); return; }
    if (e.button !== 0 || !shiftOnly(e) || !engineOn()) return;
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-tixgrab')) return;
    const seedEl = seedAt(e.clientX, e.clientY);
    if (!seedEl) return;
    block(e);
    swallowUntil = Date.now() + 500;
    primeAudio();
    grab(seedEl, e.clientX, e.clientY);
  }
  const guard = (e) => { if (e.isTrusted && Date.now() < swallowUntil) block(e); };
  const o = { capture: true, passive: false };
  ['pointerdown', 'mousedown'].forEach((t) => window.addEventListener(t, onDown, o));
  ['pointerup', 'mouseup', 'click', 'dblclick', 'selectstart', 'dragstart'].forEach((t) => window.addEventListener(t, guard, o));

  setInterval(() => {
    if (ignored()) { onIgnored(); return; }
    if (suspended) { suspended = false; announced = false; }
  }, 120);

  function setPower(v) {
    st.on = v; save();
    log({ power: v ? 'on' : 'off' });
    if (!v) { epoch++; stage = 'idle'; stopDialogs(); } else primeAudio();
    if (ui) ui.render();
  }
  function setQty(v) {
    st.qty = v;
    log({ quantity: v });
    if (ui) ui.render();
  }
  function setFlag(k, v) {
    st[k] = v; save();
    log({ [k]: v ? (k === 'reserve' ? 'auto' : 'on') : 'off' });
    if (k === 'sound' && v) tick(0, TICK.seat);
    if (ui) ui.render();
  }
  function resetAll() {
    epoch++; stage = 'idle'; ctx = null; cutWait = false; siteLimit = 0; orphanTries = 0;
    try { sessionStorage.removeItem(RES_KEY); } catch (_) {}
    logs.length = 0;
    if (ui) ui.clear();
    log({ idle: 'reset' });
  }

  if (ignored()) onIgnored();

  if (window.__tixgrabTest) window.__tixgrabTestApi = { chainFrom, windowOf, sameKind, st, logs };
})();
