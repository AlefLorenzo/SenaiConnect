import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import './Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'Aluno' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(API_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim().toLowerCase()
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível concluir a solicitação.');
      }

      if (data.token && data.user) {
        login(data.token, data.user, data.session);
        // Administradores entram diretamente no painel; alunos seguem para o feed.
        navigate(data.user.admin_role ? '/admin/dashboard' : '/', { replace: true });
        return;
      }

      if (!isLogin && data.requiresEmailConfirmation) {
        setNotice(data.message || 'Cadastro criado. Confirme seu e-mail institucional para ativar a conta.');
        setIsLogin(true);
        setFormData((current) => ({ ...current, password: '' }));
        return;
      }

      throw new Error('O servidor não retornou uma sessão válida. Tente novamente.');
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        setError('Não foi possível conectar ao servidor. Verifique se a API está em execução e se o Supabase está configurado.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <div className="auth-header">
          <h1 className="logo-text" style={{ color: 'var(--senai-blue-dark)', fontStyle: 'italic', margin: 0 }}>SENAI</h1>
          <span className="logo-sub" style={{ color: 'var(--senai-blue-dark)', letterSpacing: '2px' }}>CONNECT</span>
          <h2>{isLogin ? 'Entrar' : 'Cadastrar'}</h2>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-success" role="status">{notice}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="auth-name">Nome Completo</label>
              <input id="auth-name" type="text" name="name" value={formData.name} onChange={handleChange} required autoComplete="name" />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">E-mail institucional</label>
            <input id="auth-email" type="email" name="email" value={formData.email} onChange={handleChange} required autoComplete="email" />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Senha</label>
            <input id="auth-password" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
            {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" className="auth-switch-btn" onClick={() => {
            setIsLogin(!isLogin);
            setError('');
            setNotice('');
          }}>
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já possui conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
