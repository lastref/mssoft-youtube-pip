// Icon geometry. Player-bar icons follow YouTube's 2025 ("delhi") player:
// 24×24 grid, white, 2px rounded strokes or solid fills.
'use strict';

var YTPiP = globalThis.YTPiP || (globalThis.YTPiP = {});

(() => {
  const stroke = (d, extra) => ({
    d,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...extra,
  });
  const fill = (d) => ({ d, fill: 'currentColor' });
  const rect = (x, y, width, height, rx, mode = 'fill') => ({
    tag: 'rect', x, y, width, height, rx,
    ...(mode === 'fill'
      ? { fill: 'currentColor' }
      : { fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
  });

  // YouTube's own (hidden) .ytp-pip-button glyph, taken from the live player.
  const YT_FRAME = 'M1 6a2 2 0 012-2h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6Zm2 0v12h18V6H3Z';

  /**
   * Player-bar button styles the user can pick in the popup.
   * `on`  = icon while the video is in the main page (click opens PiP).
   * `off` = icon while PiP is open (click brings the video back).
   */
  const buttonIcons = {
    native: {
      on: { paths: [fill(YT_FRAME + 'm16 6h-6v4h6v-4Z')] },
      off: { paths: [fill(YT_FRAME + 'M5 8h14v8H5V8Z')] },
    },
    popout: {
      on: {
        paths: [
          stroke('M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6'),
          stroke('M15 3h6v6'),
          stroke('M21 3l-8 8'),
        ],
      },
      off: {
        paths: [
          stroke('M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6'),
          stroke('M13 5v6h6'),
          stroke('M21 3l-8 8'),
        ],
      },
    },
    float: {
      on: {
        paths: [
          stroke('M17 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3'),
          rect(10, 11, 13, 10, 2),
        ],
      },
      off: {
        paths: [
          stroke('M17 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3'),
          rect(11, 12, 11, 8, 1.5, 'stroke'),
        ],
      },
    },
    detach: {
      on: {
        paths: [
          stroke('M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5'),
          rect(12, 13, 11, 8, 2),
        ],
      },
      off: {
        paths: [
          stroke('M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5'),
          rect(13, 14, 9, 6, 1.5, 'stroke'),
        ],
      },
    },
  };

  const SPEAKER =
    'M11.60 2.08L11.48 2.14L3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87C1.26 9.77 1.00 10.79 1 11.83V12.16L1.01 12.56C1.07 13.52 1.37 14.46 1.87 15.29C2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.80 21.99 11.98 21.99C12.16 22.00 12.33 21.95 12.49 21.87C12.64 21.78 12.77 21.65 12.86 21.50C12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52C12.80 2.37 12.68 2.25 12.54 2.16C12.41 2.07 12.25 2.01 12.08 2.00C11.92 1.98 11.75 2.01 11.60 2.08ZM4.94 8.4V8.40L11 4.76V19.23L4.94 15.6C4.38 15.26 3.92 14.80 3.58 14.25C3.24 13.70 3.05 13.07 3.00 12.43L3 12.17V11.83C2.99 11.14 3.17 10.46 3.51 9.86C3.85 9.25 4.34 8.75 4.94 8.4Z';

  /** Icons used inside the PiP window. */
  const ui = {
    play: { paths: [fill('M8 5.14v13.72a1 1 0 0 0 1.52.85l11.1-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z')] },
    pause: {
      viewBox: '0 0 36 36',
      paths: [fill('M12.75 4.5h-3A2.25 2.25 0 0 0 7.5 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3A2.25 2.25 0 0 0 15 29.25V6.75a2.25 2.25 0 0 0-2.25-2.25Zm13.5 0h-3A2.25 2.25 0 0 0 21 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25Z')],
    },
    next: {
      paths: [fill('M20 20C20.26 20 20.51 19.89 20.70 19.70C20.89 19.51 21 19.26 21 19V5C21 4.73 20.89 4.48 20.70 4.29C20.51 4.10 20.26 4 20 4C19.73 4 19.48 4.10 19.29 4.29C19.10 4.48 19 4.73 19 5V19C19 19.26 19.10 19.51 19.29 19.70C19.48 19.89 19.73 20 20 20ZM5.04 19.77L18 12L5.04 4.22C4.84 4.10 4.60 4.03 4.36 4.03C4.12 4.03 3.89 4.09 3.68 4.21C3.47 4.32 3.30 4.49 3.18 4.70C3.06 4.91 2.99 5.14 3 5.38V18.61C2.99 18.85 3.06 19.08 3.18 19.29C3.30 19.50 3.47 19.67 3.68 19.79C3.89 19.90 4.12 19.96 4.36 19.96C4.60 19.96 4.84 19.89 5.04 19.77Z')],
    },
    // Circular arrows; the seek amount is drawn as SVG text by the caller.
    seekBack: { paths: [stroke('M12 5a8 8 0 1 1-8 8'), stroke('M14 2l-3 3 3 3')] },
    seekForward: { paths: [stroke('M12 5a8 8 0 1 0 8 8'), stroke('M10 2l3 3-3 3')] },
    volumeHigh: {
      paths: [fill(SPEAKER), stroke('M16.5 8.5a5 5 0 0 1 0 7'), stroke('M19.5 5.5a9.2 9.2 0 0 1 0 13')],
    },
    volumeLow: { paths: [fill(SPEAKER), stroke('M16.5 8.5a5 5 0 0 1 0 7')] },
    volumeMuted: {
      paths: [fill(SPEAKER), stroke('M16 9l6 6'), stroke('M22 9l-6 6')],
    },
    fullscreen: {
      paths: [fill('M10 3H3V10C3 10.26 3.10 10.51 3.29 10.70C3.48 10.89 3.73 11 4 11C4.26 11 4.51 10.89 4.70 10.70C4.89 10.51 5 10.26 5 10V6.41L9.29 10.70L9.36 10.77C9.56 10.92 9.80 11.00 10.04 10.99C10.29 10.98 10.52 10.87 10.70 10.70C10.87 10.52 10.98 10.29 10.99 10.04C11.00 9.80 10.92 9.56 10.77 9.36L10.70 9.29L6.41 5H10C10.26 5 10.51 4.89 10.70 4.70C10.89 4.51 11 4.26 11 4C11 3.73 10.89 3.48 10.70 3.29C10.51 3.10 10.26 3 10 3ZM20 13C19.73 13 19.48 13.10 19.29 13.29C19.10 13.48 19 13.730 19 14V17.58L14.70 13.29L14.63 13.22C14.43 13.07 14.19 12.99 13.95 13.00C13.70 13.01 13.47 13.12 13.29 13.29C13.12 13.47 13.01 13.70 13.00 13.95C12.99 14.19 13.07 14.43 13.22 14.63L13.29 14.70L17.58 19H14C13.73 19 13.48 19.10 13.29 19.29C13.10 19.48 13 19.73 13 20C13 20.26 13.10 20.51 13.29 20.70C13.48 20.89 13.73 21 14 21H21V14C21 13.73 20.89 13.48 20.70 13.29C20.51 13.10 20.26 13 20 13Z')],
    },
    backToTab: {
      paths: [
        stroke('M11 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6'),
        stroke('M13 5v6h6'),
        stroke('M21 3l-8 8'),
      ],
    },
  };
  YTPiP.icons = { buttonIcons, ui, BUTTON_STYLES: Object.keys(buttonIcons) };
})();
