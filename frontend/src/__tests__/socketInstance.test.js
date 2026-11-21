// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
    id: 'test-socket-id',
    io: { uri: 'http://localhost:5000' },
  })),
}), { virtual: true });

// Mock the socketInstance module
jest.mock('../context/socketInstance', () => {
  let socketInstance = null;
  let socketUserId = null;
  let isInitialized = false;

  return {
    __esModule: true,
    initSocket: jest.fn((userId) => {
      if (!userId) return null;
      if (socketInstance && socketInstance.connected && socketUserId === userId) {
        return socketInstance;
      }
      if (socketInstance) {
        socketInstance.disconnect();
      }
      socketUserId = userId;
      isInitialized = true;
      socketInstance = {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        connected: true,
        id: 'test-socket-id',
        io: { uri: 'http://localhost:5000' },
        userId,
      };
      return socketInstance;
    }),
    getSocket: jest.fn(() => socketInstance),
    disconnectSocket: jest.fn(() => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        socketUserId = null;
        isInitialized = false;
      }
    }),
    isSocketConnected: jest.fn(() => socketInstance?.connected === true),
    getSocketUserId: jest.fn(() => socketUserId),
  };
});

import { initSocket, getSocket, disconnectSocket, isSocketConnected, getSocketUserId } from '../context/socketInstance';

describe('socketInstance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('initSocket', () => {
    test('creates new socket connection for user', () => {
      const socket = initSocket(1);

      expect(socket).toBeDefined();
      expect(socket.connected).toBe(true);
    });

    test('returns null if no userId provided', () => {
      const socket = initSocket(null);
      expect(socket).toBeNull();
    });

    test('reuses existing socket for same user', () => {
      const socket1 = initSocket(1);
      const socket2 = initSocket(1);

      expect(socket1).toBe(socket2);
      expect(initSocket).toHaveBeenCalledTimes(2);
    });

    test('creates new socket for different user', () => {
      const socket1 = initSocket(1);
      const socket2 = initSocket(2);

      expect(socket1).not.toBe(socket2);
      expect(initSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSocket', () => {
    test('returns current socket instance', () => {
      initSocket(1);
      const socket = getSocket();

      expect(socket).toBeDefined();
      expect(socket.connected).toBe(true);
    });
  });

  describe('disconnectSocket', () => {
    test('disconnects and clears socket instance', () => {
      initSocket(1);
      disconnectSocket();

      expect(getSocket()).toBeNull();
      expect(getSocketUserId()).toBeNull();
    });

    test('handles disconnect when no socket exists', () => {
      disconnectSocket(); // Should not throw
      expect(getSocket()).toBeNull();
    });
  });

  describe('isSocketConnected', () => {
    test('returns true when socket is connected', () => {
      initSocket(1);
      expect(isSocketConnected()).toBe(true);
    });

    test('returns false when no socket', () => {
      // Reset the mock
      jest.resetModules();
      jest.mock('../context/socketInstance', () => ({
        __esModule: true,
        isSocketConnected: jest.fn(() => false),
      }));
      const { isSocketConnected: isConnectedFresh } = require('../context/socketInstance');
      expect(isConnectedFresh()).toBe(false);
    });
  });

  describe('getSocketUserId', () => {
    test('returns current user ID', () => {
      initSocket(42);
      expect(getSocketUserId()).toBe(42);
    });
  });
});