const { contextBridge, ipcRenderer } = require('electron');

console.log('✅ PRELOAD CARREGADO!');

contextBridge.exposeInMainWorld('electron', {
    salvarArquivo: (pasta, nome, dados) => ipcRenderer.invoke('salvar-arquivo', pasta, nome, dados),
    lerArquivo: (caminho) => ipcRenderer.invoke('ler-arquivo', caminho),
    abrirPasta: (caminho) => ipcRenderer.invoke('abrir-pasta', caminho),
    getBackupPath: () => ipcRenderer.invoke('get-backup-path'),
    configLer: () => ipcRenderer.invoke('config-ler'),
    configSalvar: (config) => ipcRenderer.invoke('config-salvar', config),
    configTestar: (caminho) => ipcRenderer.invoke('config-testar', caminho),
    abrirWhatsAppDesktop: (url) => ipcRenderer.invoke('abrir-whatsapp-desktop', url),
    listarFotos: (os) => ipcRenderer.invoke('listar-fotos', os),
    salvarFoto: (os, dados) => ipcRenderer.invoke('salvar-foto', os, dados),
    deletarFoto: (os, nome) => ipcRenderer.invoke('deletar-foto', os, nome),
    abrirPastaAnexos: (os) => ipcRenderer.invoke('abrir-pasta-anexos', os),
    supabaseLogin: (email, password) => ipcRenderer.invoke('supabase-login', email, password),
    supabaseLogout: () => ipcRenderer.invoke('supabase-logout'),
    supabaseStatus: () => ipcRenderer.invoke('supabase-status'),
    supabaseCrud: (operacao, colecao, payload) => ipcRenderer.invoke('supabase-crud', operacao, colecao, payload),
    verificarAtualizacao: () => ipcRenderer.invoke('atualizacao-verificar'),
    baixarAtualizacao: () => ipcRenderer.invoke('atualizacao-baixar'),
    instalarAtualizacao: () => ipcRenderer.invoke('atualizacao-instalar'),
    onAtualizacao: (callback) => ipcRenderer.on('atualizacao-status', (event, dados) => callback(dados)),
});

console.log('✅ Electron API exposta em window.electron');
