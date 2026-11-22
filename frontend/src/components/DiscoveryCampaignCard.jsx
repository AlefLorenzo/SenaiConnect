import { useEffect, useRef, useState } from 'react';
import { Building2, ExternalLink, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSafeDestination } from '../utils/safeUrl';
import './DiscoveryCampaignCard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function authHeaders() {
    const token = sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DiscoveryCampaignCard({ ad }) {
    const cardRef = useRef(null);
    const impressionRequestRef = useRef(false);
    const [impressionId, setImpressionId] = useState(null);
    const destination = getSafeDestination(ad.destination_url || ad.external_link);
    const internal = Boolean(destination && destination.startsWith('/'));

    useEffect(() => {
        const node = cardRef.current;
        if (!node || !ad.creative_id || impressionRequestRef.current) return undefined;

        const registerImpression = async () => {
            if (impressionRequestRef.current) return;
            impressionRequestRef.current = true;
            try {
                const response = await fetch(`${API_URL}/api/business/ad-creatives/${ad.creative_id}/impression`, {
                    method: 'POST',
                    headers: authHeaders()
                });
                if (response.ok) {
                    const data = await response.json();
                    setImpressionId(data.impression_id || null);
                }
            } catch (error) {
                console.error('Não foi possível registrar a impressão do anúncio:', error);
            }
        };

        if (typeof IntersectionObserver === 'undefined') {
            registerImpression();
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
                registerImpression();
                observer.disconnect();
            }
        }, { threshold: [0.5] });

        observer.observe(node);
        return () => observer.disconnect();
    }, [ad.creative_id]);

    const trackClick = () => {
        if (!ad.creative_id || !impressionId) return;
        fetch(`${API_URL}/api/business/ad-creatives/${ad.creative_id}/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ impression_id: impressionId }),
            keepalive: true
        }).catch(error => console.error('Não foi possível registrar o clique no anúncio:', error));
    };

 
    return (
        <article className="discovery-campaign-card" ref={cardRef}>
            <div className="discovery-campaign-topline">
                <span className="discovery-sponsored-label"><Megaphone size={13} /> Patrocinado</span>
                <span className="discovery-campaign-source"><Building2 size={13} /> {ad.company_name}</span>
            </div>
            {ad.image_url && (
                <div className="discovery-campaign-media">
                    <img src={ad.image_url} alt={ad.title || ad.campaign_name || 'Anúncio'} loading="lazy" />
                </div>
            )}
            <div className="discovery-campaign-body">
                <div className="discovery-campaign-heading">
                    {ad.logo_url && <img src={ad.logo_url} alt="" loading="lazy" />}
                    <div>
                        <strong>{ad.title || ad.campaign_name || ad.company_name}</strong>
                        <span>{ad.company_name}</span>
                    </div>
                </div>
                {ad.description && <p>{ad.description}</p>}
                {destination ? (
                    internal ? (
                        <Link to={destination} className="discovery-campaign-cta" onClick={trackClick}>
                            Saiba mais <ExternalLink size={16} />
                        </Link>
                    ) : (
                        <a href={destination} target="_blank" rel="noopener noreferrer" className="discovery-campaign-cta" onClick={trackClick}>
                            Saiba mais <ExternalLink size={16} />
                        </a>
                    )
                ) : (
                    <span className="discovery-campaign-unavailable">Destino indisponível</span>
                )}
            </div>
        </article>
    );
}
