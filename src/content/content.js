// Adds a native-looking picture-in-picture button to YouTube's player bar and
// moves the real <video> into an always-on-top Document Picture-in-Picture
// window (falls back to classic video PiP where that API is unavailable).
'use strict';

(() => {
  if (globalThis.__ytpipContent) return;
  globalThis.__ytpipContent = true;

  const { h, svg, t, clamp, isEditableTarget, isVideoId } = YTPiP;
  const isTop = window.top === window;
  if (!isTop && !location.pathname.startsWith('/embed/')) return;

  const DEFAULTS = { buttonStyle: 'native', seekStep: 10, hotkey: true, autoPip: false, pauseWhenHidden: false };
  const BUTTON_CLASS = 'ytpip-button';
  const DEFAULT_WIDTH = 480;
  const MIN_WIDTH = 300;

  let settings = { ...DEFAULTS };
  let savedWidth = 0;
  // Height Chrome takes from the requested size for the PiP title bar.
  // Measured on first open and remembered (it is constant per platform).
  let chromeOffset = /Mac/i.test(navigator.platform) ? 52 : 32;
  /** @type {null | {win: Window, video: HTMLVideoElement, ui: any, home: {parent: Node, next: Node|null}, playerEl: Element}} */
  let session = null;
  let opening = false;
  let videoPipActive = false;

  const hasDocPip = () => isTop && 'documentPictureInPicture' in window;

  // ---------- extension plumbing (survives an extension reload) ----------
  const ext = {
    get alive() {
      try { return !!chrome.runtime?.id; } catch { return false; }
    },
    send(message) {
      try { chrome.runtime.sendMessage(message).catch(() => {}); } catch {}
    },
  };

  try {
    chrome.storage.sync.get(DEFAULTS).then((stored) => {
      settings = { ...DEFAULTS, ...stored };
      applySettings();
    }).catch(() => {});
    chrome.storage.local.get({ pipWidth: 0, pipChromeOffset: null }).then((s) => {
      savedWidth = s.pipWidth || 0;
      if (Number.isFinite(s.pipChromeOffset)) chromeOffset = s.pipChromeOffset;
    }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? DEFAULTS[key];
      applySettings();
    });
  } catch {}

  function applySettings() {
    for (const btn of document.querySelectorAll(`.${BUTTON_CLASS}`)) renderButton(btn);
    session?.ui.setSeekStep(settings.seekStep);
    setupAutoPip();
  }

  // ---------- player lookup ----------
  function getPlayer() {
    return document.getElementById('movie_player') ||
      (!isTop ? document.querySelector('.html5-video-player') : null);
  }
  function getVideo(player) {
    return player?.querySelector('video.html5-main-video') || player?.querySelector('video') || null;
  }

  // ---------- the player-bar button ----------
  function renderButton(btn) {
    const active = !!session || videoPipActive;
    const variant = YTPiP.icons.buttonIcons[settings.buttonStyle] || YTPiP.icons.buttonIcons.native;
    const icon = active ? variant.off : variant.on;
    const legacy = btn.dataset.legacy === '1';
    const el = legacy
      ? svg(document, { ...icon, viewBox: '0 0 36 36', transform: 'translate(6 6)' }, '100%')
      : svg(document, icon, 24);
    btn.replaceChildren(el);
    const label = active ? t('exitPip') : t('pip');
    const shortcut = settings.hotkey ? 'p' : '';
    btn.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
    btn.setAttribute('aria-pressed', String(active));
    btn.dataset.titleNoTooltip = label;
    // The 2026 embed player uses plain title tooltips on its buttons.
    if (btn.dataset.kind === 'embed') btn.title = shortcut ? `${label} (${shortcut})` : label;
    if (shortcut) btn.setAttribute('aria-keyshortcuts', shortcut);
    else btn.removeAttribute('aria-keyshortcuts');
  }

  /** @param {'bar'|'embed'} kind */
  function createButton(player, kind) {
    const fs = player.querySelector('.ytp-fullscreen-button svg');
    const legacy = kind === 'bar' && !player.classList.contains('ytp-delhi-modern') &&
      fs?.getAttribute('viewBox') === '0 0 36 36';
    const btn = h(document, 'button', {
      class: kind === 'embed' ? `icon-button ${BUTTON_CLASS} ytpip-embed` : `ytp-button ${BUTTON_CLASS}`,
      type: 'button',
      dataset: { legacy: legacy ? '1' : '0', kind },
    });
    renderButton(btn);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip(btn);
      toggle();
    });
    if (kind === 'bar') {
      btn.addEventListener('mouseenter', () => showTooltip(btn));
      btn.addEventListener('mouseleave', () => hideTooltip(btn));
      btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) showTooltip(btn); });
      btn.addEventListener('blur', () => hideTooltip(btn));
    }
    return btn;
  }

  function ensureButton() {
    const player = getPlayer();
    if (!player) return;
    const controls = player.querySelector('.ytp-right-controls');
    if (controls) {
      if (controls.querySelector(`.${BUTTON_CLASS}`)) return;
      const group = controls.querySelector('.ytp-right-controls-right') || controls;
      // Where YouTube's miniplayer button used to live: left of theater mode.
      const anchor = group.querySelector('.ytp-size-button') ||
        group.querySelector('.ytp-fullscreen-button') || null;
      group.insertBefore(createButton(player, 'bar'), anchor && anchor.parentNode === group ? anchor : null);
      return;
    }
    // 2026 embed player: volume / captions / settings sit in the top-right row.
    const topRight = !isTop || location.pathname.startsWith('/embed/')
      ? document.querySelector('.player-controls-top-right') : null;
    if (!topRight || topRight.querySelector(`.${BUTTON_CLASS}`)) return;
    const settingsWrap = topRight.querySelector('.player-settings-icon')?.parentElement;
    const wrap = h(document, 'div', { class: 'ytpip-embed-wrap' }, createButton(player, 'embed'));
    topRight.insertBefore(wrap, settingsWrap?.parentElement === topRight ? settingsWrap : null);
  }

  // ---------- tooltip: reuse YouTube's own tooltip element ----------
  function showTooltip(btn) {
    const player = btn.closest('.html5-video-player');
    const tip = player?.querySelector('.ytp-tooltip');
    const text = tip?.querySelector('.ytp-tooltip-bottom-text .ytp-tooltip-text') || tip?.querySelector('.ytp-tooltip-text');
    const label = btn.dataset.titleNoTooltip || t('pip');
    const shortcut = settings.hotkey ? 'p' : '';
    if (!tip || !text) return showFallbackTooltip(btn, player, label, shortcut);

    const kbd = tip.querySelector('.ytp-tooltip-bottom-text .ytp-tooltip-keyboard-shortcut');
    const title = tip.querySelector('.ytp-tooltip-title span');
    if (title) title.textContent = '';
    text.textContent = label;
    if (kbd) kbd.textContent = shortcut.toUpperCase();
    else if (shortcut) text.textContent = `${label} (${shortcut})`;

    tip.className = 'ytp-tooltip ytp-bottom';
    tip.style.display = '';
    tip.style.visibility = 'hidden';
    const pr = player.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const left = clamp(br.left - pr.left + br.width / 2 - tr.width / 2, 12, pr.width - tr.width - 12);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(br.top - pr.top - tr.height - 22)}px`;
    tip.style.visibility = '';
    tip.dataset.ytpipOwner = '1';
  }
  function hideTooltip(btn) {
    if (btn.dataset.kind === 'embed') return;
    const player = btn.closest('.html5-video-player');
    const tip = player?.querySelector('.ytp-tooltip');
    if (tip?.dataset.ytpipOwner) {
      tip.style.display = 'none';
      delete tip.dataset.ytpipOwner;
    }
    player?.querySelector('.ytpip-fallback-tooltip')?.remove();
  }
  function showFallbackTooltip(btn, player, label, shortcut) {
    if (!player) return;
    player.querySelector('.ytpip-fallback-tooltip')?.remove();
    const tip = h(document, 'div', { class: 'ytpip-fallback-tooltip' },
      h(document, 'span', { text: label }),
      shortcut ? h(document, 'span', { class: 'ytpip-fallback-kbd', text: shortcut.toUpperCase() }) : null);
    player.append(tip);
    const pr = player.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const left = clamp(br.left - pr.left + br.width / 2 - tip.offsetWidth / 2, 12, pr.width - tip.offsetWidth - 12);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(br.top - pr.top - tip.offsetHeight - 22)}px`;
  }

  // ---------- placeholder shown in the page while the video is away ----------
  function showPlaceholder(player) {
    hidePlaceholder();
    const videoId = new URLSearchParams(location.search).get('v') ||
      (location.pathname.match(/\/embed\/([\w-]{6,})/) || [])[1];
    const bg = h(document, 'div', { class: 'ytpip-placeholder-bg' });
    if (isVideoId(videoId)) bg.style.backgroundImage = `url("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg")`;
    const back = h(document, 'button', { class: 'ytpip-placeholder-btn', type: 'button', text: t('bringBack') });
    back.addEventListener('click', (e) => {
      e.stopPropagation();
      closePip({});
    });
    const el = h(document, 'div', { class: 'ytpip-placeholder' },
      bg,
      h(document, 'div', { class: 'ytpip-placeholder-content' },
        svg(document, YTPiP.icons.buttonIcons.native.on, 48),
        h(document, 'div', { class: 'ytpip-placeholder-text', text: t('playingInPip') }),
        back));
    const container = player.querySelector('.html5-video-container');
    if (container?.parentNode === player) container.after(el);
    else player.prepend(el);
    player.classList.add('ytpip-away');
  }
  function hidePlaceholder() {
    for (const el of document.querySelectorAll('.ytpip-placeholder')) el.remove();
    for (const el of document.querySelectorAll('.ytpip-away')) el.classList.remove('ytpip-away');
  }

  // ---------- open / close ----------
  async function toggle() {
    if (session) closePip({});
    else if (videoPipActive || document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else await openPip();
  }

  async function openPip() {
    const player = getPlayer();
    const video = getVideo(player);
    if (!video || session || opening) return;
    if (!hasDocPip()) return openVideoPip(video);

    const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    const width = Math.round(clamp(savedWidth || DEFAULT_WIDTH, MIN_WIDTH, screen.availWidth * 0.8));
    const contentHeight = Math.round(width / clamp(aspect, 0.5, 3));
    const height = contentHeight + chromeOffset;

    let win;
    opening = true;
    try {
      win = await documentPictureInPicture.requestWindow({ width, height });
    } catch (err) {
      console.warn('[YT PiP] Document PiP failed, using video PiP.', err);
      return openVideoPip(video);
    } finally {
      opening = false;
    }
    // Learn the real title-bar height so the next window fits the video exactly.
    const measured = height - win.innerHeight;
    if (win.innerWidth === width && measured >= 0 && measured < 120 && measured !== chromeOffset) {
      chromeOffset = measured;
      try { chrome.storage.local.set({ pipChromeOffset: measured }); } catch {}
    }

    const wasPlaying = !video.paused && !video.ended;
    const home = { parent: video.parentNode, next: video.nextSibling };
    const ui = YTPiP.createPipUI({
      win,
      video,
      playerEl: player,
      seekStep: settings.seekStep,
      onBackToTab: () => closePip({ focus: true }),
      onFullscreen: () => closePip({ focus: true, fullscreen: true }),
    });
    ui.stage.prepend(video);
    if (wasPlaying && video.paused) video.play().catch(() => {});

    session = { win, video, ui, home, playerEl: player };
    showPlaceholder(player);
    refreshButtons();

    win.addEventListener('pagehide', () => restore('pagehide'), { once: true });
    watchVisibility(win, video);
    let resizeTimer = 0;
    win.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (win.closed || !win.innerWidth) return;
        savedWidth = win.innerWidth;
        try { chrome.storage.local.set({ pipWidth: savedWidth }); } catch {}
      }, 500);
    });
  }

  // macOS never shows a browser's windows over another app's full-screen
  // Space (only agent apps without a Dock icon get that), so when the user
  // switches to a full-screen app the PiP window is simply not there and its
  // document reports itself hidden. Audio keeps playing; optionally pause
  // instead and resume as soon as the window is visible again.
  function watchVisibility(win, video) {
    let pausedByUs = false;
    win.document.addEventListener('visibilitychange', () => {
      if (win.document.visibilityState === 'hidden') {
        // The window also goes hidden right before it closes; wait for
        // pagehide to tear the session down first so closing never pauses.
        setTimeout(() => {
          if (win.closed || session?.win !== win || !settings.pauseWhenHidden) return;
          if (win.document.visibilityState !== 'hidden' || video.paused || video.ended) return;
          pausedByUs = true;
          video.pause();
        }, 150);
      } else if (pausedByUs) {
        pausedByUs = false;
        if (session?.win === win && video.paused && !video.ended) video.play().catch(() => {});
      }
    });
    // A manual play while hidden (media keys) cancels the pending resume.
    video.addEventListener('play', () => { pausedByUs = false; });
  }

  /**
   * @param {{focus?: boolean, fullscreen?: boolean}} intent
   */
  function closePip(intent) {
    if (!session) return;
    const { win } = session;
    restore('user');
    if (intent.fullscreen) {
      // The click in the PiP window grants user activation to this page too,
      // but window.focus() would consume it — so request fullscreen first and
      // let the extension (which needs no activation) raise the tab.
      ext.send({ type: 'ytpip:focus-tab' });
      enterFullscreen();
    } else if (intent.focus) {
      focusTab();
    }
    try { win.close(); } catch {}
  }

  function restore(reason) {
    const s = session;
    if (!s) return;
    session = null;
    const { video, home, ui } = s;
    const wasPlaying = !video.paused && !video.ended;
    ui.destroy();

    const container = home.parent?.isConnected ? home.parent
      : getPlayer()?.querySelector('.html5-video-container');
    if (container) {
      container.insertBefore(video, home.next?.parentNode === container ? home.next : container.firstChild);
    }
    hidePlaceholder();
    refreshButtons();
    window.dispatchEvent(new Event('resize'));

    if (reason === 'pagehide') {
      // Closed from the window itself: its ✕ pauses (like Chrome's native PiP),
      // Chrome's "back to tab" brings the tab forward and keeps playing.
      setTimeout(() => {
        if (document.visibilityState !== 'visible') video.pause();
        else if (wasPlaying && video.paused) video.play().catch(() => {});
      }, 150);
    } else if (wasPlaying && video.paused) {
      video.play().catch(() => {});
    }
  }

  function focusTab() {
    try { window.focus(); } catch {}
    ext.send({ type: 'ytpip:focus-tab' });
  }

  function enterFullscreen() {
    const start = performance.now();
    const attempt = () => {
      const player = getPlayer();
      if (!player || document.fullscreenElement) return;
      // A background tab can't go fullscreen; wait (within the activation
      // window) for the extension to bring it forward.
      if (document.visibilityState !== 'visible' && performance.now() - start < 2000) {
        setTimeout(attempt, 50);
        return;
      }
      // Prefer YouTube's own button so its player switches to fullscreen layout.
      const fsButton = player.querySelector('.ytp-fullscreen-button');
      if (fsButton) fsButton.click();
      else player.requestFullscreen?.().catch(() => {});
    };
    attempt();
  }

  // Entering fullscreen in the page brings the video home.
  document.addEventListener('fullscreenchange', () => {
    // contains() is inclusive, so this covers the player itself too.
    if (session && document.fullscreenElement?.contains(session.playerEl)) closePip({});
  });

  // ---------- classic video PiP fallback (embeds, older browsers) ----------
  async function openVideoPip(video) {
    if (!document.pictureInPictureEnabled) return flashMessage(t('unsupported'));
    try {
      video.disablePictureInPicture = false;
      await video.requestPictureInPicture();
    } catch (err) {
      console.warn('[YT PiP]', err);
      flashMessage(t('unsupported'));
      return;
    }
    videoPipActive = true;
    refreshButtons();
    const step = () => settings.seekStep;
    try {
      navigator.mediaSession.setActionHandler('seekbackward', () => { video.currentTime -= step(); });
      navigator.mediaSession.setActionHandler('seekforward', () => { video.currentTime += step(); });
    } catch {}
    video.addEventListener('leavepictureinpicture', () => {
      videoPipActive = false;
      refreshButtons();
    }, { once: true });
  }

  function flashMessage(text) {
    const player = getPlayer();
    if (!player) return;
    player.querySelector('.ytpip-toast')?.remove();
    const toast = h(document, 'div', { class: 'ytpip-toast', text });
    player.append(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  function refreshButtons() {
    for (const btn of document.querySelectorAll(`.${BUTTON_CLASS}`)) renderButton(btn);
  }

  // ---------- keyboard shortcut (p) ----------
  window.addEventListener('keydown', (e) => {
    if (!settings.hotkey || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.key !== 'p' && e.key !== 'P') return;
    if (isEditableTarget(e.composedPath?.()[0] || e.target)) return;
    // While the video is away (in the PiP window) the page has no <video>;
    // the key must still close the window.
    if (!session && !videoPipActive && !getVideo(getPlayer())) return;
    e.preventDefault();
    toggle();
  }, true);

  // ---------- automatic PiP when switching tabs (opt-in) ----------
  let autoPipHandler = false;
  function setupAutoPip() {
    if (!hasDocPip()) return;
    try {
      if (settings.autoPip) {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', () => {
          if (!session) openPip();
        });
        autoPipHandler = true;
      } else if (autoPipHandler) {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', null);
        autoPipHandler = false;
      }
    } catch {
      // Browser without the enterpictureinpicture action.
    }
  }

  // ---------- keep the button present across YouTube's SPA navigation ----------
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!ext.alive) return;
      ensureButton();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  for (const type of ['yt-navigate-finish', 'yt-page-data-updated', 'yt-player-updated']) {
    document.addEventListener(type, () => {
      schedule();
      if (session) {
        setTimeout(() => session?.ui.refreshInfo(), 300);
        if (type === 'yt-navigate-finish') showPlaceholder(session.playerEl);
      }
      setupAutoPip();
    });
  }
  schedule();
})();
