import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Hash, TrendingUp, ChevronLeft, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import Post from '../components/Post';
import Avatar from '../components/Avatar';
import './Hashtag.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Hashtag = () => {
  const { hashtag } = useParams();
  const { user } = useContext(AuthContext);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [showTrending, setShowTrending] = useState(false);

  const decodedHashtag = decodeURIComponent(hashtag);

  const fetchPosts = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/hashtags/${encodeURIComponent(decodedHashtag)}/posts?page=${pageNum}&limit=20`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setPosts(prev => [...prev, ...data]);
        } else {
          setPosts(data);
        }
        setHasMore(data.length >= 20);
        setPage(pageNum);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Erro ao buscar posts da hashtag:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingHashtags = async () => {
    try {
      const res = await fetch(`${API_URL}/api/hashtags/trending`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrendingHashtags(data);
      }
    } catch (err) {
      console.error('Erro ao buscar hashtags trending:', err);
    }
  };

  useEffect(() => {
    fetchPosts(1, false);
    fetchTrendingHashtags();
  }, [decodedHashtag]);

  // Infinite scroll observer
  const observerRef = React.useRef(null);
  const loadMoreRef = React.useRef(null);

  React.useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loading) {
          fetchPosts(page + 1, true);
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
  }, [hasMore, loading, page]);

  const handleBack = () => {
    window.history.back();
  };

  const toggleTrending = () => {
    setShowTrending(!showTrending);
  };

  return (
    <div className="hashtag-page">
      <div className="hashtag-header card">
        <button className="back-btn" onClick={handleBack} aria-label="Voltar">
          <ChevronLeft size={24} />
        </button>
        <div className="hashtag-info">
          <div className="hashtag-icon">
            <Hash size={28} />
          </div>
          <div>
            <h1>#{decodedHashtag}</h1>
            <p className="hashtag-count">{posts.length} publicações</p>
          </div>
        </div>
        <button className="trending-toggle" onClick={toggleTrending} aria-label="Hashtags em alta">
          <TrendingUp size={20} />
          <span>Em alta</span>
        </button>
      </div>

      {showTrending && trendingHashtags.length > 0 && (
        <div className="trending-sidebar card">
          <div className="trending-header">
            <h3>Hashtags em alta</h3>
            <button className="close-trending" onClick={() => setShowTrending(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <div className="trending-list">
            {trendingHashtags.map((tag, index) => (
              <Link
                key={tag.tag}
                to={`/hashtag/${encodeURIComponent(tag.tag)}`}
                className="trending-item"
              >
                <span className="trending-rank">#{index + 1}</span>
                <div className="trending-tag-info">
                  <span className="trending-tag">#{tag.tag}</span>
                  <span className="trending-count">{tag.post_count} posts</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="hashtag-content">
        {loading && posts.length === 0 ? (
          <div className="hashtag-loading">
            <div className="spinner" />
            <p>Carregando publicações...</p>
          </div>
        ) : posts.length > 0 ? (
          <>
            <div className="posts-feed">
              {posts.map(post => (
                <Post key={post.id} post={post} />
              ))}
            </div>
            {/* Load more trigger */}
            <div ref={loadMoreRef} className="load-more-trigger" aria-hidden="true">
              {loading && hasMore && (
                <div className="load-more-spinner" aria-label="Carregando mais publicações">
                  <div className="spinner" />
                  <span>Carregando mais...</span>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div className="end-of-list" aria-label="Fim da lista">
                  <span>Todas as publicações carregadas</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="hashtag-empty card">
            <Hash size={48} className="empty-icon" />
            <h3>Nenhuma publicação com esta hashtag</h3>
            <p>Seja o primeiro a usar #{decodedHashtag} em uma publicação!</p>
            <Link to="/" className="btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
              Ir para o Feed
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hashtag;