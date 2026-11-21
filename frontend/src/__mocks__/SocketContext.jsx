// Mock SocketContext for testing
import React from 'react';

export const SocketContext = React.createContext({
  socket: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
});