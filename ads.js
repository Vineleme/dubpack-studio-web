(function () {
  const state = {
    scriptLoaded: false,
    scriptLoading: false,
    hidden: true,
    rendered: new Set()
  };

  function config() {
    return window.DUBPACK_ADS || {};
  }

  function isConfigured() {
    const cfg = config();
    return Boolean(cfg.enabled && /^ca-pub-\d+$/i.test(String(cfg.clientId || '').trim()));
  }

  function slotId(key) {
    return String(config().slots?.[key] || '').trim();
  }

  function loadScript() {
    if (state.scriptLoaded) return Promise.resolve();
    if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      state.scriptLoaded = true;
      return Promise.resolve();
    }
    if (state.scriptLoading) {
      return new Promise((resolve) => {
        const wait = () => {
          if (state.scriptLoaded) resolve();
          else setTimeout(wait, 40);
        };
        wait();
      });
    }
    const clientId = String(config().clientId || '').trim();
    state.scriptLoading = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        state.scriptLoaded = true;
        state.scriptLoading = false;
        resolve();
      };
      script.onerror = () => {
        state.scriptLoading = false;
        reject(new Error('ads-script-failed'));
      };
      document.head.appendChild(script);
    });
  }

  function formatForKey(key) {
    if (/leader|masthead|footer|mobile/i.test(key)) return 'horizontal';
    if (/left|right/i.test(key) && /top/i.test(key)) return 'vertical';
    if (/rail/i.test(key)) return 'rectangle';
    return 'auto';
  }

  function mountUnit(root) {
    const key = root.dataset.adKey;
    if (!key || state.rendered.has(key)) return;
    const id = slotId(key);
    const slot = root.querySelector('.studio-ad-slot');
    const fallback = root.querySelector('.studio-ad-fallback');
    if (!slot || !id) return;

    const clientId = String(config().clientId || '').trim();
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', clientId);
    ins.setAttribute('data-ad-slot', id);
    const format = formatForKey(key);
    if (format !== 'auto') ins.setAttribute('data-ad-format', format);
    ins.setAttribute('data-full-width-responsive', 'true');
    slot.replaceChildren(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      state.rendered.add(key);
      root.classList.add('has-live-ad');
      fallback?.remove();
    } catch {
      // Ad blockers or pending AdSense approval — keep placeholder.
    }
  }

  async function renderAll() {
    if (state.hidden || !isConfigured()) return;
    try {
      await loadScript();
    } catch {
      return;
    }
    document.querySelectorAll('[data-ad-key]').forEach((root) => mountUnit(root));
  }

  function syncHidden(hidden) {
    state.hidden = Boolean(hidden);
    document.body.classList.toggle('hide-ads', state.hidden);
    if (!state.hidden) void renderAll();
  }

  window.DubpackAds = {
    init() {
      syncHidden(document.body.classList.contains('hide-ads'));
    },
    syncHidden,
    refresh: renderAll
  };
})();
