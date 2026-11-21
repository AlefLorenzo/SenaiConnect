import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import {
  Search, ChevronDown, ChevronUp, Heart, MessageSquare,
  Share2, MoreHorizontal, ExternalLink, Verified,
  Loader2, Video, FileText, X, Building2,
  Bell, BellOff, Filter, Paperclip
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import { companiesService } from '../services/companiesService';
import Avatar from '../components/Avatar';
import { formatRelativeTime } from '../utils/formatters';
import './BusinessFeed.css';

const mockSubcategories = {
  tecnologia: [
    { id: 'software', name: 'Software' },
    { id: 'hardware', name: 'Hardware' },
    { id: 'ia', name: 'Inteligência Artificial' },
    { id: 'ciberseguranca', name: 'Cibersegurança' }
  ],
  engenharia: [
    { id: 'civil', name: 'Civil' },
    { id: 'mecanica', name: 'Mecânica' },
    { id: 'eletrica', name: 'Elétrica' },
    { id: 'automacao', name: 'Automação' }
  ],
  gestao: [
    { id: 'rh', name: 'Recursos Humanos' },
    { id: 'financeiro', name: 'Financeiro' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'operacoes', name: 'Operações' }
  ],
  design: [
    { id: 'grafico', name: 'Design Gráfico' },
    { id: 'uiux', name: 'UI/UX' },
    { id: 'produto', name: 'Design de Produto' },
    { id: 'motion', name: 'Motion Design' }
  ],
  saude: [
    { id: 'enfermagem', name: 'Enfermagem' },
    { id: 'farmacia', name: 'Farmácia' },
    { id: 'biomedicina', name: 'Biomedicina' },
    { id: 'radiologia', name: 'Radiologia' }
  ],
  logistica: [
    { id: 'transporte', name: 'Transporte' },
    { id: 'armazenagem', name: 'Armazenagem' },
    { id: 'supply-chain', name: 'Supply Chain' },
    { id: 'distribuicao', name: 'Distribuição' }
  ]
};

const BusinessFeed = () => {
  const { user } = useContext(AuthContext);

  // State
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState(new Set());
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('tecnologia');
  const [newPostAttachments, setNewPostAttachments] = useState([]);
  const [newPostLink, setNewPostLink] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    companyName: '',
    handle: '',
    category: 'tecnologia',
    website: '',
    email: '',
    phone: '',
    address: '',
    description: '',
    documents: []
  });
  // Companies tab state
  const [companies, setCompanies] = useState([]);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesHasMore, setCompaniesHasMore] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');

  const categoryDropdownRef = useRef(null);
  const feedContainerRef = useRef(null);

  // Refs for stable callback access in useEffect
  const loadCategoriesRef = useRef(null);
  const loadFeedRef = useRef(null);
  const loadCompaniesRef = useRef(null);
  const pageRef = useRef(page);
  const searchTermRef = useRef(searchTerm);
  const companiesPageRef = useRef(companiesPage);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const data = await companiesService.getCategories();
      setCategories(data.data || data);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  }, []);

  // Load feed
  const loadFeed = useCallback(async (reset = false) => {
    if (reset) {
      setPage(1);
      setPosts([]);
      setHasMore(true);
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const currentPage = reset ? 1 : pageRef.current;
      const data = await companiesService.getBusinessFeed({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTermRef.current || undefined,
        page: currentPage,
        limit: 10
      });

      const newPosts = data.data || data;
      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      setHasMore(data.pagination?.hasMore || newPosts.length >= 10);
      setPage(currentPage + 1);
    } catch (err) {
      console.error('Erro ao carregar feed:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [selectedCategory]);

  // Load companies
  const loadCompanies = useCallback(async (reset = false) => {
    if (reset) {
      setCompaniesPage(1);
      setCompanies([]);
      setCompaniesHasMore(true);
      setIsLoadingCompanies(true);
    }

    try {
      const currentPage = reset ? 1 : companiesPageRef.current;
      const data = await companiesService.getVerifiedCompanies({
        page: currentPage,
        limit: 20
      });

      const newCompanies = data.data || data;
      if (reset) {
        setCompanies(newCompanies);
      } else {
        setCompanies(prev => [...prev, ...newCompanies]);
      }
      setCompaniesHasMore(data.pagination?.hasMore || newCompanies.length >= 20);
      setCompaniesPage(currentPage + 1);
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  // Keep refs updated
  useEffect(() => {
    loadCategoriesRef.current = loadCategories;
  }, [loadCategories]);

  useEffect(() => {
    loadFeedRef.current = loadFeed;
  }, [loadFeed]);

  useEffect(() => {
    loadCompaniesRef.current = loadCompanies;
  }, [loadCompanies]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  useEffect(() => {
    companiesPageRef.current = companiesPage;
  }, [companiesPage]);

  // Initialize categories
  useEffect(() => {
    const load = async () => {
      await loadCategoriesRef.current?.();
    };
    load();
  }, []);

  // Load initial feed when category or search changes
  useEffect(() => {
    const load = async () => {
      loadFeedRef.current?.(true);
    };
    load();
  }, [selectedCategory]);

  // Load companies when tab changes to companies
  useEffect(() => {
    if (activeTab === 'companies') {
      const load = async () => {
        loadCompaniesRef.current?.(true);
      };
      load();
    }
  }, [activeTab]);

  // Infinite scroll
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 200) {
        if (activeTab === 'feed' && !isLoadingMore && hasMore) {
          loadFeedRef.current?.(false);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, activeTab]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep refs updated
  useEffect(() => {
    loadCategoriesRef.current = loadCategories;
  }, [loadCategories]);
  useEffect(() => {
    loadFeedRef.current = loadFeed;
  }, [loadFeed]);
  useEffect(() => {
    loadCompaniesRef.current = loadCompanies;
  }, [loadCompanies]);

  const handleLike = useCallback(async (postId, currentLikeState) => {
    // Optimistic update
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? { ...post, isLiked: !currentLikeState, likesCount: currentLikeState ? post.likesCount - 1 : post.likesCount + 1 }
        : post
    ));

    try {
      await companiesService.likeBusinessPost(postId);
    } catch (err) {
      // Revert on error
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, isLiked: currentLikeState, likesCount: currentLikeState ? post.likesCount + 1 : post.likesCount - 1 }
          : post
      ));
      console.error('Erro ao curtir:', err);
    }
  }, []);


  const handleShare = useCallback(async (postId) => {
    try {
      await companiesService.shareBusinessPost(postId);
      setPosts(prev => prev.map(post =>
        post.id === postId ? { ...post, sharesCount: post.sharesCount + 1 } : post
      ));

      // Copy link to clipboard
      const url = `${window.location.origin}/business/post/${postId}`;
      await navigator.clipboard.writeText(url);
      alert('Link copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  }, []);

  const handleFollowCompany = useCallback(async (companyId, currentFollowState) => {
    setCompanies(prev => prev.map(company =>
      company.id === companyId
        ? { ...company, isFollowed: !currentFollowState, followersCount: currentFollowState ? company.followersCount - 1 : company.followersCount + 1 }
        : company
    ));

    try {
      await companiesService.toggleFollowCompany(companyId, !currentFollowState);
    } catch (err) {
      setCompanies(prev => prev.map(company =>
        company.id === companyId
          ? { ...company, isFollowed: currentFollowState, followersCount: currentFollowState ? company.followersCount + 1 : company.followersCount - 1 }
          : company
      ));
      console.error('Erro ao seguir:', err);
    }
  }, []);

  const handleCreatePost = useCallback(async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setIsCreatingPost(true);
    try {
      const newPost = await companiesService.createBusinessPost({
        content: newPostContent,
        category: newPostCategory,
        attachments: newPostAttachments,
        link: newPostLink || undefined
      });

      setPosts(prev => [newPost, ...prev]);
      setShowCreatePost(false);
      setNewPostContent('');
      setNewPostAttachments([]);
      setNewPostLink('');
    } catch (err) {
      console.error('Erro ao criar post:', err);
      alert('Erro ao publicar. Tente novamente.');
    } finally {
      setIsCreatingPost(false);
    }
  }, [newPostContent, newPostCategory, newPostAttachments, newPostLink]);

  const handleFileUpload = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024); // 10MB max
    if (validFiles.length !== files.length) {
      alert('Alguns arquivos excedem o limite de 10MB e foram ignorados.');
    }

    // In a real app, upload to server and get URLs
    // For now, create mock attachment objects
    const attachments = validFiles.map(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      return {
        type: isImage ? 'image' : isVideo ? 'video' : 'document',
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file), // Temporary for preview
        file // Keep reference for actual upload
      };
    });

    setNewPostAttachments(prev => [...prev, ...attachments]);
  }, []);

  const removeAttachment = useCallback((index) => {
    setNewPostAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleExpand = useCallback((postId) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  const formatCount = useCallback((count) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }, []);

  const renderAttachment = useCallback((attachment, index) => {
    if (attachment.type === 'image') {
      return (
        <img
          key={index}
          src={attachment.url}
          alt={attachment.alt || attachment.name}
          className="post-attachment-image"
          onClick={() => window.open(attachment.url, '_blank')}
        />
      );
    }
    if (attachment.type === 'video') {
      return (
        <video
          key={index}
          src={attachment.url}
          className="post-attachment-video"
          controls
          poster={attachment.thumbnail}
        />
      );
    }
    return (
      <div key={index} className="post-attachment-document" onClick={() => window.open(attachment.url, '_blank')}>
        <FileText size={32} color="var(--senai-blue-primary)" />
        <div>
          <span style={{ fontWeight: 500 }}>{attachment.name}</span>
          {attachment.size && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}> {(attachment.size / 1024 / 1024).toFixed(1)} MB</span>}
        </div>
        <ExternalLink size={16} color="var(--text-secondary)" />
      </div>
    );
  }, []);

  const renderVerificationBadge = useCallback((company) => {
    if (!company.verified) return null;

    const badgeType = company.verificationBadge || 'verified';
    const isOfficial = badgeType === 'official';

    return (
      <span className={`verification-badge ${badgeType}`} title={isOfficial ? 'Empresa Oficial SENAI' : 'Empresa Verificada'}>
        <Verified size={14} />
        {isOfficial && <span style={{ marginLeft: 2, fontWeight: 600 }}>Oficial</span>}
      </span>
    );
  }, []);

  const getCategoryInfo = useCallback((categoryId) => {
    return categories.find(c => c.id === categoryId) || { name: categoryId, icon: '📋', color: 'var(--senai-blue-primary)' };
  }, [categories]);

  return (
    <div className="business-feed-layout">
      {/* Header */}
      <div className="business-feed-header">
        <div className="header-left">
          <h1>Empresas</h1>
          <div className="tab-navigation" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'feed'}
              className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              Feed
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'companies'}
              className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`}
              onClick={() => setActiveTab('companies')}
            >
              Empresas
              {companies.filter(c => c.isFollowed).length > 0 && (
                <span className="tab-badge">{companies.filter(c => c.isFollowed).length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="header-right">
          <div className="search-box">
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Buscar no feed..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFeedRef.current?.(true)}
              aria-label="Buscar posts"
            />
          </div>

          <>
              {/* Category Filter Dropdown */}
              <div className="category-filter" ref={categoryDropdownRef}>
                <button
                  className={`filter-btn ${showCategoryDropdown ? 'open' : ''}`}
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  aria-expanded={showCategoryDropdown}
                  aria-haspopup="listbox"
                >
                  <Filter size={18} />
                  <span>{getCategoryInfo(selectedCategory).icon} {getCategoryInfo(selectedCategory).name}</span>
                  <ChevronDown size={16} />
                </button>

                {showCategoryDropdown && (
                  <div className="category-dropdown" role="listbox">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        role="option"
                        aria-selected={selectedCategory === cat.id}
                        className={`category-option ${selectedCategory === cat.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setShowCategoryDropdown(false);
                          loadFeedRef.current?.(true);
                        }}
                        style={{ '--category-color': cat.color }}
                      >
                        <span className="category-icon">{cat.icon}</span>
                        <span>{cat.name}</span>
                        {selectedCategory === cat.id && <ChevronUp size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Category Chips */}
              <div className="mobile-category-chips" aria-label="Filtrar por categoria">
                {categories.slice(0, 8).map(cat => (
                  <button
                    key={cat.id}
                    className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      loadFeedRef.current?.(true);
                    }}
                    style={{ '--category-color': cat.color }}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </>

          <button
            className="create-post-btn"
            onClick={() => setShowCreatePost(true)}
            aria-label="Criar post"
          >
            <MessageSquare size={20} />
            <span>Publicar</span>
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div className="business-feed-content" ref={feedContainerRef}>
        {/* Create Post Modal */}
        {showCreatePost && (
          <div className="modal-overlay" onClick={() => setShowCreatePost(false)}>
            <div className="modal-content create-post-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Nova publicação</h3>
                <button onClick={() => setShowCreatePost(false)} aria-label="Fechar">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreatePost}>
                <div className="modal-body">
                  <div className="create-post-author">
                    <Avatar user={user} size={40} />
                    <textarea
                      placeholder="O que você quer compartilhar?"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      rows={4}
                      aria-label="Conteúdo do post"
                    />
                  </div>

                  <div className="create-post-options">
                    <div className="option-group">
                      <label>Categoria</label>
                      <select
                        value={newPostCategory}
                        onChange={(e) => setNewPostCategory(e.target.value)}
                      >
                        {categories.filter(c => c.id !== 'all').map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="option-group">
                      <label>Link (opcional)</label>
                      <input
                        type="url"
                        placeholder="https://exemplo.com"
                        value={newPostLink}
                        onChange={(e) => setNewPostLink(e.target.value)}
                      />
                    </div>

                    <div className="option-group">
                      <label>Anexos</label>
                      <div className="attachment-upload">
                        <input
                          type="file"
                          id="file-upload"
                          multiple
                          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                          onChange={(e) => handleFileUpload(e.target.files)}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="file-upload" className="upload-btn">
                          <Paperclip size={18} />
                          <span>Anexar arquivos</span>
                        </label>
                        {newPostAttachments.length > 0 && (
                          <div className="attachments-preview">
                            {newPostAttachments.map((att, idx) => (
                              <div key={idx} className="attachment-preview-item">
                                {att.type === 'image' && <img src={att.url} alt={att.name} />}
                                {att.type === 'video' && <Video size={24} />}
                                {att.type === 'document' && <FileText size={24} />}
                                <span>{att.name}</span>
                                <button type="button" onClick={() => removeAttachment(idx)} aria-label="Remover anexo">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreatePost(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isCreatingPost || !newPostContent.trim()}>
                    {isCreatingPost ? <Loader2 size={16} /> : 'Publicar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Verification Request Modal */}
        {showVerificationModal && (
          <div className="modal-overlay" onClick={() => setShowVerificationModal(false)}>
            <div className="modal-content verification-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Solicitar Verificação</h3>
                <button onClick={() => setShowVerificationModal(false)} aria-label="Fechar">
                  <X size={20} />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Preencha os dados da sua empresa para solicitar o selo de verificação.
                    Empresas verificadas ganham destaque no feed e credibilidade.
                  </p>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nome da Empresa *</label>
                      <input
                        type="text"
                        value={verificationForm.companyName}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, companyName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Handle *</label>
                      <div className="handle-input">
                        <span>@</span>
                        <input
                          type="text"
                          value={verificationForm.handle}
                          onChange={(e) => setVerificationForm(prev => ({ ...prev, handle: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Categoria *</label>
                      <select
                        value={verificationForm.category}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, category: e.target.value }))}
                        required
                      >
                        {categories.filter(c => c.id !== 'all').map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Site</label>
                      <input
                        type="url"
                        placeholder="https://empresa.com.br"
                        value={verificationForm.website}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, website: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>E-mail *</label>
                      <input
                        type="email"
                        value={verificationForm.email}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Telefone</label>
                      <input
                        type="tel"
                        value={verificationForm.phone}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Endereço</label>
                      <input
                        type="text"
                        value={verificationForm.address}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Descrição *</label>
                      <textarea
                        value={verificationForm.description}
                        onChange={(e) => setVerificationForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={4}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowVerificationModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Enviar Solicitação
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feed Content */}
        {/* Mobile Category Chips (sticky on mobile) */}
        <div className="mobile-category-chips-sticky">
          <div className="chips-scroll" role="tablist">
            {categories.map(cat => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={selectedCategory === cat.id}
                className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  loadFeedRef.current?.(true);
                }}
                style={{ '--category-color': cat.color }}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {isLoading && posts.length === 0 ? (
          <div className="loading-state">
            <Loader2 size={32} className="spin" />
            <p>Carregando feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <Building2 size={64} style={{ color: 'var(--senai-blue-primary)', opacity: 0.2 }} />
            <h2>Nenhum post encontrado</h2>
            <p>Seja o primeiro a publicar no feed de empresas!</p>
            <button className="btn-primary" onClick={() => setShowCreatePost(true)}>
              <MessageSquare size={18} />
              <span>Criar post</span>
            </button>
          </div>
        ) : (
          <div className="posts-list" role="feed">
            {posts.map(post => (
              <article
                key={post.id}
                className={`business-post ${post.isPinned ? 'pinned' : ''} ${expandedPosts.has(post.id) ? 'expanded' : ''}`}
              >
                {/* Post Header */}
                <div className="post-header">
                  <div className="post-author" onClick={() => window.open(`/company/${post.companyId}`, '_blank')}>
                    <Avatar
                      user={{ name: post.companyName, avatar: post.companyLogo }}
                      size={44}
                      className="company-avatar"
                    />
                    <div className="author-info">
                      <div className="author-name-row">
                        <span className="company-name">{post.companyName}</span>
                        {renderVerificationBadge(post)}
                      </div>
                      <div className="author-meta">
                        <span className="post-category" style={{ '--category-color': getCategoryInfo(post.category).color }}>
                          {getCategoryInfo(post.category).icon} {getCategoryInfo(post.category).name}
                        </span>
                        <span>·</span>
                        <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
                      </div>
                    </div>
                  </div>
                  <button
                    className="post-menu-btn"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                {/* Post Content */}
                <div className="post-content">
                  <p className={expandedPosts.has(post.id) ? '' : 'truncated'}>{post.content}</p>
                  {(post.content.length > 200 || post.attachments?.length > 0) && (
                    <button
                      className="expand-btn"
                      onClick={() => toggleExpand(post.id)}
                      aria-expanded={expandedPosts.has(post.id)}
                    >
                      {expandedPosts.has(post.id) ? (
                        <>
                          <ChevronUp size={14} /> Recolher
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Ver mais
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Attachments */}
                {post.attachments && post.attachments.length > 0 && (
                  <div className="post-attachments">
                    {post.attachments.map((att, idx) => renderAttachment(att, idx))}
                  </div>
                )}

                {/* Link Preview */}
                {post.link && (
                  <a href={post.link} target="_blank" rel="noopener noreferrer" className="post-link-preview">
                    <ExternalLink size={16} />
                    <div className="link-info">
                      <span className="link-title">Ver link completo</span>
                      <span className="link-url">{new URL(post.link).hostname}</span>
                    </div>
                    <ExternalLink size={16} />
                  </a>
                )}

                {/* Post Actions */}
                <div className="post-actions">
                  <button
                    className={`action-btn ${post.isLiked ? 'liked' : ''}`}
                    onClick={() => handleLike(post.id, post.isLiked)}
                    aria-label={post.isLiked ? 'Descurtir' : 'Curtir'}
                    aria-pressed={post.isLiked}
                  >
                    <Heart size={20} fill={post.isLiked ? 'currentColor' : 'none'} />
                    <span>{formatCount(post.likesCount)}</span>
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => toggleExpand(post.id)}
                    aria-label="Comentários"
                  >
                    <MessageSquare size={20} />
                    <span>{formatCount(post.commentsCount)}</span>
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleShare(post.id)}
                    aria-label="Compartilhar"
                  >
                    <Share2 size={20} />
                    <span>{formatCount(post.sharesCount)}</span>
                  </button>
                  <div className="action-spacer" />
                  <button
                    className="action-btn subtle"
                    onClick={() => setShowVerificationModal(true)}
                    aria-label="Solicitar verificação"
                    title="Solicitar verificação para sua empresa"
                  >
                    <Verified size={20} />
                    <span>Verificar</span>
                  </button>
                </div>
              </article>
            ))}

            {isLoadingMore && (
              <div className="loading-more">
                <Loader2 size={24} className="spin" />
                <span>Carregando mais...</span>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="end-of-feed">
                <p>Você viu todos os posts</p>
              </div>
            )}
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === 'companies' && (
          <div className="companies-tab">
            <div className="companies-header">
              <h2>Empresas Verificadas</h2>
              <p>Conecte-se com empresas líderes do mercado</p>
            </div>

            {isLoadingCompanies && companies.length === 0 ? (
              <div className="loading-state">
                <Loader2 size={32} className="spin" />
                <p>Carregando empresas...</p>
              </div>
            ) : companies.length === 0 ? (
              <div className="empty-state">
                <Building2 size={64} style={{ color: 'var(--senai-blue-primary)', opacity: 0.2 }} />
                <h2>Nenhuma empresa encontrada</h2>
              </div>
            ) : (
              <div className="companies-grid">
                {companies.map(company => (
                  <article key={company.id} className="company-card">
                    <div className="company-card-header">
                      <Avatar
                        user={{ name: company.name, avatar: company.logo }}
                        size={60}
                        className="company-card-avatar"
                      />
                      <div className="company-card-badges">
                        {renderVerificationBadge(company)}
                        {company.isFollowed && <span className="following-badge">Seguindo</span>}
                      </div>
                    </div>

                    <div className="company-card-info">
                      <h3 className="company-card-name">{company.name}</h3>
                      <p className="company-card-handle">{company.handle}</p>
                      <p className="company-card-description">{company.description}</p>

                      <div className="company-card-meta">
                        <span className="company-category" style={{ '--category-color': getCategoryInfo(company.category).color }}>
                          {getCategoryInfo(company.category).icon} {getCategoryInfo(company.category).name}
                        </span>
                        {company.subcategory && mockSubcategories[company.category]?.find(s => s.id === company.subcategory) && (
                          <span className="company-subcategory">
                            {mockSubcategories[company.category].find(s => s.id === company.subcategory).name}
                          </span>
                        )}
                      </div>

                      <div className="company-card-stats">
                        <div className="stat">
                          <span className="stat-value">{formatCount(company.followersCount)}</span>
                          <span className="stat-label">Seguidores</span>
                        </div>
                        <div className="stat">
                          <span className="stat-value">{formatCount(company.postsCount)}</span>
                          <span className="stat-label">Posts</span>
                        </div>
                        {company.employeeCount && (
                          <div className="stat">
                            <span className="stat-value">{company.employeeCount}</span>
                            <span className="stat-label">Funcionários</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="company-card-actions">
                      <button
                        className={`btn-follow ${company.isFollowed ? 'following' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowCompany(company.id, company.isFollowed);
                        }}
                        aria-pressed={company.isFollowed}
                      >
                        {company.isFollowed ? (
                          <>
                            <BellOff size={16} /> Seguindo
                          </>
                        ) : (
                          <>
                            <Bell size={16} /> Seguir
                          </>
                        )}
                      </button>
                      <button
                        className="btn-visit"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(company.website || `#/company/${company.id}`, '_blank');
                        }}
                      >
                        <ExternalLink size={16} /> Visitar
                      </button>
                    </div>
                  </article>
                ))}

                {isLoadingCompanies && (
                  <div className="loading-more">
                    <Loader2 size={24} className="spin" />
                    <span>Carregando mais...</span>
                  </div>
                )}

                {!companiesHasMore && companies.length > 0 && (
                  <div className="end-of-feed">
                    <p>Todas as empresas carregadas</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessFeed;