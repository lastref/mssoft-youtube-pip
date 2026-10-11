# Güvenlik · Security

MSSoft YouTube PiP, YouTube sayfasında çalışan bir tarayıcı eklentisidir. Tasarım ilkesi basit: **mümkün olan en az yetki, sıfır ağ trafiği, sıfır veri toplama.** Aşağıdaki korumaların her biri `npm test` ile çalışan test paketinde bir değişmez olarak kilitlidir; biri bozulursa CI kırmızıya döner.

## 12 güvenlik koruması

| # | Koruma | Nerede |
|---|---|---|
| 1 | **Tek izin: `storage`.** `tabs`, `scripting`, `activeTab`, `host_permissions` yok. Sekmeyi öne getirme işi, mesajla zaten gelen `sender.tab` üzerinden yapılır. | `manifest.json` |
| 2 | **Sadece YouTube.** İçerik betikleri yalnızca `https://www.youtube.com/*` ve `https://www.youtube-nocookie.com/embed/*` adreslerinde çalışır; `http://` eşleşmesi yok. | `manifest.json` |
| 3 | **Sıkı CSP.** Eklenti sayfaları için `default-src 'none'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; connect-src 'none'`. Inline script, inline stil, uzak kaynak yok. | `manifest.json`, `src/popup/popup.html` |
| 4 | **Uzak kod yok, ağ isteği yok.** Eklenti hiçbir sunucuya bağlanmaz (`fetch`, `XMLHttpRequest`, `importScripts` yok). Sayfanın yüklediği tek dış içerik, zaten YouTube'un kendi CDN'inden gelen video küçük resmidir. | `src/**` |
| 5 | **Trusted Types uyumlu DOM.** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write` kullanılmaz; her düğüm `createElement` ile kurulur. | `src/content/shared.js` |
| 6 | **Arka plan mesaj doğrulaması.** Service worker yalnızca kendi eklenti kimliğinden (`sender.id === chrome.runtime.id`) ve YouTube origin'inden gelen, bilinen tipteki mesajları işler. | `src/background.js` |
| 7 | **MAIN-world köprüsü kilitli.** Sayfa dünyasıyla iletişim JSON *string* taşıyan `CustomEvent` ile yapılır; istek şeması doğrulanır (`id` sayı, `method` string, `args` dizi), yöntemler `hasOwnProperty` ile beyaz listeden seçilir (`__proto__`, `constructor` vb. engellenir), argümanlar sınırlandırılır (`setVolume` 0–100). | `src/content/main-world.js`, `src/content/shared.js` |
| 8 | **Video kimliği doğrulaması.** Küçük resim URL'si yalnızca `[A-Za-z0-9_-]{6,20}` kalıbına uyan kimliklerle oluşturulur; URL parametresi doğrudan CSS'e gömülmez. | `src/content/content.js` |
| 9 | **Font bağlantısı doğrulaması.** PiP penceresine yalnızca `https://fonts.googleapis.com` host'una ait, YouTube'un zaten yüklediği stil bağlantısı kopyalanır. | `src/content/pip-window.js` |
| 10 | **Veri toplama yok.** Telemetri, analitik, kimlik, çerez yok. Ayarlar `chrome.storage.sync`, pencere genişliği `chrome.storage.local` içinde tarayıcıda kalır. | `src/popup/popup.js`, `src/content/content.js` |
| 11 | **Dış erişim kapalı.** `web_accessible_resources` ve `externally_connectable` tanımlı değil; web sayfaları eklentinin dosyalarına ulaşamaz, eklentiye mesaj gönderemez. | `manifest.json` |
| 12 | **Test + CI.** 19 test; izin seti, CSP, eşleşme kalıpları, tehlikeli sink'ler, köprü doğrulaması ve i18n bütünlüğü her push'ta denetlenir. | `test/extension.test.js`, `.github/workflows/ci.yml` |

## Tehdit modeli

- **Kötü niyetli sayfa betiği (youtube.com içinde çalışan üçüncü taraf kod).** Köprüye yalnızca beyaz listedeki beş yöntemle ulaşabilir; dönen değerler metin olarak (`textContent`) kullanılır, HTML'e dönüşmez.
- **Eklenti sayfalarına XSS.** Popup'ta dinamik HTML yok; CSP inline ve uzak script'i engeller.
- **Yetki kötüye kullanımı.** Eklenti sekme listesi okuyamaz, başka sitelere betik enjekte edemez, ağ isteği yapamaz.
- **Tedarik zinciri.** Çalışma zamanı bağımlılığı yok (`package.json` yalnızca `node --test` için). Dağıtım zip'i `scripts/package.js` ile yalnızca gerekli dosyalardan üretilir.

## Zafiyet bildirimi

Bir güvenlik sorunu bulursanız lütfen herkese açık issue açmak yerine GitHub'ın **Security → Report a vulnerability** (private vulnerability reporting) özelliğini kullanın. 72 saat içinde dönüş yapılır; düzeltme yayımlanana kadar ayrıntıların gizli tutulmasını rica ederiz.

Desteklenen sürüm: `main` dalındaki son sürüm.

---

## English

MSSoft YouTube PiP runs only on YouTube pages and follows one rule: **least privilege, zero network traffic, zero data collection.** Every guard below is locked in as an invariant in the `npm test` suite, so CI fails if one regresses.

1. **Single permission: `storage`.** No `tabs`, `scripting`, `activeTab` or host permissions.
2. **YouTube only.** Content scripts match `https://www.youtube.com/*` and `https://www.youtube-nocookie.com/embed/*`, nothing else.
3. **Strict CSP** for extension pages: `default-src 'none'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; connect-src 'none'`.
4. **No remote code, no network requests.** No `fetch`, `XMLHttpRequest` or `importScripts`.
5. **Trusted-Types-safe DOM.** No `innerHTML`/`eval`/`document.write`; everything is built with `createElement`.
6. **Validated background messages.** Only messages from this extension's own id, sent from a YouTube origin, of a known type.
7. **Locked MAIN-world bridge.** JSON-string `CustomEvent`s, schema-checked requests, `hasOwnProperty` method whitelist (blocks `__proto__`/`constructor`), clamped arguments.
8. **Video-id validation** before building the thumbnail URL.
9. **Font-link validation**: only `https://fonts.googleapis.com` stylesheets already loaded by YouTube are copied into the PiP window.
10. **No data collection.** No telemetry, analytics or identifiers; settings live in `chrome.storage`.
11. **No external surface.** No `web_accessible_resources`, no `externally_connectable`.
12. **Tests + CI** guard permissions, CSP, match patterns, dangerous sinks, bridge validation and i18n completeness on every push.

**Reporting:** please use GitHub's private vulnerability reporting (Security → Report a vulnerability) instead of a public issue. You will hear back within 72 hours.
