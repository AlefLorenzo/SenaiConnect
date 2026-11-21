import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import './Button.css';

/**
 * Button - Componente de botão reutilizável com design system SENAI Connect
 * Baseado nos padrões das páginas de autenticação e componentes existentes
 *
 * Props:
 * - variant: 'primary' | 'secondary' | 'ghost' | 'danger' (padrão: 'primary')
 * - size: 'sm' | 'md' | 'lg' (padrão: 'md')
 * - loading: boolean - exibe spinner e desabilita o botão
 * - fullWidth: boolean - botão ocupa 100% da largura (padrão: false)
 * - icon: componente Lucide para exibir à esquerda do texto
 * - iconPosition: 'left' | 'right' (padrão: 'left')
 * - children: conteúdo do botão
 * - ...rest: demais props nativas do button (type, disabled, onClick, etc.)
 */
const Button = forwardRef((
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    icon: IconComponent,
    iconPosition = 'left',
    children,
    className = '',
    disabled,
    type = 'button',
    'aria-busy': ariaBusy,
    ...props
  },
  ref
) => {
  const isDisabled = disabled || loading;

  const classNames = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    loading ? 'btn--loading' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classNames}
      disabled={isDisabled}
      aria-busy={loading || ariaBusy}
      aria-disabled={isDisabled}
      {...props}
    >
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <Loader2 size={16} />
        </span>
      )}

      {!loading && IconComponent && iconPosition === 'left' && (
        <span className="btn-icon" aria-hidden="true">
          <IconComponent size={18} />
        </span>
      )}

      <span className="btn-text">{children}</span>

      {!loading && IconComponent && iconPosition === 'right' && (
        <span className="btn-icon" aria-hidden="true">
          <IconComponent size={18} />
        </span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;