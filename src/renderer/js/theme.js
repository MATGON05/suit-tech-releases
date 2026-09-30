/* Shared theme controller. It is intentionally scoped to the current page. */
(function () {
  const storageKey = 'suittech-theme';
  const savedTheme = localStorage.getItem(storageKey);
  const theme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';

  function aplicarTema(valor) {
    document.documentElement.setAttribute('data-theme', valor);
    document.body?.classList.add('theme-ready');
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const light = valor === 'light';
    button.textContent = light ? '🌙 Tema escuro' : '☀️ Tema claro';
    button.setAttribute('aria-pressed', String(light));
    button.setAttribute('aria-label', light ? 'Mudar para tema escuro' : 'Mudar para tema claro');
  }

  document.documentElement.setAttribute('data-theme', theme);

  function inicializarTema() {
    aplicarTema(document.documentElement.getAttribute('data-theme') || theme);
    const pagina = window.location.pathname.split('/').pop().toLowerCase();
    const permiteAlternancia = pagina === 'login.html' || pagina === 'index.html';
    const container = document.getElementById('theme-toggle-container');
    if (permiteAlternancia && container && !document.getElementById('theme-toggle')) {
      const button = document.createElement('button');
      button.id = 'theme-toggle';
      button.type = 'button';
      button.className = 'theme-toggle-button';
      button.addEventListener('click', function () {
        const novoTema = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        localStorage.setItem(storageKey, novoTema);
        aplicarTema(novoTema);
      });
      container.appendChild(button);
    }
    aplicarTema(document.documentElement.getAttribute('data-theme') || theme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTema);
  } else {
    inicializarTema();
  }
})();
