import { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from '../Avatar';
import { X, ChevronLeft, ChevronRight, Pause, Play, ExternalLink, Flag, Share2 } from 'lucide-react';
import './BusinessStoryViewer.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STORY_DURATION = 5000; // 5 seconds per story

const BusinessStoryViewer = ({ storyGroup, initialIndex, onClose, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showActions, setShowActions] = useState(true);
    const [showReport, setShowReport] = useState(false);
    const [reportReason, setReportReason] = useState('inappropriate');
    const [reportDesc, setReportDesc] = useState('');

    const progressBarRef = useRef(null);
    const videoRef = useRef(null);
    const stories = storyGroup?.stories || [];
    const currentStory = stories[currentIndex];

    // Progress animation
    useEffect(() => {
        if (!currentStory) return;

        let animationFrame;
        let startTime = Date.now();
        const duration = STORY_DURATION;

        const animate = () => {
            if (isPaused) {
                startTime = Date.now() - progress * duration;
                animationFrame = requestAnimationFrame(animate);
                return;
            }

            const elapsed = Date.now() - startTime;
            const newProgress = Math.min(elapsed / duration, 1);
            setProgress(newProgress);

            if (newProgress >= 1) {
                // Move to next story
                if (currentIndex < stories.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                    setProgress(0);
                    startTime = Date.now();
                } else {
                    // Story group complete
                    onComplete?.();
                    return;
                }
            }

            animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);

        // Mark as viewed
        const markViewed = async () => {
            try {
                await fetch(`${API_URL}/api/business/stories/${currentStory.id}/view`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
                });
            } catch (err) {
                console.error('Erro ao marcar story como visto:', err);
            }
        };
        markViewed();

        return () => {
            cancelAnimationFrame(animationFrame);
        };
    }, [currentIndex, currentStory, isPaused, progress, stories.length, onComplete]);

    // Handle click on link
    const handleLinkClick = async (e) => {
        e.stopPropagation();
        if (currentStory?.link_url) {
            try {
                await fetch(`${API_URL}/api/business/stories/${currentStory.id}/click`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
                });
            } catch (err) {
                console.error('Erro ao registrar click:', err);
            }
            window.open(currentStory.link_url, '_blank', 'noopener,noreferrer');
        }
    };

    // Navigation
    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
        }
    }, [currentIndex]);

    const goToNext = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            onComplete?.();
        }
    }, [currentIndex, stories.length, onComplete]);

    // Touch/Swipe handlers
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

    const handleTouchStart = (e) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now()
        };
    };

    const handleTouchEnd = (e) => {
        const touchEnd = e.changedTouches[0];
        const dx = touchEnd.clientX - touchStartRef.current.x;
        const dy = touchEnd.clientY - touchStartRef.current.y;
        const dt = Date.now() - touchStartRef.current.time;

        // Horizontal swipe
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50 && dt < 300) {
            if (dx > 0) goToPrevious();
            else goToNext();
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') goToPrevious();
            else if (e.key === 'ArrowRight') goToNext();
            else if (e.key === ' ') { e.preventDefault(); setIsPaused(!isPaused); }
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isPaused, goToPrevious, goToNext]);

    // Auto-hide actions
    useEffect(() => {
        const timer = setTimeout(() => setShowActions(false), 3000);
        return () => clearTimeout(timer);
    }, [currentIndex, isPaused]);

    const handleMouseEnter = () => setShowActions(true);
    const handleMouseLeave = () => {
        if (!isPaused) setShowActions(false);
    };

    if (!currentStory) return null;

    const isVideo = currentStory.media_type === 'video' || currentStory.media_url?.match(/\.(mp4|mov|webm)$/i);

    return (
        <div
            className="story-viewer-overlay"
            onClick={onClose}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="story-viewer" onClick={e => e.stopPropagation()}>
                {/* Progress Bars */}
                <div className="story-progress-container">
                    {stories.map((_, index) => (
                        <div key={index} className="story-progress-wrapper">
                            <div
                                ref={index === currentIndex ? progressBarRef : null}
                                className={`story-progress ${index < currentIndex ? 'completed' : index === currentIndex ? 'active' : ''}`}
                                style={{ width: index === currentIndex ? `${progress * 100}%` : index < currentIndex ? '100%' : '0%' }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="story-header">
                    <div className="story-business-info" onClick={e => e.stopPropagation()}>
                        <Avatar
                            user={{ avatar: storyGroup.business_logo, name: storyGroup.business_name }}
                            className="story-viewer-avatar"
                        />
                        <div>
                            <span className="story-business-name">{storyGroup.business_name}</span>
                            <span className="story-timestamp">{formatTime(currentStory.created_at)}</span>
                        </div>
                    </div>
                    <button className="story-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="story-content" onClick={goToNext}>
                    {isVideo ? (
                        <video
                            ref={videoRef}
                            src={currentStory.media_url}
                            autoPlay
                            muted
                            playsInline
                            loop
                            className="story-media"
                            onClick={e => e.stopPropagation()}
                            onPause={() => setIsPaused(true)}
                            onPlay={() => setIsPaused(false)}
                        />
                    ) : (
                        <img
                            src={currentStory.media_url}
                            alt=""
                            className="story-media"
                            onClick={e => e.stopPropagation()}
                        />
                    )}

                    {currentStory.text_content && (
                        <div className="story-text-overlay">
                            <p>{currentStory.text_content}</p>
                        </div>
                    )}

                    {currentStory.link_url && (
                        <button
                            className="story-cta-button"
                            onClick={handleLinkClick}
                        >
                            <ExternalLink size={16} /> {currentStory.link_label || 'Ver mais'}
                        </button>
                    )}

                    {currentStory.cta_text && !currentStory.link_url && (
                        <div className="story-cta-text">{currentStory.cta_text}</div>
                    )}
                </div>

                {/* Navigation Hints */}
                <div className="story-nav-hints">
                    <div className="nav-hint left" onClick={e => { e.stopPropagation(); goToPrevious(); }}>
                        <ChevronLeft size={24} />
                    </div>
                    <div className="nav-hint right" onClick={e => { e.stopPropagation(); goToNext(); }}>
                        <ChevronRight size={24} />
                    </div>
                </div>

                {/* Actions Bar */}
                {showActions && (
                    <div className="story-actions-bar">
                        <div className="story-actions-left">
                            <button className="story-action-btn" onClick={e => { e.stopPropagation(); setIsPaused(!isPaused); }}>
                                {isPaused ? <Play size={24} /> : <Pause size={24} />}
                            </button>
                            <button className="story-action-btn" onClick={e => { e.stopPropagation(); window.open(currentStory.media_url, '_blank'); }}>
                                <Share2 size={24} />
                            </button>
                        </div>
                        <div className="story-actions-right">
                            <button className="story-action-btn" onClick={e => { e.stopPropagation(); setShowReport(true); }}>
                                <Flag size={24} />
                            </button>
                            <button className="story-action-btn" onClick={e => { e.stopPropagation(); onClose(); }}>
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Report Modal */}
            {showReport && (
                <div className="modal-overlay" onClick={() => setShowReport(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h4>Denunciar Story</h4>
                        <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="modal-select">
                            <option value="inappropriate">Conteúdo inadequado</option>
                            <option value="spam">Spam</option>
                            <option value="scam">Golpe/Fraude</option>
                            <option value="fake">Informações falsas</option>
                            <option value="other">Outro</option>
                        </select>
                        <textarea
                            value={reportDesc}
                            onChange={(e) => setReportDesc(e.target.value)}
                            placeholder="Detalhes (opcional)..."
                            rows={3}
                            className="modal-textarea"
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowReport(false)}>Cancelar</button>
                            <button className="btn-danger" onClick={handleReport}>Enviar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const handleReport = async () => {
    // Implementation would go here
    alert('Denúncia enviada!');
};

export default BusinessStoryViewer;