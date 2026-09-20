/**
 * HOSTMATTIC — Modern Interactive Storefront Engine
 * Handles Mobile Drawer, Multi-Currency ($/₹), Billing Switcher,
 * Domain Checker Simulation, Stack Builder & FAQ Accordion.
 */

(function () {
  'use strict';

  // Currency State
  let currentCurrency = localStorage.getItem('hm_currency') || 'USD';
  const USD_TO_INR = 83.5;

  // Billing State
  let currentBilling = 'annual'; // 'monthly' or 'annual'

  // Initialize once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initMobileDrawer();
    initCurrencySwitcher();
    initBillingToggle();
    initDomainSearch();
    initFaqAccordion();
    initStackBuilder();
    initToastTriggers();
  });

  /* ==========================================================================
     1. Header Scroll Shadow
     ========================================================================== */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  /* ==========================================================================
     2. Mobile Navigation Drawer
     ========================================================================== */
  function initMobileDrawer() {
    const hamburger = document.querySelector('.hamburger-btn');
    const drawer = document.querySelector('.mobile-drawer');
    const closeBtn = document.querySelector('.drawer-close');

    if (!hamburger || !drawer) return;

    function openDrawer() {
      drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Close when clicking overlay backdrop
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) closeDrawer();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  /* ==========================================================================
     3. Currency Switcher (USD $ / INR ₹)
     ========================================================================== */
  function initCurrencySwitcher() {
    const currButtons = document.querySelectorAll('.curr-btn');
    if (!currButtons.length) return;

    // Apply saved currency
    applyCurrency(currentCurrency);

    currButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.curr;
        if (selected) {
          currentCurrency = selected;
          localStorage.setItem('hm_currency', selected);
          applyCurrency(selected);
          showToast(`Currency switched to ${selected === 'USD' ? 'US Dollar ($)' : 'Indian Rupee (₹)'}`);
        }
      });
    });
  }

  function applyCurrency(curr) {
    // Update active button state
    document.querySelectorAll('.curr-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.curr === curr);
    });

    const symbol = curr === 'USD' ? '$' : '₹';

    // Update all currency symbols
    document.querySelectorAll('.curr-symbol, .plan-curr').forEach(el => {
      el.textContent = symbol;
    });

    // Update all dynamic price nodes
    document.querySelectorAll('[data-usd]').forEach(el => {
      const usdVal = parseFloat(el.dataset.usd);
      const inrVal = el.dataset.inr ? parseFloat(el.dataset.inr) : Math.round(usdVal * USD_TO_INR);

      // Check if element is in annual vs monthly context
      let displayVal;
      if (currentBilling === 'annual' && el.dataset.usdAnnual) {
        displayVal = curr === 'USD' ? el.dataset.usdAnnual : (el.dataset.inrAnnual || Math.round(parseFloat(el.dataset.usdAnnual) * USD_TO_INR));
      } else {
        displayVal = curr === 'USD' ? usdVal : inrVal;
      }

      el.textContent = displayVal;
    });

    // Update stack builder if present
    if (typeof updateStackTotal === 'function') {
      updateStackTotal();
    }
  }

  /* ==========================================================================
     4. Billing Switcher (Monthly vs Annual)
     ========================================================================== */
  function initBillingToggle() {
    const toggle = document.querySelector('.switch-toggle');
    const labelMonthly = document.querySelector('.billing-label.monthly');
    const labelAnnual = document.querySelector('.billing-label.annual');

    if (!toggle) return;

    function setBilling(cycle) {
      currentBilling = cycle;
      toggle.classList.toggle('annual', cycle === 'annual');
      if (labelMonthly) labelMonthly.classList.toggle('active', cycle === 'monthly');
      if (labelAnnual) labelAnnual.classList.toggle('active', cycle === 'annual');

      // Update period text labels
      document.querySelectorAll('.plan-period').forEach(p => {
        p.textContent = cycle === 'annual' ? '/mo (billed annually)' : '/month';
      });

      // Re-apply prices with new cycle
      applyCurrency(currentCurrency);
    }

    toggle.addEventListener('click', () => {
      setBilling(currentBilling === 'annual' ? 'monthly' : 'annual');
    });

    if (labelMonthly) labelMonthly.addEventListener('click', () => setBilling('monthly'));
    if (labelAnnual) labelAnnual.addEventListener('click', () => setBilling('annual'));
  }

  /* ==========================================================================
     5. Real-Time Domain Availability Search Simulation
     ========================================================================== */
  function initDomainSearch() {
    const searchForm = document.querySelector('.domain-search-form');
    const input = document.querySelector('.domain-input');
    const resultsContainer = document.querySelector('#domain-results');

    if (!searchForm || !input) return;

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim().toLowerCase();
      if (!raw) {
        input.focus();
        return;
      }

      // Strip http/www/extension if typed
      const cleanName = raw.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0];
      if (!cleanName) return;

      renderDomainResults(cleanName);
    });
  }

  function renderDomainResults(query) {
    let resultsBox = document.querySelector('#domain-results');
    if (!resultsBox) {
      resultsBox = document.createElement('div');
      resultsBox.id = 'domain-results';
      resultsBox.className = 'container';
      resultsBox.style.marginTop = '28px';
      const searchSection = document.querySelector('.domain-search-box').parentElement;
      searchSection.appendChild(resultsBox);
    }

    const curr = currentCurrency;
    const symbol = curr === 'USD' ? '$' : '₹';

    const tlds = [
      { ext: '.com', usd: '12.99', inr: '1099', badge: 'Popular', available: true },
      { ext: '.in', usd: '7.99', inr: '649', badge: 'Best in India', available: true },
      { ext: '.net', usd: '14.49', inr: '1199', badge: '', available: true },
      { ext: '.org', usd: '13.99', inr: '1149', badge: '', available: true },
      { ext: '.tech', usd: '4.99', inr: '399', badge: 'Special 60% OFF', available: true },
      { ext: '.online', usd: '3.99', inr: '299', badge: 'Budget Pick', available: true }
    ];

    let html = `
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; padding:28px; box-shadow:0 10px 25px -5px rgba(15,23,42,0.08); animation:fadeIn 0.3s ease;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #F1F5F9; padding-bottom:14px;">
          <div>
            <h3 style="font-size:1.15rem; color:#0F172A; margin-bottom:2px;">Domain Availability Results for "<strong>${query}</strong>"</h3>
            <p style="font-size:0.85rem; color:#64748B;">Instant WHOIS registry verification</p>
          </div>
          <span style="display:inline-flex; align-items:center; gap:6px; background:#EBF7D4; color:#4F7C12; font-size:0.8rem; font-weight:700; padding:4px 12px; border-radius:999px;">
            <span class="pulse-dot"></span> Available for Instant Registration
          </span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
    `;

    tlds.forEach(t => {
      const price = curr === 'USD' ? t.usd : t.inr;
      html += `
        <div style="border:1px solid #E2E8F0; border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; background:#F8FAFC; transition:all 0.15s;" onmouseover="this.style.borderColor='#9BCB44';this.style.background='#FFFFFF'" onmouseout="this.style.borderColor='#E2E8F0';this.style.background='#F8FAFC'">
          <div>
            <div style="font-size:1.1rem; font-weight:700; color:#0F172A;">${query}<span style="color:#10708A;">${t.ext}</span></div>
            <div style="font-size:0.8rem; color:#64748B; margin-top:2px;">
              ${t.badge ? `<span style="background:#FFF9D6; color:#A2700C; font-weight:700; padding:2px 6px; border-radius:4px; margin-right:6px;">${t.badge}</span>` : ''}
              Free DNS &amp; Mail Forwarding included
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.2rem; font-weight:800; color:#0F172A; font-family:'Outfit',sans-serif;">${symbol}${price}<span style="font-size:0.75rem; color:#64748B; font-weight:500;">/yr</span></div>
            <button class="btn btn-sm btn-primary toast-trigger" style="margin-top:6px;" data-toast="Added ${query}${t.ext} to your cart!">Select</button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    resultsBox.innerHTML = html;
    initToastTriggers();
    resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ==========================================================================
     6. Interactive Stack Builder (Cart Configurator)
     ========================================================================== */
  let stackConfig = {
    domain: { selected: true, name: '.com Domain Registration', usd: 12.99, inr: 1099 },
    hosting: { selected: true, name: 'Linux cPanel Shared Hosting (Starter)', usd: 29.88, inr: 2490 }, // Annual
    email: { selected: false, name: 'Business Email (5 GB Mailbox)', usd: 9.99, inr: 799 },
    ssl: { selected: true, name: 'Sectigo PositiveSSL Certificate', usd: 0.00, inr: 0 } // Free with hosting
  };

  function initStackBuilder() {
    const cards = document.querySelectorAll('.stack-option-card');
    if (!cards.length) return;

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const itemKey = card.dataset.stackKey;
        if (!itemKey || !stackConfig[itemKey]) return;

        stackConfig[itemKey].selected = !stackConfig[itemKey].selected;
        card.classList.toggle('selected', stackConfig[itemKey].selected);
        updateStackTotal();
      });
    });

    updateStackTotal();
  }

  function updateStackTotal() {
    const listEl = document.querySelector('#stack-summary-list');
    const totalEl = document.querySelector('#stack-total-amount');
    const currEl = document.querySelector('#stack-total-curr');
    if (!listEl || !totalEl) return;

    const curr = currentCurrency;
    const symbol = curr === 'USD' ? '$' : '₹';
    let total = 0;
    let itemsHtml = '';

    Object.keys(stackConfig).forEach(key => {
      const item = stackConfig[key];
      if (item.selected) {
        const price = curr === 'USD' ? item.usd : item.inr;
        total += price;
        itemsHtml += `
          <li class="stack-summary-item">
            <span>${item.name}</span>
            <span class="mono" style="font-weight:700; color:#FFFFFF;">${price === 0 ? '<span style="color:#9BCB44">FREE</span>' : symbol + price.toFixed(curr === 'USD' ? 2 : 0)}</span>
          </li>
        `;
      }
    });

    if (!itemsHtml) {
      itemsHtml = '<li class="stack-summary-item" style="color:#94A3B8;">No components selected. Click options on the left to build your cloud stack.</li>';
    }

    listEl.innerHTML = itemsHtml;
    if (currEl) currEl.textContent = symbol;
    totalEl.textContent = total.toFixed(curr === 'USD' ? 2 : 0);
  }

  /* ==========================================================================
     7. FAQ Accordion
     ========================================================================== */
  function initFaqAccordion() {
    const questions = document.querySelectorAll('.faq-question');
    if (!questions.length) return;

    questions.forEach(q => {
      q.addEventListener('click', () => {
        const item = q.closest('.faq-item');
        const isActive = item.classList.contains('active');

        // Close other items
        document.querySelectorAll('.faq-item').forEach(other => {
          if (other !== item) other.classList.remove('active');
        });

        // Toggle current item
        item.classList.toggle('active', !isActive);
      });
    });
  }

  /* ==========================================================================
     8. Toast Notification Triggers
     ========================================================================== */
  function initToastTriggers() {
    document.querySelectorAll('.toast-trigger').forEach(btn => {
      if (btn._toastBound) return;
      btn._toastBound = true;
      btn.addEventListener('click', (e) => {
        const msg = btn.dataset.toast || 'Item added to cart! Proceeding to configuration...';
        showToast(msg);
      });
    });
  }

  function showToast(text) {
    let toast = document.querySelector('.toast-msg');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast-msg';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="color:#9BCB44; flex-shrink:0;">
        <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z" fill="currentColor"/>
      </svg>
      <span>${text}</span>
    `;

    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Export helpers for page scripts
  window.Hostmattic = {
    showToast,
    applyCurrency,
    currentCurrency: () => currentCurrency
  };

})();
