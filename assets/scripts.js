/* ================================================================
   FR-Logistics · MASTER SCRIPTS
   Used by all pages of fr-logistics.net
   ================================================================ */

(function () {
  'use strict';

  // -----------------------------------------------------------
  // Mobile menu toggle
  // -----------------------------------------------------------
  const navToggle = document.getElementById('navToggle');
  const navClose = document.getElementById('navClose');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileBackdrop = document.getElementById('mobileBackdrop');

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add('open');
    mobileBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    mobileBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
  }

  navToggle?.addEventListener('click', openMenu);
  navClose?.addEventListener('click', closeMenu);
  mobileBackdrop?.addEventListener('click', closeMenu);
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  // -----------------------------------------------------------
  // Social sidebar: smart scroll-aware visibility
  // -----------------------------------------------------------
  const sidebar = document.querySelector('.social-sidebar');
  if (sidebar) {
    const footer = document.querySelector('.site-footer');
    const HIDE_THRESHOLD = 100;
    const FOOTER_BUFFER = 120;
    const SCROLL_DELTA = 6;

    let lastY = window.scrollY;
    let hidden = false;
    let ticking = false;

    function updateSidebar() {
      const y = window.scrollY;
      const delta = y - lastY;

      let nearFooter = false;
      if (footer) {
        const footerTop = footer.getBoundingClientRect().top;
        nearFooter = footerTop < window.innerHeight + FOOTER_BUFFER;
      }

      if (y < HIDE_THRESHOLD) {
        if (hidden) { sidebar.classList.remove('is-hidden'); hidden = false; }
      } else if (nearFooter) {
        if (!hidden) { sidebar.classList.add('is-hidden'); hidden = true; }
      } else if (delta > SCROLL_DELTA) {
        if (!hidden) { sidebar.classList.add('is-hidden'); hidden = true; }
      } else if (delta < -SCROLL_DELTA) {
        if (hidden) { sidebar.classList.remove('is-hidden'); hidden = false; }
      }

      lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateSidebar);
        ticking = true;
      }
    }, { passive: true });
  }

  // -----------------------------------------------------------
  // Tidio + LIAM integration
  // LIAM button replaces Tidio's default launcher
  // - Click LIAM → opens Tidio chat (Lyro AI + FR-Logistics team)
  // - Tidio not loaded? → fallback to WhatsApp
  // - On Tidio close → re-hide launcher to keep LIAM visible
  // -----------------------------------------------------------
  const liamBtn = document.getElementById('liamChatBtn');
  if (liamBtn) {
    const WHATSAPP_FALLBACK = 'https://api.whatsapp.com/send?phone=17863001443&text=Hi%20LIAM%2C%20I%27d%20like%20to%20chat%20with%20FR-Logistics';

    let tidioReady = false;

    function hideTidioLauncher() {
      if (window.tidioChatApi && typeof window.tidioChatApi.hide === 'function') {
        try { window.tidioChatApi.hide(); } catch (e) {}
      }
    }

    document.addEventListener('tidioChat-ready', () => {
      tidioReady = true;
      hideTidioLauncher();
    });

    document.addEventListener('tidioChat-close', () => {
      setTimeout(hideTidioLauncher, 100);
    });

    liamBtn.addEventListener('click', (e) => {
      e.preventDefault();

      if (tidioReady && window.tidioChatApi) {
        try {
          window.tidioChatApi.show();
          window.tidioChatApi.open();
          return;
        } catch (err) {}
      }

      window.open(WHATSAPP_FALLBACK, '_blank', 'noopener,noreferrer');
    });

    // Safety net: poll for Tidio up to 15 seconds
    let attempts = 0;
    const pollInterval = setInterval(() => {
      if (window.tidioChatApi) {
        if (!tidioReady) tidioReady = true;
        hideTidioLauncher();
        clearInterval(pollInterval);
      } else if (++attempts > 30) {
        clearInterval(pollInterval);
      }
    }, 500);
  }

  // ════════════════════════════════════════════════════════════════════════
  // PRICING CALCULATOR — API-driven (Phase 3.4 refactor 2026-05-07)
  //
  // Fetches DEFAULT rates from apps.fr-logistics.net/.netlify/functions/billing-rates
  // Caches result in localStorage for 1 hour to minimize API calls.
  // Falls back to hardcoded values if API unreachable (graceful degradation).
  //
  // Source of truth: fr_client_rates table in Supabase (DEFAULT row).
  // To update rates → edit Supabase, NOT this file.
  //
  // Fallback values reflect canonical D1-D15 decisions as of 2026-05-07.
  // If you change rates in fr_client_rates, also update FALLBACK_RATES below
  // so offline users see current numbers (otherwise they see stale fallbacks).
  // ════════════════════════════════════════════════════════════════════════
  const calcForm = document.getElementById('pricingCalculator');
  if (calcForm) {

    // ─── CONFIG ──────────────────────────────────────────────────────────
    const RATES_API_URL = 'https://apps.fr-logistics.net/.netlify/functions/billing-rates?client=DEFAULT';
    const CACHE_KEY     = 'fr_public_rates_v1';
    const CACHE_TTL_MS  = 60 * 60 * 1000;  // 1 hour

    // ─── FALLBACK RATES ──────────────────────────────────────────────────
    // Used ONLY if API is unreachable. Should mirror canonical DEFAULT rates.
    // Keys here = legacy calculator names (kept to minimize compute() changes).
    // Values below reflect Master Spec v3 D1-D15 (2026-05-07).
    const FALLBACK_RATES = {
      fnsku:        0.55,   // PRP_FNSKU (D3 — flat, no more tiers)
      polybag:      0.50,   // PRP_POLY  (D2)
      kitting:      0.75,   // PRP_KIT
      storage:      45 / 30, // STO_RACK $45/mo ÷ 30 = $1.50/day per pallet
      receiving:    2.50,   // INB_CARTON
      outbound:     2.00,   // FUL_OUT_CART (D7 — was $1, now $2)
      bubble:       0.80,   // PRP_BUBBLE (was $0.15 in v1, now $0.80)
      sticker:      0.25,   // PRP_ROL (was $0.20)
      dropshipment: 6.00,   // FUL_OUT_DROP
      fulfillment:  3.00,   // FUL_PP1 (D4 — flat, no more tiers)
    };

    // ─── CANONICAL CODE → CALCULATOR KEY MAPPING ─────────────────────────
    // Maps API service codes (PRP_FNSKU, PRP_BUBBLE, etc.) to calculator keys
    // (fnsku, bubble, etc.) so we can preserve compute() logic unchanged.
    const API_KEY_TO_CALC_KEY = {
      'PRP_FNSKU':    'fnsku',
      'PRP_POLY':     'polybag',
      'PRP_KIT':      'kitting',
      'PRP_BUBBLE':   'bubble',
      'PRP_ROL':      'sticker',
      'STO_RACK':     'storage_monthly',  // we'll convert to per-day below
      'INB_CARTON':   'receiving',
      'FUL_OUT_CART': 'outbound',
      'FUL_OUT_DROP': 'dropshipment',
      'FUL_PP1':      'fulfillment',
    };

    // ─── RATES STATE — populated by loadRates() at init ──────────────────
    let RATES = { ...FALLBACK_RATES };  // start with fallback, replaced after fetch

    // ─── CACHE HELPERS ───────────────────────────────────────────────────
    function readCache() {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || !obj.ts || !obj.rates) return null;
        if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
        return obj.rates;
      } catch (e) {
        return null;
      }
    }
    function writeCache(rates) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rates }));
      } catch (e) { /* localStorage full or blocked — silent fail */ }
    }

    // ─── BUILD CALCULATOR RATES FROM API RESPONSE ────────────────────────
    function buildRatesFromApi(apiRates) {
      // apiRates shape: { "PRP_FNSKU": {rate: 0.55, ...}, "STO_RACK": {rate: 45, ...}, ... }
      const out = { ...FALLBACK_RATES };  // start with fallback
      for (const code in API_KEY_TO_CALC_KEY) {
        const calcKey = API_KEY_TO_CALC_KEY[code];
        const entry   = apiRates[code];
        if (!entry || entry.rate == null) continue;

        const v = parseFloat(entry.rate);
        if (calcKey === 'storage_monthly') {
          out.storage = v / 30;  // STO_RACK is monthly; calculator uses per-day
        } else {
          out[calcKey] = v;
        }
      }
      // FNSKU rate function (always flat now — D3 eliminated tiers)
      const flatFnsku = out.fnsku;
      out.fnsku = () => flatFnsku;
      return out;
    }

    // Convert FALLBACK_RATES to also expose fnsku as function (consistency)
    function buildFallbackCalcRates() {
      const out = { ...FALLBACK_RATES };
      const flatFnsku = out.fnsku;
      out.fnsku = () => flatFnsku;
      return out;
    }

    // ─── LOAD RATES ─ async ──────────────────────────────────────────────
    async function loadRates() {
      // Try cache first
      const cached = readCache();
      if (cached) {
        return cached;
      }

      // Cache miss — fetch from API
      try {
        const resp = await fetch(RATES_API_URL, { method: 'GET' });
        if (!resp.ok) throw new Error('API ' + resp.status);
        const data = await resp.json();
        if (!data || !data.rates) throw new Error('Empty rates response');
        const built = buildRatesFromApi(data.rates);
        writeCache(built);
        return built;
      } catch (err) {
        // Graceful fallback — calculator stays usable with hardcoded values
        console.warn('[FR-Logistics] Rates API unavailable, using fallback:', err.message);
        return buildFallbackCalcRates();
      }
    }

    // ─── DOM REFS ────────────────────────────────────────────────────────
    const serviceSelect = document.getElementById('calcService');
    const serviceNote   = document.getElementById('calcServiceNote');
    const unitsSlider   = document.getElementById('calcUnits');
    const unitsValue    = document.getElementById('calcUnitsValue');
    const daysSlider    = document.getElementById('calcDays');
    const daysValue     = document.getElementById('calcDaysValue');
    const sizeSelect    = document.getElementById('calcSize');
    const addons        = calcForm.querySelectorAll('.calc-addons input[type="checkbox"]');
    const totalEl       = document.getElementById('calcTotal');
    const unitsLabel    = document.getElementById('calcUnitsLabel');

    // ─── SERVICE CONFIGS ─────────────────────────────────────────────────
    const SERVICE_CONFIGS = {
      fba: {
        noteText: 'FBA Prep: FNSKU labeling + inbound receiving + storage + shipment prep. All rates flat per current rate card.',
        unitLabel: 'Units per month',
        showSize: true,
        showAddons: true,
      },
      dropshipment: {
        noteText: 'Drop-Shipment: $6.00 per package shipped. Each drop-ship includes inspection, label print, and carrier handoff.',
        unitLabel: 'Drop-shipments per month',
        showSize: false,
        showAddons: false,
      },
      fulfillment: {
        noteText: 'Shopify/DTC Fulfillment: $3.00 per order shipped (pick, pack, label) + storage + receiving. Good for DTC brands.',
        unitLabel: 'Orders per month',
        showSize: true,
        showAddons: true,
      },
    };

    // ─── COMPUTE ─────────────────────────────────────────────────────────
    function compute() {
      const service = serviceSelect ? serviceSelect.value : 'fba';
      const units = parseInt(unitsSlider.value, 10) || 0;
      const days  = parseInt(daysSlider.value, 10) || 0;
      const size  = sizeSelect ? sizeSelect.value : 'standard';

      let total = 0;

      if (service === 'fba') {
        const cartons = Math.max(1, Math.ceil(units / (size === 'small' ? 200 : size === 'standard' ? 100 : 40)));
        const pallets = Math.max(1, Math.ceil(cartons / 20));
        total += units * RATES.fnsku(units);
        total += cartons * RATES.receiving;
        total += pallets * RATES.storage * days;
        total += units * RATES.outbound / (size === 'small' ? 10 : size === 'standard' ? 5 : 2);

        addons.forEach(box => {
          if (box.checked) {
            const v = box.value;
            if (v === 'polybag') total += units * RATES.polybag;
            if (v === 'bubble')  total += units * RATES.bubble;
            if (v === 'kitting') total += units * RATES.kitting;
            if (v === 'sticker') total += units * RATES.sticker;
          }
        });
      } else if (service === 'dropshipment') {
        // Drop-shipment: flat $6/package
        total += units * RATES.dropshipment;
      } else if (service === 'fulfillment') {
        const cartons = Math.max(1, Math.ceil(units / (size === 'small' ? 200 : size === 'standard' ? 100 : 40)));
        const pallets = Math.max(1, Math.ceil(cartons / 20));
        total += units * RATES.fulfillment;
        total += cartons * RATES.receiving;
        total += pallets * RATES.storage * days;

        addons.forEach(box => {
          if (box.checked) {
            const v = box.value;
            if (v === 'polybag') total += units * RATES.polybag;
            if (v === 'bubble')  total += units * RATES.bubble;
          }
        });
      }

      totalEl.textContent = '$' + total.toFixed(2);
    }

    function updateServiceUI() {
      if (!serviceSelect) return;
      const service = serviceSelect.value;
      const cfg = SERVICE_CONFIGS[service];
      if (!cfg) return;

      // Update note
      if (serviceNote) serviceNote.textContent = cfg.noteText;

      // Update label
      if (unitsLabel) unitsLabel.textContent = cfg.unitLabel;

      // Show/hide size selector
      const sizeFieldWrap = sizeSelect ? sizeSelect.closest('.calc-field') : null;
      if (sizeFieldWrap) sizeFieldWrap.style.display = cfg.showSize ? '' : 'none';

      // Show/hide addons
      const addonsWrap = calcForm.querySelector('.calc-addons');
      if (addonsWrap) addonsWrap.style.display = cfg.showAddons ? '' : 'none';

      compute();
    }

    function wire(el, valueEl, unit) {
      el.addEventListener('input', () => {
        if (valueEl) valueEl.textContent = el.value + (unit || '');
        compute();
      });
    }

    wire(unitsSlider, unitsValue, ' units');
    wire(daysSlider, daysValue, ' days');
    if (sizeSelect) sizeSelect.addEventListener('change', compute);
    addons.forEach(box => box.addEventListener('change', compute));
    if (serviceSelect) serviceSelect.addEventListener('change', updateServiceUI);

    // ─── INIT ─ async (load rates first, then compute) ───────────────────
    // Show fallback values immediately so calculator is never empty.
    RATES = buildFallbackCalcRates();
    updateServiceUI();

    // Then fetch live rates and re-compute (instant if cached, ~200ms first load)
    loadRates().then(loaded => {
      RATES = loaded;
      compute();  // recalculate with live rates
    });
  }

})();


/* ================================================================
   LANGUAGE AUTO-DETECT · suggest Spanish on first visit if browser is ES
   Shows once, dismissible, stored in cookie for 30 days
   ================================================================ */
(function() {
  'use strict';

  // Only show on EN pages (not already on /es/)
  if (window.location.pathname.startsWith('/es/')) return;

  // Check if user already dismissed
  try {
    if (document.cookie.includes('fr_lang_dismissed=1')) return;
  } catch(e) { return; }

  // Check browser language
  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (!browserLang.startsWith('es')) return;

  // Build banner
  const banner = document.createElement('div');
  banner.className = 'lang-suggest-banner';
  banner.innerHTML = `
    <div class="lang-suggest-inner">
      <span><img src="https://flagcdn.com/es.svg" alt="" style="width:18px;height:13px;vertical-align:middle;margin-right:6px;border-radius:2px;"> ¿Prefieres ver este sitio en español?</span>
      <a href="/es/" class="lang-suggest-btn">Ver en español</a>
      <button type="button" class="lang-suggest-close" aria-label="Cerrar">✕</button>
    </div>
  `;
  document.body.appendChild(banner);

  setTimeout(() => banner.classList.add('show'), 600);

  banner.querySelector('.lang-suggest-close').addEventListener('click', () => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
    // 30-day cookie
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    document.cookie = `fr_lang_dismissed=1; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
  });
})();
