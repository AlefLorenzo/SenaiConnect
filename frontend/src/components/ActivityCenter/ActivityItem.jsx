import React, { useMemo } from 'react';
import { activityService } from '../../services/activityService';
import { UserRound, Check, Heart, MessageCircle, Reply, AtSign, Smile, Mail, Eye, Users, FileText, CalendarDays, Bell, MessageSquare } from 'lucide-react';

const activityIcons = {
  follow: UserRound, follow_accepted: Check, post_like: Heart, like: Heart,
  post_comment: MessageCircle, comment: MessageCircle, comment_reply: Reply,
  mention: AtSign, story_mention: AtSign, comment_mention: AtSign,
  story_reaction: Smile, story_reply: Mail, story_view: Eye,
  group_invite: Users, group_post: FileText, event_reminder: CalendarDays,
  notice: Bell, message: MessageSquare
};
import './ActivityItem.css';

/**
 * ActivityItem - Individual activity feed item
 * Handles different activity types with appropriate icons, colors, and actions
 */
const ActivityItem = ({ activity, onClick, onRead, isGrouped = false, groupCount = 0 }) => {
  const meta = useMemo(() => activityService.getActivityMeta(activity.activity_type), [activity.activity_type]);

  // Determine if activity is unread
  const isUnread = !activity.read && !activity.read_at;

  // Format timestamp
  const formattedTime = useMemo(() => {
    if (!activity.created_at) return '';
    const date = new Date(activity.created_at);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }, [activity.created_at]);

  // Get actor info (support both nested actor object and flat properties)
  const actor = activity.actor || {};
  const actorName = actor.name || activity.actor_name || 'Alguém';
  const actorAvatar = actor.avatar || activity.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random`;

  // Get target info (post, story, group, etc.)
  const metadata = activity.metadata || {};

  // Render activity content based on type
  const renderContent = () => {
    const action = metadata.action || activity.activity_type;

    switch (action) {
      case 'follow':
      case 'follow_accepted':
        return (
          <div className="activity-item__content activity-item__content--follow">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">{meta.label}</span>
          </div>
        );

      case 'post_like':
      case 'like':
        return (
          <div className="activity-item__content activity-item__content--like">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">{isGrouped ? `e mais ${groupCount} pessoas curtiram` : meta.label}</span>
            {metadata.post_preview && (
              <div className="activity-item__preview" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
                <span className="preview-label">sua publicação</span>
                <span className="preview-text">{metadata.post_preview}</span>
              </div>
            )}
          </div>
        );

      case 'post_comment':
      case 'comment':
      case 'comment_reply':
        return (
          <div className="activity-item__content activity-item__content--comment">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">{meta.label}</span>
            {metadata.comment_preview && (
              <div className="activity-item__preview activity-item__preview--comment" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
                <span className="preview-text">"{metadata.comment_preview}"</span>
              </div>
            )}
          </div>
        );

      case 'comment_mention':
      case 'mention':
      case 'story_mention':
        return (
          <div className="activity-item__content activity-item__content--mention">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">{meta.label}</span>
            {metadata.content_preview && (
              <div className="activity-item__preview activity-item__preview--mention" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
                <span className="preview-text">{metadata.content_preview}</span>
              </div>
            )}
          </div>
        );

      case 'story_reaction':
        return (
          <div className="activity-item__content activity-item__content--story-reaction">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">reagiu à sua história com {metadata.reaction || '❤️'}</span>
          </div>
        );

      case 'story_reply':
        return (
          <div className="activity-item__content activity-item__content--story-reply">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">respondeu à sua história</span>
            {metadata.reply_preview && (
              <div className="activity-item__preview activity-item__preview--reply" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
                <span className="preview-text">{metadata.reply_preview}</span>
              </div>
            )}
          </div>
        );

      case 'story_view':
        return (
          <div className="activity-item__content activity-item__content--story-view">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">{meta.label}</span>
          </div>
        );

      case 'group_invite':
        return (
          <div className="activity-item__content activity-item__content--group-invite">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">convidou você para o grupo</span>
            <div className="activity-item__group-name" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <strong>{metadata.group_name || 'Grupo'}</strong>
            </div>
          </div>
        );

      case 'group_post':
        return (
          <div className="activity-item__content activity-item__content--group-post">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">publicou no grupo</span>
            <div className="activity-item__group-name" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <strong>{metadata.group_name || 'Grupo'}</strong>
            </div>
            {metadata.post_preview && (
              <div className="activity-item__preview" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
                <span className="preview-text">{metadata.post_preview}</span>
              </div>
            )}
          </div>
        );

      case 'event_reminder':
        return (
          <div className="activity-item__content activity-item__content--event">
            <span className="activity-item__verb">{meta.label}</span>
            <div className="activity-item__event-info" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <strong>{metadata.title || 'Evento'}</strong>
              {metadata.event_date && (
                <span className="event-date">{new Date(metadata.event_date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              )}
              {metadata.location && (
                <span className="event-location">{metadata.location}</span>
              )}
            </div>
          </div>
        );

      case 'notice':
        return (
          <div className="activity-item__content activity-item__content--notice">
            <span className="activity-item__verb">{meta.label}</span>
            <div className="activity-item__notice-info" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <strong>{metadata.title || 'Aviso'}</strong>
              {metadata.content && (
                <span className="notice-preview">{metadata.content}</span>
              )}
            </div>
          </div>
        );

      case 'message':
        return (
          <div className="activity-item__content activity-item__content--message">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">enviou uma mensagem</span>
            {metadata.message_preview && (
              <div className="activity-item__preview activity-item__preview--message" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
                <span className="preview-text">{metadata.message_preview}</span>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="activity-item__content activity-item__content--default">
            <span className="activity-item__actor" onClick={(e) => { e.stopPropagation(); onClick(activity); }}>
              <img src={actorAvatar} alt={actorName} className="activity-item__avatar" />
              <strong>{actorName}</strong>
            </span>
            <span className="activity-item__verb">{meta.label}</span>
          </div>
        );
    }
  };

  // Render grouped indicator
  const renderGroupIndicator = () => {
    if (!isGrouped || groupCount <= 1) return null;
    return (
      <div className="activity-item__group-indicator">
        <span className="group-badge">+{groupCount}</span>
      </div>
    );
  };

  return (
    <article
      className={`activity-item ${isUnread ? 'activity-item--unread' : ''} ${isGrouped ? 'activity-item--grouped' : ''}`}
      onClick={() => onClick(activity)}
      onMouseDown={() => { if (isUnread) onRead(activity.id); }}
      role="listitem"
      aria-label={`${actorName} ${meta.label}`}
      data-activity-id={activity.id}
      data-activity-type={activity.activity_type}
    >
      <div className="activity-item__main">
        <div className="activity-item__icon" style={{ color: meta.color }} aria-hidden="true">
          {React.createElement(activityIcons[activity.activity_type] || Bell, { size: 19, strokeWidth: 2.1 })}
        </div>
        <div className="activity-item__body">
          {renderContent()}
          <div className="activity-item__meta">
            <time className="activity-item__time" dateTime={activity.created_at}>
              {formattedTime}
            </time>
            {activity.reference_type && (
              <span className="activity-item__ref-type">{activity.reference_type}</span>
            )}
          </div>
        </div>
      </div>
      {renderGroupIndicator()}
      {isUnread && (
        <div className="activity-item__unread-dot" aria-hidden="true" />
      )}
    </article>
  );
};

export default ActivityItem;