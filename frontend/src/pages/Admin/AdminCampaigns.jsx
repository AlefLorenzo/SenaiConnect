import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Megaphone, Pause, Play, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import './AdminCampaigns.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_LABELS = {
    draft: 'Rascunho',
    pending_approval: 'Aguardando análise',
    approved: 'Aprovada',
    active: 'Em veiculação',
    paused: 'Pausada',
    completed: 'Finalizada',
    rejected: 'Rejeitada'
};

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safeDestination(value) {
    const destination = String(value || '').trim();
    if (!destination || /^(javascript|data|file|vbscript):/i.test(destination)) return null;
    if (destination.startsWith('/')) {
        return destination.startsWith('//') || destination.includes(String.fromCharCode(92)) ? null : destination;
    }
    try {
        const url = new URL(destination);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
        return null;
    }
}

export default function AdminCampaigns() {
    const [campaigns, setCampaigns] = useState([]);
    const [stats, setStats] = useState(null);
    const [adSpaces, setAdSpaces] = useState([]);
    const [spaceWorking, setSpaceWorking] = useState(false);
    const [status, setStatus] = useState('pending_approval');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState(null);
    const [error, setError] = useState('');

    const token = () => sessionStorage.getItem('token');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: '1', limit: '50' });
            if (status) params.set('status', status);
            if (search.trim()) params.set('search', search.trim());
            const headers = { Authorization: 'Bearer ' + token() };
            const [campaignResponse, statsResponse, spacesResponse] = await Promise.all([
                fetch(API_URL + '/api/business/admin/campaigns?' + params.toString(), { headers }),
                fetch(API_URL + '/api/business/admin/campaigns/stats', { headers }),
                fetch(API_URL + '/api/business/admin/ad-spaces?page=1&limit=100', { headers })
            ]);
            if (!campaignResponse.ok) throw new Error('Não foi possível carregar as campanhas.');
            const campaignData = await campaignResponse.json();
            setCampaigns(Array.isArray(campaignData.campaigns) ? campaignData.campaigns : []);
            if (statsResponse.ok) setStats(await statsResponse.json());
            if (spacesResponse.ok) {
                const spaceData = await spacesResponse.json();
                setAdSpaces(Array.isArray(spaceData.spaces) ? spaceData.spaces : []);
            }
        } catch (loadError) {
            setError(loadError.message || 'Erro ao carregar publicidade.');
        } finally {
            setLoading(false);
        }
    }, [status, search]);

    useEffect(() => {
        const timer = window.setTimeout(loadData, 250);
        return () => window.clearTimeout(timer);
    }, [loadData]);

    const performAction = async (campaign, action, body = {}) => {
        setWorkingId(campaign.id);
        setError('');
        try {
            const response = await fetch(
                API_URL + '/api/business/admin/campaigns/' + campaign.id + '/' + action,
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + token(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a ação.');
            await loadData();
        } catch (actionError) {
            setError(actionError.message || 'Erro ao atualizar a campanha.');
        } finally {
            setWorkingId(null);
        }
    };

    const handleReject = (campaign) => {
        const reason = window.prompt('Informe o motivo da rejeição desta campanha:');
        if (reason === null) return;
        if (!reason.trim()) {
            setError('Informe um motivo para rejeitar a campanha.');
            return;
        }
        performAction(campaign, 'reject', { reason: reason.trim() });
    };

    const createDefaultAdSpaces = async () => {
        const defaults = [
            { name: 'Descobrir · Destaque superior', slug: 'descobrir-feed-topo', location: 'business_feed_top' },
            { name: 'Descobrir · Entre publicações', slug: 'descobrir-feed-meio', location: 'business_feed_middle' },
            { name: 'Descobrir · Final do feed', slug: 'descobrir-feed-rodape', location: 'business_feed_bottom' },
            { name: 'Descobrir · Espaço global', slug: 'descobrir-feed-global', location: 'global_feed' }
        ];
        const existingSlugs = new Set(adSpaces.map(space => space.slug));
        const missing = defaults.filter(space => !existingSlugs.has(space.slug));
        if (!missing.length) {
            setError('Os espaços padrão já estão cadastrados. Ative os que deseja disponibilizar.');
            return;
        }

        setSpaceWorking(true);
        setError('');
        try {
            for (const space of missing) {
                const response = await fetch(API_URL + '/api/business/admin/ad-spaces', {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + token(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...space,
                        description: 'Espaço de anúncios patrocinados do feed Descobrir.',
                        width: 1080,
                        height: 600,
                        max_ads: 2,
                        frequency_cap: 3
                    })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Não foi possível criar os espaços publicitários.');
            }
            await loadData();
        } catch (spaceError) {
            setError(spaceError.message || 'Erro ao configurar os espaços publicitários.');
        } finally {
            setSpaceWorking(false);
        }
    };

    const toggleAdSpace = async (space) => {
        setSpaceWorking(true);
        setError('');
        try {
            const response = await fetch(API_URL + '/api/business/admin/ad-spaces/' + space.id, {
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer ' + token(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: !space.is_active })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Não foi possível alterar o espaço.');
            await loadData();
        } catch (spaceError) {
            setError(spaceError.message || 'Erro ao atualizar o espaço publicitário.');
        } finally {
            setSpaceWorking(false);
        }
    };

    const feedSpaces = adSpaces.filter(space => [
        'global_feed',
        'business_feed_top',
        'business_feed_middle',
        'business_feed_bottom'
    ].includes(space.location));

    return (
        <div className="admin-campaigns-page">
            <header className="admin-campaigns-header">
                <div>
                    <div className="admin-campaigns-eyebrow"><Megaphone size={16} /> CENTRAL DE PUBLICIDADE</div>
                    <h1>Campanhas e anúncios</h1>
                    <p>Revise os anúncios enviados pelas empresas antes de exibi-los no feed Descobrir.</p>
                </div>
                <button type="button" className="admin-campaigns-refresh" onClick={loadData} disabled={loading}>
                    <RefreshCw size={16} /> Atualizar
                </button>
            </header>

            {stats && (
                <section className="admin-campaigns-stats" aria-label="Resumo das campanhas">
                    <div><strong>{stats.pending || 0}</strong><span>Pendentes</span></div>
                    <div><strong>{stats.approved || 0}</strong><span>Aprovadas</span></div>
                    <div><strong>{stats.active || 0}</strong><span>Ativas</span></div>
                    <div><strong>{stats.rejected || 0}</strong><span>Rejeitadas</span></div>
                </section>
            )}

            <section className="admin-ad-spaces">
                <div className="admin-ad-spaces-heading">
                    <div>
                        <h2>Espaços do feed Descobrir</h2>
                        <p>Configure onde os anúncios aprovados poderão aparecer. Apenas espaços ativos ficam disponíveis para as empresas.</p>
                    </div>
                    <button type="button" onClick={createDefaultAdSpaces} disabled={spaceWorking}>
                        <Plus size={16} /> {spaceWorking ? 'Configurando…' : 'Configurar espaços padrão'}
                    </button>
                </div>
                {feedSpaces.length ? (
                    <div className="admin-ad-spaces-list">
                        {feedSpaces.map(space => (
                            <div className="admin-ad-space-row" key={space.id}>
                                <div>
                                    <strong>{space.name}</strong>
                                    <span>{space.location} · até {space.max_ads || 1} anúncios</span>
                                </div>
                                <span className={'admin-ad-space-status ' + (space.is_active ? 'active' : 'inactive')}>
                                    {space.is_active ? 'Ativo' : 'Desativado'}
                                </span>
                                <button type="button" onClick={() => toggleAdSpace(space)} disabled={spaceWorking}>
                                    {space.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="admin-ad-spaces-empty">
                        <Megaphone size={22} />
                        <span>Nenhum espaço de publicidade foi configurado. Crie os espaços padrão para liberar anúncios no feed.</span>
                    </div>
                )}
            </section>

            <section className="admin-campaigns-toolbar">
                <label className="admin-campaigns-search">
                    <Search size={17} />
                    <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar campanha ou empresa" />
                </label>
                <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar campanhas por status">
                    <option value="pending_approval">Aguardando análise</option>
                    <option value="">Todos os status</option>
                    <option value="approved">Aprovadas</option>
                    <option value="active">Em veiculação</option>
                    <option value="paused">Pausadas</option>
                    <option value="rejected">Rejeitadas</option>
                    <option value="completed">Finalizadas</option>
                    <option value="draft">Rascunhos</option>
                </select>
            </section>

            {error && <div className="admin-campaigns-error" role="alert">{error}</div>}
            {loading ? (
                <div className="admin-campaigns-state">Carregando campanhas…</div>
            ) : campaigns.length === 0 ? (
                <div className="admin-campaigns-state">
                    <Megaphone size={34} />
                    <strong>Nenhuma campanha encontrada</strong>
                    <span>As campanhas enviadas pelas empresas aparecerão aqui para revisão.</span>
                </div>
            ) : (
                <div className="admin-campaigns-list">
                    {campaigns.map(campaign => {
                        const creatives = Array.isArray(campaign.creatives) ? campaign.creatives : [];
                        const pending = campaign.status === 'pending_approval';
                        const busy = workingId === campaign.id;
                        return (
                            <article className="admin-campaign-card" key={campaign.id}>
                                <div className="admin-campaign-card-header">
                                    <div>
                                        <span className={'admin-campaign-status status-' + campaign.status}>
                                            {STATUS_LABELS[campaign.status] || campaign.status}
                                        </span>
                                        <h2>{campaign.name}</h2>
                                        <p>{campaign.company_name || 'Empresa'} · {campaign.objective || 'Campanha'}</p>
                                    </div>
                                    <div className="admin-campaign-budget">
                                        <strong>{formatMoney(campaign.budget)}</strong>
                                        <span>Orçamento informado</span>
                                    </div>
                                </div>

                                <div className="admin-campaign-details">
                                    <span>Período: {formatDate(campaign.start_date)} até {formatDate(campaign.end_date)}</span>
                                    <span>Investido: {formatMoney(campaign.spent)}</span>
                                    <span>Impressões: {Number(campaign.impressions_count || 0).toLocaleString('pt-BR')}</span>
                                    <span>Cliques: {Number(campaign.clicks_count || 0).toLocaleString('pt-BR')}</span>
                                </div>

                                <div className="admin-campaign-creatives">
                                    {creatives.length ? creatives.map(creative => {
                                        const destination = safeDestination(creative.destination_url);
                                        return (
                                            <div className="admin-campaign-creative" key={creative.id}>
                                                {creative.image_url && <img src={creative.image_url} alt={creative.title || 'Criativo do anúncio'} loading="lazy" />}
                                                <div className="admin-campaign-creative-info">
                                                    <strong>{creative.title || 'Peça publicitária'}</strong>
                                                    <span>{creative.ad_space_name || creative.ad_space_location || 'Espaço publicitário'}</span>
                                                    {destination ? (
                                                        <a href={destination} target={destination.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">
                                                            Conferir destino <ExternalLink size={13} />
                                                        </a>
                                                    ) : <em>Destino inválido ou ausente</em>}
                                                </div>
                                                <span className={'admin-creative-status ' + (creative.status === 'approved' ? 'approved' : 'pending')}>
                                                    {creative.status === 'approved' ? 'Criativo aprovado' : 'Criativo pendente'}
                                                </span>
                                            </div>
                                        );
                                    }) : <p className="admin-campaign-no-creatives">Esta campanha ainda não possui criativos.</p>}
                                </div>

                                <div className="admin-campaign-actions">
                                    {pending && (
                                        <>
                                            <button type="button" className="approve" disabled={busy || creatives.length === 0} onClick={() => performAction(campaign, 'approve')}>
                                                <Check size={16} /> {busy ? 'Processando…' : 'Aprovar campanha'}
                                            </button>
                                            <button type="button" className="reject" disabled={busy} onClick={() => handleReject(campaign)}>
                                                <XCircle size={16} /> Rejeitar
                                            </button>
                                        </>
                                    )}
                                    {(campaign.status === 'approved' || campaign.status === 'active') && (
                                        <button type="button" className="pause" disabled={busy} onClick={() => performAction(campaign, 'pause', { pause: true })}>
                                            <Pause size={16} /> Pausar veiculação
                                        </button>
                                    )}
                                    {campaign.status === 'paused' && (
                                        <button type="button" className="approve" disabled={busy} onClick={() => performAction(campaign, 'pause', { pause: false })}>
                                            <Play size={16} /> Retomar veiculação
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
