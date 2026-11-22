import { useEffect, useMemo, useState } from 'react';
import './AvisosPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const priorities = {
  urgente: { label: 'Urgente', color: '#ef4444', icon: '🚨' },
  importante: { label: 'Importante', color: '#f59e0b', icon: '⚠️' },
  informativo: { label: 'Informativo', color: '#3b82f6', icon: 'ℹ️' },
  geral: { label: 'Geral', color: '#6b7280', icon: '📢' }
};

const normalizeNotice = (notice) => {
  const priority = notice.priority === 'urgent'
    ? 'urgente'
    : notice.priority === 'important'
      ? 'importante'
      : notice.priority === 'normal'
        ? 'geral'
        : (notice.priority || 'geral');
  return {
    ...notice,
    prioridade: priorities[priority] ? priority : 'geral',
    titulo: notice.title || '',
    conteudo: notice.content || '',
    setor: notice.unit || 'Institucional',
    autor: notice.author_name || 'Administração SENAI',
    avatar: notice.author_avatar || null,
    data: notice.published_at || notice.created_at,
    fixado: Boolean(notice.is_pinned),
    categoria: notice.unit || 'Institucional'
  };
};

function formatDate(value) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lidos, setLidos] = useState({});
  const [expandido, setExpandido] = useState(null);
  const [filtro, setFiltro] = useState('Todos');

  const loadNotices = async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/notices`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os avisos.');
      const normalized = Array.isArray(data) ? data.map(normalizeNotice) : [];
      setAvisos(normalized);
      setLidos(Object.fromEntries(normalized.filter(item => item.read_at).map(item => [item.id, true])));
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Erro ao carregar avisos.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadNotices(controller.signal);
    return () => controller.abort();
  }, []);

  const categorias = useMemo(
    () => ['Todos', ...new Set(avisos.map(aviso => aviso.categoria).filter(Boolean))],
    [avisos]
  );

  const fixados = avisos.filter(aviso => aviso.fixado);
  const naoFixados = avisos.filter(aviso => !aviso.fixado);
  const porFiltro = (items) => filtro === 'Todos'
    ? items
    : items.filter(aviso => aviso.categoria === filtro);

  const marcarLido = async (id) => {
    setLidos(previous => ({ ...previous, [id]: true }));
    try {
      const response = await fetch(`${API_URL}/api/notices/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Falha ao registrar leitura');
    } catch (err) {
      console.error('Erro ao registrar leitura do aviso:', err);
    }
  };

  const marcarTodosComoLidos = async () => {
    const unread = avisos.filter(aviso => !lidos[aviso.id]);
    setLidos(Object.fromEntries(avisos.map(aviso => [aviso.id, true])));
    await Promise.all(unread.map(aviso => marcarLido(aviso.id)));
  };

  const naoLidosCount = avisos.filter(aviso => !lidos[aviso.id]).length;

  const renderAviso = (aviso) => {
    const priority = priorities[aviso.prioridade] || priorities.geral;
    const isRead = Boolean(lidos[aviso.id] || aviso.read_at);
    const isOpen = expandido === aviso.id;

    return (
      <article
        key={aviso.id}
        className={`aviso-card ${aviso.prioridade} ${isRead ? 'lido' : ''}`}
        onClick={() => {
          setExpandido(isOpen ? null : aviso.id);
          if (!isRead) marcarLido(aviso.id);
        }}
      >
        <div className="aviso-stripe" style={{ background: priority.color }} />
        <div className="aviso-main">
          <div className="aviso-header">
            <div className="aviso-header-left">
              <span className="aviso-priority-badge" style={{ background: priority.color }}>
                {priority.icon} {priority.label}
              </span>
              {aviso.fixado && <span className="aviso-fixado">📌 Fixado</span>}
              <span className="aviso-cat">{aviso.categoria}</span>
            </div>
            <div className="aviso-header-right">
              {isRead && <span className="lido-badge">✓ Lido</span>}
              <span className="aviso-data">{formatDate(aviso.data)}</span>
            </div>
          </div>

          <h3 className="aviso-titulo">{aviso.titulo}</h3>
          <div className="aviso-autor">
            {aviso.avatar ? <img src={aviso.avatar} alt="" loading="lazy" /> : <span className="aviso-avatar-fallback">S</span>}
            <span>{aviso.autor} · <em>{aviso.setor}</em></span>
          </div>

          {isOpen && (
            <div className="aviso-conteudo">
              <p>{aviso.conteudo}</p>
              {aviso.image_url && <img className="aviso-image" src={aviso.image_url} alt="" loading="lazy" />}
              {aviso.attachment_url && (
                <div className="aviso-acoes">
                  <a
                    className="acao-btn"
                    href={aviso.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event => event.stopPropagation()}
                  >
                    📥 Abrir anexo {aviso.attachment_name ? `— ${aviso.attachment_name}` : ''}
                  </a>
                  <a
                    className="acao-btn"
                    href={aviso.attachment_url}
                    download={aviso.attachment_name || undefined}
                    onClick={event => event.stopPropagation()}
                  >
                    Baixar
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="aviso-expand-hint">{isOpen ? '▲ Recolher' : '▼ Ver mais'}</div>
        </div>
      </article>
    );
  };

  return (
    <div className="avisos-page">
      <div className="avisos-hero">
        <div className="avisos-hero-left">
          <span className="avisos-badge">📢 Mural Oficial</span>
          <h1>Avisos & Comunicados</h1>
          <p>Comunicados publicados para você, conforme seu curso e unidade.</p>
        </div>
        <div className="avisos-hero-stats">
          <div className="av-stat urgente-s">
            <strong>{avisos.filter(aviso => aviso.prioridade === 'urgente').length}</strong>
            <span>🚨 Urgentes</span>
          </div>
          <div className="av-stat"><strong>{naoLidosCount}</strong><span>Não lidos</span></div>
          <div className="av-stat"><strong>{avisos.length}</strong><span>Total</span></div>
        </div>
      </div>

      <div className="avisos-filtros">
        {categorias.map(category => (
          <button
            key={category}
            type="button"
            className={`filtro-btn-av ${filtro === category ? 'active' : ''}`}
            onClick={() => setFiltro(category)}
          >
            {category}
          </button>
        ))}
        <button type="button" className="marcar-todos-btn" onClick={marcarTodosComoLidos} disabled={naoLidosCount === 0}>
          ✓ Marcar todos como lidos
        </button>
      </div>

      {loading && <div className="card" style={{ padding: 32, textAlign: 'center' }}>Carregando avisos publicados…</div>}
      {error && <div className="card" role="alert" style={{ padding: 24 }}>{error}</div>}

      {!loading && !error && (
        <>
          {filtro === 'Todos' && porFiltro(fixados).length > 0 && (
            <div className="avisos-section">
              <h2 className="section-label">📌 Avisos Fixados</h2>
              <div className="avisos-list">{porFiltro(fixados).map(renderAviso)}</div>
            </div>
          )}
          <div className="avisos-section">
            <h2 className="section-label">🗂 Todos os Comunicados</h2>
            <div className="avisos-list">{porFiltro(filtro === 'Todos' ? naoFixados : avisos.filter(aviso => !aviso.fixado || filtro !== 'Todos')).map(renderAviso)}</div>
            {avisos.length === 0 && (
              <div className="card" style={{ padding: 36, textAlign: 'center' }}>
                Ainda não há avisos publicados para seu perfil.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
