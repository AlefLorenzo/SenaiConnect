import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    <main className="auth-container">
      <div className="auth-ambient auth-ambient-one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-two" aria-hidden="true" />

      <section className="auth-brand-panel" aria-label="SENAI Connect">
        <div className="auth-brand-lockup">
          <span className="auth-brand-mark">S</span>
          <span className="auth-brand-name">SENAI <strong>CONNECT</strong></span>
        </div>

        <div className="auth-brand-copy">
          <span className="auth-eyebrow">CONECTANDO O FUTURO</span>
          <h1>Conhecimento que aproxima. <em>Oportunidades que transformam.</em></h1>
          <p>Entre na comunidade SENAI e acompanhe pessoas, projetos, cursos, eventos e oportunidades em um só lugar.</p>
        </div>

        <div className="auth-brand-highlights">
          <div className="auth-highlight"><span className="auth-highlight-dot" /><span>Comunidade de aprendizagem</span></div>
          <div className="auth-highlight"><span className="auth-highlight-dot" /><span>Conteúdos e oportunidades</span></div>
        </div>
        <span className="auth-brand-footer">SENAI CONNECT <span>·</span> APRENDER, COMPARTILHAR, EVOLUIR</span>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <header className="auth-header">
            <div className="auth-mobile-brand">
              <span className="auth-brand-mark">S</span>
              <span className="auth-brand-name">SENAI <strong>CONNECT</strong></span>
            </div>
            <span className="auth-form-kicker">{isLogin ? 'BEM-VINDO DE VOLTA' : 'FAÇA PARTE DA COMUNIDADE'}</span>
            <h2>{isLogin ? 'Acesse sua conta' : 'Crie sua conta'}</h2>
            <p>{isLogin ? 'Entre com seu e-mail institucional para continuar.' : 'Preencha seus dados para começar sua jornada.'}</p>
          </header>

          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="auth-success" role="status">{notice}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="auth-name">Nome completo</label>
                <input id="auth-name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Como podemos chamar você?" required autoComplete="name" />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-email">E-mail institucional</label>
              <input id="auth-email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="seu.email@senai.com.br" required autoComplete="email" />
            </div>

            <div className="form-group">
              <div className="auth-label-row">
                <label htmlFor="auth-password">Senha</label>
                {isLogin && <Link to="/forgot-password" className="auth-forgot-link">Esqueceu a senha?</Link>}
              </div>
              <input id="auth-password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Digite sua senha" required minLength={6} autoComplete={isLogin ? 'current-password' : 'new-password'} />
            </div>

            <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
              <span>{loading ? 'Aguarde...' : (isLogin ? 'Entrar na plataforma' : 'Criar minha conta')}</span>
              {!loading && <span className="auth-submit-arrow" aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="auth-footer">
            <span>{isLogin ? 'Ainda não tem uma conta?' : 'Já faz parte da comunidade?'}</span>
            <button type="button" className="auth-switch-btn" onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setNotice('');
            }}>
              {isLogin ? 'Cadastre-se' : 'Fazer login'}
            </button>
          </div>

          <div className="auth-security-note">
            <span className="auth-security-icon" aria-hidden="true">✓</span>
            <span>Ambiente protegido para sua comunidade acadêmica.</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Auth;
