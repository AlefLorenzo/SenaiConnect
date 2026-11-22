import { useEffect, useMemo, useState } from 'react';
import './CursosPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const parseSkills = (value) => {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
};

export default function CursosPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_URL}/api/courses`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os cursos.');
        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Erro ao carregar os cursos.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadCourses();
    return () => controller.abort();
  }, []);

  const categories = useMemo(
    () => ['Todos', ...new Set(courses.map(course => course.area).filter(Boolean))],
    [courses]
  );

  const filteredCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return courses.filter(course => {
      const skills = parseSkills(course.skills);
      const matchesCategory = filter === 'Todos' || course.area === filter;
      const searchable = [course.title, course.description, course.area, course.unit, ...skills]
        .filter(Boolean).join(' ').toLowerCase();
      return matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [courses, filter, search]);

  const enrolledCount = courses.reduce((total, course) => total + Number(course.enrolled_count || 0), 0);

  return (
    <div className="cursos-page">
      <div className="cursos-hero">
        <div className="cursos-hero-text">
          <span className="cursos-badge">🎓 Plataforma de Cursos</span>
          <h1>Aprenda com os Melhores</h1>
          <p>Cursos e formações publicados pela administração para sua unidade.</p>
          <div className="cursos-search">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              placeholder="Buscar cursos ou tecnologias..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar cursos"
            />
          </div>
        </div>
        <div className="cursos-hero-stats">
          <div className="c-stat"><strong>{courses.length}</strong><span>Cursos publicados</span></div>
          <div className="c-stat"><strong>{enrolledCount.toLocaleString('pt-BR')}</strong><span>Matrículas registradas</span></div>
        </div>
      </div>

      <div className="cursos-filtros">
        {categories.map(category => (
          <button
            key={category}
            type="button"
            className={`filtro-btn-c ${filter === category ? 'active' : ''}`}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loading && <div className="card" style={{ padding: 32, textAlign: 'center' }}>Carregando cursos publicados…</div>}
      {error && <div className="card" role="alert" style={{ padding: 24, color: 'var(--color-error, #b91c1c)' }}>{error}</div>}

      {!loading && !error && (
        <div className="cursos-grid">
          {filteredCourses.map(course => {
            const skills = parseSkills(course.skills);
            return (
              <article key={course.id} className="curso-card">
                <div className="curso-img-wrapper">
                  {course.image_url ? (
                    <img src={course.image_url} alt={course.title} loading="lazy" />
                  ) : (
                    <div className="curso-image-placeholder" aria-hidden="true">🎓</div>
                  )}
                  {course.modality && <span className="curso-nivel">{course.modality}</span>}
                  {course.area && <span className="curso-cat-icon">{course.area}</span>}
                </div>

                <div className="curso-body">
                  <h3>{course.title}</h3>
                  {course.description && <p className="curso-desc">{course.description}</p>}
                  <div className="curso-instrutor">
                    <span>{course.author_name ? `Publicado por ${course.author_name}` : 'Conteúdo institucional SENAI'}</span>
                  </div>
                  {skills.length > 0 && (
                    <div className="curso-tags">
                      {skills.map(skill => <span key={skill} className="tag-c">{skill}</span>)}
                    </div>
                  )}
                  <div className="curso-meta">
                    {course.duration && <span>⏱ {course.duration}</span>}
                    {course.period && <span>🗓 {course.period}</span>}
                    {course.vacancies > 0 && <span>👥 {course.vacancies} vagas</span>}
                    {course.unit && <span>📍 {course.unit}</span>}
                  </div>
                  {course.enrollment_info && <p className="curso-desc">{course.enrollment_info}</p>}
                </div>

                <div className="curso-footer">
                  <span className="curso-preco">{course.vacancies > 0 ? `${course.vacancies} vagas` : 'Consulte a unidade'}</span>
                  <button type="button" className="matricula-btn" onClick={() => setSelectedCourse(course)}>
                    Ver detalhes
                  </button>
                </div>
              </article>
            );
          })}
          {filteredCourses.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', padding: 36, textAlign: 'center' }}>
              {courses.length === 0 ? 'Ainda não há cursos publicados para sua unidade.' : 'Nenhum curso corresponde à busca.'}
            </div>
          )}
        </div>
      )}

      {selectedCourse && (
        <div className="curso-details-overlay" role="presentation" onClick={() => setSelectedCourse(null)}>
          <section className="curso-details-dialog" role="dialog" aria-modal="true" aria-label={selectedCourse.title} onClick={event => event.stopPropagation()}>
            <button type="button" className="curso-details-close" aria-label="Fechar detalhes" onClick={() => setSelectedCourse(null)}>×</button>
            {selectedCourse.image_url && <img src={selectedCourse.image_url} alt="" className="curso-details-image" />}
            <div className="curso-details-body">
              <h2>{selectedCourse.title}</h2>
              <p className="curso-details-description">{selectedCourse.description || 'Curso publicado pela administração.'}</p>
              {selectedCourse.unit && <p><strong>Unidade:</strong> {selectedCourse.unit}</p>}
              {selectedCourse.duration && <p><strong>Duração:</strong> {selectedCourse.duration}</p>}
              {selectedCourse.modality && <p><strong>Modalidade:</strong> {selectedCourse.modality}</p>}
              {selectedCourse.enrollment_info && <p>{selectedCourse.enrollment_info}</p>}
              <p>Para informações de inscrição, consulte a unidade responsável.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
