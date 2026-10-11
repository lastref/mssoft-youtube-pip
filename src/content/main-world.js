// Runs in the page's MAIN world so it can reach YouTube's player API
// (methods YouTube attaches to #movie_player). The isolated content script
// talks to it through DOM CustomEvents with JSON string payloads.
(() => {
  'use strict';
  if (window.__ytpipMainWorld) return;
  window.__ytpipMainWorld = true;

  const player = () =>
    document.getElementById('movie_player') ||
    document.querySelector('.html5-video-player');

  const methods = {
    info() {
      const p = player();
      if (!p || typeof p.getVideoData !== 'function') return null;
      const data = p.getVideoData() || {};
      let isLive = !!data.isLive;
      try {
        const details = p.getPlayerResponse?.()?.videoDetails;
        if (details) isLive = isLive || !!details.isLive;
      } catch {}
      return {
        videoId: data.video_id || '',
        title: data.title || '',
        author: data.author || '',
        isLive,
        volume: typeof p.getVolume === 'function' ? p.getVolume() : null,
        muted: typeof p.isMuted === 'function' ? p.isMuted() : null,
      };
    },
    setVolume(volume) {
      const p = player();
      if (!p?.setVolume) return false;
      p.setVolume(Math.max(0, Math.min(100, Number(volume) || 0)));
      return true;
    },
    setMuted(muted) {
      const p = player();
      if (!p?.mute) return false;
      if (muted) p.mute();
      else p.unMute();
      return true;
    },
    nextVideo() {
      const p = player();
      if (!p?.nextVideo) return false;
      p.nextVideo();
      return true;
    },
    seekToLiveHead() {
      const p = player();
      if (!p?.seekToLiveHead) return false;
      p.seekToLiveHead();
      return true;
    },
  };

  document.addEventListener('ytpip:request', (event) => {
    let msg;
    try { msg = JSON.parse(event.detail); } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.id !== 'number' || typeof msg.method !== 'string') return;
    const args = Array.isArray(msg.args) ? msg.args : [];
    const fn = Object.prototype.hasOwnProperty.call(methods, msg.method) && methods[msg.method];
    let result = null;
    if (fn) {
      try { result = fn(...args); } catch { result = null; }
    }
    document.dispatchEvent(new CustomEvent('ytpip:response', {
      detail: JSON.stringify({ id: msg.id, result }),
    }));
  });
})();
