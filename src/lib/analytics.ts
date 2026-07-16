declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let carregado = false;

/** Injeta o gtag.js do GA4. Só deve ser chamado depois de consentimento explícito para "estatísticas". */
export function iniciarAnalytics(measurementId: string | undefined): void {
  if (carregado || !measurementId) return;
  carregado = true;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  gtag('js', new Date());
  gtag('config', measurementId);
}
