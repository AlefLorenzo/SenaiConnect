import { useState, useEffect, useCallback } from 'react';
import { Save, Shield, Lock, Bell, Users, Building2, DollarSign, AlertTriangle, Trash2, FileText, X, Eye } from 'lucide-react';
import './BusinessDashboardSettings.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Settings UI Components (defined outside to avoid re-creation on render)
function SettingsSection({ title, subtitle, danger, children }) {
    return (
        <section className={`settings-section ${danger ? 'danger' : ''}`}>
            <header className="section-header">
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
            </header>
            <div className="section-content">{children}</div>
        </section>
    );
}

function SettingRow({ children }) {
    return <div className="setting-row">{children}</div>;
}

function SettingInfo({ label, desc }) {
    return (
        <div className="setting-info">
            <label dangerouslySetInnerHTML={{ __html: label }} />
            <span className="setting-desc">{desc}</span>
        </div>
    );
}

function SettingInput({ type = 'text', accept, onChange, value, required, rows, placeholder, maxLength, ...props }) {
    if (type === 'textarea') {
        return <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} maxLength={maxLength} {...props} />;
    }
    if (type === 'file') {
        return <input type="file" accept={accept} onChange={onChange} {...props} />;
    }
    return <input type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} maxLength={maxLength} {...props} />;
}

function SettingToggle({ checked, onChange, ...props }) {
    return (
        <label className="toggle-switch">
            <input type="checkbox" checked={checked} onChange={onChange} {...props} />
            <span className="toggle-slider" />
        </label>
    );
}

function SettingButton({ onClick, variant = 'secondary', children, ...props }) {
    return <button className={`btn btn-${variant}`} onClick={onClick} {...props}>{children}</button>;
}

function SettingSelect({ value, onChange, options, ...props }) {
    return (
        <select value={value} onChange={onChange} {...props}>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    );
}

function SettingNumber({ value, onChange, min, max, ...props }) {
    return <input type="number" value={value} onChange={onChange} min={min} max={max} {...props} />;
}

const BusinessDashboardSettings = () => {
    const [settings, setSettings] = useState({});
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('profile');
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);

    const tabs = [
        { id: 'profile', label: 'Perfil da Empresa', icon: Building2 },
        { id: 'notifications', label: 'Notificações', icon: Bell },
        { id: 'security', label: 'Segurança', icon: Shield },
        { id: 'billing', label: 'Faturamento', icon: DollarSign },
        { id: 'team', label: 'Equipe', icon: Users },
        { id: 'danger', label: 'Zona de Perigo', icon: AlertTriangle }
    ];

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/business/my-business`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
                if (data.logo_url) setAvatarPreview(`${API_URL}/uploads/logos/${data.logo_url}`);
                if (data.cover_image_url) setCoverPreview(data.cover_image_url);
            }
        } catch (err) {
            console.error('Erro ao buscar configurações:', err);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/api/business/my-business`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setSettings(data);
                    if (data.logo_url) setAvatarPreview(`${API_URL}/uploads/logos/${data.logo_url}`);
                    if (data.cover_image_url) setCoverPreview(data.cover_image_url);
                }
            } catch (err) {
                console.error('Erro ao buscar configurações:', err);
            }
        };
        loadSettings();
        return () => { cancelled = true; };
    }, []);

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleFileChange = (key, e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Arquivo deve ter no máximo 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                if (key === 'logo_url') setAvatarPreview(e.target.result);
                if (key === 'cover_image_url') setCoverPreview(e.target.result);
            };
            reader.readAsDataURL(file);
            // Upload would be handled separately in real implementation
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccessMessage('');
        try {
            const res = await fetch(`${API_URL}/api/business/my-business`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                setSuccessMessage('Configurações salvas com sucesso!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (err) {
            console.error('Erro ao salvar:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="business-dashboard-settings">
            <div className="page-header">
                <div>
                    <h1>Configurações da Empresa</h1>
                    <p>Personalize o perfil e preferências da sua empresa</p>
                </div>
            </div>

            {successMessage && (
                <div className="success-toast">
                    <Save size={18} />
                    <span>{successMessage}</span>
                </div>
            )}

            <div className="settings-layout">
                <aside className="settings-sidebar">
                    <nav>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className="settings-content">
                    {activeTab === 'profile' && (
                        <SettingsSection title="Perfil da Empresa" subtitle="Informações públicas exibidas no seu perfil">
                            <SettingRow>
                                <SettingInfo label="Logo" desc="Imagem exibida no perfil e nos posts (máx. 5MB, quadrada)" />
                                <SettingInput type="file" accept="image/*" onChange={e => handleFileChange('logo_url', e)} />
                                {avatarPreview && (
                                    <div className="preview-container">
                                        <img src={avatarPreview} alt="Preview" className="preview-image" />
                                    </div>
                                )}
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Imagem de Capa" desc="Banner exibido no topo do perfil (máx. 5MB, proporção 16:9)" />
                                <SettingInput type="file" accept="image/*" onChange={e => handleFileChange('cover_image_url', e)} />
                                {coverPreview && (
                                    <div className="preview-container wide">
                                        <img src={coverPreview} alt="Preview" className="preview-image" />
                                    </div>
                                )}
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Nome da Empresa <span className='required'>*</span>" desc="Nome público da sua empresa" />
                                <SettingInput
                                    type="text"
                                    value={settings.company_name || ''}
                                    onChange={e => handleChange('company_name', e.target.value)}
                                    required
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Slug (URL)" desc="Identificador único para o perfil (ex: sua-empresa)" />
                                <SettingInput
                                    type="text"
                                    value={settings.slug || ''}
                                    onChange={e => handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Setor de Atuação" desc="Categoria principal da empresa" />
                                <SettingInput
                                    type="text"
                                    value={settings.sector || ''}
                                    onChange={e => handleChange('sector', e.target.value)}
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Localização" desc="Cidade/Estado onde a empresa atua" />
                                <SettingInput
                                    type="text"
                                    value={settings.location || ''}
                                    onChange={e => handleChange('location', e.target.value)}
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Site Oficial" desc="URL do site da empresa" />
                                <SettingInput
                                    type="url"
                                    value={settings.website || ''}
                                    onChange={e => handleChange('website', e.target.value)}
                                    placeholder="https://suaempresa.com"
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="E-mail de Contato" desc="E-mail público para contato comercial" />
                                <SettingInput
                                    type="email"
                                    value={settings.contact_email || ''}
                                    onChange={e => handleChange('contact_email', e.target.value)}
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Telefone" desc="Telefone para contato comercial" />
                                <SettingInput
                                    type="tel"
                                    value={settings.contact_phone || ''}
                                    onChange={e => handleChange('contact_phone', e.target.value)}
                                    placeholder="(11) 99999-9999"
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Endereço Completo" desc="Endereço físico da empresa (opcional)" />
                                <SettingInput
                                    type="textarea"
                                    value={settings.address || ''}
                                    onChange={e => handleChange('address', e.target.value)}
                                    rows={3}
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Descrição da Empresa" desc="Texto exibido no perfil (máx. 500 caracteres)" />
                                <SettingInput
                                    type="textarea"
                                    value={settings.description || ''}
                                    onChange={e => handleChange('description', e.target.value)}
                                    rows={4}
                                    maxLength={500}
                                />
                            </SettingRow>

                            <SettingRow>
                                <SettingInfo label="Redes Sociais" desc="Links para perfis oficiais (JSON)" />
                                <SettingInput
                                    type="textarea"
                                    value={settings.social_links ? JSON.stringify(settings.social_links, null, 2) : '{}'}
                                    onChange={e => {
                                        try {
                                            handleChange('social_links', JSON.parse(e.target.value));
                                        } catch { /* invalid json */ }
                                    }}
                                    rows={6}
                                    placeholder='{"linkedin": "https://linkedin.com/company/suaempresa", "instagram": "https://instagram.com/suaempresa"}'
                                />
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'notifications' && (
                        <SettingsSection title="Notificações" subtitle="Configure como você recebe alertas sobre sua empresa">
                            <SettingRow>
                                <SettingInfo label="Novos Seguidores" desc="Notificar quando alguém seguir sua empresa" />
                                <SettingToggle
                                    checked={settings.notify_new_follower !== false}
                                    onChange={e => handleChange('notify_new_follower', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Interações nos Posts" desc="Curtidas, comentários e compartilhamentos" />
                                <SettingToggle
                                    checked={settings.notify_post_interactions !== false}
                                    onChange={e => handleChange('notify_post_interactions', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Visualizações de Stories" desc="Quando alguém visualizar seus stories" />
                                <SettingToggle
                                    checked={settings.notify_story_views !== false}
                                    onChange={e => handleChange('notify_story_views', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Campanhas Aprovadas/Rejeitadas" desc="Status de aprovação das campanhas" />
                                <SettingToggle
                                    checked={settings.notify_campaign_status !== false}
                                    onChange={e => handleChange('notify_campaign_status', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Pagamentos Recebidos" desc="Confirmação de pagamentos de faturas" />
                                <SettingToggle
                                    checked={settings.notify_payments !== false}
                                    onChange={e => handleChange('notify_payments', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Faturas Vencendo" desc="Lembrete 3 dias antes do vencimento" />
                                <SettingToggle
                                    checked={settings.notify_invoice_due !== false}
                                    onChange={e => handleChange('notify_invoice_due', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Relatório Semanal" desc="Resumo semanal de métricas (segundas-feiras)" />
                                <SettingToggle
                                    checked={settings.weekly_report !== false}
                                    onChange={e => handleChange('weekly_report', e.target.checked)}
                                />
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'security' && (
                        <SettingsSection title="Segurança" subtitle="Proteja o acesso à sua conta empresarial">
                            <SettingRow>
                                <SettingInfo label="Autenticação de Dois Fatores (2FA)" desc="Exige código adicional ao fazer login" />
                                <SettingToggle
                                    checked={settings.two_factor_enabled !== false}
                                    onChange={e => handleChange('two_factor_enabled', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Alterar Senha" desc="Atualize sua senha de acesso" />
                                <SettingButton onClick={() => alert('Funcionalidade: Abrir modal de alteração de senha')} variant="secondary">
                                    <Lock size={18} /> Alterar Senha
                                </SettingButton>
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Sessões Ativas" desc="Gerencie dispositivos conectados" />
                                <SettingButton onClick={() => alert('Funcionalidade: Ver sessões ativas')} variant="secondary">
                                    <Eye size={18} /> Ver Sessões
                                </SettingButton>
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Log de Acesso" desc="Histórico de logins na conta da empresa" />
                                <SettingButton onClick={() => alert('Funcionalidade: Ver log de acesso')} variant="secondary">
                                    <FileText size={18} /> Ver Log
                                </SettingButton>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'billing' && (
                        <SettingsSection title="Faturamento" subtitle="Configure preferências de cobrança e pagamentos">
                            <SettingRow>
                                <SettingInfo label="Método de Pagamento Padrão" desc="Método usado para pagamentos automáticos de campanhas" />
                                <SettingSelect
                                    value={settings.default_payment_method || 'pix'}
                                    onChange={e => handleChange('default_payment_method', e.target.value)}
                                    options={[
                                        { value: 'pix', label: 'PIX' },
                                        { value: 'boleto', label: 'Boleto Bancário' },
                                        { value: 'credit_card', label: 'Cartão de Crédito' }
                                    ]}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Pagamento Automático" desc="Pagar faturas automaticamente na data de vencimento" />
                                <SettingToggle
                                    checked={settings.auto_pay !== false}
                                    onChange={e => handleChange('auto_pay', e.target.checked)}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Notificar Antes do Vencimento" desc="Dias de antecedência para avisar sobre faturas" />
                                <SettingNumber
                                    value={settings.invoice_reminder_days || 3}
                                    onChange={e => handleChange('invoice_reminder_days', parseInt(e.target.value))}
                                    min={1}
                                    max={10}
                                />
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Dados para Nota Fiscal" desc="Informações fiscais para emissão de NF" />
                                <SettingButton onClick={() => alert('Funcionalidade: Editar dados fiscais')} variant="primary">
                                    <FileText size={18} /> Editar Dados Fiscais
                                </SettingButton>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeTab === 'team' && (
                        <SettingsSection title="Equipe e Acessos" subtitle="Gerencie quem tem acesso ao painel da empresa">
                            <div className="team-list">
                                <div className="team-member">
                                    <div className="member-info">
                                        <div className="member-avatar">{sessionStorage.getItem('user_name')?.charAt(0) || 'U'}</div>
                                        <div>
                                            <div className="member-name">{sessionStorage.getItem('user_name') || 'Você'}</div>
                                            <div className="member-role">Proprietário • Acesso total</div>
                                        </div>
                                    </div>
                                    <span className="member-badge owner">Proprietário</span>
                                </div>
                                <div className="team-member">
                                    <div className="member-info">
                                        <div className="member-avatar">+</div>
                                        <div>
                                            <div className="member-name">Convidar novo membro</div>
                                            <div className="member-role">Definir permissões de acesso</div>
                                        </div>
                                    </div>
                                    <button className="btn-secondary" onClick={() => alert('Funcionalidade: Convidar membro')}>
                                        Convidar
                                    </button>
                                </div>
                            </div>
                            <div className="permissions-info">
                                <h4>Níveis de Permissão</h4>
                                <ul>
                                    <li><strong>Proprietário:</strong> Acesso total, pode gerenciar equipe, faturamento e configurações</li>
                                    <li><strong>Administrador:</strong> Acesso a campanhas, posts, stories, analytics. Não acessa faturamento</li>
                                    <li><strong>Editor:</strong> Pode criar/editar posts e stories. Não acessa campanhas nem analytics</li>
                                    <li><strong>Visualizador:</strong> Acesso somente leitura a analytics e relatórios</li>
                                </ul>
                            </div>
                        </SettingsSection>
                    )}

                    {activeTab === 'danger' && (
                        <SettingsSection title="Zona de Perigo" subtitle="Ações irreversíveis - use com extrema cautela" danger>
                            <SettingRow>
                                <SettingInfo label="Desativar Conta da Empresa" desc="Oculta o perfil e pausa todas as campanhas. Pode ser reativado." />
                                <SettingButton onClick={() => {
                                    if (window.confirm('Tem certeza? Isso ocultará o perfil da empresa e pausará todas as campanhas.')) {
                                        alert('Funcionalidade: Desativar conta');
                                    }
                                }} variant="danger">
                                    <X size={18} /> Desativar Conta
                                </SettingButton>
                            </SettingRow>
                            <SettingRow>
                                <SettingInfo label="Excluir Conta Permanentemente" desc="Remove todos os dados da empresa, posts, stories, campanhas e histórico. IRREVERSÍVEL." />
                                <SettingButton onClick={() => {
                                    if (window.confirm('ATENÇÃO: Esta ação é IRREVERSÍVEL. Todos os dados serão perdidos permanentemente. Digite "EXCLUIR" para confirmar.')) {
                                        const confirm = prompt('Digite "EXCLUIR" para confirmar:');
                                        if (confirm === 'EXCLUIR') {
                                            alert('Funcionalidade: Excluir conta permanentemente');
                                        }
                                    }
                                }} variant="danger">
                                    <Trash2 size={18} /> Excluir Permanentemente
                                </SettingButton>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    <div className="settings-actions">
                        <button className="btn-secondary" onClick={fetchSettings}>Cancelar</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BusinessDashboardSettings;