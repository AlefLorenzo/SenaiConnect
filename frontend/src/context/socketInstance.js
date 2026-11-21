import { io } from 'socket.io-client';

// Module-level singleton socket instance
let socketInstance = null;
let socketUserId = null;
let socketUrl = null;
let isInitialized = false;

// Get socket URL - connect directly to backend to avoid proxy WebSocket upgrade issues
const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // Use backend URL directly for socket.io to avoid WebSocket upgrade issues through Vite proxy
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  return '';
};

/**
 * Initialize or get the socket instance
 * @param {number} userId - The user ID to register with the socket
 * @returns {Socket|null} The socket.io socket instance
 */
export function initSocket(userId) {
  if (!userId) return null;

  const url = getSocketUrl();

  // If we already have a socket for this user and it's connected, reuse it
  if (socketInstance && socketInstance.connected && socketUserId === userId) {
    console.log('[socketInstance] Reusing existing socket for user:', userId);
    return socketInstance;
  }

  // If socket exists but for different user or disconnected, clean up
  if (socketInstance) {
    console.log('[socketInstance] Cleaning up old socket');
    socketInstance.disconnect();
    socketInstance = null;
    socketUserId = null;
  }

  socketUrl = url;
  socketUserId = userId;

  console.log('[socketInstance] Creating new socket connection to:', url);

  socketInstance = io(url, {
    path: '/socket.io/',
    // Use only polling to avoid WebSocket upgrade issues through proxy
    transports: ['polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 60000,
    autoConnect: true,
    withCredentials: true,
    // Match server ping settings to prevent transport close
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  console.log('[socketInstance] Socket.io URI:', socketInstance.io?.uri);

  isInitialized = true;
  return socketInstance;
}

/**
 * Get the current socket instance
 * @returns {Socket|null}
 */
export function getSocket() {
  return socketInstance;
}

/**
 * Disconnect and cleanup the socket
 */
export function disconnectSocket() {
  if (socketInstance) {
    console.log('[socketInstance] Disconnecting socket');
    socketInstance.disconnect();
    socketInstance = null;
    socketUserId = null;
    isInitialized = false;
  }
}

/**
 * Check if socket is initialized and connected
 * @returns {boolean}
 */
export function isSocketConnected() {
  return socketInstance?.connected === true;
}

/**
 * Get the socket user ID
 * @returns {number|null}
 */
export function getSocketUserId() {
  return socketUserId;
}