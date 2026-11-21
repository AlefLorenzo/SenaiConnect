import { forwardRef } from 'react';
import { ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
import './Link.css';

/**
 * Link - Componente de link reutilizável com design system SENAI Connect
 *
 * Props:
 * - variant: 'inline' | 'standalone' | 'button' (padrão: 'inline')
 * - icon: 'none' | 'arrow-right' | 'arrow-left' | 'external' | componente Lucide (padrão: 'none')
 * - iconPosition: 'left' | 'right' (padrão: 'right' para standalone, 'left' para button)
 * - underline: 'none' | 'hover' | 'always' (padrão: 'hover' para inline, 'none' para outros)
 * - children: conteúdo do link
 * - className: classes CSS adicionais
 * - ...rest: demais props nativas do <a> (href, target, rel, onClick, etc.)
 */
const Link = forwardRef((
  {
    variant = 'inline',
    icon = 'none',
    iconPosition,
    underline,
    children,
    className = '',
    ...props
  },
  ref
) => {
  // Default icon position based on variant
  const defaultIconPosition = variant === 'standalone' ? 'right' : 'left';
  const resolvedIconPosition = iconPosition || defaultIconPosition;

  // Default underline based on variant
  const defaultUnderline = variant === 'inline' ? 'hover' : 'none';
  const resolvedUnderline = underline ?? defaultUnderline;

  // Resolve icon component
  let IconComponent = null;
  if (icon === 'arrow-right') IconComponent = ArrowRight;
  else if (icon === 'arrow-left') IconComponent = ArrowLeft;
  else if (icon === 'external') IconComponent = ExternalLink;
  else if (icon && typeof icon === 'object') IconComponent = icon;

  const classNames = [
    'link',
    `link--${variant}`,
    `link--underline-${resolvedUnderline}`,
    resolvedIconPosition === 'left' ? 'link--icon-left' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <a
      ref={ref}
      className={classNames}
      {...props}
    >
      {IconComponent && resolvedIconPosition === 'left' && (
        <span className="link-icon" aria-hidden="true">
          <IconComponent size={16} />
        </span>
      )}

      <span className="link-text">{children}</span>

      {IconComponent && resolvedIconPosition === 'right' && (
        <span className="link-icon" aria-hidden="true">
          <IconComponent size={16} />
        </span>
      )}
    </a>
  );
});

Link.displayName = 'Link';

export default Link;