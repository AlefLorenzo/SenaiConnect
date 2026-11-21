// Mock AuthContext for testing
import React from 'react';

export const AuthContext = React.createContext({
  user: {
    id: 1,
    name: 'Test User',
    avatar: null,
    role: 'aluno',
    isVerified: true,
  },
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
});

export const useAuth = () => React.useContext(AuthContext);