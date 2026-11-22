import { Bell, CalendarDays, GraduationCap, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSafeDestination } from '../utils/safeUrl';
import './DiscoveryInstitutionCard.css';

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DiscoveryInstitutionCard({ item }) {
    const destination = getSafeDestination(item.external_link);
    const internal = Boolean(destination && destination.startsWith('/'));
    const isEvent = item.institution_type === 'event';
    const isNotice = item.institution_type === 'notice';
 
    return (
        <article className="discovery-institution-card">
            <div className="discovery-institution-label">
                {isNotice ? <Bell size={15} /> : isEvent ? <CalendarDays size={15} /> : <GraduationCap size={15} />}
                <span>{isNotice ? 'Aviso institucional' : isEvent ? 'Evento institucional' : 'Oportunidade de formação'}</span>
            </div>
            {item.attachment_url && (
                <div className="discovery-institution-media">
                    <img src={item.attachment_url} alt={item.title || ''} loading="lazy" />
                </div>
            )}
            <div className="discovery-institution-content">
                <div className="discovery-institution-source">{item.company_name || 'Instituição'}</div>
                <h3>{item.title}</h3>
                {item.content && <p>{item.content}</p>}
                <div className="discovery-institution-meta">
                    {item.event_date && <span><CalendarDays size={14} /> {formatDate(item.event_date)}</span>}
                    {isNotice && item.priority && <span>{String(item.priority).toUpperCase()}</span>}
                    {(item.location || item.unit || item.area) && (
                        <span><MapPin size={14} /> {item.location || item.unit || item.area}</span>
                    )}
                </div>
                {destination && (
                    internal ? (
                        <Link to={destination} className="discovery-institution-link">
                            {item.link_label || (isNotice ? 'Ler comunicado' : isEvent ? 'Ver evento' : 'Conhecer curso')}
                        </Link>
                    ) : (
                        <a href={destination} target="_blank" rel="noopener noreferrer" className="discovery-institution-link">
                            {item.link_label || (isNotice ? 'Ler comunicado' : isEvent ? 'Ver evento' : 'Conhecer curso')}
                        </a>
                    )
                )}
            </div>
        </article>
    );
}
