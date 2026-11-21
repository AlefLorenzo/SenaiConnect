import { useState, useRef, useEffect } from 'react';
import Avatar from '../Avatar';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import './StoryBar.css';

const StoryBar = ({ storyGroups, currentUserId, onOpenStory }) => {
    const [scrollPosition, setScrollPosition] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [scrollWidth, setScrollWidth] = useState(0);
    const containerRef = useRef(null);

    const scrollLeft = () => {
        if (containerRef.current) {
            containerRef.current.scrollBy({ left: -280, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (containerRef.current) {
            containerRef.current.scrollBy({ left: 280, behavior: 'smooth' });
        }
    };

    const handleScroll = () => {
        if (containerRef.current) {
            setScrollPosition(containerRef.current.scrollLeft);
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            // Initialize dimensions
            setContainerWidth(container.clientWidth);
            setScrollWidth(container.scrollWidth);
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    // Update dimensions on resize
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            setContainerWidth(container.clientWidth);
            setScrollWidth(container.scrollWidth);
        }
    }, [storyGroups]);

    const canScrollLeft = scrollPosition > 10;
    const canScrollRight = scrollPosition < scrollWidth - containerWidth - 10;

    if (!storyGroups || storyGroups.length === 0) {
        return (
            <div className="story-bar empty">
                <div className="story-bar-content">
                    <div className="story-item add-story" onClick={() => onOpenStory?.({ business_id: 'create' }, 0)}>
                        <div className="story-avatar-container add-story">
                            <Plus size={24} color="#65676B" />
                        </div>
                        <span className="story-name">Criar Story</span>
                    </div>
                    <div className="story-item empty-hint">
                        <span className="story-name">Nenhum story no momento</span>
                        <span className="story-sub">Siga empresas para ver seus stories aqui</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="story-bar">
            {canScrollLeft && (
                <button
                    className="story-nav-btn left"
                    onClick={scrollLeft}
                    aria-label="Rolar para a esquerda"
                >
                    <ChevronLeft size={20} />
                </button>
            )}

            <div className="story-bar-container" ref={containerRef} onScroll={handleScroll}>
                <div className="story-bar-content">
                    {/* Add Story Button (only for business owners) */}
                    {currentUserId && (
                        <div className="story-item add-story" onClick={() => onOpenStory?.({ business_id: 'create' }, 0)}>
                            <div className="story-avatar-container add-story">
                                <Plus size={24} color="#65676B" />
                            </div>
                            <span className="story-name">Seu Story</span>
                        </div>
                    )}

                    {/* Story Groups */}
                    {storyGroups.map((group) => (
                        <div key={group.business_id} className="story-group">
                            {group.stories.map((story, storyIndex) => (
                                <div
                                    key={story.id}
                                    className={`story-item ${story.seen ? 'seen' : ''} ${group.has_unseen && !story.seen ? 'unseen' : ''}`}
                                    onClick={() => onOpenStory?.(group, storyIndex)}
                                >
                                    <div className="story-avatar-container">
                                        <Avatar
                                            user={{ avatar: group.business_logo, name: group.business_name }}
                                            className="story-avatar"
                                        />
                                        {!story.seen && <div className="story-ring" />}
                                    </div>
                                    <span className="story-name">{group.business_name}</span>
                                    {group.has_unseen && !story.seen && (
                                        <span className="story-new-badge">Novo</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {canScrollRight && (
                <button
                    className="story-nav-btn right"
                    onClick={scrollRight}
                    aria-label="Rolar para a direita"
                >
                    <ChevronRight size={20} />
                </button>
            )}
        </div>
    );
};

export default StoryBar;