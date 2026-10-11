'use strict';

(() => {
  const DEFAULTS = { buttonStyle: 'native', seekStep: 10, hotkey: true, autoPip: false, pauseWhenHidden: false };
  const STYLE_LABELS = { native: 'styleNative', popout: 'stylePopout', float: 'styleFloat', detach: 'styleDetach' };
  const SEEK_STEPS = [5, 10, 15, 30];
  const { h, svg } = YTPiP;
  const msg = (key, ...subs) => chrome.i18n.getMessage(key, subs) || key;

  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = msg(el.dataset.i18n);

  const stylesEl = document.getElementById('styles');
  const seekEl = document.getElementById('seek');
  const hotkeyEl = document.getElementById('hotkey');
  const autoPipEl = document.getElementById('autoPip');
  const pauseWhenHiddenEl = document.getElementById('pauseWhenHidden');

  const save = (patch) => chrome.storage.sync.set(patch);

  function radio(group, value, selected, content, onSelect) {
    const el = h(document, 'button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(selected),
      dataset: { value: String(value) },
      onclick: onSelect,
    }, content);
    group.append(el);
    return el;
  }

  function renderStyles(current) {
    stylesEl.replaceChildren();
    for (const [style, icons] of Object.entries(YTPiP.icons.buttonIcons)) {
      radio(stylesEl, style, style === current, [
        // A slice of YouTube's control bar with the icon sitting in it.
        h(document, 'span', { class: 'preview' },
          h(document, 'span', { class: 'pill' },
            h(document, 'span', { class: 'slot dim' }, svg(document, YTPiP.icons.ui.fullscreen, 16)),
            h(document, 'span', { class: 'slot' }, svg(document, icons.on, 16)))),
        h(document, 'span', { class: 'name', text: msg(STYLE_LABELS[style]) }),
      ], () => {
        save({ buttonStyle: style });
        renderStyles(style);
      });
    }
  }

  function renderSeek(current) {
    seekEl.replaceChildren();
    for (const step of SEEK_STEPS) {
      radio(seekEl, step, step === current, msg('seconds', String(step)), () => {
        save({ seekStep: step });
        renderSeek(step);
      });
    }
  }

  // Arrow-key navigation inside radio groups.
  for (const group of [stylesEl, seekEl]) {
    group.addEventListener('keydown', (e) => {
      const items = [...group.querySelectorAll('[role="radio"]')];
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!delta) return;
      e.preventDefault();
      const next = items[(i + delta + items.length) % items.length];
      next.click();
      group.querySelector(`[data-value="${next.dataset.value}"]`)?.focus();
    });
  }

  chrome.storage.sync.get(DEFAULTS).then((s) => {
    renderStyles(s.buttonStyle);
    renderSeek(s.seekStep);
    hotkeyEl.checked = !!s.hotkey;
    autoPipEl.checked = !!s.autoPip;
    pauseWhenHiddenEl.checked = !!s.pauseWhenHidden;
  });
  hotkeyEl.addEventListener('change', () => save({ hotkey: hotkeyEl.checked }));
  autoPipEl.addEventListener('change', () => save({ autoPip: autoPipEl.checked }));
  pauseWhenHiddenEl.addEventListener('change', () => save({ pauseWhenHidden: pauseWhenHiddenEl.checked }));
})();
