// Shared helpers for the isolated-world content scripts.
// YouTube enforces Trusted Types, so every node is built with createElement —
// never innerHTML.
'use strict';

var YTPiP = globalThis.YTPiP || (globalThis.YTPiP = {});

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * Creates an element in `doc`.
   * h(doc, 'div', { class: 'a', onclick: fn, dataset: {x: 1} }, child, 'text')
   */
  function h(doc, tag, attrs, ...children) {
    const el = doc.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
        else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2), value);
        } else el.setAttribute(key, value === true ? '' : value);
      }
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.append(typeof child === 'string' ? doc.createTextNode(child) : child);
    }
    return el;
  }

  /**
   * Builds an <svg> from an icon definition (see icons.js):
   *   { viewBox: '0 0 24 24', paths: [{ d, fill?, stroke?, ... }] }
   */
  function svg(doc, icon, size = 24) {
    const root = doc.createElementNS(SVG_NS, 'svg');
    root.setAttribute('viewBox', icon.viewBox || '0 0 24 24');
    root.setAttribute('width', String(size));
    root.setAttribute('height', String(size));
    root.setAttribute('fill', 'none');
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('focusable', 'false');
    const parent = icon.transform ? doc.createElementNS(SVG_NS, 'g') : root;
    if (icon.transform) {
      parent.setAttribute('transform', icon.transform);
      root.appendChild(parent);
    }
    for (const def of icon.paths) {
      const tag = def.tag || 'path';
      const node = doc.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(def)) {
        if (key === 'tag') continue;
        if (key === 'text') node.textContent = value;
        else node.setAttribute(key, String(value));
      }
      if (!def.fill && !def.stroke) node.setAttribute('fill', 'currentColor');
      parent.appendChild(node);
    }
    return root;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const hrs = Math.floor(seconds / 3600);
    const ss = String(s).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /** YouTube video ids are 11 url-safe base64 chars; be lenient on length, strict on alphabet. */
  const isVideoId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(id);

  function isEditableTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const type = (target.type || 'text').toLowerCase();
      return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(type);
    }
    return false;
  }

  /** Talks to src/content/main-world.js, which can reach YouTube's player API. */
  const bridge = (() => {
    let seq = 0;
    const pending = new Map();
    document.addEventListener('ytpip:response', (e) => {
      let msg;
      try { msg = JSON.parse(e.detail); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.id !== 'number') return;
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg.result);
      }
    });
    function call(method, ...args) {
      const id = ++seq;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        document.dispatchEvent(new CustomEvent('ytpip:request', {
          detail: JSON.stringify({ id, method, args }),
        }));
        setTimeout(() => {
          if (pending.delete(id)) resolve(undefined);
        }, 1000);
      });
    }
    return { call };
  })();

  Object.assign(YTPiP, { h, svg, formatTime, clamp, isEditableTarget, isVideoId, bridge });
})();
