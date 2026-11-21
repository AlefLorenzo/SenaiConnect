import { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, AlertTriangle, Shield, Lock, Bell, Globe, Users } from 'lucide-react';
import Card from '../../components/ui/Card/Card';
import Button from '../../components/ui/Button/Button';
import Input from '../../components/ui/Input/Input';
import Alert from '../../components/ui/Alert/Alert';
import Badge from '../../components/ui/Badge/Badge';

import './AdminSettings.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AdminSettings = () => {
    const [settings, setSettings] = useState({});
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('general');

    const fetchSettings = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchSettings();
    }, []);

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccessMessage('');
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                setSuccessMessage('Configurações salvas com sucesso!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Tem certeza? Todas as configurações voltarão aos valores padrão.')) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/settings/reset`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data.settings);
                setSuccessMessage('Configurações restauradas aos padrões!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Erro ao resetar:', error);
        }
    };

    const handleClearCache = async () => {
        try {
            const token = sessionStorage.getItem('token');
            await fetch(`${API_URL}/api/admin/settings/clear-cache`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccessMessage('Cache limpo com sucesso!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
        }
    };

    const tabs = [
        { id: 'general', label: 'Geral', icon: Globe },
        { id: 'notifications', label: 'Notificações', icon: Bell },
        { id: 'moderation', label: 'Moderação', icon: Shield },
        { id: 'security', label: 'Segurança', icon: Lock },
        { id: 'admins', label: 'Administradores', icon: Users },
        { id: 'danger', label: 'Zona de Perigo', icon: AlertTriangle }
    ];

    return (
        <div className="admin-settings">
            <div className="page-header">
                <div>
                    <h1>Configurações Administrativas</h1>
                    <p>Personalize o comportamento da plataforma SENAI Connect</p>
                </div>
            </div>

            {successMessage && (
                <Alert variant="success" dismissible onDismiss={() => setSuccessMessage('')}>
                    {successMessage}
                </Alert>
            )}

            <div className="settings-layout">
                <aside className="settings-sidebar">
                    <nav>
                        {tabs.map(tab => (
                            <Button
                                key={tab.id}
                                variant={activeTab === tab.id ? 'primary' : 'ghost'}
                                fullWidth
                                justify="start"
                                onClick={() => setActiveTab(tab.tab)}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </Button>
                        ))}
                    </nav>
                </aside>

                <main className="settings-content">
                    {activeTab === 'general' && (
                        <SettingsSection title="Configurações Gerais" subtitle="Opções básicas de funcionamento da plataforma">
                            <SettingRow>
                                <SettingInfo label="Nome da Plataforma" desc="Nome exibido no cabeçalho e comunicações" />
                                <Input
                                    type="text"
                                    value={settings.platform_name || 'SENAI Connect'}
                                    onChange={e => handleChange('platform_name', e.target.value)}
                                    fullWidth
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Domínio Institucional (Alunos)" desc="Domínio de e-mail permitido para cadastro de alunos" />
                                <Input
                                    type="text"
                                    value={settings.student_domain || '@estudante.senai.com'}
                                    onChange={e => handleChange('student_domain', e.target.value)}
                                    fullWidth
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Domínio Docente" desc="Domínio de e-mail permitido para cadastro de professores" />
                                <Input
                                    type="text"
                                    value={settings.teacher_domain || '@docente.senai.com'}
                                    onChange={e => handleChange('teacher_domain', e.target.value)}
                                    fullWidth
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Modo de Manutenção" desc="Desabilita acesso dos alunos (administradores ainda acessam)" />
                                <SettingToggle
                                    checked={settings.maintenance_mode}
                                    onChange={e => handleChange('maintenance_mode', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Registro Público" desc="Permite que novos usuários se cadastrem na plataforma" />
                                <SettingToggle
                                    checked={settings.public_registration !== false}
                                    onChange={e => handleChange('public_registration', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Verificação de E-mail Obrigatória" desc="Exige confirmação de e-mail antes do primeiro login" />
                                <SettingToggle
                                    checked={settings.email_verification !== false}
                                    onChange={e => handleChange('email_verification', e.target.checked)}
                                />
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'notifications' && (
                        <SettingsSection title="Notificações e Comunicações" subtitle="Configure como os usuários recebem alertas">
                            <SettingRow>
                                <SettingInfo label="Notificações Push" desc="Envia notificações push para navegadores compatíveis" />
                                <SettingToggle
                                    checked={settings.push_notifications !== false}
                                    onChange={e => handleChange('push_notifications', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Notificações por E-mail" desc="Envia resumos e alertas importantes por e-mail" />
                                <SettingToggle
                                    checked={settings.email_notifications !== false}
                                    onChange={e => handleChange('email_notifications', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Frequência de Digest Diário" desc="Horário de envio do resumo diário de atividades" />
                                <Input
                                    as="select"
                                    value={settings.digest_time || '09:00'}
                                    onChange={e => handleChange('digest_time', e.target.value)}
                                    options={['08:00', '09:00', '10:00', '18:00'].map(v => ({ value: v, label: v }))}
                                    style={{ width: 'auto', minWidth: '200px' }}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Notificar Avisos Urgentes" desc="Alerta imediato quando administrador publica aviso urgente" />
                                <SettingToggle
                                    checked={settings.notify_urgent_notices !== false}
                                    onChange={e => handleChange('notify_urgent_notices', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Notificar Denúncias" desc="Alerta administradores quando nova denúncia é recebida" />
                                <SettingToggle
                                    checked={settings.notify_reports !== false}
                                    onChange={e => handleChange('notify_reports', e.target.checked)}
                                />
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'moderation' && (
                        <SettingsSection title="Moderação de Conteúdo" subtitle="Regras automáticas e limites de moderação">
                            <SettingRow>
                                <SettingInfo label="Moderação Automática" desc="IA detecta conteúdo impróprio e sinaliza automaticamente" />
                                <SettingToggle
                                    checked={settings.auto_moderation !== false}
                                    onChange={e => handleChange('auto_moderation', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Limite de Denúncias para Auto-Bloqueio" desc="Número de denúncias válidas antes de bloquear temporariamente" />
                                <Input
                                    type="number"
                                    value={settings.auto_block_threshold || 3}
                                    onChange={e => handleChange('auto_block_threshold', parseInt(e.target.value))}
                                    min={1}
                                    max={10}
                                    style={{ width: '80px' }}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Palavras Bloqueadas" desc="Lista de termos que impedem publicação (separados por vírgula)" />
                                <Input
                                    type="text"
                                    value={settings.blocked_words || 'spam,phishing,golpe,fraude'}
                                    onChange={e => handleChange('blocked_words', e.target.value)}
                                    style={{ width: '400px' }}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Máximo de Posts por Hora" desc="Limite anti-spam para publicações por usuário" />
                                <Input
                                    type="number"
                                    value={settings.max_posts_per_hour || 10}
                                    onChange={e => handleChange('max_posts_per_hour', parseInt(e.target.value))}
                                    min={1}
                                    max={50}
                                    style={{ width: '80px' }}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Máximo de Mensagens por Hora" desc="Limite anti-spam para mensagens privadas" />
                                <Input
                                    type="number"
                                    value={settings.max_messages_per_hour || 30}
                                    onChange={e => handleChange('max_messages_per_hour', parseInt(e.target.value))}
                                    min={5}
                                    max={100}
                                    style={{ width: '80px' }}
                                />
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'security' && (
                        <SettingsSection title="Segurança e Acesso" subtitle="Configurações críticas de segurança do sistema">
                            <SettingRow>
                                <SettingInfo label="Autenticação de Dois Fatores (2FA)" desc="Exige 2FA para todos os administradores" />
                                <SettingToggle
                                    checked={settings.require_2fa !== false}
                                    onChange={e => handleChange('require_2fa', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Tempo de Sessão Admin" desc="Duração do token de acesso administrativo" />
                                <Input
                                    as="select"
                                    value={settings.session_timeout || 8}
                                    onChange={e => handleChange('session_timeout', parseInt(e.target.value))}
                                    options={[
                                        { value: 4, label: '4 horas' },
                                        { value: 8, label: '8 horas' },
                                        { value: 12, label: '12 horas' },
                                        { value: 24, label: '24 horas' }
                                    ]}
                                    style={{ width: 'auto', minWidth: '200px' }}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Bloquear Após Tentativas Falhadas" desc="Bloqueia IP após 5 tentativas de login falhas" />
                                <SettingToggle
                                    checked={settings.lockout_failed !== false}
                                    onChange={e => handleChange('lockout_failed', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Log de Auditoria Detalhado" desc="Registra todas as ações administrativas com metadados completos" />
                                <SettingToggle
                                    checked={settings.detailed_audit !== false}
                                    onChange={e => handleChange('detailed_audit', e.target.checked)}
                                />
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'admins' && (
                        <SettingsSection title="Administradores do Sistema" subtitle="Gerencie quem tem acesso ao painel administrativo">
                            <AdminList />
                            <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)' }}>
                                <Button variant="primary" onClick={addAdmin}>
                                    <Save size={18} /> Adicionar Admin
                                </Button>
                            </div>
                        </SettingsSection>
                    )}

                    {activeTab === 'danger' && (
                        <SettingsSection title="Zona de Perigo" subtitle="Ações irreversíveis - use com extrema cautela" danger>
                            <SettingRow>
                                <SettingInfo label="Limpar Cache do Sistema" desc="Remove todos os caches temporários (pode causar lentidão temporária)" />
                                <Button variant="secondary" onClick={handleClearCache}>
                                    <RotateCcw size={18} /> Limpar Cache
                                </Button>
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Exportar Dados de Auditoria" desc="Gera relatório completo de todas as ações administrativas (CSV)" />
                                <Button variant="secondary" onClick={() => window.open(`${API_URL}/api/admin/audit/export`, '_blank')}>
                                    <Download size={18} /> Exportar CSV
                                </Button>
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Resetar Configurações Padrão" desc="Restaura todas as configurações aos valores de fábrica" />
                                <Button variant="danger" onClick={handleReset}>
                                    <AlertTriangle size={18} /> Restaurar Padrões
                                </Button>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    <div className="settings-actions">
                        <Button variant="secondary" onClick={fetchSettings}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSave} loading={saving}>
                            <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </main>
            </div>
        </div>
    );
};

// Componentes reutilizáveis
const SettingsSection = ({ title, subtitle, danger, children }) => (
    <Card className={`settings-section ${danger ? 'danger' : ''}`} padding="lg" elevation="md">
        <div className="section-header">
            <h2>{title}</h2>
            <p>{subtitle}</p>
        </div>
        <div className="section-body">{children}</div>
    </Card>
);

const SettingRow = ({ children }) => (
    <div className="setting-row">{children}</div>
);

const SettingInfo = ({ label, desc }) => (
    <div className="setting-info">
        <div className="setting-label">{label}</div>
        <div className="setting-desc">{desc}</div>
    </div>
);

const SettingToggle = ({ checked, onChange }) => (
    <div className="setting-control">
        <label className="toggle">
            <input type="checkbox" checked={checked} onChange={onChange} />
            <span className="toggle-slider" />
        </label>
    </div>
);

const AdminList = () => (
    <div className="admin-list">
        <div className="admin-item">
            <div className="admin-item-info">
                <div className="admin-item-avatar">JA</div>
                <div>
                    <div className="admin-item-name">João Administrador</div>
                    <div className="admin-item-role">Super Admin • Acesso total</div>
                </div>
            </div>
            <Badge variant="primary">Proprietário</Badge>
        </div>
        <div className="admin-item">
            <div className="admin-item-info">
                <div className="admin-item-avatar">MS</div>
                <div>
                    <div className="admin-item-name">Maria Silva</div>
                    <div className="admin-item-role">Admin Moderação • Denúncias, Avisos</div>
                </div>
            </div>
            <Badge variant="warning">Moderação</Badge>
        </div>
        <div className="admin-item">
            <div className="admin-item-info">
                <div className="admin-item-avatar">JS</div>
                <div>
                    <div className="admin-item-name">José Santos</div>
                    <div className="admin-item-role">Admin Suporte • Usuários, Eventos, Cursos</div>
                </div>
            </div>
            <Badge variant="info">Suporte</Badge>
        </div>
        <div className="admin-item">
            <div className="admin-item-info">
                <div className="admin-item-avatar">PA</div>
                <div>
                    <div className="admin-item-name">Patrícia Alves</div>
                    <div className="admin-item-role">Admin Unidade • SENAI Informática</div>
                </div>
            </div>
            <Badge variant="success">Unidade</Badge>
        </div>
        <div className="admin-item">
            <div className="admin-item-info">
                <div className="admin-item-avatar">RC</div>
                <div>
                    <div className="admin-item-name">Roberto Costa</div>
                    <div className="admin-item-role">Admin Unidade • SENAI Automação</div>
                </div>
            </div>
            <Badge variant="success">Unidade</Badge>
        </div>
    </div>
);

const addAdmin = () => {
    alert('Funcionalidade: Abrir modal para adicionar novo administrador');
};

export default AdminSettings;