/**
 * REINATUS - ADVANCED CONVERSION TRACKER & META PIXEL INTEGRATION
 */

(function () {
  'use strict';

  // 1. Visitor & Session Management
  function getOrCreateVisitorId() {
    let vid = localStorage.getItem('reinatus_vid');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('reinatus_vid', vid);
    }
    return vid;
  }

  function getOrCreateSessionId() {
    let sid = sessionStorage.getItem('reinatus_sid');
    if (!sid) {
      sid = 's_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      sessionStorage.setItem('reinatus_sid', sid);
    }
    return sid;
  }

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();

  // Detect device
  function getDeviceType() {
    const w = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad|tablet|(android(?!.*mobile))/i.test(ua) || (w >= 768 && w <= 1024)) return 'Tablet';
    if (/mobile|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua) || w < 768) return 'Mobile';
    return 'Desktop';
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    return 'Navegador';
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Macintosh')) return 'MacOS';
    if (ua.includes('Linux')) return 'Linux';
    return 'Outro';
  }

  // 2. Track Pageview
  function trackPageview() {
    const payload = {
      session_id: sessionId,
      visitor_id: visitorId,
      path: window.location.pathname,
      referrer: document.referrer || '',
      device_type: getDeviceType(),
      browser: getBrowser(),
      os: getOS(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/pageview', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } else {
      fetch('/api/track/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(function () {});
    }
  }

  trackPageview();

  // 3. Meta Pixel Dynamic Injection
  let metaPixelActive = false;

  fetch('/api/config/meta')
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.is_active && data.pixel_id) {
        initMetaPixel(data.pixel_id);
      }
    })
    .catch(function () {});

  function initMetaPixel(pixelId) {
    /* Standard Meta Pixel Code */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    metaPixelActive = true;
    console.log('[REINATUS] Meta Pixel Ativado com ID:', pixelId);
  }

  // 4. Click & Heatmap Event Listener
  document.addEventListener('click', function (e) {
    const target = e.target.closest('a, button, [data-track-click]');
    if (!target) return;

    // Calculate Heatmap % coordinates
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, 1);
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1);
    const clickXPct = parseFloat(((e.pageX / scrollWidth) * 100).toFixed(2));
    const clickYPct = parseFloat(((e.pageY / scrollHeight) * 100).toFixed(2));

    const href = target.getAttribute('href') || '';
    const buttonId = target.id || target.getAttribute('data-track-id') || target.className || 'btn_cta';
    const buttonText = (target.innerText || target.textContent || '').trim().replace(/\s+/g, ' ');

    let eventName = 'click';
    let productToken = target.getAttribute('data-track-token') || null;
    let productName = target.getAttribute('data-track-product') || null;
    let productValue = parseFloat(target.getAttribute('data-track-value')) || 0;

    // Check if it's a Yampi checkout link
    if (href.includes('yampi.com.br/r/')) {
      eventName = 'initiate_checkout';
      const tokenMatch = href.match(/\/r\/([A-Z0-9]+)/);
      if (tokenMatch && !productToken) productToken = tokenMatch[1];
    } else if (href.includes('whatsapp.com') || target.getAttribute('data-action') === 'whatsapp') {
      eventName = 'whatsapp_click';
    } else if (href.startsWith('tel:')) {
      eventName = 'call_click';
    } else if (href.startsWith('#')) {
      eventName = 'anchor_nav';
    }

    // Auto product metadata lookup if token is found
    const tokenPrices = {
      RU4AS8ZODH: { name: 'Combo com 2 Kits (Mais Vendido)', value: 497.90 },
      R87V22IOLZ: { name: 'Combo com 3 Kits', value: 799.90 },
      PUQRGLLLWG: { name: 'Combo com 1 Kit', value: 297.90 },
      NG8VJ7MOUR: { name: 'Combo com 6 Kits', value: 1499.90 },
      LF6N2UOMNC: { name: 'Líquido 30ml (Gotas)', value: 149.90 },
      SXXCXKZDKF: { name: '30 Cápsulas 500mg', value: 199.90 },
      N58J4NCMQ4: { name: 'Amostra Grátis (5 Cápsulas)', value: 49.90 },
    };

    if (productToken && tokenPrices[productToken]) {
      if (!productName) productName = tokenPrices[productToken].name;
      if (!productValue) productValue = tokenPrices[productToken].value;
    }

    // Generate unique event_id for browser + CAPI deduplication
    const eventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    // Browser-side Meta Pixel Dispatch
    if (metaPixelActive && window.fbq) {
      if (eventName === 'initiate_checkout') {
        window.fbq(
          'track',
          'InitiateCheckout',
          {
            content_name: productName || 'Super Poten Max',
            content_ids: productToken ? [productToken] : [],
            value: productValue,
            currency: 'BRL',
          },
          { eventID: eventId }
        );
      } else if (eventName === 'whatsapp_click') {
        window.fbq(
          'track',
          'Contact',
          {
            content_name: 'WhatsApp Concierge',
          },
          { eventID: eventId }
        );
      }
    }

    // Server-side Dispatch (Analytics DB + CAPI)
    const payload = {
      session_id: sessionId,
      visitor_id: visitorId,
      event_name: eventName,
      button_id: buttonId.slice(0, 100),
      button_label: buttonText.slice(0, 255),
      product_name: productName,
      product_token: productToken,
      product_value: productValue,
      target_url: href.slice(0, 500),
      click_x_pct: clickXPct,
      click_y_pct: clickYPct,
      event_id: eventId,
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/click', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } else {
      fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(function () {});
    }
  });
})();
