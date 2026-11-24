import { useEffect, useMemo, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import './EventosPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatDate = (value) => {
  if (!value) return { day: '--', month: '', full: 'Data a confirmar' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '', full: 'Data a confirmar' };
  return {
    day: date.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    full: date.toLocaleDateString('pt-BR', { dateStyle: 'full' })
  };
};

const categoryColor = {
  competição: '#ef4444',
  palestra: '#3b82f6',
  workshop: '#8b5cf6',
  feira: '#f59e0b',
  curso: '#0d8abc'
};

export default function EventosPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registrationForm, setRegistrationForm] = useState({ registration_name: '', participation_type: 'individual', team_name: '', shift: '', course: '', notes: '' });
  const [submittingRegistration, setSubmittingRegistration] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState('');
  const { registerEventHandler } = useSocket();

  useEffect(() => {
    let disposed = false;
    let activeController = null;
    let requestSequence = 0;

    const loadEvents = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const currentRequest = ++requestSequence;
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_URL}/api/events`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os eventos.');
        if (!disposed && currentRequest === requestSequence) {
          setEvents(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!disposed && err.name !== 'AbortError' && currentRequest === requestSequence) {
          setError(err.message || 'Erro ao carregar os eventos.');
        }
      } finally {
        if (!disposed && currentRequest === requestSequence) setLoading(false);
      }
    };

    const unsubscribe = registerEventHandler('admin_content_changed', change => {
      if (change?.resource === 'events') loadEvents();
    });
    const unsubscribeRegistrations = registerEventHandler('event_registration_changed', change => {
      if (change?.eventId) loadEvents();
    });

    loadEvents();
    return () => {
      disposed = true;
      activeController?.abort();
      unsubscribe();
      unsubscribeRegistrations();
    };
  }, [registerEventHandler]);

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault();
    if (!selectedEvent) return;
    setSubmittingRegistration(true);
    setRegistrationError('');
    setRegistrationSuccess('');
    try {
      const response = await fetch(`${API_URL}/api/events/${selectedEvent.id}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registrationForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível realizar a inscrição.');
      setRegistrationSuccess('Inscrição confirmada! Você já está na lista deste evento.');
      setSelectedEvent(previous => previous ? { ...previous, enrolled_count: data.enrolled_count } : previous);
      setEvents(previous => previous.map(item => Number(item.id) === Number(selectedEvent.id)
        ? { ...item, enrolled_count: data.enrolled_count } : item));
    } catch (err) {
      setRegistrationError(err.message);
    } finally {
      setSubmittingRegistration(false);
    }
  };

  const categories = useMemo(
    () => ['Todos', ...new Set(events.map(event => event.category).filter(Boolean))],
    [events]
  );
  const filteredEvents = filter === 'Todos' ? events : events.filter(event => event.category === filter);
  const registeredCount = events.reduce((sum, event) => sum + Number(event.enrolled_count || 0), 0);

  return (
    <div className="eventos-page">
      <div className="eventos-hero">
        <div className="eventos-hero-content">
          <span className="eventos-badge">📅 Agenda SENAI</span>
          <h1>Eventos & Atividades</h1>
          <p>Eventos e atividades publicados pela administração para sua unidade.</p>
        </div>
        <div className="eventos-stats">
          <div className="stat-item"><strong>{events.length}</strong><span>Eventos publicados</span></div>
          <div className="stat-item"><strong>{registeredCount.toLocaleString('pt-BR')}</strong><span>Inscrições registradas</span></div>
        </div>
      </div>

      <div className="eventos-filtros">
        {categories.map(category => (
          <button
            key={category}
            type="button"
            className={`filtro-btn ${filter === category ? 'active' : ''}`}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loading && <div className="card" style={{ padding: 32, textAlign: 'center' }}>Carregando eventos publicados…</div>}
      {error && <div className="card" role="alert" style={{ padding: 24, color: 'var(--color-error, #b91c1c)' }}>{error}</div>}

      {!loading && !error && (
        <div className="eventos-grid">
          {filteredEvents.map(event => {
            const date = formatDate(event.event_date);
            const enrolled = Number(event.enrolled_count || 0);
            const vacancies = Number(event.vacancies || 0);
            const categoryKey = String(event.category || '').toLowerCase();
            return (
              <article key={event.id} className="evento-card">
                <div className="evento-img-wrapper">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.hidden = true; e.currentTarget.parentElement.classList.add('has-image-error'); }} />
                  ) : (
                    <div className="evento-image-placeholder" aria-hidden="true">📅</div>
                  )}
                  {event.category && (
                    <span className="evento-categoria" style={{ background: categoryColor[categoryKey] || '#64748b' }}>
                      {event.category}
                    </span>
                  )}
                </div>
                <div className="evento-body">
                  <div className="evento-date-block">
                    <span className="ev-day">{date.day}</span>
                    <span className="ev-month">{date.month}</span>
                  </div>
                  <div className="evento-info">
                    <h3>{event.title}</h3>
                    {event.location && <p className="evento-local">📍 {event.location}</p>}
                    {event.event_time && <p className="evento-hora">🕐 {event.event_time}</p>}
                    {event.unit && <p className="evento-local">Unidade: {event.unit}</p>}
                    {vacancies > 0 && <div className="evento-vagas"><span>{Math.max(vacancies - enrolled, 0)} de {vacancies} vagas disponíveis</span></div>}
                  </div>
                </div>
                <button type="button" className="evento-btn inscrever" onClick={() => { setSelectedEvent(event); setRegistrationForm({ registration_name: '', participation_type: 'individual', team_name: '', shift: '', course: '', notes: '' }); setRegistrationError(''); setRegistrationSuccess(''); }}>
                  Ver detalhes
                </button>
              </article>
            );
          })}
          {filteredEvents.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', padding: 36, textAlign: 'center' }}>
              {events.length === 0 ? 'Ainda não há eventos publicados para sua unidade.' : 'Nenhum evento nesta categoria.'}
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <div className="eventos-modal-overlay" role="presentation" onClick={() => setSelectedEvent(null)}>
          <section className="eventos-modal" role="dialog" aria-modal="true" aria-label={selectedEvent.title} onClick={event => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Fechar detalhes" onClick={() => setSelectedEvent(null)}>×</button>
            {selectedEvent.image_url && <img src={selectedEvent.image_url} alt="" className="modal-img" onError={(e) => { e.currentTarget.hidden = true; }} />}
            <div className="modal-body">
              <h2>{selectedEvent.title}</h2>
              <p className="modal-desc">{selectedEvent.description || 'Evento publicado pela administração.'}</p>
              <div className="modal-details">
                <div><strong>Data:</strong> {formatDate(selectedEvent.event_date).full}</div>
                {selectedEvent.event_time && <div><strong>Horário:</strong> {selectedEvent.event_time}</div>}
                {selectedEvent.location && <div><strong>Local:</strong> {selectedEvent.location}</div>}
                {selectedEvent.unit && <div><strong>Unidade:</strong> {selectedEvent.unit}</div>}
                {selectedEvent.author_name && <div><strong>Organizador:</strong> {selectedEvent.author_name}</div>}
                {Number(selectedEvent.vacancies) > 0 && <div><strong>Vagas:</strong> {Math.max(Number(selectedEvent.vacancies) - Number(selectedEvent.enrolled_count || 0), 0)} de {selectedEvent.vacancies} disponíveis</div>}
              </div>
            </div>
            <div className="evento-registration-panel">
              <h3>Inscrição no evento</h3>
              <p>Preencha apenas seu nome. Os demais dados são opcionais.</p>
              {registrationSuccess ? (
                <div className="registration-feedback success" role="status">{registrationSuccess}</div>
              ) : (
                <form onSubmit={handleRegistrationSubmit} className="evento-registration-form">
                  <label>Nome completo *
                    <input required maxLength={120} value={registrationForm.registration_name}
                      onChange={e => setRegistrationForm(v => ({ ...v, registration_name: e.target.value }))} />
                  </label>
                  <label>Participação
                    <select value={registrationForm.participation_type}
                      onChange={e => setRegistrationForm(v => ({ ...v, participation_type: e.target.value }))}>
                      <option value="individual">Individual</option>
                      <option value="group">Em grupo</option>
                    </select>
                  </label>
                  {registrationForm.participation_type === 'group' && (
                    <label>Nome da equipe (opcional)
                      <input maxLength={120} value={registrationForm.team_name}
                        onChange={e => setRegistrationForm(v => ({ ...v, team_name: e.target.value }))} />
                    </label>
                  )}
                  <label>Turno (opcional)
                    <select value={registrationForm.shift}
                      onChange={e => setRegistrationForm(v => ({ ...v, shift: e.target.value }))}>
                      <option value="">Não informar</option><option>Matutino</option><option>Vespertino</option><option>Noturno</option><option>Integral</option>
                    </select>
                  </label>
                  <label>Curso (opcional)
                    <input maxLength={120} value={registrationForm.course}
                      onChange={e => setRegistrationForm(v => ({ ...v, course: e.target.value }))} />
                  </label>
                  <label>Observações (opcional)
                    <textarea rows={3} maxLength={500} value={registrationForm.notes}
                      onChange={e => setRegistrationForm(v => ({ ...v, notes: e.target.value }))} />
                  </label>
                  {registrationError && <div className="registration-feedback error" role="alert">{registrationError}</div>}
                  <button className="evento-btn inscrever" type="submit" disabled={submittingRegistration ||
                    (Number(selectedEvent.vacancies) > 0 && Number(selectedEvent.enrolled_count || 0) >= Number(selectedEvent.vacancies))}>
                    {submittingRegistration ? 'Enviando inscrição…' : 'Confirmar inscrição'}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
