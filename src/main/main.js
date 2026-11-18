const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { autoUpdater } = require('electron-updater');
const WebSocket = require('ws');

// Chave publishable: pode estar no aplicativo quando o RLS estiver configurado.
// Nunca coloque aqui a Secret key/service_role.
const SUPABASE_URL = 'https://wnljexozjqoellagscwb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Y7O2kWhRhPs9fWf4jEHN0w_-SrS36j3';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { transport: WebSocket }
});
let supabaseUser = null;
let supabaseWorkspaceId = null;
let mainWindow = null;

function enviarStatusAtualizacao(status, dados = {}) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('atualizacao-status', { status, ...dados });
}

function configurarAtualizador() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => enviarStatusAtualizacao('verificando'));
    autoUpdater.on('update-available', info => enviarStatusAtualizacao('disponivel', { versao: info.version }));
    autoUpdater.on('update-not-available', info => enviarStatusAtualizacao('atualizado', { versao: info.version }));
    autoUpdater.on('download-progress', progress => enviarStatusAtualizacao('baixando', { percentual: Math.round(progress.percent), velocidade: progress.bytesPerSecond }));
    autoUpdater.on('update-downloaded', info => enviarStatusAtualizacao('baixado', { versao: info.version }));
    autoUpdater.on('error', error => enviarStatusAtualizacao('erro', { mensagem: error.message }));
}

ipcMain.handle('atualizacao-verificar', async () => {
    if (!app.isPackaged) return { sucesso: false, ambiente: 'desenvolvimento', mensagem: 'Atualizações só funcionam na versão instalada.' };
    try {
        const resultado = await autoUpdater.checkForUpdates();
        return { sucesso: true, versaoAtual: app.getVersion(), versaoNova: resultado?.updateInfo?.version || null };
    } catch (error) { return { sucesso: false, erro: error.message }; }
});
ipcMain.handle('atualizacao-baixar', async () => {
    try { await autoUpdater.downloadUpdate(); return { sucesso: true }; }
    catch (error) { return { sucesso: false, erro: error.message }; }
});
ipcMain.handle('atualizacao-instalar', async () => {
    if (!app.isPackaged) return { sucesso: false, erro: 'Instalação disponível apenas na versão instalada.' };
    autoUpdater.quitAndInstall(false, true);
    return { sucesso: true };
});


function remoteRecord(row) {
    const dados = row && row.data && typeof row.data === 'object' ? { ...row.data } : {};
    if (!dados._id) dados._id = row.legacy_id;
    return dados;
}

async function getWorkspaceForUser(userId) {
    const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id,role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Usuário sem workspace vinculado no Supabase.');
    return { id: data.workspace_id, role: data.role || 'user' };
}

async function remoteBuscar(colecao) {
    if (!supabaseUser || !supabaseWorkspaceId) return null;
    const { data, error } = await supabase
        .from('records')
        .select('legacy_id,data')
        .eq('workspace_id', supabaseWorkspaceId)
        .eq('collection', colecao)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(remoteRecord);
}

async function remoteSalvar(colecao, dados) {
    if (!supabaseUser || !supabaseWorkspaceId) return null;
    const lista = Array.isArray(dados) ? dados : [dados];
    const linhas = lista.map(item => {
        const registro = { ...(item || {}) };
        if (!registro._id) registro._id = 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        if (!registro.data_criacao) registro.data_criacao = new Date().toISOString();
        return {
            workspace_id: supabaseWorkspaceId,
            collection: colecao,
            legacy_id: String(registro._id),
            data: registro,
            created_by: supabaseUser.id
        };
    });
    const { data, error } = await supabase
        .from('records')
        .upsert(linhas, { onConflict: 'workspace_id,collection,legacy_id' })
        .select('legacy_id,data');
    if (error) throw error;
    return Array.isArray(dados) ? (data || []).map(remoteRecord) : remoteRecord((data || [])[0] || linhas[0]);
}

async function remoteAtualizar(colecao, id, dados) {
    if (!supabaseUser || !supabaseWorkspaceId) return null;
    const registro = { ...(dados || {}), _id: id, data_atualizacao: new Date().toISOString() };
    const { data, error } = await supabase
        .from('records')
        .update({ data: registro, created_by: supabaseUser.id })
        .eq('workspace_id', supabaseWorkspaceId)
        .eq('collection', colecao)
        .eq('legacy_id', String(id))
        .select('legacy_id,data')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Item não encontrado no Supabase.');
    return remoteRecord(data);
}

async function remoteDeletar(colecao, id) {
    if (!supabaseUser || !supabaseWorkspaceId) return null;
    const { error } = await supabase
        .from('records')
        .delete()
        .eq('workspace_id', supabaseWorkspaceId)
        .eq('collection', colecao)
        .eq('legacy_id', String(id));
    if (error) throw error;
    return true;
}

ipcMain.handle('supabase-login', async (event, email, password) => {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        supabaseUser = data.user;
        const workspace = await getWorkspaceForUser(supabaseUser.id);
        supabaseWorkspaceId = workspace.id;
        return {
            sucesso: true,
            usuario: { id: supabaseUser.id, email: supabaseUser.email },
            workspaceId: supabaseWorkspaceId,
            workspaceRole: workspace.role
        };
    } catch (error) {
        supabaseUser = null;
        supabaseWorkspaceId = null;
        await supabase.auth.signOut().catch(() => {});
        return { sucesso: false, erro: error.message };
    }
});

ipcMain.handle('supabase-logout', async () => {
    await supabase.auth.signOut().catch(() => {});
    supabaseUser = null;
    supabaseWorkspaceId = null;
    return { sucesso: true };
});

ipcMain.handle('supabase-status', async () => ({
    configurado: true,
    autenticado: !!supabaseUser,
    workspaceId: supabaseWorkspaceId
}));

ipcMain.handle('supabase-crud', async (event, operacao, colecao, payload) => {
    try {
        if (!supabaseUser || !supabaseWorkspaceId) return { remoto: false };
        if (operacao === 'buscar') return { remoto: true, dados: await remoteBuscar(colecao) };
        if (operacao === 'salvar') return { remoto: true, dados: await remoteSalvar(colecao, payload) };
        if (operacao === 'atualizar') return { remoto: true, dados: await remoteAtualizar(colecao, payload.id, payload.dados) };
        if (operacao === 'deletar') return { remoto: true, dados: await remoteDeletar(colecao, payload.id) };
        return { remoto: false, erro: 'Operação desconhecida' };
    } catch (error) {
        return { remoto: true, sucesso: false, erro: error.message };
    }
});

// ============================================
// PASTA DE BACKUP (userData)
// ============================================
function getBackupDir() {
    const userData = app.getPath('userData');
    const backupDir = path.join(userData, 'backup');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
}

// ============================================
// HANDLERS IPC
// ============================================

// Salvar arquivo (backup)
ipcMain.handle('salvar-arquivo', async (event, pasta, nome, conteudo) => {
    try {
        let dir = pasta;
        if (!dir || dir === '') {
            dir = getBackupDir();
        }
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const caminhoCompleto = path.join(dir, nome);
        fs.writeFileSync(caminhoCompleto, conteudo, 'utf8');
        return { sucesso: true, caminho: caminhoCompleto };
    } catch (erro) {
        console.error('Erro ao salvar arquivo:', erro);
        return { sucesso: false, erro: erro.message };
    }
});

// LER ARQUIVO (NOVO - necessário para o modo rede)
ipcMain.handle('ler-arquivo', async (event, caminho) => {
    try {
        if (!fs.existsSync(caminho)) {
            return { sucesso: false, erro: 'Arquivo não encontrado' };
        }
        const conteudo = fs.readFileSync(caminho, 'utf8');
        return { sucesso: true, conteudo };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

// Abrir pasta no explorador
ipcMain.handle('abrir-pasta', async (event, caminho) => {
    try {
        let dir = caminho;
        if (!dir || dir === 'imagens') {
            dir = path.join(app.getPath('userData'), 'fotos');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        if (!fs.existsSync(dir)) {
            return { sucesso: false, erro: 'Pasta não encontrada' };
        }
        shell.openPath(dir);
        return { sucesso: true };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

// Configuração de rede
ipcMain.handle('config-ler', async () => {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        if (fs.existsSync(configPath)) {
            const dados = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return { sucesso: true, dados };
        } else {
            return { sucesso: true, dados: { modo: 'local', caminhoRede: '' } };
        }
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

ipcMain.handle('config-salvar', async (event, config) => {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return { sucesso: true };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

ipcMain.handle('config-testar', async (event, caminho) => {
    try {
        if (!caminho) throw new Error('Caminho vazio');
        if (fs.existsSync(caminho)) {
            return { sucesso: true, mensagem: 'Caminho acessível' };
        } else {
            return { sucesso: false, erro: 'Caminho não encontrado' };
        }
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

ipcMain.handle('get-backup-path', async () => {
    return getBackupDir();
});

// ============================================
// FUNÇÕES PARA FOTOS (ANEXOS)
// ============================================
function getFotosDir(os) {
    const base = path.join(app.getPath('userData'), 'fotos', os);
    if (!fs.existsSync(base)) {
        fs.mkdirSync(base, { recursive: true });
    }
    return base;
}

ipcMain.handle('listar-fotos', async (event, os) => {
    try {
        const dir = getFotosDir(os);
        const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif|bmp)$/i.test(f));
        const fotos = files.map(f => ({
            nome: f,
            caminho: path.join(dir, f),
            data: fs.statSync(path.join(dir, f)).mtime.toISOString()
        }));
        return { sucesso: true, fotos };
    } catch (erro) {
        return { sucesso: false, erro: erro.message, fotos: [] };
    }
});

ipcMain.handle('salvar-foto', async (event, os, dataUrl) => {
    try {
        const dir = getFotosDir(os);
        const nome = `foto_${Date.now()}.jpg`;
        const caminho = path.join(dir, nome);
        const base64 = dataUrl.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(caminho, buffer);
        return { sucesso: true, caminho };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

ipcMain.handle('deletar-foto', async (event, os, nome) => {
    try {
        const dir = getFotosDir(os);
        const caminho = path.join(dir, nome);
        if (fs.existsSync(caminho)) {
            fs.unlinkSync(caminho);
            return { sucesso: true };
        } else {
            return { sucesso: false, erro: 'Foto não encontrada' };
        }
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

ipcMain.handle('abrir-pasta-anexos', async (event, os) => {
    try {
        const dir = getFotosDir(os);
        shell.openPath(dir);
        return { sucesso: true };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

// ============================================
// WHATSAPP DESKTOP
// ============================================
function localizarWhatsAppWindows() {
    if (process.platform !== 'win32') return null;
    const locais = [
        path.join(process.env.LOCALAPPDATA || '', 'WhatsApp', 'WhatsApp.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'WhatsApp', 'WhatsApp.exe'),
        path.join(process.env.PROGRAMFILES || '', 'WhatsApp', 'WhatsApp.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'WhatsApp', 'WhatsApp.exe')
    ];
    for (const local of locais) if (local && fs.existsSync(local)) return local;
    const base = path.join(process.env.LOCALAPPDATA || '', 'WhatsApp');
    if (fs.existsSync(base)) {
        const pastas = fs.readdirSync(base, { withFileTypes: true })
            .filter(item => item.isDirectory() && /^app-/i.test(item.name))
            .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
        for (const pasta of pastas) {
            const exe = path.join(base, pasta.name, 'WhatsApp.exe');
            if (fs.existsSync(exe)) return exe;
        }
    }
    return null;
}

ipcMain.handle('abrir-whatsapp-desktop', async (event, url) => {
    try {
        if (typeof url !== 'string' || !url.startsWith('whatsapp://send?')) {
            return { sucesso: false, erro: 'URL do WhatsApp inválida' };
        }

        // Usa o protocolo registrado pelo WhatsApp Desktop. Esse caminho
        // também funciona com versões instaladas pela Microsoft Store.
        try {
            await shell.openExternal(url);
            return { sucesso: true };
        } catch (erroProtocolo) {
            console.warn('Protocolo whatsapp:// indisponível:', erroProtocolo.message);
        }

        // Fallback para instalações tradicionais do WhatsApp no Windows.
        if (process.platform === 'win32') {
            const executavel = localizarWhatsAppWindows();
            if (!executavel) return { sucesso: false, erro: 'WhatsApp Desktop não encontrado' };
            return await new Promise(resolve => {
                execFile(executavel, [url], { windowsHide: true }, erro => {
                    resolve(erro ? { sucesso: false, erro: erro.message } : { sucesso: true });
                });
            });
        }
        return { sucesso: false, erro: 'WhatsApp Desktop não encontrado' };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
});

// ============================================
// JANELA PRINCIPAL
// ============================================
function createWindow() {
    // Determina o caminho do preload baseado no ambiente
    let preloadPath;
    if (app.isPackaged) {
        // Em produção, o preload está na pasta resources (copiado via extraResources)
        preloadPath = path.join(process.resourcesPath, 'preload.js');
    } else {
        // Em desenvolvimento, usa o caminho relativo
        preloadPath = path.join(__dirname, 'preload.js');
    }

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '..', 'renderer', 'assets', 'novo_icone.ico'),
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Sempre exigir novo login ao iniciar o aplicativo.
    mainWindow = win;
    win.loadFile(path.join(__dirname, '..', 'renderer', 'pages', 'login.html'));

    // Descomente para debug
    // win.webContents.openDevTools();
}

// ============================================
// INICIALIZAÇÃO (único whenReady)
// ============================================
app.whenReady().then(() => {
    getBackupDir();
    configurarAtualizador();
    createWindow();
    setTimeout(() => { if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {}); }, 5000);

    // ============================================
    // FECHAMENTO AUTOMÁTICO NO PRIMEIRO DIA DO MÊS
    // ============================================
    const agora = new Date();
    if (agora.getDate() === 1) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.on('did-finish-load', async () => {
                try {
                    // Verifica se já foi fechado este mês
                    const pendente = await win.webContents.executeJavaScript(`
                        window.api.verificarFechamentoPendente()
                    `);
                    if (pendente) {
                        // Pergunta ao usuário via dialog (Electron)
                        const { response } = await dialog.showMessageBox(win, {
                            type: 'question',
                            buttons: ['Sim', 'Não'],
                            defaultId: 0,
                            title: 'Fechamento Mensal',
                            message: '🔔 Hoje é o primeiro dia do mês!',
                            detail: 'Deseja fechar o mês anterior automaticamente? Isso arquivará todas as movimentações e limpará o caixa.'
                        });
                        if (response === 0) {
                            // Executa o fechamento
                            const resultado = await win.webContents.executeJavaScript(`
                                window.api.fecharMes()
                            `);
                            if (resultado.sucesso) {
                                dialog.showMessageBox(win, {
                                    type: 'info',
                                    title: 'Fechamento concluído',
                                    message: resultado.mensagem
                                });
                            } else {
                                dialog.showMessageBox(win, {
                                    type: 'error',
                                    title: 'Erro',
                                    message: resultado.erro
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Erro no fechamento automático:', e);
                }
            });
        }
    }

    // Verifica se o preload foi carregado (apenas para debug)
    setTimeout(() => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.executeJavaScript(`
                console.log('🔍 window.electron:', typeof window.electron);
                console.log('🔍 window.api:', typeof window.api);
            `);
        }
    }, 3000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
