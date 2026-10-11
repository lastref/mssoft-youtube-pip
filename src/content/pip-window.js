// Builds the YouTube-style player UI inside a Document Picture-in-Picture
// window and drives it from the real <video> element.
'use strict';

var YTPiP = globalThis.YTPiP || (globalThis.YTPiP = {});

(() => {
  const HIDE_DELAY = 2500;
  const SEEK_THROTTLE = 120;

  /**
   * @param {object} opts
   * @param {Window} opts.win            the PiP window
   * @param {HTMLVideoElement} opts.video the YouTube <video> (moved in by the caller)
   * @param {Element} opts.playerEl      #movie_player in the opener page
   * @param {number} opts.seekStep       seconds for the ⟲/⟳ buttons and j/l keys
   * @param {() => void} opts.onBackToTab
   * @param {() => void} opts.onFullscreen
   */
  YTPiP.createPipUI = function createPipUI(opts) {
    const { win, video, playerEl, onBackToTab, onFullscreen } = opts;
    const { h, svg, formatTime, clamp, t, bridge } = YTPiP;
    const icons = YTPiP.icons.ui;
    const doc = win.document;
    let seekStep = opts.seekStep || 10;
    let tooltipOwner = null;

    const cleanups = [];
    const on = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      cleanups.push(() => target.removeEventListener(type, fn, options));
    };

    // ---------- document setup ----------
    doc.documentElement.lang = document.documentElement.lang || 'en';
    try {
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(YTPiP.pipCss);
      doc.adoptedStyleSheets = [sheet];
    } catch {
      doc.head.append(h(doc, 'style', { text: YTPiP.pipCss }));
    }
    // Reuse YouTube's web font so text matches the page.
    for (const link of document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')) {
      let url;
      try { url = new URL(link.href); } catch { continue; }
      if (url.protocol !== 'https:' || url.hostname !== 'fonts.googleapis.com') continue;
      doc.head.append(h(doc, 'link', { rel: 'stylesheet', href: url.href }));
    }

    // ---------- small builders ----------
    function button({ cls = '', icon, size = 24, tip, kbd = '', onClick }) {
      const b = h(doc, 'button', { class: `ytpip-btn ${cls}`, type: 'button' });
      if (icon) b.append(svg(doc, icon, size));
      setTip(b, tip, kbd);
      on(b, 'click', (e) => {
        e.stopPropagation();
        onClick(e);
        wake();
      });
      return b;
    }
    function setIcon(b, icon, size = 24) {
      const next = svg(doc, icon, size);
      const prev = b.querySelector('svg');
      if (prev) prev.replaceWith(next);
      else b.prepend(next);
    }
    function setTip(b, tip, kbd = '') {
      b.dataset.tip = tip;
      b.dataset.kbd = kbd;
      b.setAttribute('aria-label', kbd ? `${tip} (${kbd})` : tip);
      if (tooltipOwner === b) showTooltip(b);
    }
    function seekIcon(base, step) {
      return {
        ...base,
        paths: [
          ...base.paths,
          { tag: 'text', x: 12, y: 15.6, 'text-anchor': 'middle', class: 'ytpip-seek-label', fill: 'currentColor', text: String(step) },
        ],
      };
    }

    // ---------- DOM ----------
    const titleEl = h(doc, 'div', { class: 'ytpip-title' });
    const authorEl = h(doc, 'div', { class: 'ytpip-author' });

    const seekBackBtn = button({
      cls: 'ytpip-circle ytpip-seek',
      icon: seekIcon(icons.seekBack, seekStep), size: 26,
      tip: t('seekBack', { n: seekStep }), kbd: 'j',
      onClick: () => seekBy(-seekStep, true),
    });
    const playBtn = button({
      cls: 'ytpip-circle ytpip-big', icon: icons.pause, size: 30,
      tip: t('pause'), kbd: 'k',
      onClick: () => togglePlay(false),
    });
    const seekFwdBtn = button({
      cls: 'ytpip-circle ytpip-seek',
      icon: seekIcon(icons.seekForward, seekStep), size: 26,
      tip: t('seekForward', { n: seekStep }), kbd: 'l',
      onClick: () => seekBy(seekStep, true),
    });

    const nextBtn = button({
      cls: 'ytpip-next', icon: icons.next, tip: t('next'), kbd: 'shift+n',
      onClick: () => bridge.call('nextVideo'),
    });
    const muteBtn = button({
      icon: icons.volumeHigh, tip: t('mute'), kbd: 'm',
      onClick: () => toggleMute(),
    });
    const volFill = h(doc, 'div', { class: 'ytpip-volume-fill' });
    const volHandle = h(doc, 'div', { class: 'ytpip-volume-handle' });
    const volSlider = h(doc, 'div', {
      class: 'ytpip-volume-slider', role: 'slider', tabindex: '0',
      'aria-valuemin': '0', 'aria-valuemax': '100',
    }, h(doc, 'div', { class: 'ytpip-volume-track' }, volFill), volHandle);
    const volumeWrap = h(doc, 'div', { class: 'ytpip-volume' }, muteBtn, volSlider);
    const miniPlayBtn = button({
      cls: 'ytpip-compact-only', icon: icons.pause, tip: t('pause'), kbd: 'k',
      onClick: () => togglePlay(false),
    });
    const miniBackBtn = button({
      cls: 'ytpip-compact-only ytpip-seek-mini', icon: seekIcon(icons.seekBack, seekStep),
      tip: t('seekBack', { n: seekStep }), kbd: 'j',
      onClick: () => seekBy(-seekStep, true),
    });
    const miniFwdBtn = button({
      cls: 'ytpip-compact-only ytpip-seek-mini', icon: seekIcon(icons.seekForward, seekStep),
      tip: t('seekForward', { n: seekStep }), kbd: 'l',
      onClick: () => seekBy(seekStep, true),
    });
    const leftPill = h(doc, 'div', { class: 'ytpip-pill' },
      miniPlayBtn, miniBackBtn, miniFwdBtn, nextBtn, volumeWrap);

    const currentEl = h(doc, 'span', { text: '0:00' });
    const durationEl = h(doc, 'span', { text: '0:00' });
    const timeEl = h(doc, 'div', { class: 'ytpip-time' },
      h(doc, 'span', { class: 'ytpip-ad-label', text: t('ad') }),
      currentEl,
      h(doc, 'span', { class: 'ytpip-duration-part' },
        h(doc, 'span', { class: 'ytpip-sep', text: '/' }), durationEl));
    const liveBtn = h(doc, 'button', { class: 'ytpip-live', type: 'button', text: t('live') });
    on(liveBtn, 'click', (e) => {
      e.stopPropagation();
      bridge.call('seekToLiveHead').then((ok) => {
        if (!ok && video.seekable.length) video.currentTime = video.seekable.end(video.seekable.length - 1);
      });
    });
    const timePill = h(doc, 'div', { class: 'ytpip-pill ytpip-time-pill' }, liveBtn, timeEl);

    const backBtn = button({ cls: 'ytpip-back', icon: icons.backToTab, tip: t('backToTab'), onClick: () => onBackToTab() });
    const fsBtn = button({ icon: icons.fullscreen, tip: t('fullscreen'), kbd: 'f', onClick: () => onFullscreen() });
    const rightPill = h(doc, 'div', { class: 'ytpip-pill' }, backBtn, fsBtn);

    const buffered = h(doc, 'div', { class: 'ytpip-buffered' });
    const hoverFill = h(doc, 'div', { class: 'ytpip-hover-fill' });
    const played = h(doc, 'div', { class: 'ytpip-played' });
    const track = h(doc, 'div', { class: 'ytpip-track' }, buffered, hoverFill, played);
    const scrubber = h(doc, 'div', { class: 'ytpip-scrubber' });
    const hoverTime = h(doc, 'div', { class: 'ytpip-hover-time' });
    const progress = h(doc, 'div', {
      class: 'ytpip-progress', role: 'slider', 'aria-valuemin': '0', tabindex: '-1',
    }, track, scrubber, hoverTime);

    const bottom = h(doc, 'div', { class: 'ytpip-bottom' },
      progress,
      h(doc, 'div', { class: 'ytpip-row' }, leftPill, timePill, h(doc, 'div', { class: 'ytpip-spacer' }), rightPill));
    const center = h(doc, 'div', { class: 'ytpip-center' }, seekBackBtn, playBtn, seekFwdBtn);

    const chrome = h(doc, 'div', { class: 'ytpip-chrome' },
      h(doc, 'div', { class: 'ytpip-scrim-top' }),
      h(doc, 'div', { class: 'ytpip-scrim-bottom' }),
      h(doc, 'div', { class: 'ytpip-top' }, titleEl, authorEl),
      center,
      bottom);

    const bezel = h(doc, 'div', { class: 'ytpip-bezel' });
    const bezelText = h(doc, 'div', { class: 'ytpip-bezel-text' });
    const spinner = h(doc, 'div', { class: 'ytpip-spinner' });
    const tooltip = h(doc, 'div', { class: 'ytpip-tooltip', role: 'tooltip' },
      h(doc, 'span'), h(doc, 'span', { class: 'ytpip-kbd' }));

    const stage = h(doc, 'div', { class: 'ytpip-stage' }, spinner, chrome, bezel, bezelText, tooltip);
    doc.body.append(stage);

    // ---------- tooltip ----------
    function showTooltip(b) {
      tooltipOwner = b;
      tooltip.firstChild.textContent = b.dataset.tip || '';
      tooltip.lastChild.textContent = b.dataset.kbd || '';
      const r = b.getBoundingClientRect();
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      const left = clamp(r.left + r.width / 2 - tw / 2, 8, win.innerWidth - tw - 8);
      let top = r.top - th - 10;
      if (top < 8) top = r.bottom + 10;
      tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      tooltip.classList.add('ytpip-visible');
    }
    function hideTooltip() {
      tooltipOwner = null;
      tooltip.classList.remove('ytpip-visible');
    }
    on(stage, 'pointerover', (e) => {
      const b = e.target.closest?.('.ytpip-btn');
      if (b && b !== tooltipOwner) showTooltip(b);
      else if (!b && tooltipOwner) hideTooltip();
    });
    on(stage, 'pointerleave', hideTooltip);

    // ---------- auto-hide ----------
    let hideTimer = 0;
    let overControls = false;
    let dragging = false;
    let volDragging = false;
    function wake() {
      stage.classList.add('ytpip-active');
      doc.body.classList.remove('ytpip-idle');
      win.clearTimeout(hideTimer);
      hideTimer = win.setTimeout(sleep, HIDE_DELAY);
    }
    function sleep() {
      if (video.paused || dragging || volDragging || overControls) return;
      stage.classList.remove('ytpip-active');
      doc.body.classList.add('ytpip-idle');
      hideTooltip();
    }
    on(doc, 'pointermove', wake);
    on(doc, 'pointerdown', wake);
    on(doc.documentElement, 'pointerleave', () => {
      overControls = false;
      win.clearTimeout(hideTimer);
      hideTimer = win.setTimeout(sleep, 300);
    });
    for (const el of [bottom, center]) {
      on(el, 'pointerenter', () => { overControls = true; });
      on(el, 'pointerleave', () => { overControls = false; wake(); });
    }

    // ---------- playback ----------
    function showBezel(icon, text) {
      bezel.replaceChildren(svg(doc, icon, 36));
      bezel.classList.remove('ytpip-animate');
      void bezel.offsetWidth; // restart the animation
      bezel.classList.add('ytpip-animate');
      if (text) {
        bezelText.textContent = text;
        bezelText.classList.add('ytpip-visible');
        win.clearTimeout(showBezel.timer);
        showBezel.timer = win.setTimeout(() => bezelText.classList.remove('ytpip-visible'), 600);
      }
    }
    function togglePlay(withBezel) {
      if (video.paused || video.ended) {
        video.play().catch(() => {});
        if (withBezel) showBezel(icons.play);
      } else {
        video.pause();
        if (withBezel) showBezel(icons.pause);
      }
    }
    function seekRange() {
      const d = video.duration;
      if ((isLive || !Number.isFinite(d)) && video.seekable.length) {
        return { start: video.seekable.start(0), end: video.seekable.end(video.seekable.length - 1) };
      }
      return { start: 0, end: Number.isFinite(d) ? d : 0 };
    }
    function seekTo(time) {
      const { start, end } = seekRange();
      video.currentTime = clamp(time, start, Math.max(start, end - 0.1));
    }
    function seekBy(delta, withBezel) {
      if (isAd) return;
      seekTo(video.currentTime + delta);
      if (withBezel) {
        showBezel(delta < 0 ? icons.seekBack : icons.seekForward, t('seconds', { n: Math.abs(delta) }));
      }
      render();
    }

    // ---------- volume ----------
    let volume = Math.round(video.volume * 100);
    let muted = video.muted;
    async function syncVolume() {
      const info = await bridge.call('info');
      if (info && info.volume != null) {
        volume = info.volume;
        muted = !!info.muted;
      } else {
        volume = Math.round(video.volume * 100);
        muted = video.muted;
      }
      renderVolume();
    }
    function renderVolume() {
      const level = muted ? 0 : volume;
      setIcon(muteBtn, level === 0 ? icons.volumeMuted : level < 50 ? icons.volumeLow : icons.volumeHigh);
      setTip(muteBtn, level === 0 ? t('unmute') : t('mute'), 'm');
      volFill.style.width = `${level}%`;
      volHandle.style.left = `calc(6px + (100% - 12px) * ${level / 100})`;
      volSlider.setAttribute('aria-valuenow', String(level));
    }
    async function setVolume(v) {
      volume = Math.round(clamp(v, 0, 100));
      if (await bridge.call('setVolume', volume)) {
        if (muted && volume > 0) await bridge.call('setMuted', false);
      } else {
        video.volume = volume / 100;
        if (volume > 0) video.muted = false;
      }
      muted = volume === 0 ? muted : false;
      renderVolume();
    }
    async function toggleMute() {
      const target = !(muted || volume === 0);
      if (!target && volume === 0) {
        await setVolume(50);
        return;
      }
      if (!(await bridge.call('setMuted', target))) video.muted = target;
      muted = target;
      renderVolume();
    }
    function volumeFromEvent(e) {
      const r = volSlider.getBoundingClientRect();
      setVolume(((e.clientX - r.left - 6) / (r.width - 12)) * 100);
    }
    on(volSlider, 'pointerdown', (e) => {
      e.stopPropagation();
      volDragging = true;
      volSlider.setPointerCapture(e.pointerId);
      volSlider.classList.add('ytpip-dragging');
      volumeFromEvent(e);
    });
    on(volSlider, 'pointermove', (e) => { if (volDragging) volumeFromEvent(e); });
    const endVolDrag = () => {
      volDragging = false;
      volSlider.classList.remove('ytpip-dragging');
    };
    on(volSlider, 'pointerup', endVolDrag);
    on(volSlider, 'lostpointercapture', endVolDrag);
    on(volSlider, 'click', (e) => e.stopPropagation());
    on(volSlider, 'keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setVolume(volume + 5); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setVolume(volume - 5); e.preventDefault(); e.stopPropagation(); }
    });

    // ---------- progress ----------
    let dragFraction = null;
    let lastSeekAt = 0;
    function fractionFromEvent(e) {
      const r = track.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1);
    }
    function updateHover(e) {
      const f = fractionFromEvent(e);
      const { start, end } = seekRange();
      hoverFill.style.width = `${f * 100}%`;
      hoverTime.textContent = isLive ? `-${formatTime(end - (start + f * (end - start)))}` : formatTime(start + f * (end - start));
      const half = hoverTime.offsetWidth / 2;
      const x = clamp(f * track.clientWidth, half - 2, track.clientWidth - half + 2);
      hoverTime.style.left = `${x}px`;
    }
    function scrubTo(e, final) {
      dragFraction = fractionFromEvent(e);
      const now = performance.now();
      if (final || now - lastSeekAt > SEEK_THROTTLE) {
        lastSeekAt = now;
        const { start, end } = seekRange();
        seekTo(start + dragFraction * (end - start));
      }
      render();
    }
    on(progress, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging = true;
      progress.setPointerCapture(e.pointerId);
      progress.classList.add('ytpip-dragging');
      scrubTo(e, false);
    });
    on(progress, 'pointermove', (e) => {
      updateHover(e);
      if (dragging) scrubTo(e, false);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      if (e.type === 'pointerup') scrubTo(e, true);
      dragFraction = null;
      progress.classList.remove('ytpip-dragging');
      wake();
    };
    on(progress, 'pointerup', endDrag);
    on(progress, 'lostpointercapture', endDrag);
    on(progress, 'click', (e) => e.stopPropagation());

    // ---------- rendering ----------
    let isLive = false;
    let isAd = false;
    function render() {
      const { start, end } = seekRange();
      const span = Math.max(end - start, 0.001);
      const cur = video.currentTime;
      const f = dragFraction != null ? dragFraction : clamp((cur - start) / span, 0, 1);
      const width = track.clientWidth;
      played.style.width = `${f * 100}%`;
      played.style.setProperty('--ytpip-bar-width', `${width}px`);
      scrubber.style.left = `${f * width}px`;

      let bufferedEnd = 0;
      const b = video.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= cur + 0.5 && b.end(i) >= cur) bufferedEnd = b.end(i);
      }
      buffered.style.width = `${clamp((bufferedEnd - start) / span, 0, 1) * 100}%`;

      const shown = dragFraction != null ? start + dragFraction * span : cur;
      currentEl.textContent = formatTime(shown);
      durationEl.textContent = formatTime(end);
      progress.setAttribute('aria-valuemax', String(Math.round(end)));
      progress.setAttribute('aria-valuenow', String(Math.round(shown)));
      progress.setAttribute('aria-valuetext', `${formatTime(shown)} / ${formatTime(end)}`);
      if (isLive) liveBtn.classList.toggle('ytpip-at-edge', end - cur < 15);
    }
    function renderPlay() {
      const paused = video.paused || video.ended;
      setIcon(playBtn, paused ? icons.play : icons.pause, 30);
      setTip(playBtn, paused ? t('play') : t('pause'), 'k');
      setIcon(miniPlayBtn, paused ? icons.play : icons.pause);
      setTip(miniPlayBtn, paused ? t('play') : t('pause'), 'k');
    }

    let rafId = 0;
    function loop() {
      render();
      rafId = win.requestAnimationFrame(loop);
    }
    rafId = win.requestAnimationFrame(loop);

    let bufferTimer = 0;
    const videoEvents = {
      play: () => { renderPlay(); wake(); },
      pause: () => { renderPlay(); wake(); },
      ended: renderPlay,
      volumechange: syncVolume,
      loadedmetadata: () => refreshInfo(),
      durationchange: render,
      waiting: () => {
        win.clearTimeout(bufferTimer);
        bufferTimer = win.setTimeout(() => stage.classList.add('ytpip-buffering'), 400);
      },
    };
    const clearBuffering = () => {
      win.clearTimeout(bufferTimer);
      stage.classList.remove('ytpip-buffering');
    };
    for (const type of ['playing', 'canplay', 'seeked', 'pause']) on(video, type, clearBuffering);
    for (const [type, fn] of Object.entries(videoEvents)) on(video, type, fn);

    // ---------- clicks & keys ----------
    on(stage, 'click', (e) => {
      if (e.target.closest('.ytpip-btn, .ytpip-progress, .ytpip-row, .ytpip-live')) return;
      togglePlay(true);
    });
    on(stage, 'dblclick', (e) => {
      if (e.target.closest('.ytpip-btn, .ytpip-progress, .ytpip-row')) return;
      onFullscreen();
    });

    on(doc, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === ' ' || e.key === 'Enter') && e.target.closest?.('button, [role="slider"]')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let handled = true;
      switch (key) {
        case ' ':
        case 'k': togglePlay(true); break;
        case 'j': seekBy(-seekStep, true); break;
        case 'l': seekBy(seekStep, true); break;
        case 'ArrowLeft': seekBy(-5, true); break;
        case 'ArrowRight': seekBy(5, true); break;
        case 'ArrowUp': setVolume((muted ? 0 : volume) + 5); break;
        case 'ArrowDown': setVolume((muted ? 0 : volume) - 5); break;
        case 'm': toggleMute(); break;
        case 'f': onFullscreen(); break;
        case 'p': onBackToTab(); break;
        case 'n': if (e.shiftKey) bridge.call('nextVideo'); else handled = false; break;
        case 'Home': if (!isAd) seekTo(seekRange().start); break;
        case 'End': if (!isAd) seekTo(seekRange().end); break;
        default:
          if (/^[0-9]$/.test(key) && !isAd && !isLive) {
            seekTo(seekRange().end * (Number(key) / 10));
          } else handled = false;
      }
      if (handled) {
        e.preventDefault();
        wake();
      }
    });

    // ---------- page state (title, ads, next button) ----------
    function pageTitle() {
      return document.title.replace(/^\(\d+\)\s*/, '').replace(/\s+-\s+YouTube$/, '');
    }
    async function refreshInfo() {
      const info = await bridge.call('info');
      const title = info?.title || pageTitle();
      titleEl.textContent = title;
      authorEl.textContent = info?.author || '';
      doc.title = title || 'YouTube';
      isLive = !!info?.isLive || video.duration === Infinity;
      stage.classList.toggle('ytpip-is-live', isLive);
      const mainNext = playerEl?.querySelector('.ytp-next-button');
      const hasNext = !!mainNext && getComputedStyle(mainNext).display !== 'none';
      nextBtn.style.display = hasNext ? '' : 'none';
      render();
    }
    function syncAdState() {
      isAd = !!playerEl?.classList.contains('ad-showing');
      stage.classList.toggle('ytpip-ad', isAd);
      for (const b of [seekBackBtn, seekFwdBtn, miniBackBtn, miniFwdBtn]) b.disabled = isAd;
    }
    let adObserver = null;
    if (playerEl) {
      adObserver = new MutationObserver(() => {
        const was = isAd;
        syncAdState();
        if (was !== isAd) refreshInfo();
      });
      adObserver.observe(playerEl, { attributes: true, attributeFilter: ['class'] });
    }

    // ---------- init ----------
    syncAdState();
    renderPlay();
    syncVolume();
    refreshInfo();
    wake();

    return {
      stage,
      refreshInfo,
      setSeekStep(step) {
        seekStep = step;
        for (const [b, size] of [[seekBackBtn, 26], [miniBackBtn, 24]]) {
          setIcon(b, seekIcon(icons.seekBack, step), size);
          setTip(b, t('seekBack', { n: step }), 'j');
        }
        for (const [b, size] of [[seekFwdBtn, 26], [miniFwdBtn, 24]]) {
          setIcon(b, seekIcon(icons.seekForward, step), size);
          setTip(b, t('seekForward', { n: step }), 'l');
        }
      },
      destroy() {
        win.cancelAnimationFrame(rafId);
        win.clearTimeout(hideTimer);
        win.clearTimeout(bufferTimer);
        adObserver?.disconnect();
        for (const fn of cleanups.splice(0)) fn();
      },
    };
  };
})();
