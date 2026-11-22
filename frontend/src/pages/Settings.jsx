import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Eye, Moon, Sun, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { applyTheme, getStoredTheme, isExplicitTheme, persistTheme } from '../utils/theme';

const Settings = () => {
  const [settings, setSettings] = useState({
    theme: getStoredTheme() || 'light',
    language: 'pt-BR',
    notifications: {
      push: true,
      email: true,
      likes: true,
      comments: true,
      follows: true,
      messages: true,
      groups: true,
      stories: true,
      mentions: true
    },
    privacy: {
      profileVisibility: 'public',
      showEmail: false,
      showLastSeen: 'everyone',
      showOnlineStatus: true,
      readReceipts: true
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      fontSize: 'medium'
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Theme changes are explicit user choices. Never follow the operating
  // system's color scheme automatically after the user has selected a theme.
  useEffect(() => {
    applyTheme(settings.theme === 'dark' ? 'dark' : 'light');
    const root = document.documentElement;
    root.classList.toggle('accessibility-reduced-motion', Boolean(settings.accessibility?.reducedMotion));
    root.classList.toggle('accessibility-high-contrast', Boolean(settings.accessibility?.highContrast));
    root.dataset.fontSize = settings.accessibility?.fontSize || 'medium';
  }, [settings.theme, settings.accessibility?.reducedMotion, settings.accessibility?.highContrast, settings.accessibility?.fontSize]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // api.get() returns the decoded JSON body directly (not an Axios response).
      const response = await api.get('/api/settings');
      const loaded = response?.settings && typeof response.settings === 'object'
        ? response.settings
        : response;
      if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
        throw new Error('Resposta inválida do servidor ao carregar configurações.');
      }
      const localTheme = getStoredTheme();
      const serverTheme = isExplicitTheme(loaded.theme) ? loaded.theme : null;
      const resolvedTheme = localTheme || serverTheme || 'light';
      if (!localTheme && serverTheme) persistTheme(serverTheme);

      setSettings((current) => ({
        ...current,
        ...loaded,
        theme: resolvedTheme,
        notifications: { ...current.notifications, ...(loaded.notifications || {}) },
        privacy: { ...current.privacy, ...(loaded.privacy || {}) },
        accessibility: { ...current.accessibility, ...(loaded.accessibility || {}) }
      }));
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      const detail = error?.data?.error || error?.message;
      setMessage({ type: 'error', text: detail
        ? `Não foi possível carregar suas configurações: ${detail}`
        : 'Não foi possível carregar suas configurações. Verifique sua conexão e tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  // Load settings from backend on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      persistTheme(settings.theme === 'dark' ? 'dark' : 'light');
      const response = await api.put('/api/settings', settings);
      const saved = response?.settings && typeof response.settings === 'object' ? response.settings : settings;
      setSettings((current) => ({
        ...current,
        ...saved,
        notifications: { ...current.notifications, ...(saved.notifications || {}) },
        privacy: { ...current.privacy, ...(saved.privacy || {}) },
        accessibility: { ...current.accessibility, ...(saved.accessibility || {}) }
      }));
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações. Tente novamente.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const updateSetting = (path, value) => {
    if (path === 'theme') persistTheme(value);
    const keys = path.split('.');
    setSettings(prev => {
      const newSettings = JSON.parse(JSON.stringify(prev));
      let current = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  if (loading) {
    return (
      <div className="settings-container" style={{ display: 'flex', height: '400px', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader2 className="animate-spin" size={24} color="var(--senai-blue-primary)" />
        <span style={{ color: 'var(--text-secondary)' }}>Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'var(--senai-blue-light)', padding: '10px', borderRadius: '50%', color: 'var(--senai-blue-primary)', display: 'flex' }}>
          <SettingsIcon size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Configurações</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Personalize a sua experiência no SENAI Connect.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`card animate-fade-in settings-feedback-message settings-feedback-message--${message.type}`} style={{
          padding: '12px 20px',
          background: message.type === 'success' ? '#E8F5E9' : '#FFEBEE',
          borderLeft: `4px solid ${message.type === 'success' ? '#4CAF50' : '#F44336'}`,
          color: message.type === 'success' ? '#2E7D32' : '#C62828',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Aparência */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Moon size={20} color="var(--senai-blue-primary)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Aparência e Tema</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Escolha como o SENAI Connect deve parecer no seu dispositivo.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => updateSetting('theme', 'light')}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              border: settings.theme === 'light' ? '2px solid var(--senai-blue-primary)' : '1px solid var(--border-color)',
              padding: '12px',
              background: settings.theme === 'light' ? 'var(--senai-blue-light)' : 'transparent'
            }}
          >
            <Sun size={18} /> Light
          </button>
          <button
            className="btn-secondary"
            onClick={() => updateSetting('theme', 'dark')}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              border: settings.theme === 'dark' ? '2px solid var(--senai-blue-primary)' : '1px solid var(--border-color)',
              padding: '12px',
              background: settings.theme === 'dark' ? 'var(--senai-blue-light)' : 'transparent'
            }}
          >
            <Moon size={18} /> Dark
          </button>
        </div>
      </div>

      {/* Notificações */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Bell size={20} color="var(--senai-blue-primary)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Notificações</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(settings.notifications).map(([key, value]) => {
            const labels = {
              push: 'Notificações push',
              email: 'Notificações por e-mail',
              likes: 'Curtidas nas suas publicações',
              comments: 'Comentários nas suas publicações',
              follows: 'Novos seguidores',
              messages: 'Novas mensagens diretas',
              groups: 'Atividade em grupos',
              stories: 'Novas histórias',
              mentions: 'Menções (@seu_nome)'
            };
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{labels[key] || key}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => updateSetting(`notifications.${key}`, e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--senai-blue-primary)' }}
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Privacidade */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Shield size={20} color="var(--senai-blue-primary)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Privacidade e Visibilidade</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Quem pode ver seu perfil completo?</span>
            <select
              value={settings.privacy.profileVisibility}
              onChange={(e) => updateSetting('privacy.profileVisibility', e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
            >
              <option value="public">Todos (público)</option>
              <option value="professor">Apenas professores</option>
              <option value="private">Privado (apenas você)</option>
            </select>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Esta configuração controla quem pode ver seu perfil, posts, stories e grupos.
            </p>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>Mostrar seu e-mail corporativo no perfil</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Apenas visível se o perfil for público ou para professores</span>
            </div>
            <input
              type="checkbox"
              checked={settings.privacy.showEmail}
              onChange={(e) => updateSetting('privacy.showEmail', e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--senai-blue-primary)' }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Quem pode ver seu status "visto por último"?</span>
            <select
              value={settings.privacy.showLastSeen}
              onChange={(e) => updateSetting('privacy.showLastSeen', e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
            >
              <option value="everyone">Todos</option>
              <option value="contacts">Apenas contatos</option>
              <option value="nobody">Ninguém</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Mostrar quando você está online</span>
            <input
              type="checkbox"
              checked={settings.privacy.showOnlineStatus}
              onChange={(e) => updateSetting('privacy.showOnlineStatus', e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--senai-blue-primary)' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Confirmação de leitura (checks azuis)</span>
            <input
              type="checkbox"
              checked={settings.privacy.readReceipts}
              onChange={(e) => updateSetting('privacy.readReceipts', e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--senai-blue-primary)' }}
            />
          </label>
        </div>
      </div>

      {/* Acessibilidade */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Eye size={20} color="var(--senai-blue-primary)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Acessibilidade</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>Reduzir animações</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Desativa transições e efeitos de movimento</span>
            </div>
            <input
              type="checkbox"
              checked={settings.accessibility.reducedMotion}
              onChange={(e) => updateSetting('accessibility.reducedMotion', e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--senai-blue-primary)' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>Alto contraste</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Aumenta o contraste das cores para melhor legibilidade</span>
            </div>
            <input
              type="checkbox"
              checked={settings.accessibility.highContrast}
              onChange={(e) => updateSetting('accessibility.highContrast', e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--senai-blue-primary)' }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tamanho da fonte</span>
            <select
              value={settings.accessibility.fontSize}
              onChange={(e) => updateSetting('accessibility.fontSize', e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
            >
              <option value="small">Pequeno</option>
              <option value="medium">Médio</option>
              <option value="large">Grande</option>
            </select>
          </div>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ padding: '14px 28px', display: 'flex', alignSelf: 'flex-end', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}
      >
        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        {saving ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </div>
  );
};

export default Settings;