import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import Avatar from './Avatar';
import './NotificationDropdown.css';

const NotificationDropdown = () => {
    const { notifications = [], unreadCount = 0, markAsRead } = useContext(SocketContext);
    const safeNotifications = Array.isArray(notifications) ? notifications : [];
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = (notification) => {
        setIsOpen(false);
        if (!notification.read && typeof markAsRead === 'function') {
            markAsRead(notification.id);
        }
        if (notification.activity_type === 'message' || notification.type === 'message') {
            let metadata = notification.metadata || {};
            if (typeof metadata === 'string') {
                try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
            }
            const conversationId = metadata.conversation_id;
            navigate(conversationId ? `/messages?conversationId=${encodeURIComponent(conversationId)}` : '/messages');
            return;
        }
        const metadata = typeof notification.metadata === 'string'
            ? (() => { try { return JSON.parse(notification.metadata); } catch { return {}; } })()
            : (notification.metadata || {});
        const resource = metadata.resource || notification.reference_type;
        const destination = resource === 'events' || resource === 'event' ? '/events'
            : resource === 'courses' || resource === 'course' ? '/courses'
            : resource === 'notices' || resource === 'notice' ? '/notices'
            : resource === 'posts' || resource === 'post' ? '/'
            : null;
        if (destination) {
            navigate(destination);
        } else if (notification.post_id) {
            navigate('/');
        } else if (notification.source_user_id) {
            navigate(`/profile/${notification.source_user_id}`);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'like': return '❤️';
            case 'comment': return '💬';
            case 'follow':
            case 'friend_request':
            case 'friend_accepted': return '👤';
            case 'message': return '💬';
            case 'mention': return '📢';
            case 'admin_publication': return '📣';
            default: return '🔔';
        }
    };

    const timeAgo = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        if (!Number.isFinite(date.getTime())) return '';
        if (diffMin < 1) return 'agora';
        if (diffMin < 60) return `${diffMin}min`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}h`;
        const diffD = Math.floor(diffH / 24);
        return `${diffD}d`;
    };

    return (
        <div className="notification-wrapper" ref={dropdownRef}>
            <button type="button" className="icon-btn notification-bell-btn" onClick={() => setIsOpen(!isOpen)} aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'} aria-expanded={isOpen}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-dropdown-header">
                        <h3>Notificações</h3>
                        <span className="notification-count">{unreadCount} novas</span>
                    </div>
                    <div className="notification-list">
                        {safeNotifications.length > 0 ? (
                            safeNotifications.slice(0, 20).map(n => (
                                <div
                                    key={n.id}
                                    className={`notification-item ${!n.read ? 'unread' : ''}`}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className="notification-icon">{getNotificationIcon(n.activity_type || n.type)}</div>
                                    <div className="notification-body">
                                        <Avatar user={{ avatar: n.source_user_avatar, name: n.source_user_name }} className="notification-avatar" />
                                        <div className="notification-text">
                                            <p><strong>{n.source_user_name}</strong> {n.content}</p>
                                            <span className="notification-time">{timeAgo(n.created_at)}</span>
                                        </div>
                                    </div>
                                    {!n.read && <div className="notification-dot"></div>}
                                </div>
                            ))
                        ) : (
                            <div className="notification-empty">
                                <span>🔔</span>
                                <p>Nenhuma notificação ainda</p>
                            </div>
                        )}
                    </div>
                    <button type="button" className="notification-view-all" onClick={() => { setIsOpen(false); navigate('/notifications'); }}>
                        Ver todas as notificações
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
