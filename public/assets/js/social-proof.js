/**
 * REINATUS - SOCIAL PROOF RECENT PURCHASES POPUP (PROVA SOCIAL AO VIVO)
 */

(function () {
  'use strict';

  // 1. Realistic Customer List (approx. 35 Brazilian customers)
  const customers = [
    { name: 'Renato Gomes Pereira', city: 'São Paulo, SP' },
    { name: 'Jorge e Mateus Cristiano', city: 'Curitiba, PR' },
    { name: 'Carlos Eduardo Silveira', city: 'Belo Horizonte, MG' },
    { name: 'Marcos Vinicius Ribeiro', city: 'Rio de Janeiro, RJ' },
    { name: 'Antônio Marcos de Oliveira', city: 'Campinas, SP' },
    { name: 'José Roberto de Souza', city: 'Porto Alegre, RS' },
    { name: 'Marcelo Fernando Barbosa', city: 'Goiânia, GO' },
    { name: 'Rodrigo Alves Figueiredo', city: 'Brasília, DF' },
    { name: 'Paulo Henrique Guimarães', city: 'Salvador, BA' },
    { name: 'Cláudio Márcio Nogueira', city: 'Fortaleza, CE' },
    { name: 'Eduardo Fagundes Lima', city: 'Florianópolis, SC' },
    { name: 'Fernando César Duarte', city: 'Santos, SP' },
    { name: 'Alexandre Ramos de Castro', city: 'Recife, PE' },
    { name: 'Ricardo Valente Siqueira', city: 'Manaus, AM' },
    { name: 'Fábio Rogério Albuquerque', city: 'Vitória, ES' },
    { name: 'André Luiz Pimentel', city: 'Ribeirão Preto, SP' },
    { name: 'Wilson Ferreira Mendes', city: 'Londrina, PR' },
    { name: 'Gilberto Prado Vasconcelos', city: 'Joinville, SC' },
    { name: 'Rogério Magalhães Cruz', city: 'Sorocaba, SP' },
    { name: 'Valmir dos Santos Cunha', city: 'Uberlândia, MG' },
    { name: 'Sérgio Murilo Brandão', city: 'Belém, PA' },
    { name: 'Luiz Carlos Evangelista', city: 'Natal, RN' },
    { name: 'Mauro Sérgio Bittencourt', city: 'Niterói, RJ' },
    { name: 'Wagner Silvério Matos', city: 'São José dos Campos, SP' },
    { name: 'Emerson Tavares Meireles', city: 'Cuiabá, MT' },
    { name: 'Robson Batista Carvalho', city: 'Campo Grande, MS' },
    { name: 'Leandro Garcia Toledo', city: 'Maceió, AL' },
    { name: 'César Augusto Medeiros', city: 'Caxias do Sul, RS' },
    { name: 'Gustavo Henrique Amaral', city: 'Juiz de Fora, MG' },
    { name: 'Francisco Assis Fontenele', city: 'João Pessoa, PB' },
    { name: 'Juliano César Fontana', city: 'Blumenau, SC' },
    { name: 'Marcio Aurélio Peixoto', city: 'Bauru, SP' },
    { name: 'Otávio Henrique Rezende', city: 'Uberaba, MG' },
    { name: 'Reinaldo Pinheiro Prado', city: 'Pelotas, RS' },
    { name: 'Valter Miranda Barreto', city: 'Aracaju, SE' },
  ];

  // 2. Products Catalog with Images & Labels
  const products = [
    { title: 'Combo com 2 Kits', badge: 'Mais Vendido', img: 'assets/images/kit-combo-2-bestseller.webp' },
    { title: 'Combo com 3 Kits', badge: 'Tratamento Completo', img: 'assets/images/kit-combo-3.webp' },
    { title: 'Combo com 1 Kit', badge: 'Gotas + Cápsulas', img: 'assets/images/kit-combo-1.webp' },
    { title: 'Combo com 2 Kits', badge: 'Mais Vendido', img: 'assets/images/kit-combo-2-bestseller.webp' },
    { title: 'Pote 30 Cápsulas 500mg', badge: 'Fórmula Africana', img: 'assets/images/kit-2-capsulas.webp' },
    { title: 'Frasco Líquido 30ml', badge: 'Gotas Sublinguais', img: 'assets/images/kit-1-gotas.webp' },
    { title: 'Amostra Grátis', badge: 'Promoção', img: 'assets/images/hero-sample-promo.png' },
    { title: 'Combo Máximo com 6 Kits', badge: 'Tratamento Anual', img: 'assets/images/kit-combo-6.webp' },
  ];

  const timeAgoToDisplay = [
    'há 2 minutos',
    'há 3 minutos',
    'há 4 minutos',
    'há 6 minutos',
    'há 8 minutos',
    'há 11 minutos',
    'há poucos instantes',
  ];

  let currentIndex = 0;
  let isPaused = false;
  let toastEl = null;

  // Shuffle array slightly so every visitor gets a fresh order
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Create DOM Elements
  function createToastContainer() {
    let container = document.getElementById('social-proof-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'social-proof-toast-container';
      container.className = 'social-proof-container';
      document.body.appendChild(container);
    }

    toastEl = document.createElement('div');
    toastEl.className = 'social-proof-toast';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'polite');

    toastEl.innerHTML = `
      <div class="social-proof-avatar-wrap">
        <div class="social-proof-avatar">
          <img id="sp-img" src="assets/images/kit-combo-2-bestseller.webp" alt="Produto Super Poten Max">
        </div>
        <div class="social-proof-verified-badge" title="Compra 100% Verificada">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
      </div>
      <div class="social-proof-content">
        <div class="social-proof-header">
          <span class="social-proof-name" id="sp-name">Renato Gomes Pereira</span>
          <span class="social-proof-status">Compra aprovada</span>
        </div>
        <div class="social-proof-product" id="sp-product">
          Comprou: <strong>Combo com 2 Kits</strong>
        </div>
        <div class="social-proof-meta">
          <span id="sp-city">São Paulo, SP</span> • <span id="sp-time">há 3 minutos</span>
        </div>
      </div>
      <button class="social-proof-close" id="sp-close" aria-label="Fechar notificação">&times;</button>
    `;

    container.appendChild(toastEl);

    // Clicking anywhere on the notification scrolls to the pricing table
    toastEl.addEventListener('click', (e) => {
      if (e.target.closest('#sp-close')) return;
      const kitsSection = document.getElementById('kits');
      if (kitsSection) {
        kitsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // Close button dismisses the current notification
    const closeBtn = document.getElementById('sp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideToast();
      });
    }

    // Pause on hover
    toastEl.addEventListener('mouseenter', () => { isPaused = true; });
    toastEl.addEventListener('mouseleave', () => { isPaused = false; });
  }

  function showNextNotification() {
    if (!toastEl) return;

    // Pick customer in sequence (loops indefinitely)
    const customer = customers[currentIndex % customers.length];
    const product = products[currentIndex % products.length];
    const timeAgo = timeAgoToDisplay[Math.floor(Math.random() * timeAgoToDisplay.length)];

    currentIndex++;

    // Update DOM
    document.getElementById('sp-name').textContent = customer.name;
    document.getElementById('sp-city').textContent = customer.city;
    document.getElementById('sp-time').textContent = timeAgo;
    document.getElementById('sp-img').src = product.img;
    document.getElementById('sp-product').innerHTML = `Comprou: <strong>${product.title}</strong>`;

    // Show toast
    toastEl.classList.add('show');

    // Keep visible for 4.5 seconds, then hide
    setTimeout(() => {
      hideToast();
    }, 4500);
  }

  function hideToast() {
    if (!toastEl) return;
    toastEl.classList.remove('show');

    // Schedule next notification after 5 to 8 seconds
    const nextInterval = Math.floor(Math.random() * 3000) + 5000;
    setTimeout(() => {
      if (!isPaused && document.visibilityState === 'visible') {
        showNextNotification();
      } else {
        // Retry slightly later if paused or tab is hidden
        setTimeout(showNextNotification, 4000);
      }
    }, nextInterval);
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    // Keep order starting with Renato Gomes Pereira and Jorge e Mateus Cristiano, shuffle remainder
    const firstTwo = customers.slice(0, 2);
    const rest = customers.slice(2);
    shuffle(rest);
    customers.length = 0;
    customers.push(...firstTwo, ...rest);

    createToastContainer();

    // First popup appears 4 seconds after visitor lands on the site
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        showNextNotification();
      }
    }, 4000);
  });
})();
