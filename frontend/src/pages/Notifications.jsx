import { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { Bell, Heart, MessageCircle, UserPlus, CheckCircle, AtSign, X, Settings, ChevronDown, ChevronUp, BellRing, BellOff, Mail, Smartphone } from 'lucide-react';
import Avatar from '../components/Avatar';
import './Notifications.css';

const getNotificationIcon = (type) => {
    switch (type) {
        case 'like': return <Heart size={20} fill="#EF4444" />;
        case 'comment': return <MessageCircle size={20} fill="#0066CC" />;
        case 'follow': return <UserPlus size={20} fill="#10B981" />;
        case 'friend_request': return <UserPlus size={20} fill="#F59E0B" />;
        case 'friend_accepted': return <CheckCircle size={20} fill="#10B981" />;
        case 'mention': return <AtSign size={20} fill="#8B5CF6" />;
        default: return <Bell size={20} fill="#6B7280" />;
    }
};

const getNotificationTypeLabel = (type) => {
    const labels = {
        like: 'curtiu sua publicação',
        comment: 'comentou na sua publicação',
        follow: 'começou a te seguir',
        friend_request: 'enviou uma solicitação de amizade',
        friend_accepted: 'aceitou sua solicitação de amizade',
        mention: 'te mencionou',
    };
    return labels[type] || 'enviou uma notificação';
};

const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const groupNotificationsByDate = (notifications) => {
    const groups = {};
    notifications.forEach(n => {
        const date = new Date(n.created_at).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(n);
    });
    return groups;
};

const formatGroupDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Notifications = () => {
    const { notifications, unreadCount, markAsRead, fetchNotifications } = useContext(SocketContext);
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [allNotifications, setAllNotifications] = useState(notifications);
    const observerRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Notification preferences state
    const [showPreferences, setShowPreferences] = useState(false);
    const [preferences, setPreferences] = useState({
      pushEnabled: true,
      emailEnabled: true,
      likeNotifications: true,
      commentNotifications: true,
      followNotifications: true,
      mentionNotifications: true,
      friendRequestNotifications: true,
      friendAcceptedNotifications: true,
      groupNotifications: true,
      eventNotifications: true,
      storyNotifications: true,
    });
    const [savingPreferences, setSavingPreferences] = useState(false);

    // Update allNotifications when notifications from socket change
    useEffect(() => {
        setAllNotifications(notifications);
    }, [notifications]);

    // Infinite scroll observer
    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first.isIntersecting && hasMore && !loading) {
                    loadMore();
                }
            },
            { rootMargin: '100px', threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [hasMore, loading]);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`${API_URL}/api/notifications?page=${page + 1}&limit=20`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    setAllNotifications(prev => [...prev, ...data]);
                    setPage(prev => prev + 1);
                } else {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Erro ao carregar mais notificações:', err);
        } finally {
            setLoading(false);
        }
    }, [page, hasMore, loading]);

    // Load notification preferences from backend
    const loadPreferences = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`${API_URL}/api/notifications/preferences`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPreferences(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error('Erro ao carregar preferências:', err);
        }
    }, []);

    // Save notification preferences to backend
    const savePreferences = async () => {
        setSavingPreferences(true);
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`${API_URL}/api/notifications/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(preferences)
            });
            if (res.ok) {
                console.log('Preferências salvas com sucesso');
            }
        } catch (err) {
            console.error('Erro ao salvar preferências:', err);
        } finally {
            setSavingPreferences(false);
        }
    };

    // Load preferences on mount
    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    const handleClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.post_id) {
            navigate('/');
        } else if (notification.source_user_id) {
            navigate(`/profile/${notification.source_user_id}`);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const token = sessionStorage.getItem('token');
            await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error('Erro ao marcar todas como lidas:', err);
        }
    };

    const groupedNotifications = groupNotificationsByDate(allNotifications);

    const handlePreferenceChange = (key, value) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    const preferenceOptions = [
        { key: 'pushEnabled', label: 'Notificações push', icon: Smartphone, description: 'Receber notificações no navegador' },
        { key: 'emailEnabled', label: 'Notificações por email', icon: Mail, description: 'Receber resumo diário por email' },
        { key: 'likeNotifications', label: 'Curtidas', icon: Heart, description: 'Quando alguém curte suas publicações' },
        { key: 'commentNotifications', label: 'Comentários', icon: MessageCircle, description: 'Quando alguém comenta suas publicações' },
        { key: 'followNotifications', label: 'Novos seguidores', icon: UserPlus, description: 'Quando alguém começa a te seguir' },
        { key: 'mentionNotifications', label: 'Menções', icon: AtSign, description: 'Quando alguém te menciona' },
        { key: 'friendRequestNotifications', label: 'Solicitações de amizade', icon: UserPlus, description: 'Quando alguém te envia solicitação' },
        { key: 'friendAcceptedNotifications', label: 'Amizades aceitas', icon: CheckCircle, description: 'Quando sua solicitação é aceita' },
        { key: 'groupNotifications', label: 'Grupos', icon: UserPlus, description: 'Atividades nos seus grupos' },
        { key: 'eventNotifications', label: 'Eventos', icon: BellRing, description: 'Lembretes e atualizações de eventos' },
        { key: 'storyNotifications', label: 'Histórias', icon: BellRing, description: 'Novas histórias de quem você segue' },
    ];

    return (
        <div className="notifications-page">
            <div className="notifications-page-header">
                <h1>Notificações</h1>
                <div className="header-actions">
                    {unreadCount > 0 && (
                        <button className="mark-all-read-btn" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                            Marcar todas como lidas
                        </button>
                    )}
                    <button
                        className="preferences-toggle-btn"
                        onClick={() => setShowPreferences(!showPreferences)}
                        aria-expanded={showPreferences}
                        aria-controls="notification-preferences"
                    >
                        <Settings size={20} />
                        <span>Preferências</span>
                        {showPreferences ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Preferences Panel */}
            {showPreferences && (
                <div id="notification-preferences" className="preferences-panel card" role="region" aria-label="Preferências de notificação">
                    <div className="preferences-header">
                        <h2>Preferências de Notificação</h2>
                        <button
                            className="preferences-save-btn"
                            onClick={savePreferences}
                            disabled={savingPreferences}
                        >
                            {savingPreferences ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                    </div>
                    <div className="preferences-sections">
                        <div className="preferences-section">
                            <h3>Canais de entrega</h3>
                            <div className="preferences-grid">
                                {preferenceOptions.slice(0, 2).map(option => (
                                    <label key={option.key} className="preference-item">
                                        <div className="preference-info">
                                            <option.icon size={20} className="preference-icon" />
                                            <div>
                                                <span className="preference-label">{option.label}</span>
                                                <span className="preference-description">{option.description}</span>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={preferences[option.key]}
                                            onChange={(e) => handlePreferenceChange(option.key, e.target.checked)}
                                            className="preference-toggle"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="preferences-section">
                            <h3>Tipos de notificação</h3>
                            <div className="preferences-grid">
                                {preferenceOptions.slice(2).map(option => (
                                    <label key={option.key} className="preference-item">
                                        <div className="preference-info">
                                            <option.icon size={20} className="preference-icon" />
                                            <div>
                                                <span className="preference-label">{option.label}</span>
                                                <span className="preference-description">{option.description}</span>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={preferences[option.key]}
                                            onChange={(e) => handlePreferenceChange(option.key, e.target.checked)}
                                            className="preference-toggle"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="notifications-page-list">
                {Object.keys(groupedNotifications).length > 0 ? (
                    Object.entries(groupedNotifications).map(([date, items]) => (
                        <div key={date} className="notification-group">
                            <div className="notification-group-header">{formatGroupDate(date)}</div>
                            {items.map(n => (
                                <div
                                    key={n.id}
                                    className={`notification-item ${!n.read ? 'unread' : ''}`}
                                    onClick={() => handleClick(n)}
                                >
                                    <div className="notification-icon-wrapper">
                                        {getNotificationIcon(n.type)}
                                    </div>
                                    <Avatar user={{ avatar: n.source_user_avatar, name: n.source_user_name }} className="notification-avatar" />
                                    <div className="notification-content">
                                        <p>
                                            <strong>{n.source_user_name}</strong>{' '}
                                            {n.content || getNotificationTypeLabel(n.type)}
                                        </p>
                                        <span className="notification-time">{timeAgo(n.created_at)}</span>
                                    </div>
                                    {!n.read && <div className="notification-dot" aria-hidden="true" />}
                                </div>
                            ))}
                        </div>
                    ))
                ) : (
                    <div className="notifications-page-empty">
                        <Bell size={64} className="empty-icon" aria-hidden="true" />
                        <p>Nenhuma notificação ainda</p>
                    </div>
                )}

                {/* Load more trigger */}
                <div ref={loadMoreRef} className="load-more-trigger" aria-hidden="true">
                    {loading && hasMore && (
                        <div className="load-more-spinner" aria-label="Carregando mais notificações">
                            <div className="spinner"></div>
                        </div>
                    )}
                    {!hasMore && allNotifications.length > 0 && (
                        <div className="end-of-list" aria-label="Fim da lista">
                            <span>Todas as notificações carregadas</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
