import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Search, ExternalLink, FolderOpen } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem('token')}`
});

const normalizeFile = (file, source) => ({
  id: file.notice_id ? `notice-${file.notice_id}` : `post-${file.id}`,
  title: file.attachment_name || file.title || 'Arquivo compartilhado',
  url: file.attachment_url,
  author: file.author_name || file.user_name || file.name || 'Comunidade SENAI',
  description: file.title || file.content || '',
  createdAt: file.published_at || file.created_at,
  source
});

const Files = () => {
  const [files, setFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const loadFiles = async () => {
      setLoading(true);
      setError('');
      const headers = getAuthHeaders();

      try {
        const [postsResult, noticesResult] = await Promise.allSettled([
          fetch(`${API_URL}/api/posts`, { headers, signal: controller.signal }),
          fetch(`${API_URL}/api/notices/files`, { headers, signal: controller.signal })
        ]);

        const collected = [];
        let successfulSources = 0;

        if (postsResult.status === 'fulfilled' && postsResult.value.ok) {
          const posts = await postsResult.value.json();
          if (Array.isArray(posts)) {
            collected.push(...posts
              .filter(post => post.attachment_url)
              .map(post => normalizeFile(post, 'Comunidade')));
          }
          successfulSources += 1;
        }

        if (noticesResult.status === 'fulfilled' && noticesResult.value.ok) {
          const noticeFiles = await noticesResult.value.json();
          if (Array.isArray(noticeFiles)) {
            collected.push(...noticeFiles.map(file => normalizeFile(file, 'Aviso oficial')));
          }
          successfulSources += 1;
        }

        if (!successfulSources) {
          throw new Error('Não foi possível carregar os arquivos. Atualize a página e tente novamente.');
        }

        const uniqueFiles = Array.from(
          new Map(collected.filter(file => file.url).map(file => [file.url, file])).values()
        ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        setFiles(uniqueFiles);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Erro ao carregar arquivos.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadFiles();
    return () => controller.abort();
  }, []);

  const filteredFiles = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return files;
    return files.filter(file =>
      [file.title, file.author, file.description, file.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  }, [files, searchTerm]);

  return (
    <div className="files-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}>
      <div className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ background: '#E8F5E9', padding: '10px', borderRadius: '50%', color: '#4CAF50', display: 'flex', flexShrink: 0 }}>
            <FolderOpen size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Arquivos e Materiais</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Materiais compartilhados pela comunidade e anexos de avisos oficiais destinados ao seu perfil.
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0, border: '1px solid var(--border-color)', borderRadius: '20px', padding: '4px 12px', background: 'var(--bg-card)' }}>
          <Search size={18} color="#65676B" style={{ marginRight: '6px', flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Buscar arquivos..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            aria-label="Buscar arquivos"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', width: 'min(200px, 50vw)', minWidth: 0, color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          Carregando arquivos disponíveis para seu perfil…
        </div>
      )}

      {error && <div className="card" role="alert" style={{ padding: 24 }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredFiles.length > 0 ? filteredFiles.map(file => (
            <article key={file.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: '1 1 260px' }}>
                <div style={{ background: '#FFEBEE', padding: '12px', borderRadius: '8px', color: '#E53935', display: 'flex', flexShrink: 0 }}>
                  <FileText size={28} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{file.title}</h4>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {file.source} · Por <strong>{file.author}</strong>
                    {file.createdAt && ` · ${new Date(file.createdAt).toLocaleDateString('pt-BR')}`}
                  </p>
                  {file.description && file.description !== file.title && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{file.description}</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-flex', padding: '8px 12px', fontSize: '0.85rem', gap: '6px' }}
                >
                  <ExternalLink size={16} /><span>Abrir</span>
                </a>
                <a
                  href={file.url}
                  download={file.title}
                  className="btn-primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', padding: '8px 12px', fontSize: '0.85rem', gap: '6px' }}
                >
                  <Download size={16} /><span>Baixar</span>
                </a>
              </div>
            </article>
          )) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {files.length ? 'Nenhum arquivo corresponde à busca.' : 'Nenhum arquivo foi publicado ou compartilhado para seu perfil.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Files;
