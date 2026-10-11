'use strict';
// Zero-dependency test suite (node --test). Covers the pure helpers, the
// isolated-world <-> MAIN-world bridge, and the security invariants of the
// manifest / locales / source tree.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const manifest = JSON.parse(read('manifest.json'));
const locales = {
  en: JSON.parse(read('_locales/en/messages.json')),
  tr: JSON.parse(read('_locales/tr/messages.json')),
};

/** Tiny DOM-less sandbox: enough `document` for the scripts' load-time code. */
function sandbox(extra = {}) {
  const listeners = new Map();
  class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  const document = {
    documentElement: { lang: 'en' },
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) || []), fn]); },
    dispatchEvent(ev) { for (const fn of listeners.get(ev.type) || []) fn(ev); return true; },
    getElementById: () => null,
    querySelector: () => null,
  };
  const ctx = { console, document, navigator: { language: 'en-US' }, CustomEvent, setTimeout, clearTimeout, ...extra };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.load = (file) => vm.runInContext(read(file), ctx, { filename: file });
  return ctx;
}

// ---------------------------------------------------------------- helpers
test('formatTime renders m:ss and h:mm:ss', () => {
  const { YTPiP } = (() => { const c = sandbox(); c.load('src/content/shared.js'); return c; })();
  const cases = [[0, '0:00'], [59, '0:59'], [60, '1:00'], [61.9, '1:01'], [3599, '59:59'],
    [3600, '1:00:00'], [3661, '1:01:01'], [36000, '10:00:00'], [NaN, '0:00'], [-5, '0:00'], [Infinity, '0:00']];
  for (const [input, expected] of cases) assert.equal(YTPiP.formatTime(input), expected, `formatTime(${input})`);
});

test('clamp bounds values', () => {
  const c = sandbox(); c.load('src/content/shared.js');
  assert.equal(c.YTPiP.clamp(5, 0, 10), 5);
  assert.equal(c.YTPiP.clamp(-1, 0, 10), 0);
  assert.equal(c.YTPiP.clamp(11, 0, 10), 10);
});

test('isVideoId accepts YouTube ids and rejects injection attempts', () => {
  const c = sandbox(); c.load('src/content/shared.js');
  const { isVideoId } = c.YTPiP;
  assert.equal(isVideoId('dQw4w9WgXcQ'), true);
  assert.equal(isVideoId('aqz-KE-bpKQ'), true);
  assert.equal(isVideoId('a_b-c1'), true);
  for (const bad of ['', 'abc', 'dQw4w9WgXcQ")', 'x'.repeat(21), '../../etc', 'id with space', null, undefined, 42, {}]) {
    assert.equal(isVideoId(bad), false, `should reject ${String(bad)}`);
  }
});

test('isEditableTarget recognises text inputs, textareas and contenteditable only', () => {
  const c = sandbox(); c.load('src/content/shared.js');
  const { isEditableTarget } = c.YTPiP;
  const el = (tagName, extra = {}) => ({ nodeType: 1, tagName, ...extra });
  assert.equal(isEditableTarget(el('INPUT', { type: 'text' })), true);
  assert.equal(isEditableTarget(el('INPUT', { type: 'search' })), true);
  assert.equal(isEditableTarget(el('INPUT')), true);
  assert.equal(isEditableTarget(el('INPUT', { type: 'checkbox' })), false);
  assert.equal(isEditableTarget(el('INPUT', { type: 'range' })), false);
  assert.equal(isEditableTarget(el('TEXTAREA')), true);
  assert.equal(isEditableTarget(el('SELECT')), true);
  assert.equal(isEditableTarget(el('DIV', { isContentEditable: true })), true);
  assert.equal(isEditableTarget(el('DIV')), false);
  assert.equal(isEditableTarget(el('BUTTON')), false);
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget({ nodeType: 3 }), false);
});

test('h() builds elements without touching innerHTML', () => {
  const made = [];
  const fakeDoc = {
    createElement(tag) {
      const node = {
        tag, attrs: {}, children: [], dataset: {}, style: {}, listeners: {},
        set className(v) { this.attrs.class = v; },
        set textContent(v) { this.children = [v]; },
        setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(t, fn) { this.listeners[t] = fn; },
        append(...kids) { this.children.push(...kids); },
      };
      Object.defineProperty(node, 'innerHTML', { set() { throw new Error('innerHTML used'); } });
      made.push(node);
      return node;
    },
    createTextNode: (s) => ({ text: s }),
  };
  const c = sandbox(); c.load('src/content/shared.js');
  const el = c.YTPiP.h(fakeDoc, 'div', { class: 'a', dataset: { k: 1 }, hidden: true, skip: null, onclick: () => {} }, 'hi', null, ['x']);
  assert.equal(el.attrs.class, 'a');
  assert.equal(el.dataset.k, 1);
  assert.equal(el.attrs.hidden, '');
  assert.equal('skip' in el.attrs, false);
  assert.equal(typeof el.listeners.click, 'function');
  assert.deepEqual(el.children.map((k) => k.text), ['hi', 'x']);
});

// ---------------------------------------------------------------- i18n
test('content i18n tables are complete for every language and fall back to English', () => {
  const c = sandbox(); c.load('src/content/i18n.js');
  const src = read('src/content/i18n.js');
  const langs = [...src.matchAll(/^    ([a-z]{2}): \{$/gm)].map((m) => m[1]);
  assert.ok(langs.includes('en') && langs.includes('tr'), 'has en + tr');
  const keysOf = (lang) => [...src.slice(src.indexOf(`    ${lang}: {`)).match(/^      (\w+):/gm)].map((s) => s.trim().slice(0, -1));
  const enKeys = new Set(keysOf('en').slice(0, 17));
  for (const lang of langs) {
    for (const key of enKeys) {
      c.document.documentElement.lang = lang;
      assert.notEqual(c.YTPiP.t(key), key, `${lang}.${key} missing`);
    }
  }
  c.document.documentElement.lang = 'xx-YY';
  assert.equal(c.YTPiP.t('live'), 'LIVE');
  c.document.documentElement.lang = 'tr';
  assert.equal(c.YTPiP.t('seekBack', { n: 10 }), '10 saniye geri');
});

test('every t(key) used by the content scripts exists in the English table', () => {
  const c = sandbox(); c.load('src/content/i18n.js');
  c.document.documentElement.lang = 'en';
  const used = new Set();
  for (const f of ['src/content/content.js', 'src/content/pip-window.js']) {
    for (const m of read(f).matchAll(/\bt\('(\w+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 10, 'found t() usages');
  for (const key of used) assert.notEqual(c.YTPiP.t(key), key, `missing i18n key: ${key}`);
});

test('_locales en and tr define the same keys, and every referenced key exists', () => {
  assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.tr).sort());
  const referenced = new Set();
  for (const m of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) referenced.add(m[1]);
  for (const m of read('src/popup/popup.html').matchAll(/data-i18n="(\w+)"/g)) referenced.add(m[1]);
  for (const m of read('src/popup/popup.js').matchAll(/msg\('(\w+)'/g)) referenced.add(m[1]);
  for (const m of read('src/popup/popup.js').matchAll(/: '(\w+)'/g)) if (/^(style|seek|hotkey|autoPip|pauseWhenHidden|fullscreen)/.test(m[1])) referenced.add(m[1]);
  assert.ok(referenced.size >= 8);
  for (const key of referenced) {
    assert.ok(key in locales.en, `en missing ${key}`);
    assert.ok(key in locales.tr, `tr missing ${key}`);
  }
});

// ---------------------------------------------------------------- bridge
function bridgeSandbox(playerApi) {
  const c = sandbox();
  c.document.getElementById = (id) => (id === 'movie_player' ? playerApi : null);
  c.load('src/content/main-world.js');
  c.load('src/content/shared.js');
  return c;
}

test('bridge round-trips a whitelisted method through JSON CustomEvents', async () => {
  const c = bridgeSandbox({
    getVideoData: () => ({ video_id: 'dQw4w9WgXcQ', title: 'T', author: 'A', isLive: false }),
    getVolume: () => 42, isMuted: () => false,
  });
  const info = await c.YTPiP.bridge.call('info');
  assert.deepEqual(JSON.parse(JSON.stringify(info)), { videoId: 'dQw4w9WgXcQ', title: 'T', author: 'A', isLive: false, volume: 42, muted: false });
});

test('bridge rejects unknown and prototype methods with a null result', async () => {
  const c = bridgeSandbox({ getVideoData: () => ({}) });
  for (const method of ['nope', '__proto__', 'constructor', 'hasOwnProperty', 'toString']) {
    assert.equal(await c.YTPiP.bridge.call(method), null, method);
  }
});

test('MAIN-world listener ignores malformed requests instead of answering them', () => {
  const c = bridgeSandbox({ getVideoData: () => ({}), setVolume: () => {} });
  const responses = [];
  c.document.addEventListener('ytpip:response', (e) => responses.push(e.detail));
  const send = (detail) => c.document.dispatchEvent(new c.CustomEvent('ytpip:request', { detail }));
  send('not json');
  send(JSON.stringify({ method: 'info' }));            // no id
  send(JSON.stringify({ id: 'x', method: 'info' }));   // id not a number
  send(JSON.stringify({ id: 1, method: 5 }));          // method not a string
  send(JSON.stringify(null));
  send(JSON.stringify([1, 2]));
  assert.deepEqual(responses, []);
  send(JSON.stringify({ id: 7, method: 'setVolume', args: 'not-an-array' }));
  assert.deepEqual(responses.map((r) => JSON.parse(r)), [{ id: 7, result: true }]);
});

test('setVolume clamps and coerces untrusted input', () => {
  const calls = [];
  const c = bridgeSandbox({ setVolume: (v) => calls.push(v) });
  const send = (args) => c.document.dispatchEvent(new c.CustomEvent('ytpip:request', { detail: JSON.stringify({ id: 1, method: 'setVolume', args }) }));
  send([150]); send([-5]); send(['abc']); send([{}]); send([33.3]);
  assert.deepEqual(calls, [100, 0, 0, 0, 33.3]);
});

// ---------------------------------------------------------------- manifest / security invariants
test('manifest is MV3 with the minimum permission set', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.background.type, undefined, 'no module worker needed');
  assert.ok(Number(manifest.minimum_chrome_version) >= 116, 'Document PiP needs Chrome 116+');
});

test('manifest ships a strict content security policy', () => {
  const csp = manifest.content_security_policy?.extension_pages;
  assert.ok(csp, 'content_security_policy.extension_pages present');
  const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
  assert.deepEqual(directives['default-src'], ["'none'"]);
  assert.deepEqual(directives['script-src'], ["'self'"]);
  assert.deepEqual(directives['object-src'], ["'none'"]);
  assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
  assert.deepEqual(directives['base-uri'], ["'none'"]);
  assert.deepEqual(directives['connect-src'], ["'none'"]);
  assert.ok(!/unsafe-(inline|eval)|https?:|\*/.test(csp), 'no unsafe sources');
});

test('content scripts run only on YouTube over https', () => {
  const allowed = new Set(['https://www.youtube.com/*', 'https://www.youtube-nocookie.com/embed/*']);
  for (const cs of manifest.content_scripts) {
    for (const m of cs.matches) assert.ok(allowed.has(m), `unexpected match pattern ${m}`);
    assert.equal(cs.exclude_matches, undefined);
    assert.ok(cs.matches.every((m) => m.startsWith('https://')));
  }
  const main = manifest.content_scripts.filter((cs) => cs.world === 'MAIN');
  assert.equal(main.length, 1, 'exactly one MAIN-world script');
  assert.deepEqual(main[0].js, ['src/content/main-world.js']);
});

test('every file the manifest references exists', () => {
  const files = new Set();
  for (const v of Object.values(manifest.icons)) files.add(v);
  for (const v of Object.values(manifest.action.default_icon)) files.add(v);
  files.add(manifest.action.default_popup);
  files.add(manifest.background.service_worker);
  for (const cs of manifest.content_scripts) for (const f of [...(cs.js || []), ...(cs.css || [])]) files.add(f);
  for (const f of files) assert.ok(exists(f), `${f} missing`);
  for (const lang of ['en', 'tr']) assert.ok(exists(`_locales/${lang}/messages.json`));
  assert.equal(manifest.default_locale, 'en');
});

test('popup html loads only local scripts and styles, nothing inline', () => {
  const html = read('src/popup/popup.html');
  assert.ok(!/<script[^>]*>[^<]*\S[^<]*<\/script>/.test(html), 'no inline script bodies');
  assert.ok(!/\son\w+=/i.test(html), 'no inline event handlers');
  assert.ok(!/style=/i.test(html), 'no inline styles');
  for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(m[1]), `remote reference ${m[1]}`);
    assert.ok(exists(path.join('src/popup', m[1])), `${m[1]} missing`);
  }
  // The only outbound link is the project page, opened as a plain anchor.
  const anchors = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(anchors, ['https://github.com/lastref/mssoft-youtube-pip']);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('source tree avoids dangerous sinks and remote code', () => {
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  const files = walk('src').filter((f) => /\.(js|html|css)$/.test(f));
  assert.ok(files.length >= 10);
  const banned = [/\binnerHTML\b(?!\s*\.)/, /outerHTML\s*=/, /insertAdjacentHTML/, /\beval\(/, /new Function\(/, /document\.write/,
    /\bsrcdoc\b/, /javascript:/, /\bfetch\(/, /XMLHttpRequest/, /importScripts/, /chrome\.scripting/, /http:\/\/(?!www\.w3\.org)/];
  for (const f of files) {
    const src = read(f).replace(/^\s*\/\/.*$/gm, '');
    for (const re of banned) assert.ok(!re.test(src), `${f} matches ${re}`);
  }
  // The only remote hosts the extension ever references.
  const hosts = new Set();
  for (const f of files) for (const m of read(f).matchAll(/https:\/\/([a-z0-9.-]+)/g)) hosts.add(m[1]);
  assert.deepEqual([...hosts].sort(), ['github.com', 'i.ytimg.com', 'www.youtube-nocookie.com', 'www.youtube.com']);
  for (const f of files) if (f !== 'src/popup/popup.html') assert.ok(!read(f).includes('github.com'), `${f} references github.com`);
  // Google Fonts is only ever copied from a link YouTube itself loaded, after a host check.
  assert.match(read('src/content/pip-window.js'), /url\.hostname !== 'fonts\.googleapis\.com'/);
});

test('every settings key has the same default in the content script, popup and installer', () => {
  const pick = (src) => Object.fromEntries([...src.match(/DEFAULTS = \{([^}]+)\}/)[1].matchAll(/(\w+): ([^,]+)/g)].map((m) => [m[1], m[2].trim()]));
  const content = pick(read('src/content/content.js'));
  const popup = pick(read('src/popup/popup.js'));
  assert.deepEqual(content, popup);
  const installer = Object.fromEntries([...read('src/background.js').match(/storage\.sync\.set\(\{([^}]+)\}/)[1].matchAll(/(\w+): ([^,]+)/g)].map((m) => [m[1], m[2].trim()]));
  assert.deepEqual(installer, content);
  assert.deepEqual(Object.keys(content).sort(), ['autoPip', 'buttonStyle', 'hotkey', 'pauseWhenHidden', 'seekStep']);
});

test('background accepts focus requests only from our own YouTube content scripts', () => {
  const src = read('src/background.js');
  assert.match(src, /sender\.id !== chrome\.runtime\.id/);
  assert.match(src, /https:\/\/www\.youtube\.com/);
  assert.ok(!/chrome\.tabs\.(query|create|executeScript)/.test(src));
});
