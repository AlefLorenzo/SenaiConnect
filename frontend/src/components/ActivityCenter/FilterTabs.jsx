import React from 'react';
import { activityService } from '../../services/activityService';
import { Bell, UserRound, Heart, MessageCircle, Megaphone, BookOpen, Package } from 'lucide-react';

const filterIcons = { all: Bell, followers: UserRound, likes: Heart, comments: MessageCircle, mentions: Megaphone, stories: BookOpen, others: Package };
import './FilterTabs.css';

/**
 * FilterTabs - Filter tabs for Activity Center
 * Allows filtering by: All, Followers, Likes, Comments, Mentions, Stories, Others
 */
const FilterTabs = ({ activeFilter, onFilterChange, unreadCount = 0 }) => {
  const filters = activityService.filterOptions;

  return (
    <nav className="filter-tabs" role="tablist" aria-label="Filtrar atividades">
      <div className="filter-tabs__scroll" role="presentation">
        {filters.map((filter) => (
          <button
            key={filter.value}
            role="tab"
            aria-selected={activeFilter === filter.value}
            aria-controls={`panel-${filter.value}`}
            id={`tab-${filter.value}`}
            className={`filter-tabs__tab ${activeFilter === filter.value ? 'filter-tabs__tab--active' : ''}`}
            onClick={() => onFilterChange(filter.value)}
          >
            <span className="filter-tabs__icon" aria-hidden="true">{React.createElement(filterIcons[filter.value] || Bell, { size: 19, strokeWidth: 2.2 })}</span>
            <span className="filter-tabs__label">{filter.label}</span>
            {(filter.value === 'all' && unreadCount > 0) && (
              <span className="filter-tabs__badge" aria-label={`${unreadCount} não lidas`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default FilterTabs;