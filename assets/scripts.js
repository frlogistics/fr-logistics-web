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

  // -----------------------------------------------------------
  // Pricing calculator (pricing.html only) — service-aware
  // Changes cost model based on selected service
  // -----------------------------------------------------------
  const calcForm = document.getElementById('pricingCalculator');
  if (calcForm) {
    const RATES = {
      fnsku: (units) => {
        if (units <= 50) return 1.00;
        if (units <= 100) return 0.90;
        if (units <= 500) return 0.75;
        if (units <= 1000) return 0.65;
        if (units <= 5000) return 0.60;
        return 0.50;
      },
      polybag: 0.50,
      kitting: 0.75,
      storage: 0.05,         // per pallet per day
      receiving: 2.50,       // per carton
      outbound: 1.00,        // per order
      bubble: 0.15,
      sticker: 0.20,
      dropshipment: 6.00,    // per drop-shipment
      fulfillment: 3.00,     // per Shopify/DTC order
    };

    const serviceSelect = document.getElementById('calcService');
    const serviceNote = document.getElementById('calcServiceNote');
    const unitsSlider = document.getElementById('calcUnits');
    const unitsValue = document.getElementById('calcUnitsValue');
    const daysSlider = document.getElementById('calcDays');
    const daysValue = document.getElementById('calcDaysValue');
    const sizeSelect = document.getElementById('calcSize');
    const addons = calcForm.querySelectorAll('.calc-addons input[type="checkbox"]');
    const totalEl = document.getElementById('calcTotal');
    const unitsLabel = document.getElementById('calcUnitsLabel');

    // Service-specific configs
    const SERVICE_CONFIGS = {
      fba: {
        noteText: 'FBA Prep: FNSKU labeling + inbound receiving + storage + shipment prep. Volume tiers applied automatically.',
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

    function compute() {
      const service = serviceSelect ? serviceSelect.value : 'fba';
      const units = parseInt(unitsSlider.value, 10) || 0;
      const days = parseInt(daysSlider.value, 10) || 0;
      const size = sizeSelect ? sizeSelect.value : 'standard';

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

    // Initial setup
    updateServiceUI();
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
