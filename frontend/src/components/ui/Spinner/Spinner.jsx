import { forwardRef } from 'react';
import './Spinner.css';

/**
 * Spinner - Componente de carregamento reutilizável com design system SENAI Connect
 *
 * Props:
 * - size: 'sm' | 'md' | 'lg' | 'xl' (padrão: 'md')
 * - color: 'primary' | 'white' | 'current' (padrão: 'primary')
 * - thickness: número - espessura da borda em px (padrão: 3)
 * - speed: 'slow' | 'normal' | 'fast' (padrão: 'normal')
 * - label: string - texto para screen readers (padrão: 'Carregando...')
 * - className: classes CSS adicionais
 * - ...rest: demais props nativas
 */
const Spinner = forwardRef((
  {
    size = 'md',
    color = 'primary',
    thickness = 3,
    speed = 'normal',
    label = 'Carregando...',
    className = '',
    style,
    ...props
  },
  ref
) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48
  };

  const speedMap = {
    slow: '2s',
    normal: '1s',
    fast: '0.6s'
  };

  const diameter = sizeMap[size] || sizeMap.md;
  const animationDuration = speedMap[speed] || speedMap.normal;

  const colorStyles = {
    primary: {
      borderColor: 'var(--color-border)',
      borderTopColor: 'var(--color-primary)'
    },
    white: {
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderTopColor: '#fff'
    },
    current: {
      borderColor: 'currentColor',
      borderTopColor: 'currentColor'
    }
  };

  const resolvedColor = colorStyles[color] || colorStyles.primary;

  const spinnerStyle = {
    width: diameter,
    height: diameter,
    borderWidth: thickness,
    borderColor: resolvedColor.borderColor,
    borderTopColor: resolvedColor.borderTopColor,
    animationDuration,
    ...style
  };

  const classNames = [
    'spinner',
    `spinner--${size}`,
    `spinner--${color}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <span
      ref={ref}
      className={classNames}
      style={spinnerStyle}
      role="status"
      aria-live="polite"
      aria-label={label}
      {...props}
    >
      <span className="spinner-visually-hidden">{label}</span>
    </span>
  );
});

Spinner.displayName = 'Spinner';

export default Spinner;