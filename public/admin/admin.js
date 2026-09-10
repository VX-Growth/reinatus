/**
 * REINATUS ADMIN DASHBOARD - CLIENT CONTROLLER
 */

(function () {
  'use strict';

  let currentPeriod = 'today';
  let currentUser = null;

  // DOM Elements
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // Init Application
  document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    initNavigation();
    initPeriodSelector();
    initMetaHandlers();
    initUserHandlers();
  });

  // ========================================================================
  // 1. AUTHENTICATION & SESSION
  // ========================================================================
  async function checkSession() {
    try {
      const res = await fetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        renderLoggedInState();
      } else {
        renderLoggedOutState();
      }
    } catch (err) {
      renderLoggedOutState();
    }
  }

  function renderLoggedInState() {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');

    if (currentUser) {
      document.getElementById('current-user-name').textContent = currentUser.name || currentUser.email;
      document.getElementById('current-user-role').textContent = currentUser.role || 'Admin';
      document.getElementById('current-user-avatar').textContent = (currentUser.name || 'A').charAt(0).toUpperCase();
    }

    loadCurrentTabData();
  }

  function renderLoggedOutState() {
    currentUser = null;
    dashboardView.classList.add('hidden');
    loginView.classList.remove('hidden');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    loginBtn.querySelector('.btn-text').classList.add('hidden');
    loginBtn.querySelector('.btn-spinner').classList.remove('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        currentUser = data.user;
        renderLoggedInState();
      } else {
        loginError.textContent = data.error || 'Credenciais inválidas. Verifique seu e-mail e senha.';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Erro de comunicação com o servidor. Tente novamente.';
      loginError.classList.remove('hidden');
    } finally {
      loginBtn.querySelector('.btn-text').classList.remove('hidden');
      loginBtn.querySelector('.btn-spinner').classList.add('hidden');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    renderLoggedOutState();
  });

  // ========================================================================
  // 2. NAVIGATION & TABS
  // ========================================================================
  function initNavigation() {
    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach((link) => {
      link.addEventListener('click', () => {
        tabLinks.forEach((l) => l.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

        link.classList.add('active');
        const targetId = link.getAttribute('data-target');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');

        loadCurrentTabData();
      });
    });
  }

  function initPeriodSelector() {
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        periodButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.getAttribute('data-period');
        loadCurrentTabData();
      });
    });
  }

  function loadCurrentTabData() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;

    if (activeTab.id === 'tab-overview') loadOverview();
    if (activeTab.id === 'tab-products') loadProducts();
    if (activeTab.id === 'tab-heatmap') loadHeatmap();
    if (activeTab.id === 'tab-meta') loadMetaSettings();
    if (activeTab.id === 'tab-users') loadUsers();
  }

  // Helper formatting
  function formatMoney(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ========================================================================
  // 3. OVERVIEW TAB
  // ========================================================================
  async function loadOverview() {
    try {
      const [overviewRes, trafficRes] = await Promise.all([
        fetch(`/api/admin/analytics/overview?period=${currentPeriod}`),
        fetch(`/api/admin/analytics/traffic?period=${currentPeriod}`),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        document.getElementById('kpi-pageviews').textContent = (data.pageviews || 0).toLocaleString('pt-BR');
        document.getElementById('kpi-visitors').textContent = (data.uniqueVisitors || 0).toLocaleString('pt-BR');
        document.getElementById('kpi-checkout-clicks').textContent = (data.checkoutClicks || 0).toLocaleString('pt-BR');
        document.getElementById('kpi-conv-rate').textContent = (data.conversionRate || 0) + '%';
        document.getElementById('kpi-checkout-value').textContent = formatMoney(data.totalCheckoutValue);
      }

      if (trafficRes.ok) {
        const traffic = await trafficRes.json();
        const devices = traffic.devices || { Mobile: 0, Desktop: 0, Tablet: 0 };
        const totalDev = (devices.Mobile || 0) + (devices.Desktop || 0) + (devices.Tablet || 0) || 1;

        const mobPct = Math.round(((devices.Mobile || 0) / totalDev) * 100);
        const dskPct = Math.round(((devices.Desktop || 0) / totalDev) * 100);
        const tabPct = Math.round(((devices.Tablet || 0) / totalDev) * 100);

        document.getElementById('dev-mobile-pct').textContent = `${mobPct}% (${devices.Mobile || 0})`;
        document.getElementById('dev-mobile-bar').style.width = `${mobPct}%`;

        document.getElementById('dev-desktop-pct').textContent = `${dskPct}% (${devices.Desktop || 0})`;
        document.getElementById('dev-desktop-bar').style.width = `${dskPct}%`;

        document.getElementById('dev-tablet-pct').textContent = `${tabPct}% (${devices.Tablet || 0})`;
        document.getElementById('dev-tablet-bar').style.width = `${tabPct}%`;

        // Referrers
        const refList = document.getElementById('top-referrers-list');
        refList.innerHTML = '';
        if (traffic.topReferrers && traffic.topReferrers.length > 0) {
          traffic.topReferrers.forEach((r) => {
            const li = document.createElement('li');
            li.className = 'referrer-item';
            li.innerHTML = `
              <span>🌐 ${r.domain}</span>
              <strong>${r.count} acessos</strong>
            `;
            refList.appendChild(li);
          });
        } else {
          refList.innerHTML = '<li class="empty-state p-4 text-muted">Nenhum acesso registrado no período.</li>';
        }
      }
    } catch (err) {
      console.error('[ADMIN] Erro ao carregar visão geral:', err);
    }
  }

  // ========================================================================
  // 4. PRODUCTS RANKING TAB
  // ========================================================================
  async function loadProducts() {
    const tbody = document.querySelector('#products-ranking-table tbody');
    try {
      const res = await fetch(`/api/admin/analytics/products?period=${currentPeriod}`);
      if (!res.ok) return;

      const data = await res.json();
      tbody.innerHTML = '';

      if (!data.ranking || data.ranking.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-6 text-muted">Nenhum clique registrado no período.</td></tr>';
        return;
      }

      data.ranking.forEach((prod, index) => {
        const tr = document.createElement('tr');
        const posClass = index === 0 ? 'top1' : '';
        tr.innerHTML = `
          <td><span class="badge-position ${posClass}">${index + 1}º</span></td>
          <td>
            <div class="product-row-info">
              <img src="../${prod.img}" alt="${prod.name}" class="product-row-img">
              <div>
                <div class="product-row-name">${prod.name}</div>
                <div class="product-row-token">Token: ${prod.token}</div>
              </div>
            </div>
          </td>
          <td><strong>${formatMoney(prod.price)}</strong></td>
          <td><strong class="text-cyan">${prod.clicks}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${prod.share}%</span>
              <div class="progress-track" style="width: 80px;"><div class="progress-bar cyan" style="width: ${prod.share}%"></div></div>
            </div>
          </td>
          <td><strong class="text-gold">${formatMoney(prod.totalValue)}</strong></td>
          <td>
            <a href="https://rei-natus-suplementos-extrato-africano.pay.yampi.com.br/r/${prod.token}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">
              Testar Checkout ↗
            </a>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('[ADMIN] Erro ao carregar ranking de produtos:', err);
    }
  }

  // ========================================================================
  // 5. HEATMAP & CLICKS TAB
  // ========================================================================
  async function loadHeatmap() {
    const tbody = document.querySelector('#buttons-clicks-table tbody');
    try {
      const res = await fetch(`/api/admin/analytics/heatmap?period=${currentPeriod}`);
      if (!res.ok) return;

      const data = await res.json();
      tbody.innerHTML = '';

      if (!data.buttons || data.buttons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-6 text-muted">Nenhum clique registrado no período.</td></tr>';
      } else {
        data.buttons.forEach((btn) => {
          const tr = document.createElement('tr');
          let typeLabel = 'Navegação';
          let typeClass = 'text-muted';
          if (btn.event_name === 'initiate_checkout') {
            typeLabel = 'Compra (Kit)';
            typeClass = 'text-gold';
          } else if (btn.event_name === 'whatsapp_click') {
            typeLabel = 'WhatsApp';
            typeClass = 'text-emerald';
          }

          tr.innerHTML = `
            <td>
              <strong>${btn.button_label || btn.button_id}</strong>
              ${btn.product_name ? `<br><small class="text-muted">${btn.product_name}</small>` : ''}
            </td>
            <td><span class="${typeClass}" style="font-weight: 700; font-size: 0.8rem;">${typeLabel}</span></td>
            <td><strong class="text-cyan">${btn.clicks}</strong></td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Zone density calculation
      let heroClicks = 0, amostraClicks = 0, treatmentClicks = 0, kitsClicks = 0, footerClicks = 0;
      (data.buttons || []).forEach((btn) => {
        const id = (btn.button_id || '').toLowerCase();
        const lbl = (btn.button_label || '').toLowerCase();
        const prod = (btn.product_name || '').toLowerCase();

        if (id.includes('hero') || lbl.includes('mais desempenho') || id.includes('header')) {
          heroClicks += btn.clicks;
        } else if (lbl.includes('amostra') || prod.includes('amostra')) {
          amostraClicks += btn.clicks;
        } else if (lbl.includes('gotas vs') || lbl.includes('frasco gotas (r$') || lbl.includes('pote cápsulas (r$')) {
          treatmentClicks += btn.clicks;
        } else if (btn.event_name === 'initiate_checkout' || id.includes('kit') || lbl.includes('comprar')) {
          kitsClicks += btn.clicks;
        } else if (btn.event_name === 'whatsapp_click' || id.includes('whatsapp') || id.includes('footer')) {
          footerClicks += btn.clicks;
        }
      });

      document.getElementById('stat-zone-hero').textContent = `${heroClicks} cliques`;
      document.getElementById('stat-zone-amostra').textContent = `${amostraClicks} cliques`;
      document.getElementById('stat-zone-treatment').textContent = `${treatmentClicks} cliques`;
      document.getElementById('stat-zone-kits').textContent = `${kitsClicks} cliques`;
      document.getElementById('stat-zone-footer').textContent = `${footerClicks} cliques`;

      // Highlight hottest section
      const sections = [
        { el: document.querySelector('.mockup-section.hero'), clicks: heroClicks },
        { el: document.querySelector('.mockup-section.sample'), clicks: amostraClicks },
        { el: document.querySelector('.mockup-section.treatment'), clicks: treatmentClicks },
        { el: document.querySelector('.mockup-section.kits'), clicks: kitsClicks },
        { el: document.querySelector('.mockup-section.footer'), clicks: footerClicks },
      ];
      sections.forEach((s) => s.el.classList.remove('hot'));
      const maxClicks = Math.max(...sections.map((s) => s.clicks));
      if (maxClicks > 0) {
        sections.find((s) => s.clicks === maxClicks)?.el.classList.add('hot');
      }
    } catch (err) {
      console.error('[ADMIN] Erro ao carregar mapa de calor:', err);
    }
  }

  // ========================================================================
  // 6. META ADS TAB
  // ========================================================================
  function initMetaHandlers() {
    const metaForm = document.getElementById('meta-form');
    const testBtn = document.getElementById('meta-test-btn');
    const saveAlert = document.getElementById('meta-save-alert');
    const errorAlert = document.getElementById('meta-error-alert');

    metaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      saveAlert.classList.add('hidden');
      errorAlert.classList.add('hidden');

      const payload = {
        pixel_id: document.getElementById('meta-pixel-id').value.trim(),
        access_token: document.getElementById('meta-access-token').value.trim(),
        test_event_code: document.getElementById('meta-test-code').value.trim(),
        is_active: document.getElementById('meta-is-active').checked,
      };

      try {
        const res = await fetch('/api/admin/settings/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          saveAlert.textContent = 'Configurações do Meta Ads salvas com sucesso!';
          saveAlert.classList.remove('hidden');
        } else {
          errorAlert.textContent = 'Erro ao salvar configurações do Meta.';
          errorAlert.classList.remove('hidden');
        }
      } catch (err) {
        errorAlert.textContent = 'Falha ao comunicar com o servidor.';
        errorAlert.classList.remove('hidden');
      }
    });

    testBtn.addEventListener('click', async () => {
      saveAlert.classList.add('hidden');
      errorAlert.classList.add('hidden');
      testBtn.disabled = true;
      testBtn.textContent = 'Disparando Teste...';

      const payload = {
        pixel_id: document.getElementById('meta-pixel-id').value.trim(),
        access_token: document.getElementById('meta-access-token').value.trim(),
        test_event_code: document.getElementById('meta-test-code').value.trim(),
      };

      try {
        const res = await fetch('/api/admin/settings/meta/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          saveAlert.textContent = `✓ Sucesso! O evento de teste foi aceito pela Meta (Status: ${data.status}). Verifique a aba 'Testar Eventos' no Gerenciador.`;
          saveAlert.classList.remove('hidden');
        } else {
          errorAlert.textContent = `Falha no teste: ${data.error || 'Credenciais inválidas'}`;
          errorAlert.classList.remove('hidden');
        }
      } catch (err) {
        errorAlert.textContent = 'Erro ao disparar evento de teste para a Meta.';
        errorAlert.classList.remove('hidden');
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Testar Conexão com Meta';
      }
    });
  }

  async function loadMetaSettings() {
    try {
      const res = await fetch('/api/admin/settings/meta');
      if (res.ok) {
        const data = await res.json();
        document.getElementById('meta-pixel-id').value = data.pixel_id || '';
        document.getElementById('meta-access-token').value = data.access_token || '';
        document.getElementById('meta-test-code').value = data.test_event_code || '';
        document.getElementById('meta-is-active').checked = !!data.is_active;
      }
    } catch (err) {
      console.error('[ADMIN] Erro ao carregar configurações Meta:', err);
    }
  }

  // ========================================================================
  // 7. USER MANAGEMENT TAB
  // ========================================================================
  function initUserHandlers() {
    const modal = document.getElementById('user-modal');
    const modalForm = document.getElementById('user-modal-form');
    const modalClose = document.getElementById('modal-user-close');
    const modalCancel = document.getElementById('modal-user-cancel');
    const addBtn = document.getElementById('add-user-btn');
    const modalError = document.getElementById('modal-user-error');

    function closeModal() {
      modal.classList.add('hidden');
      modalError.classList.add('hidden');
      modalForm.reset();
      document.getElementById('modal-user-id').value = '';
    }

    addBtn.addEventListener('click', () => {
      document.getElementById('modal-user-title').textContent = 'Adicionar Novo Administrador';
      document.getElementById('modal-password-label').textContent = 'Senha *';
      document.getElementById('modal-password').required = true;
      document.getElementById('modal-password-hint').textContent = 'Mínimo de 6 caracteres.';
      document.getElementById('modal-user-id').value = '';
      modal.classList.remove('hidden');
    });

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);

    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      modalError.classList.add('hidden');

      const id = document.getElementById('modal-user-id').value;
      const name = document.getElementById('modal-name').value.trim();
      const email = document.getElementById('modal-email').value.trim();
      const password = document.getElementById('modal-password').value;
      const role = document.getElementById('modal-role').value;

      const isEdit = !!id;
      const url = isEdit ? `/api/admin/users/${id}` : '/api/admin/users';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role }),
        });

        const data = await res.json();
        if (res.ok) {
          closeModal();
          loadUsers();
        } else {
          modalError.textContent = data.error || 'Erro ao salvar usuário.';
          modalError.classList.remove('hidden');
        }
      } catch (err) {
        modalError.textContent = 'Erro ao comunicar com o servidor.';
        modalError.classList.remove('hidden');
      }
    });
  }

  async function loadUsers() {
    const tbody = document.querySelector('#users-table tbody');
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) return;

      const data = await res.json();
      tbody.innerHTML = '';

      if (!data.users || data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-6 text-muted">Nenhum usuário cadastrado.</td></tr>';
        return;
      }

      data.users.forEach((u) => {
        const tr = document.createElement('tr');
        const isSelf = currentUser && currentUser.id === u.id;
        const lastLoginStr = u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca';

        tr.innerHTML = `
          <td><strong>#${u.id}</strong></td>
          <td><strong>${u.name}</strong> ${isSelf ? '<span class="brand-tag">Você</span>' : ''}</td>
          <td>${u.email}</td>
          <td><span class="text-cyan font-bold" style="text-transform: capitalize;">${u.role}</span></td>
          <td>${lastLoginStr}</td>
          <td>
            <button class="btn btn-secondary btn-sm edit-user-btn" data-id="${u.id}" data-name="${u.name}" data-email="${u.email}" data-role="${u.role}">
              Editar
            </button>
            ${
              !isSelf
                ? `<button class="btn btn-secondary btn-sm delete-user-btn" data-id="${u.id}" data-name="${u.name}" style="color: var(--red); margin-left: 0.35rem;">Excluir</button>`
                : ''
            }
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind edit and delete handlers
      document.querySelectorAll('.edit-user-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          const email = btn.getAttribute('data-email');
          const role = btn.getAttribute('data-role');

          document.getElementById('modal-user-id').value = id;
          document.getElementById('modal-name').value = name;
          document.getElementById('modal-email').value = email;
          document.getElementById('modal-role').value = role;

          document.getElementById('modal-user-title').textContent = 'Editar Administrador';
          document.getElementById('modal-password-label').textContent = 'Nova Senha (opcional)';
          document.getElementById('modal-password').required = false;
          document.getElementById('modal-password-hint').textContent = 'Deixe em branco para manter a senha atual.';

          document.getElementById('user-modal').classList.remove('hidden');
        });
      });

      document.querySelectorAll('.delete-user-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          if (confirm(`Tem certeza que deseja excluir o administrador "${name}"?`)) {
            try {
              const delRes = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
              if (delRes.ok) {
                loadUsers();
              } else {
                const errData = await delRes.json();
                alert(errData.error || 'Erro ao excluir usuário.');
              }
            } catch (e) {
              alert('Erro de conexão ao excluir.');
            }
          }
        });
      });
    } catch (err) {
      console.error('[ADMIN] Erro ao carregar usuários:', err);
    }
  }
})();
