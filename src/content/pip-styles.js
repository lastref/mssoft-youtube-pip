// Stylesheet for the Document Picture-in-Picture window. Values mirror
// YouTube's 2025 player (pills, hover tint, gradient progress bar, bezel).
'use strict';

var YTPiP = globalThis.YTPiP || (globalThis.YTPiP = {});

YTPiP.pipCss = String.raw`
:root {
  color-scheme: dark;
  --red: #ff0033;
  --pink: #ff2791;
  --ad: #ffcc00;
  --pill: rgba(0, 0, 0, .3);
  --hover: rgba(255, 255, 255, .1);
  --text: #eee;
  --ease: cubic-bezier(.05, 0, 0, 1);
  --fade: cubic-bezier(.4, 0, .2, 1);
  font-family: "YouTube Noto", Roboto, Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  color: var(--text);
  user-select: none;
  -webkit-user-select: none;
}
body.ytpip-idle { cursor: none; }

.ytpip-stage { position: fixed; inset: 0; background: #000; }

/* The real YouTube <video>, moved in from the page. YouTube keeps writing
   inline width/height/left/top on it, so these must win. */
.ytpip-stage > video {
  position: absolute !important;
  inset: 0 !important;
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  background: #000;
}

/* ---------- chrome (auto-hiding controls) ---------- */
.ytpip-chrome {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s var(--fade);
}
.ytpip-active .ytpip-chrome { opacity: 1; pointer-events: auto; transition-duration: .1s; }
.ytpip-scrim-top, .ytpip-scrim-bottom { position: absolute; left: 0; right: 0; pointer-events: none; }
.ytpip-scrim-top { top: 0; height: 96px; background: linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,0)); }
.ytpip-scrim-bottom { bottom: 0; height: 120px; background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.6)); }

/* ---------- top: title ---------- */
.ytpip-top { position: absolute; top: 0; left: 0; right: 0; padding: 12px 14px 0; }
.ytpip-title {
  font-size: 15px; line-height: 20px; font-weight: 500; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-shadow: 0 0 2px rgba(0,0,0,.5);
}
.ytpip-author {
  margin-top: 1px;
  font-size: 12px; line-height: 16px; color: rgba(255,255,255,.75);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-shadow: 0 0 2px rgba(0,0,0,.5);
}

/* ---------- buttons ---------- */
.ytpip-btn {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 40px; flex: none;
  padding: 0; margin: 0; border: 0;
  background: none; color: #fff; cursor: pointer;
  font: inherit; outline: none;
  -webkit-tap-highlight-color: transparent;
}
.ytpip-btn::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  transition: background-color .2s var(--ease);
}
.ytpip-btn:hover::before { background-color: var(--hover); }
.ytpip-btn:active::before { background-color: rgba(255,255,255,.2); }
.ytpip-btn:focus-visible { box-shadow: inset 0 0 0 2px rgba(27,127,204,.8); }
.ytpip-btn > svg { position: relative; display: block; pointer-events: none; }
.ytpip-btn[disabled] { opacity: .4; pointer-events: none; }

.ytpip-pill {
  display: flex; align-items: center; height: 40px;
  border-radius: 28px; background: var(--pill); overflow: hidden;
  backdrop-filter: blur(12px);
}
.ytpip-pill .ytpip-btn { border-radius: 0; }
/* Duplicates of the center controls, shown only in very short windows. */
.ytpip-compact-only { display: none !important; }

/* ---------- center cluster ---------- */
.ytpip-center {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  display: flex; align-items: center; gap: 20px;
}
.ytpip-circle {
  width: 48px; height: 48px; border-radius: 50%;
  background: var(--pill); backdrop-filter: blur(12px);
}
.ytpip-circle.ytpip-big { width: 64px; height: 64px; }
.ytpip-seek-label { font: 600 7.4px/1 "YouTube Noto", Roboto, Arial, sans-serif; }

/* ---------- bottom ---------- */
.ytpip-bottom { position: absolute; left: 12px; right: 12px; bottom: 0; }
.ytpip-row { display: flex; align-items: center; gap: 8px; height: 40px; margin: 0 0 10px; }
.ytpip-spacer { flex: 1; min-width: 0; }
.ytpip-time {
  height: 40px; padding: 0 14px;
  font-size: 14px; line-height: 40px; font-weight: 500; color: var(--text);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.ytpip-time .ytpip-sep { margin: 0 4px; opacity: .7; }
.ytpip-time-pill { flex: none; }

.ytpip-live {
  display: none; align-items: center; gap: 6px;
  height: 40px; padding: 0 14px; border: 0; background: none;
  color: var(--text); font: 500 14px/40px "YouTube Noto", Roboto, Arial, sans-serif;
  cursor: pointer; text-transform: uppercase;
}
.ytpip-live::before {
  content: ""; width: 8px; height: 8px; border-radius: 50%; background: #717171;
}
.ytpip-live.ytpip-at-edge::before { background: var(--red); }
.ytpip-is-live .ytpip-live { display: inline-flex; }
.ytpip-is-live .ytpip-time { display: none; }

/* volume */
.ytpip-volume { display: flex; align-items: center; }
.ytpip-volume-slider {
  position: relative; width: 0; height: 40px; overflow: hidden; cursor: pointer;
  transition: width .2s var(--ease), margin .2s var(--ease);
  touch-action: none;
}
.ytpip-volume:hover .ytpip-volume-slider,
.ytpip-volume-slider.ytpip-dragging,
.ytpip-volume:focus-within .ytpip-volume-slider { width: 64px; margin-right: 14px; }
.ytpip-volume-track {
  position: absolute; left: 6px; right: 6px; top: 50%; height: 4px; margin-top: -2px;
  border-radius: 2px; background: rgba(255,255,255,.3);
}
.ytpip-volume-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: #fff; }
.ytpip-volume-handle {
  position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px;
  border-radius: 50%; background: #fff;
}

/* progress bar */
.ytpip-progress {
  position: relative; height: 20px; margin: 0 2px;
  display: flex; align-items: center; cursor: pointer; touch-action: none;
}
.ytpip-track {
  position: relative; width: 100%; height: 4px; border-radius: 3px;
  background: rgba(255,255,255,.2); overflow: hidden;
  transition: height .1s var(--fade);
}
.ytpip-progress:hover .ytpip-track,
.ytpip-progress.ytpip-dragging .ytpip-track { height: 6px; }
.ytpip-buffered, .ytpip-hover-fill, .ytpip-played {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0;
}
.ytpip-buffered { background: rgba(255,255,255,.4); }
.ytpip-hover-fill { background: rgba(255,255,255,.5); opacity: 0; }
.ytpip-progress:hover .ytpip-hover-fill { opacity: 1; }
.ytpip-played {
  background-image: linear-gradient(90deg, var(--red) 80%, var(--pink));
  background-size: var(--ytpip-bar-width, 100%) 100%;
  background-repeat: no-repeat;
}
.ytpip-scrubber {
  position: absolute; top: 50%; left: 0;
  width: 12px; height: 12px; margin: -6px 0 0 -6px;
  border-radius: 50%; background: var(--red);
  transform: scale(0); transition: transform .1s var(--fade);
}
.ytpip-progress:hover .ytpip-scrubber,
.ytpip-progress.ytpip-dragging .ytpip-scrubber { transform: scale(1.1); }
.ytpip-hover-time {
  position: absolute; bottom: 22px; left: 0;
  transform: translateX(-50%);
  padding: 4px 8px; border-radius: 8px;
  background: rgba(28,28,28,.9);
  font-size: 12.98px; line-height: 15px; font-weight: 500; color: #fff;
  white-space: nowrap; pointer-events: none; opacity: 0;
  font-variant-numeric: tabular-nums;
}
.ytpip-progress:hover .ytpip-hover-time,
.ytpip-progress.ytpip-dragging .ytpip-hover-time { opacity: 1; }

/* ads: YouTube paints the bar yellow and disables seeking */
.ytpip-ad .ytpip-played { background: var(--ad); }
.ytpip-ad .ytpip-scrubber { background: var(--ad); }
.ytpip-ad .ytpip-progress { pointer-events: none; }
.ytpip-ad-label { display: none; margin-right: 6px; color: var(--ad); }
.ytpip-ad .ytpip-ad-label { display: inline; }

/* ---------- bezel (center flash on play/pause/seek) ---------- */
.ytpip-bezel {
  position: absolute; left: 50%; top: 50%;
  width: 52px; height: 52px; margin: -26px 0 0 -26px;
  border-radius: 50%; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none; color: #fff;
}
.ytpip-bezel.ytpip-animate { animation: ytpip-bezel .5s linear forwards; }
@keyframes ytpip-bezel { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(2); } }
.ytpip-bezel-text {
  position: absolute; left: 50%; top: calc(50% + 40px);
  transform: translateX(-50%);
  padding: 6px 10px; border-radius: 8px; background: rgba(0,0,0,.5);
  font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .3s var(--fade);
}
.ytpip-bezel-text.ytpip-visible { opacity: 1; transition-duration: 0s; }

/* ---------- spinner ---------- */
.ytpip-spinner {
  position: absolute; left: 50%; top: 50%;
  width: 48px; height: 48px; margin: -24px 0 0 -24px;
  border-radius: 50%; border: 4px solid rgba(255,255,255,.2); border-top-color: #fff;
  animation: ytpip-spin 1s linear infinite; display: none; pointer-events: none;
}
.ytpip-buffering .ytpip-spinner { display: block; }
.ytpip-buffering .ytpip-center .ytpip-big { visibility: hidden; }
@keyframes ytpip-spin { to { transform: rotate(360deg); } }

/* ---------- tooltip ---------- */
.ytpip-tooltip {
  position: absolute; z-index: 10; top: 0; left: 0;
  display: flex; align-items: center; gap: 4px;
  padding: 5px 9px; border-radius: 8px;
  background: rgba(0,0,0,.3); backdrop-filter: blur(10px);
  font-size: 12.98px; line-height: 15px; font-weight: 500; color: #fff;
  white-space: nowrap; pointer-events: none;
  opacity: 0; transition: opacity .1s var(--fade);
}
.ytpip-tooltip.ytpip-visible { opacity: 1; }
.ytpip-kbd {
  min-width: 11px; padding: 0 2px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,.3);
  text-align: center; text-transform: uppercase;
}
.ytpip-kbd:empty { display: none; }

/* ---------- compact windows ---------- */
@media (max-width: 420px) {
  .ytpip-center { gap: 12px; }
  .ytpip-circle { width: 40px; height: 40px; }
  .ytpip-circle.ytpip-big { width: 52px; height: 52px; }
  .ytpip-row { gap: 6px; margin-bottom: 8px; }
  .ytpip-time { padding: 0 10px; font-size: 13px; }
  .ytpip-next { display: none; }
}
@media (max-width: 330px) {
  .ytpip-author, .ytpip-time-pill .ytpip-duration-part { display: none; }
  .ytpip-volume-slider { display: none; }
  .ytpip-bottom { left: 8px; right: 8px; }
}
@media (max-height: 220px) {
  .ytpip-top, .ytpip-scrim-top { display: none; }
  .ytpip-center { top: calc(50% - 22px); gap: 10px; }
  .ytpip-circle { width: 34px; height: 34px; }
  .ytpip-circle > svg { width: 20px; height: 20px; }
  .ytpip-circle.ytpip-big { width: 44px; height: 44px; }
  .ytpip-circle.ytpip-big > svg { width: 24px; height: 24px; }
}
/* Too short for a center cluster: play and skip move into the bottom bar. */
@media (max-height: 150px) {
  .ytpip-center { display: none; }
  .ytpip-compact-only { display: inline-flex !important; }
  .ytpip-row { margin-bottom: 6px; }
  .ytpip-btn { width: 40px; }
  .ytpip-next { display: none; }
}
@media (max-height: 150px) and (max-width: 420px) {
  .ytpip-volume, .ytpip-time-pill, .ytpip-back { display: none; }
}
`;
