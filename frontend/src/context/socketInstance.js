import { io } from 'socket.io-client';

let socketInstance = null;
let socketUserId = null;
let socketAccessToken = null;

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return '';
};

/**
 * Initialize the authenticated socket. The token is used only in the Socket.IO
 * auth handshake and is never placed in the URL/query string.
 */
export function initSocket(userId, accessToken) {
  if (!userId || !accessToken) return null;

  const normalizedUserId = Number(userId);
  const url = getSocketUrl();

  if (socketInstance && socketUserId === normalizedUserId && socketAccessToken === accessToken) {
    return socketInstance;
  }

  if (socketInstance && socketUserId === normalizedUserId) {
    socketAccessToken = accessToken;
    socketInstance.auth = { token: accessToken };
    if (socketInstance.connected) {
      socketInstance.disconnect();
      socketInstance.connect();
    } else {
      socketInstance.connect();
    }
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  socketUserId = normalizedUserId;
  socketAccessToken = accessToken;

  socketInstance = io(url, {
    path: '/socket.io/',
    transports: ['polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 60000,
    autoConnect: true,
    withCredentials: true,
    auth: { token: accessToken },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  return socketInstance;
}

export function updateSocketAuth(accessToken) {
  if (!socketInstance || !socketUserId || !accessToken || accessToken === socketAccessToken) return;
  socketAccessToken = accessToken;
  socketInstance.auth = { token: accessToken };
  if (socketInstance.connected) socketInstance.disconnect();
  socketInstance.connect();
}

export function getSocket() {
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) socketInstance.disconnect();
  socketInstance = null;
  socketUserId = null;
  socketAccessToken = null;
}

export function isSocketConnected() {
  return socketInstance?.connected === true;
}

export function getSocketUserId() {
  return socketUserId;
}
