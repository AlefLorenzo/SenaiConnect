import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Shield, ArrowRight } from 'lucide-react';
import './Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const emailRef = useRef(null);
  const errorRef = useRef(null);

  // Focus management para erro
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  // Auto-focus email input
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validateEmail = (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'E-mail inválido';
    }
    return '';
  };

  const handleBlur = (e) => {
    const fieldError = validateEmail(e.target.value);
    setError(fieldError);
  };

  const handleChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailError = validateEmail(email);
    if (emailError || !email) {
      setError(emailError || 'E-mail obrigatório');
      emailRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/password/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao solicitar recuperação.');
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
      <h2 className="auth-success-title">E-mail Enviado!</h2>
      <p className="auth-success-text">
        Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
      </p>
      <Link to="/login" className="btn btn--primary btn--full">
        Voltar ao Login
      </Link>
    </div>
  );

  // Render form state outside of JSX to avoid parser issues with nested ternary
  const formState = (
    <div>
      {errorAlert}

      <form onSubmit={handleSubmit} className="login-form auth-form" noValidate>
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
              placeholder="nome.sobrenome@estudante.senai.com"
              className={`form-input ${error ? 'form-input--error' : ''}`}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'email-error' : 'email-hint'}
              disabled={loading}
              required
            />
          </div>
          {error ? (
            <span id="email-error" className="form-error" role="alert">
              {error}
            </span>
          ) : (
            <span id="email-hint" className="form-hint">
              Use @estudante.senai.com ou @docente.senai.com
            </span>
          )}
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full auth-submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="btn-spinner" aria-hidden="true"></span>
              <span>Enviando…</span>
            </>
          ) : (
            <>
              <span>Enviar Link de Recuperação</span>
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
            <h1 className="login-title">Recuperar Senha</h1>
            <p className="login-subtitle">
              Digite seu e-mail institucional e enviaremos instruções para redefinir sua senha.
            </p>
          </header>

          {/* Success State */}
          {success ? successState : formState}
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;