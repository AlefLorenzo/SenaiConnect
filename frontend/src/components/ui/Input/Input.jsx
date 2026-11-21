import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import './Input.css';

/**
 * Input - Componente de entrada reutilizável com design system SENAI Connect
 * Baseado nos padrões das páginas de autenticação (login, registro, forgot/reset password)
 *
 * Props:
 * - label: Texto do label (obrigatório para acessibilidade)
 * - error: Mensagem de erro (exibe estado de erro)
 * - hint: Texto de ajuda/hint (exibido abaixo do input)
 * - icon: Ícone do lucide-react para exibir à esquerda (ex: Mail, Lock, User)
 * - showPasswordToggle: Habilita botão mostrar/ocultar senha
 * - success: Mensagem de sucesso (exibe estado de sucesso)
 * - fullWidth: Input ocupa 100% da largura (padrão: true)
 * - as: 'input' | 'textarea' | 'select' (padrão: 'input')
 * - options: Array de {value, label} para quando as="select"
 * - rows: número de linhas para textarea
 * - ...rest: Demais props nativas do input/textarea/select
 */
const Input = forwardRef((
  {
    label,
    error,
    hint,
    icon: IconComponent,
    showPasswordToggle = false,
    success,
    fullWidth = true,
    id: providedId,
    className = '',
    'aria-describedby': ariaDescribedBy,
    as = 'input',
    options = [],
    rows,
    ...props
  },
  ref
) => {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const successId = `${id}-success`;

  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const describedByParts = [];
  if (error) describedByParts.push(errorId);
  if (success) describedByParts.push(successId);
  if (hint && !error && !success) describedByParts.push(hintId);
  if (ariaDescribedBy) describedByParts.push(ariaDescribedBy);

  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  const handleTogglePassword = () => {
    setShowPassword(prev => !prev);
  };

  const inputType = showPasswordToggle && showPassword ? 'text' : (props.type || 'text');

  const isTextarea = as === 'textarea';
  const isSelect = as === 'select';

  const commonProps = {
    ref,
    id,
    className: `form-input ${error ? 'form-input--error' : ''} ${success ? 'form-input--success' : ''} ${isTextarea ? 'form-textarea' : ''} ${isSelect ? 'form-select' : ''}`,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': describedBy,
    disabled: props.disabled,
    required: props.required,
    onFocus: () => { setIsFocused(true); props.onFocus?.(); },
    onBlur: () => { setIsFocused(false); props.onBlur?.(); },
    ...props
  };

  return (
    <div className={`form-field ${fullWidth ? 'form-field--full' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}

      <div
        className={`input-wrapper ${isFocused ? 'input-wrapper--focused' : ''} ${error ? 'input-wrapper--error' : ''} ${success ? 'input-wrapper--success' : ''}`}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => setIsFocused(false)}
      >
        {IconComponent && !isSelect && (
          <span className="input-icon" aria-hidden="true">
            <IconComponent size={20} />
          </span>
        )}

        {isTextarea ? (
          <textarea
            {...commonProps}
            rows={rows || 3}
            style={{ minHeight: '80px', resize: 'vertical', ...props.style }}
          />
        ) : isSelect ? (
          <select {...commonProps}>
            {options.map((opt, idx) => (
              <option key={opt.value || idx} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...commonProps}
            type={inputType}
          />
        )}

        {showPasswordToggle && !isTextarea && !isSelect && (
          <button
            type="button"
            className="input-toggle"
            onClick={handleTogglePassword}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            disabled={props.disabled}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>

      {error && (
        <span id={errorId} className="form-error" role="alert" aria-live="polite">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </span>
      )}

      {success && (
        <span id={successId} className="form-success" role="status" aria-live="polite">
          <CheckCircle size={12} aria-hidden="true" />
          {success}
        </span>
      )}

      {hint && !error && !success && (
        <span id={hintId} className="form-hint">
          <Info size={12} aria-hidden="true" />
          {hint}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;