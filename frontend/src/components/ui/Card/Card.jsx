import { forwardRef } from 'react';
import './Card.css';

/**
 * Card - Componente de card reutilizável com design system SENAI Connect
 *
 * Props:
 * - children: conteúdo do card
 * - padding: 'none' | 'sm' | 'md' | 'lg' (padrão: 'md')
 * - elevation: 'none' | 'sm' | 'md' | 'lg' (padrão: 'md')
 * - bordered: boolean - adiciona borda sutil (padrão: true)
 * - radius: 'sm' | 'md' | 'lg' | 'xl' (padrão: 'lg')
 * - hoverable: boolean - adiciona efeito hover (padrão: false)
 * - className: classes CSS adicionais
 * - as: elemento HTML (padrão: 'div')
 * - ...rest: demais props nativas
 */
const Card = forwardRef((
  {
    children,
    padding = 'md',
    elevation = 'md',
    bordered = true,
    radius = 'lg',
    hoverable = false,
    className = '',
    as: Component = 'div',
    ...props
  },
  ref
) => {
  const classNames = [
    'card',
    `card--padding-${padding}`,
    `card--elevation-${elevation}`,
    `card--radius-${radius}`,
    bordered ? 'card--bordered' : '',
    hoverable ? 'card--hoverable' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Component
      ref={ref}
      className={classNames}
      {...props}
    >
      {children}
    </Component>
  );
});

Card.displayName = 'Card';

export default Card;