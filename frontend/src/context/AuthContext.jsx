import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const SESSION_KEY = 'senai_connect_supabase_session';

function readStoredSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function saveSession(session) {
    if (session && session.access_token) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.setItem('token', session.access_token);
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('token');
}

async function loadProfile(token) {
    const response = await fetch(API_URL + '/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token }
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (USE_MOCK) {
            setUser({
                id: 1,
                name: 'Usuário Demo',
                email: 'demo@senai.br',
                avatar: null,
                role: 'user',
                unidade: 'SENAI São Paulo'
            });
            setLoading(false);
            return undefined;
        }

        let active = true;

        const restoreSession = async () => {
            const storedSession = readStoredSession();
            let token = (storedSession && storedSession.access_token) || sessionStorage.getItem('token');

            if (!token) {
                if (active) setLoading(false);
                return;
            }

            try {
                let result = await loadProfile(token);
                let currentSession = storedSession;

                if (result.response.status === 401 && storedSession && storedSession.refresh_token) {
                    const refreshResponse = await fetch(API_URL + '/api/auth/refresh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh_token: storedSession.refresh_token })
                    });
                    const refreshed = await refreshResponse.json().catch(() => ({}));

                    if (refreshResponse.ok && refreshed.session && refreshed.token) {
                        currentSession = refreshed.session;
                        token = refreshed.token;
                        saveSession(currentSession);
                        result = await loadProfile(token);
                    }
                }

                if (!active) return;

                if (result.response.ok && result.data && !result.data.error) {
                    setUser(result.data);
                    if (currentSession) saveSession(currentSession);
                    else sessionStorage.setItem('token', token);
                } else if (result.response.status === 401 || result.response.status === 403 || result.response.status === 404) {
                    clearSession();
                    setUser(null);
                } else {
                    // Não apaga a sessão em falhas temporárias de rede/servidor.
                    setUser(null);
                }
            } catch (error) {
                console.error('Não foi possível restaurar a sessão:', error);
                if (active) setUser(null);
            } finally {
                if (active) setLoading(false);
            }
        };

        restoreSession();
        return () => {
            active = false;
        };
    }, []);

    const login = useCallback((token, userData, authSession) => {
        if (authSession && authSession.access_token) {
            saveSession(authSession);
        } else if (token) {
            sessionStorage.setItem('token', token);
        }
        setUser(userData || null);
    }, []);

    const logout = useCallback(async () => {
        const token = sessionStorage.getItem('token');
        if (token) {
            try {
                await fetch(API_URL + '/api/auth/logout', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token }
                });
            } catch (error) {
                console.warn('A sessão local será encerrada; o servidor não respondeu ao logout.', error);
            }
        }
        clearSession();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
