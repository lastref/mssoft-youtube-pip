// UI strings follow YouTube's own interface language (<html lang>), not the
// browser's, so our labels always match the surrounding YouTube labels.
'use strict';

var YTPiP = globalThis.YTPiP || (globalThis.YTPiP = {});

(() => {
  const strings = {
    en: {
      pip: 'Picture-in-picture',
      exitPip: 'Exit picture-in-picture',
      playingInPip: 'Playing in picture-in-picture',
      bringBack: 'Bring video back here',
      play: 'Play',
      pause: 'Pause',
      seekBack: 'Back {n} seconds',
      seekForward: 'Forward {n} seconds',
      seconds: '{n} seconds',
      next: 'Next',
      mute: 'Mute',
      unmute: 'Unmute',
      fullscreen: 'Full screen',
      backToTab: 'Back to tab',
      live: 'LIVE',
      ad: 'Ad',
      unsupported: "Picture-in-picture isn't available here",
    },
    tr: {
      pip: 'Pencere içinde pencere',
      exitPip: 'Pencere içinde pencereden çık',
      playingInPip: 'Pencere içinde pencere modunda oynatılıyor',
      bringBack: 'Videoyu buraya geri getir',
      play: 'Oynat',
      pause: 'Duraklat',
      seekBack: '{n} saniye geri',
      seekForward: '{n} saniye ileri',
      seconds: '{n} saniye',
      next: 'Sonraki',
      mute: 'Sesi kapat',
      unmute: 'Sesi aç',
      fullscreen: 'Tam ekran',
      backToTab: 'Sekmeye dön',
      live: 'CANLI',
      ad: 'Reklam',
      unsupported: 'Pencere içinde pencere burada kullanılamıyor',
    },
    de: {
      pip: 'Bild im Bild',
      exitPip: 'Bild im Bild beenden',
      playingInPip: 'Wird im Bild-im-Bild-Modus wiedergegeben',
      bringBack: 'Video hierher zurückholen',
      play: 'Wiedergabe',
      pause: 'Pause',
      seekBack: '{n} Sekunden zurück',
      seekForward: '{n} Sekunden vor',
      seconds: '{n} Sekunden',
      next: 'Weiter',
      mute: 'Stummschalten',
      unmute: 'Stummschaltung aufheben',
      fullscreen: 'Vollbild',
      backToTab: 'Zurück zum Tab',
      live: 'LIVE',
      ad: 'Werbung',
      unsupported: 'Bild im Bild ist hier nicht verfügbar',
    },
    fr: {
      pip: 'Picture-in-picture',
      exitPip: 'Quitter le mode Picture-in-picture',
      playingInPip: 'Lecture en mode Picture-in-picture',
      bringBack: 'Ramener la vidéo ici',
      play: 'Lire',
      pause: 'Pause',
      seekBack: 'Reculer de {n} secondes',
      seekForward: 'Avancer de {n} secondes',
      seconds: '{n} secondes',
      next: 'Suivante',
      mute: 'Désactiver le son',
      unmute: 'Activer le son',
      fullscreen: 'Plein écran',
      backToTab: "Revenir à l'onglet",
      live: 'EN DIRECT',
      ad: 'Annonce',
      unsupported: "Le mode Picture-in-picture n'est pas disponible ici",
    },
    es: {
      pip: 'Imagen en imagen',
      exitPip: 'Salir de imagen en imagen',
      playingInPip: 'Reproduciendo en imagen en imagen',
      bringBack: 'Traer el vídeo aquí',
      play: 'Reproducir',
      pause: 'Pausar',
      seekBack: 'Retroceder {n} segundos',
      seekForward: 'Avanzar {n} segundos',
      seconds: '{n} segundos',
      next: 'Siguiente',
      mute: 'Silenciar',
      unmute: 'Activar sonido',
      fullscreen: 'Pantalla completa',
      backToTab: 'Volver a la pestaña',
      live: 'EN DIRECTO',
      ad: 'Anuncio',
      unsupported: 'Imagen en imagen no está disponible aquí',
    },
    ru: {
      pip: 'Картинка в картинке',
      exitPip: 'Выйти из режима «Картинка в картинке»',
      playingInPip: 'Воспроизводится в режиме «Картинка в картинке»',
      bringBack: 'Вернуть видео сюда',
      play: 'Смотреть',
      pause: 'Пауза',
      seekBack: 'Назад на {n} с',
      seekForward: 'Вперед на {n} с',
      seconds: '{n} с',
      next: 'Следующее видео',
      mute: 'Отключить звук',
      unmute: 'Включить звук',
      fullscreen: 'Во весь экран',
      backToTab: 'Вернуться на вкладку',
      live: 'ЭФИР',
      ad: 'Реклама',
      unsupported: 'Режим «Картинка в картинке» здесь недоступен',
    },
  };

  function lang() {
    const raw = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
    const base = raw.split('-')[0];
    return strings[base] ? base : 'en';
  }

  /** t('seekBack', { n: 10 }) → "10 saniye geri" */
  function t(key, vars) {
    const table = strings[lang()];
    let s = table[key] ?? strings.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  }

  YTPiP.t = t;
})();
