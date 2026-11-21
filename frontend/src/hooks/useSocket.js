import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';

/**
 * Hook para acessar o contexto de socket
 * @returns {Object} { socket, notifications, unreadCount, unreadMsgCount, fetchUnreadMessages, markAsRead, fetchNotifications }
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default useSocket;