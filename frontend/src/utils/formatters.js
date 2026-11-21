/**
 * Utility functions for formatting and transforming data
 */

/**
 * Truncates a name to a maximum number of characters, adding ellipsis if truncated.
 * Used for Stories, message previews, and other UI elements with limited space.
 *
 * @param {string} name - The full name to truncate
 * @param {number} maxLength - Maximum characters before truncation (default: 7)
 * @returns {string} Truncated name with ellipsis if needed
 */
export const truncateName = (name, maxLength = 7) => {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + '…';
};

/**
 * Formats a date to a relative time string (e.g., "2h", "3d", "agora")
 * @param {string|Date} date - The date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return then.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

/**
 * Formats a timestamp for "last seen" display
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted time string (e.g., "14:30")
 */
export const formatLastSeen = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formats a number for display (e.g., 1500 -> "1.5k", 1000000 -> "1M")
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export const formatCount = (num) => {
  if (!num && num !== 0) return '0';
  const n = Number(num);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
};

/**
 * Gets initials from a name (first letter of first and last name)
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Formats a date for display in profiles (e.g., "Membro desde: 15/03/2024")
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDateBR = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
};

/**
 * Generates a handle from a name (e.g., "João Silva" -> "@joao.silva")
 * @param {string} name - Full name
 * @returns {string} Formatted handle
 */
export const generateHandle = (name) => {
  if (!name) return '@usuario';
  return '@' + name.toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
};