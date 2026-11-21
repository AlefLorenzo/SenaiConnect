import React from 'react';
import ActivityItem from './ActivityItem';
import './ActivitySection.css';

/**
 * ActivitySection - Chronological section (Today, Yesterday, This Week, Earlier)
 */
const ActivitySection = ({ section, sectionIndex, onActivityClick, onActivityRead }) => {
  const { title, activities = [], date, latestDate } = section;

  // Format section title
  const formatSectionTitle = (sectionTitle, sectionDate) => {
    if (sectionTitle === 'Hoje') return 'Hoje';
    if (sectionTitle === 'Ontem') return 'Ontem';
    if (sectionTitle === 'Esta semana') return 'Esta semana';
    if (sectionTitle === 'Anterior') return 'Anterior';

    // Try to parse date for custom sections
    if (sectionDate) {
      const date = new Date(sectionDate);
      const now = new Date();
      const diffDays = Math.floor((now - date) / 86400000);

      if (diffDays === 0) return 'Hoje';
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return 'Esta semana';
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    return sectionTitle;
  };

  if (!activities || activities.length === 0) return null;

  return (
    <section className="activity-section" aria-labelledby={`section-${sectionIndex}`}>
      <header className="activity-section__header">
        <h2 id={`section-${sectionIndex}`} className="activity-section__title">
          {formatSectionTitle(title, date)}
        </h2>
        <div className="activity-section__divider" aria-hidden="true" />
      </header>

      <div className="activity-section__list" role="list">
        {activities.map((activity, index) => (
          <ActivityItem
            key={activity.id || `activity-${sectionIndex}-${index}`}
            activity={activity}
            onClick={onActivityClick}
            onRead={onActivityRead}
            isGrouped={activity.grouped}
            groupCount={activity.group_count || 0}
          />
        ))}
      </div>
    </section>
  );
};

export default ActivitySection;