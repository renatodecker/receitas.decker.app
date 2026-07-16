/* Cookie consent (LGPD/GDPR) + Google Analytics 4 loader, shared by all decker.app.br pages. */
(function () {
  var GA_ID = 'G-9JZ3V1YQ20';
  var STORAGE_KEY = 'decker_cookie_consent';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function applyConsent(granted) {
    gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
    if (granted) loadGA();
  }

  function showBanner() {
    var style = document.createElement('style');
    style.textContent =
      '#cookie-consent-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'background:#0c1a12;color:#f3f4f6;padding:16px 20px;display:flex;gap:16px;' +
      'align-items:center;justify-content:center;flex-wrap:wrap;font:14px/1.5 Inter,system-ui,sans-serif;' +
      'box-shadow:0 -2px 12px rgba(0,0,0,.25)}' +
      '#cookie-consent-banner p{margin:0;max-width:520px}' +
      '#cookie-consent-banner a{color:#7fd1a3;text-decoration:underline}' +
      '#cookie-consent-banner .ccb-actions{display:flex;gap:8px;flex-shrink:0}' +
      '#cookie-consent-banner button{padding:8px 16px;border-radius:6px;border:none;' +
      'font-weight:600;font-size:13px;cursor:pointer}' +
      '#ccb-accept{background:#16a34a;color:#fff}' +
      '#ccb-reject{background:transparent;color:#f3f4f6;border:1px solid #4b5563!important}';
    document.head.appendChild(style);

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML =
      '<p>Usamos cookies de analytics para entender como o site é usado. ' +
      'Você pode aceitar ou recusar.</p>' +
      '<div class="ccb-actions">' +
      '<button id="ccb-reject" type="button">Recusar</button>' +
      '<button id="ccb-accept" type="button">Aceitar</button>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('ccb-accept').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'granted');
      applyConsent(true);
      banner.remove();
    });
    document.getElementById('ccb-reject').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'denied');
      applyConsent(false);
      banner.remove();
    });
  }

  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'granted') {
    applyConsent(true);
  } else if (saved !== 'denied') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
