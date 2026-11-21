import { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext.jsx';
import './AdminLogin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const errorRef = useRef(null);

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  // Focus management para erro global
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  const validateField = (name, value) => {
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'E-mail inválido';
    }
    if (name === 'password' && value && value.length < 6) {
      return 'Mínimo 6 caracteres';
    }
    return '';
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const fieldError = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: fieldError }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
    // Limpar erro do campo ao digitar
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Validação completa
    const emailError = validateField('email', email);
    const passwordError = validateField('password', password);

    if (emailError || passwordError || !email || !password) {
      setFieldErrors({
        email: emailError || (!email ? 'E-mail obrigatório' : ''),
        password: passwordError || (!password ? 'Senha obrigatória' : '')
      });
      // Focar primeiro campo com erro
      if (emailError || !email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user);
        navigate(data.redirectTo || '/admin/dashboard');
      } else {
        setError(data.error || 'Credenciais inválidas. Verifique e tente novamente.');
        passwordRef.current?.focus();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    navigate('/forgot-password');
  };

  const handleRegister = (e) => {
    e.preventDefault();
    navigate('/register');
  };

  return (
    <div className="login-page">
      <main className="login-main" role="main">
        <div className="login-card">
          {/* Header Minimalista */}
          <header className="login-header">
            <div className="login-brand" aria-hidden="true">
              <Shield size={28} className="login-icon" />
            </div>
            <h1 className="login-title">SENAI Connect</h1>
            <p className="login-subtitle">Painel Administrativo</p>
          </header>

          {/* Alert Global - Acessível */}
          {error ? (
            <div
              ref={errorRef}
              className="login-alert"
              role="alert"
              aria-live="polite"
              tabIndex={-1}
            >
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Formulário */}
          <form onSubmit={handleLogin} className="login-form" noValidate>
            {/* E-mail */}
            <div className="form-field">
              <label htmlFor="email" className="form-label">
                E-mail Institucional
              </label>
              <div className="input-wrapper">
                <Mail size={20} className="input-icon" aria-hidden="true" />
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="admin@senai.com"
                  className={`form-input ${fieldErrors.email ? 'form-input--error' : ''}`}
                  aria-invalid={fieldErrors.email ? 'true' : 'false'}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  disabled={loading}
                  required
                />
              </div>
              {fieldErrors.email ? (
                <span id="email-error" className="form-error" role="alert">
                  {fieldErrors.email}
                </span>
              ) : null}
            </div>

            {/* Senha */}
            <div className="form-field">
              <div className="form-label-row">
                <label htmlFor="password" className="form-label">
                  Senha
                </label>
                <a
                  href="/forgot-password"
                  className="form-link"
                  onClick={handleForgotPassword}
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="input-wrapper">
                <Lock size={20} className="input-icon" aria-hidden="true" />
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  className={`form-input ${fieldErrors.password ? 'form-input--error' : ''}`}
                  aria-invalid={fieldErrors.password ? 'true' : 'false'}
                  aria-describedby={fieldErrors.password ? 'password-error' : (showPassword ? 'password-hint' : undefined)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {fieldErrors.password ? (
                <span id="password-error" className="form-error" role="alert">
                  {fieldErrors.password}
                </span>
              ) : null}
              {showPassword && !fieldErrors.password ? (
                <span id="password-hint" className="form-hint">
                  Sua senha está visível
                </span>
              ) : null}
            </div>

            {/* Botão Submit */}
            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  <span>Autenticando…</span>
                </>
              ) : (
                <>
                  <span>Entrar no painel</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Footer - Link Cadastro */}
          <footer className="login-footer">
            <p className="login-footer-text">
              Não tem acesso?{' '}
              <a href="/register" className="form-link" onClick={handleRegister}>
                Solicite ao administrador
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;