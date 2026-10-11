# Changelog

Tüm önemli değişiklikler burada listelenir. Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme [SemVer](https://semver.org/lang/tr/).

## [1.1.0] — 2026-10-11

### Eklendi
- **Tam ekran uygulamalar** ayar bölümü: *Tam ekran uygulama pencereyi gizleyince duraklat*. macOS'ta başka bir uygulamanın tam ekran alanına geçildiğinde PiP belgesi `hidden` olur; ayar açıksa video orada duraklar, pencere yeniden görünür olunca kaldığı yerden sürer. Pencereyi kapatmak hiçbir zaman duraklatmaz; medya tuşlarıyla elle başlatma bekleyen sürdürmeyi iptal eder.
- Ayar penceresinde macOS tam ekran davranışı ve **Doldur** ipucu notu, MSSoft marka bağlantısı.
- README'de "macOS ve tam ekran uygulamalar" bölümü: Chromium kaynak kodu ve 11 Ekim 2026 tarihli ölçümlerle neden hiçbir eklentinin PiP'i başka uygulamaların tam ekran alanında gösteremeyeceği, ve dört pratik çözüm.
- `SECURITY.md` (12 güvenlik koruması, tehdit modeli, zafiyet bildirimi), `PRIVACY.md`, `LICENSE` (Apache-2.0), `NOTICE`.
- 20 testlik `node --test` paketi (bağımlılıksız): yardımcılar, MAIN-world köprüsü, manifest / CSP / i18n / kaynak ağacı değişmezleri, ayar varsayılanlarının tutarlılığı.
- GitHub Actions CI: sözdizimi denetimi, testler, dağıtım zip artefaktı. `npm run package` ile yerel zip.

### Güvenlik
- Eklenti sayfaları için sıkı CSP: `default-src 'none'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; connect-src 'none'`.
- Arka plan mesajları yalnızca kendi eklenti kimliğinden ve YouTube origin'inden kabul edilir.
- MAIN-world köprüsünde istek şeması doğrulaması (`id` sayı, `method` string, `args` dizi).
- Küçük resim URL'si yalnızca `[A-Za-z0-9_-]{6,20}` kalıbına uyan video kimlikleriyle kurulur.
- PiP penceresine yalnızca `https://fonts.googleapis.com` host'una ait stil bağlantısı kopyalanır.

### Düzeltildi
- `P` kısayolu PiP açıkken pencereyi kapatmıyordu (video sayfadan taşındığı için `<video>` bulunamıyordu).

## 1.0.0 — 2026-10-11

İlk sürüm: native görünümlü oynatıcı butonu, Document Picture-in-Picture penceresi ve YouTube tarzı kontroller, sayfada yer tutucu, tam ekrana dönüş, reklam / canlı yayın farkındalığı, klavye kısayolları, dört buton stili, atlama süresi, otomatik PiP (deneysel), TR / EN / DE / FR / ES / RU arayüz metinleri, gömülü oynatıcı desteği.

[1.1.0]: https://github.com/lastref/mssoft-youtube-pip/releases/tag/v1.1.0
