import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { SocketContext } from '../context/SocketContext.jsx';
import { Image, Paperclip, Smile, Video, X, Plus } from 'lucide-react';
import Post from '../components/Post';
import StoryViewer from '../components/StoryViewer';
import CreateStory from '../components/CreateStory';
import CreatePostModal from '../components/CreatePostModal';
import MobileStories from '../components/MobileStories';
import Avatar from '../components/Avatar';
import storiesService from '../services/storiesService';
import { postsService } from '../services/postsService';
import './Home.css';

const Home = () => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const loadingMorePostsRef = useRef(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('No que você está pensando?');
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const creatingPostRef = useRef(false);

  // Check for creation type from sessionStorage (set by FAB via MobileCreateSheet)
  useEffect(() => {
    const createType = sessionStorage.getItem('createPostType');
    if (createType) {
      sessionStorage.removeItem('createPostType');
      const placeholders = {
        photo: 'Compartilhe uma foto...',
        video: 'Compartilhe um vídeo...',
        project: 'Compartilhe seu projeto...',
        question: 'Faça uma pergunta...',
        tip: 'Compartilhe uma dica útil...',
        event: 'Crie um evento...',
        post: 'O que você quer compartilhar?',
      };
      setInputPlaceholder(placeholders[createType] || placeholders.post);
      // Open a dedicated composer instead of scrolling the Home feed to its inline input.
      setShowCreatePost(true);
    }
  }, []);

  // Check for story creation flag from sessionStorage on mount and location change
  useEffect(() => {
    console.log('Home useEffect running, pathname:', location.pathname);
    const shouldCreateStory = sessionStorage.getItem('createStory');
    console.log('sessionStorage createStory:', shouldCreateStory);
    if (shouldCreateStory) {
      sessionStorage.removeItem('createStory');
      setShowCreateStory(true);
      console.log('showCreateStory set to true');
    }
  }, [location.pathname]);

  // Listen for custom event from FAB when navigating to home
  useEffect(() => {
    const handleCreatePostTypeChanged = (event) => {
      const { type } = event.detail || {};
      if (type) {
        const placeholders = {
          photo: 'Compartilhe uma foto...',
          video: 'Compartilhe um vídeo...',
          project: 'Compartilhe seu projeto...',
          question: 'Faça uma pergunta...',
          tip: 'Compartilhe uma dica útil...',
          event: 'Crie um evento...',
          post: 'O que você quer compartilhar?',
        };
        setInputPlaceholder(placeholders[type] || placeholders.post);
        setShowCreatePost(true);
      }
    };

    window.addEventListener('createPostTypeChanged', handleCreatePostTypeChanged);
    return () => window.removeEventListener('createPostTypeChanged', handleCreatePostTypeChanged);
  }, []);

  // Open the story composer when requested from the mobile create sheet,
  // including when the user is already on the home route.
  useEffect(() => {
    const openStoryComposer = () => setShowCreateStory(true);
    window.addEventListener('createStoryRequested', openStoryComposer);
    return () => window.removeEventListener('createStoryRequested', openStoryComposer);
  }, []);

  // Story viewing state (for StoryViewer when clicking on stories from MobileStories)
  const [viewingStoryIndex, setViewingStoryIndex] = useState(null);
  const [storyGroups, setStoryGroups] = useState([]);
  const [stories, setStories] = useState([]);

  // Keep the feed's source data and the rendered story list in sync as soon
  // as the API confirms a view. This prevents a stale group snapshot from
  // restoring the green/unviewed ring after the viewer closes.
  const handleStoryViewed = useCallback((storyId) => {
    const markViewed = (currentGroups) => currentGroups.map((group) => {
      const updatedStories = (group.stories || []).map((story) =>
        String(story.id) === String(storyId) ? { ...story, viewed: true } : story
      );

      return {
        ...group,
        stories: updatedStories,
        hasUnviewed: updatedStories.some((story) => story.viewed !== true),
      };
    });

    setStoryGroups(markViewed);
    setStories(markViewed);
  }, []);

  // Transform storyGroups into story groups for MobileStories (one item per user)
  useEffect(() => {
    const storyGroupsForMobile = (storyGroups || [])
      .filter(group => group && group.stories && group.stories.length > 0)
      .map(group => {
        const stories = group.stories || [];
        // The API exposes the current viewer's read state; views_count is a
        // popularity counter and must never be used to infer whether I viewed it.
        const hasUnviewed = stories.some(story => story.viewed !== true);
        return {
          id: group.user_id,
          user_id: group.user_id,
          user_name: group.user_name,
          user_avatar: group.user_avatar,
          hasUnviewed,
          storyCount: stories.length,
          stories: stories, // Pass the full stories array for the viewer
        };
      });
    setStories(storyGroupsForMobile);
  }, [storyGroups]);

  const fetchPosts = async () => {
    try {
      const data = await postsService.getFeed({ page: 1, limit: 20 });
      setPosts(data.posts || []);
      setPostsPage(data.page || 1);
      setHasMorePosts(Boolean(data.hasMore));
    } catch (err) {
      console.log('Erro ao buscar posts', err);
    }
  };

  const loadMorePosts = async () => {
    if (!hasMorePosts || loadingMorePostsRef.current) return;
    loadingMorePostsRef.current = true;
    setLoadingMorePosts(true);
    try {
      const data = await postsService.getFeed({ page: postsPage + 1, limit: 20, append: true });
      setPosts(data.posts || []);
      setPostsPage(data.page || postsPage + 1);
      setHasMorePosts(Boolean(data.hasMore));
    } catch (err) {
      console.warn('Não foi possível carregar mais publicações:', err);
    } finally {
      loadingMorePostsRef.current = false;
      setLoadingMorePosts(false);
    }
  };

  const fetchStories = async () => {
    try {
      const data = await storiesService.getFeed();
      setStoryGroups(data);
    } catch (err) {
      console.log('Erro ao buscar stories', err);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchStories();
  }, []);

  // Subscribe to posts service changes (for real-time updates from other components)
  useEffect(() => {
    const unsubscribe = postsService.subscribe((updatedPosts) => {
      setPosts(Array.isArray(updatedPosts) ? [...updatedPosts] : []);
    });
    return unsubscribe;
  }, []);

  // Listen for new stories via socket
  useEffect(() => {
    if (!socket) return;
    const handleNewStory = () => {
      fetchStories(); // Refresh stories
    };
    socket.on('new_story', handleNewStory);
    return () => socket.off('new_story', handleNewStory);
  }, [socket]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem deve ter no máximo 5MB.');
      return;
    }
    setPostImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPostImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async () => {
    if (creatingPostRef.current || (!newPostContent.trim() && !postImage)) return;
    creatingPostRef.current = true;
    setLoading(true);
    try {
      let attachment_url = null;
      let attachment_type = null;

      // For mock mode, just use a placeholder image URL
      if (postImage) {
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(postImage);
        });
        // In mock mode, we'll use a placeholder image
        attachment_url = base64; // Use data URL for mock
        attachment_type = 'image';
      }

      // Create post via service
      await postsService.createPost({
        user_id: user?.id || 1,
        user: user || {
          id: 1,
          name: 'Usuário Atual',
          avatar: null,
          role: 'aluno',
          isVerified: true
        },
        content: newPostContent,
        attachment_url,
        attachment_type
      });

      // Refresh posts will be triggered by subscription
      setNewPostContent('');
      setPostImage(null);
      setPostImagePreview(null);
      setShowCreatePost(false);
    } catch (error) {
      alert('Erro ao publicar post.');
    } finally {
      creatingPostRef.current = false;
      setLoading(false);
    }
  };

  const onPostDeleted = (deletedId) => {
    setPosts(posts.filter(p => p.id !== deletedId));
  };

  return (
      <div className="home-container">
      {viewingStoryIndex !== null && (
        <StoryViewer
          storyGroups={stories}
          initialGroupIndex={viewingStoryIndex}
          onClose={() => setViewingStoryIndex(null)}
          onStoryViewed={handleStoryViewed}
        />
      )}

      {/* 1. PRIMEIRO — STORIES (Topo da Home) */}
      {user && (
        <div className="stories-section">
          <MobileStories
            stories={stories}
            onStoryClick={(story) => {
              // Find the group index in the filtered stories array (matches what MobileStories receives)
              const groupIndex = stories.findIndex(g => g.user_id === story.user_id);
              if (groupIndex !== -1 && stories[groupIndex]?.stories?.length > 0) {
                setViewingStoryIndex(groupIndex);
              }
            }}
            onAddStory={() => {
              console.log('[Home] onAddStory called, setting showCreateStory to true');
              setShowCreateStory(true);
            }}
          />
        </div>
      )}

      {/* 2. SEGUNDO — CRIAR PUBLICAÇÃO (Imediatamente abaixo dos Stories) */}
      <div className="create-post-section">
        <div className="create-post-card card">
          <div className="create-post-top">
            <Avatar user={user} className="create-post-avatar" />
            <input
              ref={inputRef}
              type="text"
              placeholder={inputPlaceholder}
              className="create-post-input"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) handleCreatePost() }}
            />
          </div>

          {postImagePreview && (
            <div className="post-image-preview">
              <img src={postImagePreview} alt="Preview" />
              <button className="remove-image-btn" onClick={() => { setPostImage(null); setPostImagePreview(null); }}>
                <X size={16} />
              </button>
            </div>
          )}

          <div className="create-post-bottom">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageSelect} />
            <button className="create-post-btn" onClick={() => alert('Em breve!')}>
              <Video size={20} color="#F44336" /><span>Vídeo</span>
            </button>
            <button className="create-post-btn" onClick={() => fileInputRef.current?.click()}>
              <Image size={20} color="#4CAF50" /><span>Foto</span>
            </button>
            <button className="create-post-btn"><Paperclip size={20} color="#FF9800" /><span>Arquivo</span></button>
            <button className="create-post-btn"><Smile size={20} color="#FFEB3B" /><span>Sentimento</span></button>
            <button
              className="btn-primary"
              style={{marginLeft: 'auto', padding: '6px 16px', fontSize: '14px'}}
              onClick={handleCreatePost}
              disabled={loading || (!newPostContent.trim() && !postImage)}
            >
              {loading ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. TERCEIRO — FEED DE PUBLICAÇÕES (Abaixo do campo de criação) */}
      <div className="feed-container">
        {posts.length > 0 ? (
          posts.map(post => <Post key={post.id} post={post} onDeleted={onPostDeleted} />)
        ) : (
          <div className="card" style={{padding: '32px', textAlign: 'center', color: '#65676B'}}>
            Nenhuma publicação ainda. Seja o primeiro a postar!
          </div>
        )}
        {hasMorePosts && (
          <button
            type="button"
            className="btn-secondary load-more-posts"
            onClick={loadMorePosts}
            disabled={loadingMorePosts}
          >
            {loadingMorePosts ? 'Carregando...' : 'Carregar mais publicações'}
          </button>
        )}
      </div>

      {/* Publication composer is rendered in a body portal to avoid page clipping/scroll shifts. */}
      {user && (
        <CreatePostModal
          isOpen={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          user={user}
          content={newPostContent}
          onContentChange={setNewPostContent}
          placeholder={inputPlaceholder}
          imagePreview={postImagePreview}
          onRemoveImage={() => { setPostImage(null); setPostImagePreview(null); }}
          onImageSelect={handleImageSelect}
          onSubmit={handleCreatePost}
          isSubmitting={loading}
        />
      )}

      {/* Create Story Modal */}
      {user && (
        <CreateStory
          isOpen={showCreateStory}
          onClose={() => setShowCreateStory(false)}
          onStoryCreated={() => {
            setShowCreateStory(false);
            // Refresh stories after creation
            fetchStories();
          }}
        />
      )}
    </div>
  );
};

export default Home;