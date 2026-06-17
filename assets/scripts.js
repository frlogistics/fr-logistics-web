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
      // FUL_PP1 weight tiers (small≤1.5lb $3, standard 1.5-3lb $4, oversized >3lb $5)
      fulfillment:  { small: 3.00, standard: 4.00, oversized: 5.00 },
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
    // All rates are plain numbers (D3 eliminated FNSKU tiers — now flat $0.55).
    function buildRatesFromApi(apiRates) {
      // apiRates shape: { "PRP_FNSKU": {rate: 0.55, ...}, "STO_RACK": {rate: 45, ...}, ... }
      const out = { ...FALLBACK_RATES };  // start with fallback
      for (const code in API_KEY_TO_CALC_KEY) {
        const calcKey = API_KEY_TO_CALC_KEY[code];
        const entry   = apiRates[code];
        if (!entry || entry.rate == null) continue;

        // FUL_PP1 carries weight tiers — read the tiers block, not the flat rate.
        if (code === 'FUL_PP1') {
          const t = entry.tiers;
          if (t && t.small != null && t.standard != null && t.oversized != null) {
            out.fulfillment = {
              small:     parseFloat(t.small),
              standard:  parseFloat(t.standard),
              oversized: parseFloat(t.oversized),
            };
          }
          // If tiers missing (old API), keep FALLBACK_RATES.fulfillment object.
          continue;
        }

        const v = parseFloat(entry.rate);
        if (calcKey === 'storage_monthly') {
          out.storage = v / 30;  // STO_RACK is monthly; calculator uses per-day
        } else {
          out[calcKey] = v;
        }
      }
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
        return { ...FALLBACK_RATES };
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
    const sizeField     = document.getElementById('calcSizeField');
    const storageField  = document.getElementById('calcStorageField');
    const storageToggle = document.getElementById('calcStorageToggle');
    const storageRow    = document.getElementById('calcStorageRow');
    const addonsField   = document.getElementById('calcAddonsField');
    const addons        = calcForm.querySelectorAll('.calc-addons input[type="checkbox"]');
    const totalEl       = document.getElementById('calcTotal');
    const unitsLabel    = document.getElementById('calcUnitsLabel');
    const resultNote    = document.getElementById('calcResultNote');
    const unitsValUnit  = { current: ' orders' };

    const DEFAULT_NOTE = 'excludes carrier shipping costs & optional specialty services';
    // Detect language from URL so the shared scripts.js serves the right copy.
    const IS_ES = window.location.pathname.startsWith('/es/') || window.location.pathname === '/es';
    const T = IS_ES ? {
      fulfillmentNote: 'Fulfillment Shopify / DTC — pick, pack y etiqueta según peso de la orden: $3.00 (≤1.5 lb) · $4.00 (1.5–3 lb) · $5.00 (>3 lb).',
      fulfillmentUnit: 'Órdenes por mes', fulfillmentWord: ' órdenes',
      fbaNote: 'Preparación Amazon FBA — etiquetado FNSKU ($0.55/unidad) + recepción entrante ($2.50/caja). Certificado SPN.',
      fbaUnit: 'Unidades por mes', fbaWord: ' unidades',
      dropNote: 'Drop-Shipment (LATAM) — $6.00 por paquete: inspección, impresión de etiqueta y entrega al transportista.',
      dropUnit: 'Paquetes por mes', dropWord: ' paquetes',
      dropResultNote: 'La tarifa plana de $6/paquete aplica solo a órdenes de MercadoLibre. Otros destinos LATAM — contáctanos para una cotización personalizada.',
      defaultResultNote: 'excluye costos de envío y servicios especializados opcionales',
    } : {
      fulfillmentNote: 'Shopify / DTC Fulfillment — pick, pack & label priced by order weight: $3.00 (≤1.5 lb) · $4.00 (1.5–3 lb) · $5.00 (>3 lb).',
      fulfillmentUnit: 'Orders per month', fulfillmentWord: ' orders',
      fbaNote: 'Amazon FBA Prep — FNSKU labeling ($0.55/unit) + inbound receiving ($2.50/carton). SPN-certified.',
      fbaUnit: 'Units per month', fbaWord: ' units',
      dropNote: 'Drop-Shipment (LATAM) — $6.00 per package: inspection, label print & carrier handoff.',
      dropUnit: 'Packages per month', dropWord: ' packages',
      dropResultNote: 'Flat $6/package applies to MercadoLibre orders only. Other LATAM destinations — contact us for a custom quote.',
      defaultResultNote: DEFAULT_NOTE,
    };

    // ─── SERVICE CONFIGS ─────────────────────────────────────────────────
    // Each service declares which controls it shows. Storage is opt-in for
    // every service (toggle OFF by default) and never auto-added to the total.
    const SERVICE_CONFIGS = {
      fulfillment: {
        noteText: T.fulfillmentNote,
        unitLabel: T.fulfillmentUnit,
        unitWord: T.fulfillmentWord,
        showSize: true,
        showStorage: true,
        showAddons: true,
        resultNote: T.defaultResultNote,
      },
      fba: {
        noteText: T.fbaNote,
        unitLabel: T.fbaUnit,
        unitWord: T.fbaWord,
        showSize: false,
        showStorage: true,
        showAddons: true,
        resultNote: T.defaultResultNote,
      },
      dropshipment: {
        noteText: T.dropNote,
        unitLabel: T.dropUnit,
        unitWord: T.dropWord,
        showSize: false,
        showStorage: false,
        showAddons: false,
        resultNote: T.dropResultNote,
      },
    };

    // ─── COMPUTE ─────────────────────────────────────────────────────────
    function compute() {
      const service = serviceSelect ? serviceSelect.value : 'fulfillment';
      const cfg     = SERVICE_CONFIGS[service] || SERVICE_CONFIGS.fulfillment;
      const units   = parseInt(unitsSlider.value, 10) || 0;
      const size    = sizeSelect ? sizeSelect.value : 'standard';

      // Storage is only counted when the user opts in AND the service allows it.
      const storageOn = cfg.showStorage && storageToggle && storageToggle.checked;
      const days      = storageOn ? (parseInt(daysSlider.value, 10) || 0) : 0;

      let total = 0;

      if (service === 'fulfillment') {
        // Pick & Pack by weight tier: small→$3, standard→$4, large(oversized)→$5.
        const ppTierKey = size === 'small' ? 'small' : size === 'standard' ? 'standard' : 'oversized';
        const ppRate = (RATES.fulfillment && typeof RATES.fulfillment === 'object')
          ? RATES.fulfillment[ppTierKey]
          : RATES.fulfillment;  // fallback if a flat number ever slips through
        total += units * ppRate;

        addons.forEach(box => {
          if (!box.checked) return;
          const v = box.value;
          if (v === 'polybag') total += units * RATES.polybag;
          if (v === 'bubble')  total += units * RATES.bubble;
          if (v === 'kitting') total += units * RATES.kitting;
          if (v === 'sticker') total += units * RATES.sticker;
        });

      } else if (service === 'fba') {
        // FBA prep: FNSKU labeling + inbound receiving. No storage in the base.
        const cartons = Math.max(1, Math.ceil(units / 100));
        total += units * RATES.fnsku;
        total += cartons * RATES.receiving;

        addons.forEach(box => {
          if (!box.checked) return;
          const v = box.value;
          if (v === 'polybag') total += units * RATES.polybag;
          if (v === 'bubble')  total += units * RATES.bubble;
          if (v === 'kitting') total += units * RATES.kitting;
          if (v === 'sticker') total += units * RATES.sticker;
        });

      } else if (service === 'dropshipment') {
        // Flat $6/package (MercadoLibre). No size, no addons.
        total += units * RATES.dropshipment;
      }

      // Optional storage estimate (any service that allows it, when toggled on).
      if (storageOn && days > 0) {
        const cartons = Math.max(1, Math.ceil(units / (size === 'small' ? 200 : size === 'standard' ? 100 : 40)));
        const pallets = Math.max(1, Math.ceil(cartons / 20));
        total += pallets * RATES.storage * days;
      }

      totalEl.textContent = '$' + total.toFixed(2);
    }

    function updateServiceUI() {
      if (!serviceSelect) return;
      const service = serviceSelect.value;
      const cfg = SERVICE_CONFIGS[service];
      if (!cfg) return;

      if (serviceNote) serviceNote.textContent = cfg.noteText;
      if (unitsLabel)  unitsLabel.textContent  = cfg.unitLabel;
      unitsValUnit.current = cfg.unitWord;
      if (unitsValue) unitsValue.textContent = unitsSlider.value + cfg.unitWord;
      if (resultNote) resultNote.textContent = cfg.resultNote || DEFAULT_NOTE;

      if (sizeField)    sizeField.style.display    = cfg.showSize    ? '' : 'none';
      if (addonsField)  addonsField.style.display  = cfg.showAddons  ? '' : 'none';
      if (storageField) storageField.style.display = cfg.showStorage ? '' : 'none';

      // When a service hides storage, force the toggle off + collapse the row.
      if (!cfg.showStorage && storageToggle) {
        storageToggle.checked = false;
        if (storageRow) storageRow.style.display = 'none';
      }

      compute();
    }

    function wire(el, valueEl, unitFn) {
      el.addEventListener('input', () => {
        if (valueEl) valueEl.textContent = el.value + (typeof unitFn === 'function' ? unitFn() : unitFn || '');
        compute();
      });
    }

    wire(unitsSlider, unitsValue, () => unitsValUnit.current);
    wire(daysSlider, daysValue, ' days');
    if (sizeSelect) sizeSelect.addEventListener('change', compute);
    addons.forEach(box => box.addEventListener('change', compute));
    if (serviceSelect) serviceSelect.addEventListener('change', updateServiceUI);

    // Storage toggle: reveal/collapse the days row and recompute.
    if (storageToggle) {
      storageToggle.addEventListener('change', () => {
        if (storageRow) storageRow.style.display = storageToggle.checked ? '' : 'none';
        compute();
      });
    }

    // ─── INIT ─ async (load rates first, then compute) ───────────────────
    // Show fallback values immediately so calculator is never empty.
    RATES = { ...FALLBACK_RATES };
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
