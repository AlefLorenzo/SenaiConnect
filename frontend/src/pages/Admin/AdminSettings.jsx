import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    Bell,
    Check,
    ChevronRight,
    Clock3,
    Download,
    Globe,
    HardDrive,
    LockKeyhole,
    RotateCcw,
    Save,
    Settings as SettingsIcon,
    ShieldCheck,
    SlidersHorizontal,
    Users,
    X
} from 'lucide-react';
import './AdminSettings.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const DEFAULT_SETTINGS = {
    platform_name: 'SENAI Connect',
    student_domain: '@estudante.senai.com',
    teacher_domain: '@docente.senai.com',
    maintenance_mode: false,
    public_registration: true,
    email_verification: true,
    push_notifications: true,
    email_notifications: true,
    digest_time: '09:00',
    notify_urgent_notices: true,
    notify_reports: true,
    auto_moderation: true,
    auto_block_threshold: 3,
    blocked_words: 'spam,phishing,golpe,fraude',
    max_posts_per_hour: 10,
    max_messages_per_hour: 30,
    require_2fa: true,
    session_timeout: 8,
    lockout_failed: true,
    detailed_audit: true
};

const SETTINGS_TABS = [
    { id: 'general', label: 'Geral', description: 'Identidade e cadastro', icon: Globe },
    { id: 'notifications', label: 'Notificações', description: 'Alertas e comunicações', icon: Bell },
    { id: 'moderation', label: 'Moderação', description: 'Regras e limites', icon: ShieldCheck },
    { id: 'security', label: 'Segurança', description: 'Acesso e proteção', icon: LockKeyhole },
    { id: 'admins', label: 'Administradores', description: 'Permissões da equipe', icon: Users },
    { id: 'danger', label: 'Manutenção', description: 'Ações do sistema', icon: AlertTriangle }
];

const getResponseError = async (response, fallback) => {
    const data = await response.json().catch(() => ({}));
    return data.error || data.message || fallback;
};

const AdminSettings = () => {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [originalSettings, setOriginalSettings] = useState(DEFAULT_SETTINGS);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [action, setAction] = useState('');
    const [loadError, setLoadError] = useState('');
    const [feedback, setFeedback] = useState(null);

    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    const activeDefinition = SETTINGS_TABS.find(tab => tab.id === activeTab) || SETTINGS_TABS[0];

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(API_URL + '/api/admin/settings', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) {
                throw new Error(await getResponseError(response, 'Não foi possível carregar as configurações.'));
            }
            const data = await response.json();
            const normalized = { ...DEFAULT_SETTINGS, ...data };
            setSettings(normalized);
            setOriginalSettings(normalized);
            setFeedback(null);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            setLoadError(error.message || 'Não foi possível carregar as configurações.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateSetting = (key, value) => {
        setSettings(current => ({ ...current, [key]: value }));
        setFeedback(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setFeedback(null);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(API_URL + '/api/admin/settings', {
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            if (!response.ok) {
                throw new Error(await getResponseError(response, 'Não foi possível salvar as configurações.'));
            }
            setOriginalSettings({ ...settings });
            setFeedback({ type: 'success', message: 'Alterações salvas. As configurações do sistema foram atualizadas.' });
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            setFeedback({ type: 'error', message: error.message || 'Ocorreu um erro ao salvar.' });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setSettings({ ...originalSettings });
        setFeedback({ type: 'info', message: 'As alterações não salvas foram descartadas.' });
    };

    const handleReset = async () => {
        const confirmed = window.confirm(
            'Restaurar as configurações padrão? Essa ação substitui todas as configurações administrativas atualmente salvas.'
        );
        if (!confirmed) return;

        setAction('reset');
        setFeedback(null);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(API_URL + '/api/admin/settings/reset', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) {
                throw new Error(await getResponseError(response, 'Não foi possível restaurar os padrões.'));
            }
            const data = await response.json();
            const normalized = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
            setSettings(normalized);
            setOriginalSettings(normalized);
            setFeedback({ type: 'success', message: 'As configurações padrão foram restauradas.' });
        } catch (error) {
            console.error('Erro ao restaurar configurações:', error);
            setFeedback({ type: 'error', message: error.message || 'Não foi possível restaurar os padrões.' });
        } finally {
            setAction('');
        }
    };

    const handleClearCache = async () => {
        setAction('cache');
        setFeedback(null);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(API_URL + '/api/admin/settings/clear-cache', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) {
                throw new Error(await getResponseError(response, 'Não foi possível executar a limpeza do cache.'));
            }
            setFeedback({ type: 'success', message: 'A solicitação de limpeza do cache foi concluída.' });
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            setFeedback({ type: 'error', message: error.message || 'Não foi possível limpar o cache.' });
        } finally {
            setAction('');
        }
    };

    const handleExportAudit = async () => {
        setAction('export');
        setFeedback(null);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(API_URL + '/api/admin/audit/export', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) {
                throw new Error(await getResponseError(response, 'Não foi possível exportar a auditoria.'));
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = 'senai-connect-auditoria.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
            setFeedback({ type: 'success', message: 'O arquivo de auditoria foi gerado para download.' });
        } catch (error) {
            console.error('Erro ao exportar auditoria:', error);
            setFeedback({ type: 'error', message: error.message || 'Não foi possível exportar a auditoria.' });
        } finally {
            setAction('');
        }
    };

    const renderActiveSettings = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <>
                        <SettingsCard
                            icon={Globe}
                            eyebrow="IDENTIDADE"
                            title="Identidade da plataforma"
                            description="Informações que identificam o SENAI Connect nas telas e comunicações."
                        >
                            <SettingRow label="Nome da plataforma" description="Nome exibido no cabeçalho e nas comunicações.">
                                <TextField id="platform-name" value={settings.platform_name} onChange={value => updateSetting('platform_name', value)} />
                            </SettingRow>
                        </SettingsCard>
                        <SettingsCard
                            icon={Users}
                            eyebrow="CADASTRO"
                            title="Acesso e cadastro"
                            description="Defina quem pode criar uma conta e quais endereços institucionais são aceitos."
                        >
                            <SettingRow label="Domínio institucional dos alunos" description="Sufixo de e-mail permitido para cadastro de alunos.">
                                <TextField id="student-domain" value={settings.student_domain} onChange={value => updateSetting('student_domain', value)} />
                            </SettingRow>
                            <SettingRow label="Domínio dos docentes" description="Sufixo de e-mail permitido para cadastro de professores.">
                                <TextField id="teacher-domain" value={settings.teacher_domain} onChange={value => updateSetting('teacher_domain', value)} />
                            </SettingRow>
                            <SettingRow label="Registro público" description="Permite que novos usuários iniciem o cadastro na plataforma.">
                                <SettingToggle label="Permitir registro público" checked={settings.public_registration !== false} onChange={value => updateSetting('public_registration', value)} />
                            </SettingRow>
                            <SettingRow label="Verificação de e-mail obrigatória" description="Exige confirmação do endereço de e-mail antes do primeiro acesso.">
                                <SettingToggle label="Exigir verificação de e-mail" checked={settings.email_verification !== false} onChange={value => updateSetting('email_verification', value)} />
                            </SettingRow>
                            <SettingRow label="Modo de manutenção" description="Restringe o acesso dos alunos enquanto a equipe realiza manutenção.">
                                <SettingToggle label="Ativar modo de manutenção" checked={Boolean(settings.maintenance_mode)} onChange={value => updateSetting('maintenance_mode', value)} />
                            </SettingRow>
                        </SettingsCard>
                    </>
                );
            case 'notifications':
                return (
                    <>
                        <SettingsCard
                            icon={Bell}
                            eyebrow="CANAIS"
                            title="Canais de comunicação"
                            description="Escolha quais canais podem ser usados para enviar atualizações aos usuários."
                        >
                            <SettingRow label="Notificações push" description="Envia notificações para navegadores e dispositivos compatíveis.">
                                <SettingToggle label="Ativar notificações push" checked={settings.push_notifications !== false} onChange={value => updateSetting('push_notifications', value)} />
                            </SettingRow>
                            <SettingRow label="Notificações por e-mail" description="Permite o envio de resumos e alertas importantes por e-mail.">
                                <SettingToggle label="Ativar notificações por e-mail" checked={settings.email_notifications !== false} onChange={value => updateSetting('email_notifications', value)} />
                            </SettingRow>
                            <SettingRow label="Horário do resumo diário" description="Horário em que o resumo de atividades deve ser enviado.">
                                <SelectField
                                    id="digest-time"
                                    value={settings.digest_time || '09:00'}
                                    onChange={value => updateSetting('digest_time', value)}
                                    options={[
                                        { value: '08:00', label: '08:00' },
                                        { value: '09:00', label: '09:00' },
                                        { value: '10:00', label: '10:00' },
                                        { value: '18:00', label: '18:00' }
                                    ]}
                                />
                            </SettingRow>
                        </SettingsCard>
                        <SettingsCard
                            icon={ShieldCheck}
                            eyebrow="ALERTAS"
                            title="Alertas administrativos"
                            description="Controle quais ocorrências precisam chamar a atenção da equipe de administração."
                        >
                            <SettingRow label="Avisos urgentes" description="Notifica a equipe quando um aviso urgente é publicado.">
                                <SettingToggle label="Notificar avisos urgentes" checked={settings.notify_urgent_notices !== false} onChange={value => updateSetting('notify_urgent_notices', value)} />
                            </SettingRow>
                            <SettingRow label="Novas denúncias" description="Notifica os administradores quando uma nova denúncia é recebida.">
                                <SettingToggle label="Notificar novas denúncias" checked={settings.notify_reports !== false} onChange={value => updateSetting('notify_reports', value)} />
                            </SettingRow>
                        </SettingsCard>
                    </>
                );
            case 'moderation':
                return (
                    <>
                        <SettingsCard
                            icon={ShieldCheck}
                            eyebrow="CONTEÚDO"
                            title="Regras de moderação"
                            description="Ajuste os filtros que ajudam a identificar conteúdo inadequado."
                        >
                            <SettingRow label="Moderação automática" description="Ativa a sinalização automática de conteúdo para revisão da equipe.">
                                <SettingToggle label="Ativar moderação automática" checked={settings.auto_moderation !== false} onChange={value => updateSetting('auto_moderation', value)} />
                            </SettingRow>
                            <SettingRow label="Palavras bloqueadas" description="Termos separados por vírgula que devem impedir uma publicação.">
                                <TextField id="blocked-words" value={settings.blocked_words || ''} onChange={value => updateSetting('blocked_words', value)} />
                            </SettingRow>
                            <SettingRow label="Denúncias para bloqueio automático" description="Quantidade de denúncias válidas antes de um bloqueio temporário.">
                                <NumberField id="auto-block-threshold" value={settings.auto_block_threshold ?? 3} min={1} max={10} onChange={value => updateSetting('auto_block_threshold', value)} />
                            </SettingRow>
                        </SettingsCard>
                        <SettingsCard
                            icon={SlidersHorizontal}
                            eyebrow="LIMITES"
                            title="Proteção contra spam"
                            description="Defina limites de frequência para reduzir publicações e mensagens abusivas."
                        >
                            <SettingRow label="Publicações por hora" description="Quantidade máxima de publicações por usuário em uma hora.">
                                <NumberField id="max-posts" value={settings.max_posts_per_hour ?? 10} min={1} max={50} onChange={value => updateSetting('max_posts_per_hour', value)} />
                            </SettingRow>
                            <SettingRow label="Mensagens por hora" description="Quantidade máxima de mensagens privadas por usuário em uma hora.">
                                <NumberField id="max-messages" value={settings.max_messages_per_hour ?? 30} min={5} max={100} onChange={value => updateSetting('max_messages_per_hour', value)} />
                            </SettingRow>
                        </SettingsCard>
                    </>
                );
            case 'security':
                return (
                    <>
                        <SettingsCard
                            icon={LockKeyhole}
                            eyebrow="AUTENTICAÇÃO"
                            title="Autenticação e sessão"
                            description="Ajustes relacionados à proteção das contas administrativas."
                        >
                            <SettingRow label="Autenticação em dois fatores (2FA)" description="Exige uma segunda etapa de autenticação para administradores.">
                                <SettingToggle label="Exigir autenticação em dois fatores" checked={settings.require_2fa !== false} onChange={value => updateSetting('require_2fa', value)} />
                            </SettingRow>
                            <SettingRow label="Duração da sessão administrativa" description="Tempo de validade da sessão administrativa, em horas.">
                                <SelectField
                                    id="session-timeout"
                                    value={String(settings.session_timeout ?? 8)}
                                    onChange={value => updateSetting('session_timeout', Number(value))}
                                    options={[
                                        { value: '4', label: '4 horas' },
                                        { value: '8', label: '8 horas' },
                                        { value: '12', label: '12 horas' },
                                        { value: '24', label: '24 horas' }
                                    ]}
                                />
                            </SettingRow>
                        </SettingsCard>
                        <SettingsCard
                            icon={ShieldCheck}
                            eyebrow="MONITORAMENTO"
                            title="Proteção e rastreabilidade"
                            description="Acompanhe tentativas de acesso e mantenha o registro das operações administrativas."
                        >
                            <SettingRow label="Bloqueio após tentativas falhas" description="Ativa a proteção contra tentativas repetidas de autenticação inválida.">
                                <SettingToggle label="Ativar bloqueio após falhas" checked={settings.lockout_failed !== false} onChange={value => updateSetting('lockout_failed', value)} />
                            </SettingRow>
                            <SettingRow label="Log de auditoria detalhado" description="Registra metadados adicionais nas ações realizadas pela administração.">
                                <SettingToggle label="Ativar auditoria detalhada" checked={settings.detailed_audit !== false} onChange={value => updateSetting('detailed_audit', value)} />
                            </SettingRow>
                        </SettingsCard>
                    </>
                );
            case 'admins':
                return (
                    <SettingsCard
                        icon={Users}
                        eyebrow="EQUIPE"
                        title="Gerenciamento de administradores"
                        description="A atribuição de perfis administrativos é feita no cadastro de cada usuário, com validação de permissão no servidor."
                    >
                        <div className="settings-access-panel">
                            <div className="settings-access-icon"><Users size={22} /></div>
                            <div className="settings-access-copy">
                                <h4>Controle de usuários e permissões</h4>
                                <p>Consulte os usuários, edite seus perfis e atribua uma função administrativa pela área de Usuários. As alterações de função são protegidas pelas permissões da conta conectada.</p>
                                <Link to="/admin/users" className="settings-link-button">
                                    Abrir gerenciamento de usuários <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </SettingsCard>
                );
            case 'danger':
                return (
                    <>
                        <div className="settings-danger-notice">
                            <AlertTriangle size={20} />
                            <div>
                                <strong>Área de manutenção do sistema</strong>
                                <p>Confira o impacto de cada ação antes de executá-la. A restauração dos padrões substitui as configurações administrativas atuais.</p>
                            </div>
                        </div>
                        <SettingsCard
                            icon={HardDrive}
                            eyebrow="OPERAÇÕES"
                            title="Manutenção e dados"
                            description="Ferramentas administrativas para tarefas de manutenção e registro."
                        >
                            <SettingActionRow
                                icon={RotateCcw}
                                title="Limpar cache do sistema"
                                description="Executa a rotina de limpeza de cache disponível no servidor."
                                buttonLabel={action === 'cache' ? 'Limpando...' : 'Limpar cache'}
                                onClick={handleClearCache}
                                disabled={Boolean(action)}
                            />
                            <SettingActionRow
                                icon={Download}
                                title="Exportar auditoria"
                                description="Baixa um arquivo CSV com os registros de auditoria administrativa."
                                buttonLabel={action === 'export' ? 'Preparando...' : 'Exportar CSV'}
                                onClick={handleExportAudit}
                                disabled={Boolean(action)}
                            />
                            <SettingActionRow
                                icon={AlertTriangle}
                                title="Restaurar configurações padrão"
                                description="Substitui as configurações atuais pelos valores padrão definidos pelo sistema."
                                buttonLabel={action === 'reset' ? 'Restaurando...' : 'Restaurar padrões'}
                                onClick={handleReset}
                                disabled={Boolean(action)}
                                danger
                            />
                        </SettingsCard>
                    </>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="admin-settings">
                <div className="settings-page-heading">
                    <div className="settings-heading-copy">
                        <span className="settings-eyebrow">SISTEMA / PREFERÊNCIAS</span>
                        <h1>Configurações</h1>
                        <p>Organize e controle o funcionamento da plataforma.</p>
                    </div>
                </div>
                <div className="settings-loading" role="status" aria-live="polite">
                    <span className="settings-spinner" />
                    <strong>Carregando configurações</strong>
                    <span>Buscando as preferências salvas no sistema...</span>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="admin-settings">
                <div className="settings-page-heading">
                    <div className="settings-heading-copy">
                        <span className="settings-eyebrow">SISTEMA / PREFERÊNCIAS</span>
                        <h1>Configurações</h1>
                        <p>Organize e controle o funcionamento da plataforma.</p>
                    </div>
                </div>
                <div className="settings-error-state" role="alert">
                    <AlertTriangle size={24} />
                    <div>
                        <h2>Não foi possível carregar as configurações</h2>
                        <p>{loadError}</p>
                        <button type="button" className="settings-button settings-button--primary" onClick={fetchSettings}>
                            Tentar novamente <RotateCcw size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-settings">
            <header className="settings-page-heading">
                <div className="settings-heading-copy">
                    <span className="settings-eyebrow">SISTEMA / PREFERÊNCIAS</span>
                    <h1>Configurações</h1>
                    <p>Gerencie as regras, a comunicação e a segurança do SENAI Connect em um só lugar.</p>
                </div>
                <div className="settings-heading-meta">
                    <span className="settings-meta-icon"><SettingsIcon size={18} /></span>
                    <span><strong>Configurações do sistema</strong><small>Alterações salvas manualmente</small></span>
                </div>
            </header>

            <div className="settings-summary" aria-label="Resumo das configurações">
                <div className="settings-summary-item">
                    <span className="settings-summary-icon"><SlidersHorizontal size={18} /></span>
                    <span><strong>{Object.keys(DEFAULT_SETTINGS).length} opções</strong><small>Parâmetros disponíveis</small></span>
                </div>
                <div className="settings-summary-item">
                    <span className="settings-summary-icon"><Clock3 size={18} /></span>
                    <span><strong>Salvamento manual</strong><small>Você controla quando publicar</small></span>
                </div>
                <div className={'settings-summary-item settings-summary-item--state' + (hasChanges ? ' is-dirty' : '')}>
                    <span className="settings-summary-icon">{hasChanges ? <AlertTriangle size={18} /> : <Check size={18} />}</span>
                    <span><strong>{hasChanges ? 'Alterações pendentes' : 'Tudo atualizado'}</strong><small>{hasChanges ? 'Salve para aplicar as mudanças' : 'Nenhuma alteração pendente'}</small></span>
                </div>
            </div>

            {feedback && (
                <div className={'settings-feedback settings-feedback--' + feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>
                    {feedback.type === 'success' ? <Check size={18} /> : feedback.type === 'error' ? <AlertTriangle size={18} /> : <X size={18} />}
                    <span>{feedback.message}</span>
                    <button type="button" aria-label="Fechar mensagem" onClick={() => setFeedback(null)}><X size={16} /></button>
                </div>
            )}

            <div className="settings-layout">
                <aside className="settings-sidebar">
                    <div className="settings-nav-heading">
                        <span>CATEGORIAS</span>
                        <small>Organize por assunto</small>
                    </div>
                    <nav className="settings-nav" aria-label="Categorias de configurações">
                        {SETTINGS_TABS.map(tab => {
                            const Icon = tab.icon;
                            const selected = activeTab === tab.id;
                            return (
                                <button
                                    type="button"
                                    key={tab.id}
                                    className={'settings-nav-item' + (selected ? ' is-active' : '')}
                                    aria-current={selected ? 'page' : undefined}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <span className="settings-nav-icon"><Icon size={18} /></span>
                                    <span className="settings-nav-copy">
                                        <strong>{tab.label}</strong>
                                        <small>{tab.description}</small>
                                    </span>
                                    <ChevronRight className="settings-nav-chevron" size={16} />
                                </button>
                            );
                        })}
                    </nav>
                    <div className="settings-sidebar-note">
                        <ShieldCheck size={17} />
                        <span>As alterações são registradas no sistema após salvar.</span>
                    </div>
                </aside>

                <main className="settings-content">
                    <div className="settings-panel-heading">
                        <div className="settings-panel-icon"><activeDefinition.icon size={21} /></div>
                        <div>
                            <span className="settings-panel-kicker">CONFIGURAÇÕES</span>
                            <h2>{activeDefinition.label}</h2>
                            <p>{activeDefinition.description}. Revise as opções abaixo e salve quando terminar.</p>
                        </div>
                    </div>

                    <div className="settings-panel-body">
                        {renderActiveSettings()}
                    </div>

                    <footer className="settings-actions">
                        <div className="settings-actions-status">
                            {hasChanges ? (
                                <><span className="settings-unsaved-dot" /> Você tem alterações que ainda não foram salvas.</>
                            ) : (
                                <><Check size={15} /> Suas configurações estão atualizadas.</>
                            )}
                        </div>
                        <div className="settings-actions-buttons">
                            <button type="button" className="settings-button settings-button--secondary" onClick={handleCancel} disabled={!hasChanges || saving}>
                                Descartar
                            </button>
                            <button type="button" className="settings-button settings-button--primary" onClick={handleSave} disabled={!hasChanges || saving} aria-busy={saving}>
                                {saving ? <span className="settings-button-spinner" /> : <Save size={16} />}
                                {saving ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    );
};

const SettingsCard = ({ icon: Icon, eyebrow, title, description, children }) => (
    <section className="settings-card">
        <header className="settings-card-heading">
            <span className="settings-card-icon"><Icon size={18} /></span>
            <div>
                <span className="settings-card-eyebrow">{eyebrow}</span>
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </header>
        <div className="settings-card-body">{children}</div>
    </section>
);

const SettingRow = ({ label, description, children }) => (
    <div className="setting-row">
        <div className="setting-info">
            <h4>{label}</h4>
            <p>{description}</p>
        </div>
        <div className="setting-control">{children}</div>
    </div>
);

const SettingToggle = ({ label, checked, onChange }) => (
    <label className="settings-switch">
        <input type="checkbox" aria-label={label} checked={Boolean(checked)} onChange={event => onChange(event.target.checked)} />
        <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
        <span className="settings-switch-state">{checked ? 'Ativado' : 'Desativado'}</span>
    </label>
);

const TextField = ({ id, value, onChange }) => (
    <input
        id={id}
        className="settings-input"
        type="text"
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
    />
);

const NumberField = ({ id, value, min, max, onChange }) => (
    <input
        id={id}
        className="settings-input settings-input--compact"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        onBlur={event => {
            if (event.target.value === '') onChange(min);
            else onChange(Math.min(max, Math.max(min, Number(event.target.value))));
        }}
    />
);

const SelectField = ({ id, value, onChange, options }) => (
    <select id={id} className="settings-input settings-select" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
);

const SettingActionRow = ({ icon: Icon, title, description, buttonLabel, onClick, disabled, danger }) => (
    <div className="settings-action-row">
        <span className={'settings-action-icon' + (danger ? ' is-danger' : '')}><Icon size={18} /></span>
        <div className="settings-action-copy">
            <strong>{title}</strong>
            <p>{description}</p>
        </div>
        <button
            type="button"
            className={'settings-button ' + (danger ? 'settings-button--danger' : 'settings-button--secondary')}
            onClick={onClick}
            disabled={disabled}
        >
            {buttonLabel} <ArrowRight size={15} />
        </button>
    </div>
);

export default AdminSettings;
