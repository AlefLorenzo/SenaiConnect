import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // In mock mode, provide a mock user for development
        if (USE_MOCK) {
            const mockUser = {
                id: 1,
                name: 'Usuário Demo',
                email: 'demo@senai.br',
                avatar: null,
                role: 'user',
                unidade: 'SENAI São Paulo'
            };
            setUser(mockUser);
            setLoading(false);
            return;
        }

        const token = sessionStorage.getItem('token');
        if (token) {
            fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    sessionStorage.removeItem('token');
                } else {
                    setUser(data);
                }
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, []);

    const login = (token, userData) => {
        sessionStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = () => {
        sessionStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
