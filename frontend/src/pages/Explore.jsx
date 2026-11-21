import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Compass, Briefcase, FolderOpen, HelpCircle, UserPlus, Users } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import Post from '../components/Post';
import Avatar from '../components/Avatar';
import RoleBadge from '../components/RoleBadge';
import FollowButton from '../components/FollowButton';
import { useFollow } from '../hooks/useFollow';
import searchService from '../services/searchService';
import './Explore.css';

const PersonCard = ({ person }) => {
  const { isFollowing, loading, toggleFollow } = useFollow(person.id);
  return (
    <div className="explore-person-card card">
      <Link to={`/profile/${person.id}`} className="explore-person-top">
        <Avatar user={person} className="explore-person-avatar" />
        <div className="explore-person-info">
          <strong>{person.name}</strong>
          <RoleBadge role={person.role} />
          {person.course && <span className="explore-person-course">{person.course}</span>}
          {person.unit && <span className="explore-person-unit">{person.unit}</span>}
        </div>
      </Link>
      <FollowButton isFollowing={isFollowing} loading={loading} onToggle={toggleFollow} targetUserId={person.id} />
    </div>
  );
};

const Explore = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const q = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState('discover');

  const [suggestions, setSuggestions] = useState({ people: [], projects: [], opportunities: [], questions: [] });
  const [searchResults, setSearchResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(q);
  const mountedRef = useRef(true);

  // Sync searchQuery with URL param
  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery(q);
    return () => { mountedRef.current = false; };
  }, [q]);

  const fetchSuggestions = useCallback(async () => {
    mountedRef.current = true;
    setLoading(true);
    try {
      const data = await searchService.getSuggestions(true);
      if (mountedRef.current) setSuggestions(data);
    } catch (e) { console.error(e); }
    finally { if (mountedRef.current) setLoading(false); }
  }, []);

  const fetchSearchResults = useCallback(async (term) => {
    mountedRef.current = true;
    setLoading(true);
    try {
      const data = await searchService.search(term);
      if (mountedRef.current) setSearchResults(data);
    } catch (e) { console.error(e); }
    finally { if (mountedRef.current) setLoading(false); }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (q) {
        await fetchSearchResults(q);
      } else {
        await fetchSuggestions();
      }
    };
    load();
    return () => { mountedRef.current = false; };
  }, [q, fetchSuggestions, fetchSearchResults]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const tabs = [
    { id: 'discover', label: 'Descobrir', icon: <Compass size={16} /> },
    { id: 'projects', label: 'Projetos', icon: <FolderOpen size={16} /> },
    { id: 'opportunities', label: 'Vagas', icon: <Briefcase size={16} /> },
    { id: 'questions', label: 'Dúvidas', icon: <HelpCircle size={16} /> },
  ];

  return (
    <div className="explore-container">
      {/* Search bar at top */}
      <div className="explore-search-bar card">
        <form onSubmit={handleSearch} className="explore-search-form">
          <Search size={20} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Buscar pessoas, projetos, vagas, dúvidas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="explore-search-input"
          />
          <button type="submit" className="btn-primary explore-search-btn">Buscar</button>
        </form>
      </div>

      {/* Search results mode */}
      {q ? (
        <div className="explore-results">
          <h2 className="explore-results-title">Resultados para "{q}"</h2>

          {searchResults.users?.length > 0 && (
            <section className="explore-section">
              <h3><Users size={18} /> Pessoas ({searchResults.users.length})</h3>
              <div className="explore-people-grid">
                {searchResults.users.map(p => <PersonCard key={p.id} person={p} />)}
              </div>
            </section>
          )}

          {searchResults.posts?.length > 0 && (
            <section className="explore-section">
              <h3>Publicações ({searchResults.posts.length})</h3>
              {searchResults.posts.map(post => <Post key={post.id} post={post} />)}
            </section>
          )}

          {!loading && !searchResults.users?.length && !searchResults.posts?.length && (
            <div className="card explore-empty">
              <Search size={40} />
              <h3>Nenhum resultado encontrado</h3>
              <p>Tente buscar por nome de pessoa, curso, unidade ou conteúdo de post.</p>
            </div>
          )}
        </div>
      ) : (
        /* Discovery mode */
        <>
          <div className="explore-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`explore-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'discover' && (
            <div>
              <section className="explore-section">
                <div className="explore-section-header">
                  <h3><UserPlus size={18} /> Pessoas que você pode conhecer</h3>
                  {user?.course && <span className="explore-section-sub">Baseado no seu curso: {user.course}</span>}
                </div>
                {loading ? (
                  <div className="explore-loading">Buscando sugestões...</div>
                ) : suggestions.people?.length > 0 ? (
                  <div className="explore-people-grid">
                    {suggestions.people.map(p => <PersonCard key={p.id} person={p} />)}
                  </div>
                ) : (
                  <div className="explore-empty-small">Você já segue todos da sua área! Explore outras abas.</div>
                )}
              </section>

              {suggestions.opportunities?.length > 0 && (
                <section className="explore-section">
                  <div className="explore-section-header">
                    <h3><Briefcase size={18} /> Vagas e oportunidades recentes</h3>
                  </div>
                  {suggestions.opportunities.map(post => <Post key={post.id} post={post} />)}
                </section>
              )}
            </div>
          )}

          {activeTab === 'projects' && (
            <section className="explore-section">
              <div className="explore-section-header">
                <h3><FolderOpen size={18} /> Projetos em destaque</h3>
                <span className="explore-section-sub">Os melhores projetos da semana</span>
              </div>
              {loading ? <div className="explore-loading">Carregando...</div>
                : suggestions.projects?.length > 0
                ? suggestions.projects.map(post => <Post key={post.id} post={post} />)
                : <div className="explore-empty-small card">Nenhum projeto publicado ainda. Compartilhe o seu!</div>
              }
            </section>
          )}

          {activeTab === 'opportunities' && (
            <section className="explore-section">
              <div className="explore-section-header">
                <h3><Briefcase size={18} /> Vagas e Oportunidades</h3>
                <span className="explore-section-sub">Estágios, empregos e processos seletivos</span>
              </div>
              {loading ? <div className="explore-loading">Carregando...</div>
                : suggestions.opportunities?.length > 0
                ? suggestions.opportunities.map(post => <Post key={post.id} post={post} />)
                : <div className="explore-empty-small card">Nenhuma vaga publicada ainda.</div>
              }
            </section>
          )}

          {activeTab === 'questions' && (
            <section className="explore-section">
              <div className="explore-section-header">
                <h3><HelpCircle size={18} /> Dúvidas sem resposta</h3>
                <span className="explore-section-sub">Ajude seus colegas respondendo dúvidas</span>
              </div>
              {loading ? <div className="explore-loading">Carregando...</div>
                : suggestions.questions?.length > 0
                ? suggestions.questions.map(post => <Post key={post.id} post={post} />)
                : <div className="explore-empty-small card">Nenhuma dúvida pendente. Ótimo!</div>
              }
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Explore;
