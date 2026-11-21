import { forwardRef } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Alert.css';

/**
 * Alert - Componente de alerta reutilizável com design system SENAI Connect
 *
 * Props:
 * - variant: 'error' | 'success' | 'warning' | 'info' (padrão: 'info')
 * - title: título do alerta (opcional)
 * - children: conteúdo/mensagem do alerta
 * - dismissible: boolean - permite fechar o alerta (padrão: false)
 * - onDismiss: callback quando o alerta é fechado
 * - icon: boolean - exibe ícone (padrão: true)
 * - className: classes CSS adicionais
 * - role: 'alert' | 'status' (padrão: 'alert' para error/warning, 'status' para success/info)
 */
const Alert = forwardRef((
  {
    variant = 'info',
    title,
    children,
    dismissible = false,
    onDismiss,
    icon = true,
    className = '',
    role,
    ...props
  },
  ref
) => {
  const defaultRole = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  const alertRole = role || defaultRole;

  const icons = {
    error: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info
  };

  const IconComponent = icons[variant] || Info;

  const classNames = [
    'alert',
    `alert--${variant}`,
    dismissible ? 'alert--dismissible' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      className={classNames}
      role={alertRole}
      aria-live={variant === 'error' || variant === 'warning' ? 'assertive' : 'polite'}
      {...props}
    >
      {icon && (
        <span className="alert-icon" aria-hidden="true">
          <IconComponent size={20} />
        </span>
      )}

      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div className="alert-message">{children}</div>
      </div>

      {dismissible && (
        <button
          type="button"
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Fechar alerta"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
});

Alert.displayName = 'Alert';

export default Alert;