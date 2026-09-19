// carregarMenu.js - Versão corrigida (abre apenas o grupo ativo e ignora estado salvo conflitante)
(function() {
  const container = document.getElementById('menu-container');
  if (!container) {
    console.warn('⚠️ Elemento #menu-container não encontrado.');
    return;
  }
  if (container.dataset.carregado === 'true') return;

  // Detecta a pasta base onde está o HTML atual
  const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  const menuUrl = base + 'menu.html';

  console.log('📋 Carregando menu de:', menuUrl);

  fetch(menuUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(html => {
      container.innerHTML = html;
      container.dataset.carregado = 'true';

      // --- 1. Marcar item ativo ---
      const paginaAtual = window.location.pathname.split('/').pop();
      const allLinks = container.querySelectorAll('a');
      let grupoAtivo = null;
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === paginaAtual) {
          link.classList.add('active');
          // Encontra o grupo pai
          const grupo = link.closest('.menu-group');
          if (grupo) grupoAtivo = grupo;
        } else {
          link.classList.remove('active');
        }
      });

      // --- 2. Abrir APENAS o grupo que contém o link ativo ---
      const todosGrupos = container.querySelectorAll('.menu-group');
      todosGrupos.forEach(grupo => {
        const items = grupo.querySelector('.menu-group-items');
        const title = grupo.querySelector('.menu-group-title');
        // Fecha todos os grupos primeiro
        if (items) items.classList.remove('open');
        if (title) title.classList.remove('open');
      });

      // Abre o grupo ativo (se encontrado)
      if (grupoAtivo) {
        const items = grupoAtivo.querySelector('.menu-group-items');
        const title = grupoAtivo.querySelector('.menu-group-title');
        if (items) items.classList.add('open');
        if (title) title.classList.add('open');
      }

      // --- 3. Expor toggle globalmente ---
      window.toggleGroup = function(el) {
        const group = el.closest('.menu-group');
        if (!group) return;
        const items = group.querySelector('.menu-group-items');
        const title = group.querySelector('.menu-group-title');
        const estavaAberto = items?.classList.contains('open');

        // Comportamento de acordeão: fecha todos os outros grupos antes
        // de abrir o grupo clicado.
        document.querySelectorAll('.menu-group').forEach(outroGrupo => {
          const outrosItems = outroGrupo.querySelector('.menu-group-items');
          const outroTitle = outroGrupo.querySelector('.menu-group-title');
          if (outrosItems) outrosItems.classList.remove('open');
          if (outroTitle) outroTitle.classList.remove('open');
          const outraSeta = outroGrupo.querySelector('.menu-group-title .arrow');
          if (outraSeta) outraSeta.classList.remove('open');
        });

        // Se o grupo já estava aberto, o clique apenas o fecha.
        if (!estavaAberto && items) {
          items.classList.add('open');
          if (title) title.classList.add('open');
          const seta = title?.querySelector('.arrow');
          if (seta) seta.classList.add('open');
        }
        // Salva estado no localStorage para futuras interações manuais
        const estado = {};
        document.querySelectorAll('.menu-group').forEach(g => {
          const titulo = g.querySelector('.menu-group-title span')?.textContent || '';
          const aberto = g.querySelector('.menu-group-items')?.classList.contains('open');
          estado[titulo] = aberto;
        });
        localStorage.setItem('menu_groups_state', JSON.stringify(estado));
      };

      // --- 4. Forçar estado consistente: apenas o grupo ativo fica aberto ---
      // Isso substitui qualquer estado salvo anterior, garantindo que ao carregar
      // qualquer página, somente o grupo que contém o link ativo seja expandido.
      // Os demais grupos permanecem fechados, evitando o problema de todos abertos.
      try {
        const estadoNovo = {};
        document.querySelectorAll('.menu-group').forEach(g => {
          const titulo = g.querySelector('.menu-group-title span')?.textContent || '';
          // Define como true apenas se for o grupo ativo
          estadoNovo[titulo] = (g === grupoAtivo);
        });
        localStorage.setItem('menu_groups_state', JSON.stringify(estadoNovo));
      } catch (e) {
        console.warn('Não foi possível salvar o estado do menu:', e);
      }

    })
    .catch(error => {
      console.error('❌ Erro ao carregar menu:', error);
      container.innerHTML = `
        <nav style="padding: 10px;">
          <a href="#" style="color: #ef4444; text-decoration: none; display: block; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
            ⚠️ Menu não carregado. Verifique o console.
          </a>
        </nav>
      `;
    });
})();
