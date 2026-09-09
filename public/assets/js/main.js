/**
 * REINATUS - SUPER POTEN MAX AFRICANO
 * Interactions & Conversion Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initWhatsApp();
  initPricingTabs();
  initFaqAccordion();
  initMobileStickyBar();
  initCountdownTimer();
  initSmoothScroll();
});

/* ==========================================================================
   WHATSAPP CONCIERGE INTEGRATION
   ========================================================================== */
function initWhatsApp() {
  const defaultUrl = "https://api.whatsapp.com/send/?phone=5511954876473&text=Ol%C3%A1%2C+vim+atrav%C3%A9s+da+p%C3%A1gina+e+gostaria+de+mais+informa%C3%A7%C3%B5es&type=phone_number&app_absent=0";
  
  window.openWhatsApp = function(customMsg) {
    if (customMsg) {
      const url = `https://api.whatsapp.com/send/?phone=5511954876473&text=${encodeURIComponent(customMsg)}&type=phone_number&app_absent=0`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(defaultUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const waButtons = document.querySelectorAll('[data-action="whatsapp"]');
  waButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const customMsg = btn.getAttribute('data-whatsapp-msg');
      window.openWhatsApp(customMsg);
    });
  });
}

/* ==========================================================================
   PRICING TABS (COMBOS vs KITS INDIVIDUAIS)
   ========================================================================== */
function initPricingTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const kitCards = document.querySelectorAll('.kit-card');

  if (!tabButtons.length) return;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetCategory = btn.getAttribute('data-tab');

      kitCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        if (targetCategory === 'all' || cardCategory === targetCategory) {
          card.style.display = 'flex';
          card.style.animation = 'fadeIn 0.4s ease';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   FAQ ACCORDION
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });

      // Toggle current
      if (isActive) {
        item.classList.remove('active');
      } else {
        item.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   MOBILE STICKY CONVERSION BAR
   ========================================================================== */
function initMobileStickyBar() {
  const stickyBar = document.querySelector('.mobile-sticky-bar');
  const heroSection = document.querySelector('.hero-section');

  if (!stickyBar || !heroSection) return;

  window.addEventListener('scroll', () => {
    const heroBottom = heroSection.getBoundingClientRect().bottom;
    
    // Reveal bar after user scrolls past hero section
    if (heroBottom < 0) {
      stickyBar.classList.add('visible');
    } else {
      stickyBar.classList.remove('visible');
    }
  }, { passive: true });
}

/* ==========================================================================
   URGENCY COUNTDOWN TIMER (EXPIRING TODAY)
   ========================================================================== */
function initCountdownTimer() {
  const timerElements = document.querySelectorAll('.urgency-timer');
  if (!timerElements.length) return;

  // Calculates time until end of current day (23:59:59)
  function updateTimer() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);

    const diff = midnight - now;
    if (diff <= 0) return;

    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const formatted = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

    timerElements.forEach(el => {
      el.textContent = formatted;
    });
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

/* ==========================================================================
   SMOOTH SCROLL NAVIGATION
   ========================================================================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}
