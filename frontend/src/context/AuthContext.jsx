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
    if (session && session.access_token && session.refresh_token) {
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

async function refreshAccessSession(refreshToken) {
    const response = await fetch(API_URL + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || 'Não foi possível renovar a sessão.');
        error.status = response.status;
        throw error;
    }

    if (!data.session || !data.token || !data.session.refresh_token) {
        const error = new Error('O servidor retornou uma sessão de renovação incompleta.');
        error.status = 502;
        throw error;
    }

    return data;
}

function getSessionExpiry(session) {
    const explicitExpiry = Number(session && session.expires_at);
    if (Number.isFinite(explicitExpiry) && explicitExpiry > 0) {
        return explicitExpiry;
    }

    const expiresIn = Number(session && session.expires_in);
    return Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600);
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [authSession, setAuthSession] = useState(() => readStoredSession());
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
                if (active) {
                    setAuthSession(null);
                    setLoading(false);
                }
                return;
            }

            try {
                let result = await loadProfile(token);
                let currentSession = storedSession;

                if (result.response.status === 401 && storedSession && storedSession.refresh_token) {
                    const refreshed = await refreshAccessSession(storedSession.refresh_token);
                    currentSession = refreshed.session;
                    token = refreshed.token;
                    result = await loadProfile(token);
                }

                if (!active) return;

                if (result.response.ok && result.data && !result.data.error) {
                    setUser(result.data);
                    setAuthSession(currentSession || null);
                    if (currentSession) saveSession(currentSession);
                    else sessionStorage.setItem('token', token);
                } else if ([401, 403, 404].includes(result.response.status)) {
                    clearSession();
                    setAuthSession(null);
                    setUser(null);
                } else {
                    // Falhas temporárias não invalidam uma sessão que ainda pode ser renovada.
                    setUser(null);
                    setAuthSession(currentSession || null);
                }
            } catch (error) {
                console.error('Não foi possível restaurar a sessão:', error);
                if (active) {
                    if ([400, 401, 403].includes(error.status)) {
                        clearSession();
                        setAuthSession(null);
                    }
                    setUser(null);
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        restoreSession();
        return () => {
            active = false;
        };
    }, []);

    // Renova o access token automaticamente antes de expirar. A renovação usa
    // o endpoint do backend para manter a chave e a lógica do Supabase no servidor.
    useEffect(() => {
        if (USE_MOCK || !authSession || !authSession.refresh_token) return undefined;

        let cancelled = false;
        let timeoutId = null;

        const schedule = (delay) => {
            if (cancelled) return;
            if (timeoutId) window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(renew, delay);
        };

        const renew = async () => {
            if (cancelled) return;

            try {
                const refreshed = await refreshAccessSession(authSession.refresh_token);
                if (cancelled) return;

                saveSession(refreshed.session);
                setAuthSession(refreshed.session);
                setUser(refreshed.user || null);
            } catch (error) {
                if (cancelled) return;

                if ([400, 401, 403].includes(error.status)) {
                    clearSession();
                    setAuthSession(null);
                    setUser(null);
                    return;
                }

                console.warn('A renovação automática da sessão falhou temporariamente:', error);
                // Erros de rede/limite/servidor são tentados novamente sem desconectar o usuário.
                schedule(error.status === 429 ? 60000 : 30000);
            }
        };

        const secondsUntilExpiry = getSessionExpiry(authSession) - Math.floor(Date.now() / 1000);
        schedule(Math.max(1000, (secondsUntilExpiry - 60) * 1000));

        return () => {
            cancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [authSession]);

    const login = useCallback((token, userData, session) => {
        if (session && session.access_token && session.refresh_token) {
            saveSession(session);
            setAuthSession(session);
        } else if (token) {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.setItem('token', token);
            setAuthSession(null);
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
        setAuthSession(null);
        setUser(null);
    }, []);

    const isAdmin = Boolean(user && user.admin_role);

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};
