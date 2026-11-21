import { forwardRef } from 'react';
import './Badge.css';

/**
 * Badge - Componente de badge/etiqueta reutilizável com design system SENAI Connect
 *
 * Props:
 * - variant: 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info' (padrão: 'neutral')
 * - size: 'sm' | 'md' | 'lg' (padrão: 'md')
 * - dot: boolean - exibe ponto colorido antes do texto (padrão: false)
 * - children: conteúdo do badge
 * - className: classes CSS adicionais
 * - ...rest: demais props nativas
 */
const Badge = forwardRef((
  {
    variant = 'neutral',
    size = 'md',
    dot = false,
    children,
    className = '',
    ...props
  },
  ref
) => {
  const classNames = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    dot ? 'badge--dot' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <span
      ref={ref}
      className={classNames}
      {...props}
    >
      {dot && <span className="badge-dot" aria-hidden="true" />}
      <span className="badge-text">{children}</span>
    </span>
  );
});

Badge.displayName = 'Badge';

export default Badge;