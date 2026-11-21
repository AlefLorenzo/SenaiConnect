import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';
import './Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ password: '', confirmPassword: '' });
  const [success, setSuccess] = useState(false);

  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Token de recuperação inválido ou ausente na URL.');
    }
  }, [token]);

  // Focus management para erro
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  // Auto-focus password input
  useEffect(() => {
    if (!success && token) {
      passwordRef.current?.focus();
    }
  }, [success, token]);

  const validatePassword = (value) => {
    if (value && value.length < 6) {
      return 'Mínimo 6 caracteres';
    }
    return '';
  };

  const validateConfirmPassword = (value) => {
    if (value && value !== password) {
      return 'As senhas não coincidem';
    }
    return '';
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    let fieldError = '';
    if (name === 'password') fieldError = validatePassword(value);
    if (name === 'confirmPassword') fieldError = validateConfirmPassword(value);
    setFieldErrors(prev => ({ ...prev, [name]: fieldError }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'password') setPassword(value);
    if (name === 'confirmPassword') setConfirmPassword(value);
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Revalidar confirmPassword quando password muda
    if (name === 'password' && fieldErrors.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    setError('');

    const passwordError = validatePassword(password);
    const confirmError = validateConfirmPassword(confirmPassword);
    const hasEmptyFields = !password || !confirmPassword;

    if (passwordError || confirmError || hasEmptyFields) {
      setFieldErrors({
        password: passwordError || (!password ? 'Nova senha obrigatória' : ''),
        confirmPassword: confirmError || (!confirmPassword ? 'Confirme a senha' : '')
      });
      if (passwordError || !password) passwordRef.current?.focus();
      else confirmPasswordRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/password/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render error alert outside of JSX to avoid parser issues
  const errorAlert = error ? (
    <div
      ref={errorRef}
      className="login-alert auth-alert"
      role="alert"
      aria-live="polite"
      tabIndex={-1}
    >
      <AlertCircle size={18} aria-hidden="true" />
      <span>{error}</span>
    </div>
  ) : null;

  // Render success state outside of JSX
  const successState = (
    <div className="auth-success" role="status" aria-live="polite">
      <div className="auth-success-icon" aria-hidden="true">
        <CheckCircle2 size={32} />
      </div>
      <h2 className="auth-success-title">Senha Redefinida!</h2>
      <p className="auth-success-text">
        Sua senha foi alterada com sucesso. Agora você pode acessar sua conta normalmente.
      </p>
      <button className="btn btn--primary btn--full" onClick={() => navigate('/login')}>
        Fazer Login
      </button>
    </div>
  );

  // Render form state outside of JSX to avoid parser issues with nested ternary
  const formState = (
    <div>
      {errorAlert}

      <form onSubmit={handleSubmit} className="login-form auth-form" noValidate>
        <div className="form-field">
          <label htmlFor="password" className="form-label">
            Nova Senha
          </label>
          <div className="input-wrapper">
            <Lock size={20} className="input-icon" aria-hidden="true" />
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Mínimo de 6 caracteres"
              className={`form-input ${fieldErrors.password ? 'form-input--error' : ''}`}
              aria-invalid={fieldErrors.password ? 'true' : 'false'}
              aria-describedby={fieldErrors.password ? 'password-error' : (showPassword ? 'password-hint' : 'password-hint')}
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
          {(showPassword || !fieldErrors.password) ? (
            <span id="password-hint" className="form-hint">
              {showPassword ? 'Sua senha está visível' : 'Mínimo 6 caracteres'}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="confirmPassword" className="form-label">
            Confirmar Nova Senha
          </label>
          <div className="input-wrapper">
            <Lock size={20} className="input-icon" aria-hidden="true" />
            <input
              ref={confirmPasswordRef}
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Repita a senha"
              className={`form-input ${fieldErrors.confirmPassword ? 'form-input--error' : ''}`}
              aria-invalid={fieldErrors.confirmPassword ? 'true' : 'false'}
              aria-describedby={fieldErrors.confirmPassword ? 'confirm-error' : undefined}
              disabled={loading}
              required
            />
          </div>
          {fieldErrors.confirmPassword ? (
            <span id="confirm-error" className="form-error" role="alert">
              {fieldErrors.confirmPassword}
            </span>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full auth-submit"
          disabled={loading || !token}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="btn-spinner" aria-hidden="true"></span>
              <span>Salvando…</span>
            </>
          ) : (
            <>
              <span>Salvar Nova Senha</span>
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <footer className="login-footer auth-footer">
        <Link to="/login" className="auth-switch-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Voltar para o Login</span>
        </Link>
      </footer>
    </div>
  );

  return (
    <div className="login-page">
      <main className="login-main" role="main">
        <div className="login-card auth-card">
          {/* Header */}
          <header className="login-header auth-header">
            <div className="login-brand auth-brand" aria-hidden="true">
              <Shield size={28} className="login-icon" />
            </div>
            <h1 className="login-title">{success ? 'Senha Redefinida!' : 'Criar Nova Senha'}</h1>
            <p className="login-subtitle">
              {success
                ? 'Sua senha foi alterada com sucesso. Agora você pode acessar sua conta normalmente.'
                : 'Digite sua nova senha abaixo.'}
            </p>
          </header>

          {/* Success State */}
          {success ? successState : formState}
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;