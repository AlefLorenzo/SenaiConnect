import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ImagePlus, Megaphone, Upload } from 'lucide-react';
import { getSafeDestination } from '../utils/safeUrl';
import './BusinessCampaignForm.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const FEED_LOCATIONS = ['global_feed', 'business_feed_top', 'business_feed_middle', 'business_feed_bottom'];

function localDateTime(value) {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

function toIso(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function BusinessCampaignForm() {
    const navigate = useNavigate();
    const [adSpaces, setAdSpaces] = useState([]);
    const [loadingSpaces, setLoadingSpaces] = useState(true);
    const [saving, setSaving] = useState(false);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [error, setError] = useState('');
    const [form, setForm] = useState(() => {
        const now = new Date(Date.now() + 5 * 60 * 1000);
        const end = new Date(now);
        end.setDate(end.getDate() + 14);
        return {
            name: '',
            objective: 'traffic',
            budget: '100',
            start_date: localDateTime(now),
            end_date: localDateTime(end),
            ad_space_id: '',
            creative_title: '',
            description: '',
            destination_url: '',
            image_url: ''
        };
    });

    const token = () => sessionStorage.getItem('token');
    const destination = useMemo(() => getSafeDestination(form.destination_url), [form.destination_url]);

    useEffect(() => {
        let active = true;
        const loadAdSpaces = async () => {
            try {
                const response = await fetch(API_URL + '/api/business/ad-spaces', {
                    headers: { Authorization: 'Bearer ' + token() }
                });
                if (!response.ok) throw new Error('Não foi possível carregar os espaços publicitários.');
                const data = await response.json();
                const available = (Array.isArray(data) ? data : []).filter(space =>
                    FEED_LOCATIONS.includes(space.location)
                );
                if (active) {
                    setAdSpaces(available);
                    if (available.length) {
                        setForm(previous => ({ ...previous, ad_space_id: String(available[0].id) }));
                    }
                }
            } catch (loadError) {
                if (active) setError(loadError.message);
            } finally {
                if (active) setLoadingSpaces(false);
            }
        };
        loadAdSpaces();
        return () => { active = false; };
    }, []);

    const handleImage = event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Selecione um arquivo de imagem.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('A imagem deve ter no máximo 5 MB.');
            return;
        }
        setError('');
        setImage(file);
        const reader = new FileReader();
        reader.onload = () => setImagePreview(String(reader.result || ''));
        reader.onerror = () => setError('Não foi possível ler a imagem selecionada.');
        reader.readAsDataURL(file);
    };

    const uploadImage = async () => {
        if (!image) return null;
        const response = await fetch(API_URL + '/api/upload', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: imagePreview,
                name: image.name,
                folder: 'business-campaigns'
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || 'Não foi possível enviar a imagem.');
        return data.url;
    };

    const update = (field, value) => setForm(previous => ({ ...previous, [field]: value }));

    const handleSubmit = async event => {
        event.preventDefault();
        setError('');
        if (!form.name.trim() || !form.creative_title.trim()) {
            setError('Informe o nome da campanha e o título do anúncio.');
            return;
        }
        if (!form.ad_space_id || !adSpaces.length) {
            setError('Não há espaço publicitário habilitado para o feed. Peça ao administrador para configurar um espaço.');
            return;
        }
        if (!destination) {
            setError('Informe um destino válido: site com HTTPS/HTTP ou caminho interno iniciado por /.');
            return;
        }
        if (!image && !form.image_url.trim()) {
            setError('Adicione a imagem do anúncio.');
            return;
        }
        const startDate = toIso(form.start_date);
        const endDate = toIso(form.end_date);
        if (!startDate || !endDate || new Date(startDate) >= new Date(endDate)) {
            setError('O período da campanha é inválido. A data final precisa ser posterior à inicial.');
            return;
        }
        const budget = Number(form.budget);
        if (!Number.isFinite(budget) || budget <= 0) {
            setError('Informe um orçamento maior que zero.');
            return;
        }

        setSaving(true);
        try {
            const imageUrl = image ? await uploadImage() : form.image_url.trim();
            const payload = {
                name: form.name.trim(),
                objective: form.objective,
                budget,
                billing_model: 'FIXED',
                fixed_price: budget,
                start_date: startDate,
                end_date: endDate,
                target_audience: { type: 'all' },
                creatives: [{
                    ad_space_id: Number(form.ad_space_id),
                    title: form.creative_title.trim(),
                    description: form.description.trim(),
                    image_url: imageUrl,
                    destination_url: destination,
                    width: null,
                    height: null
                }]
            };

            const createResponse = await fetch(API_URL + '/api/business/my-campaigns', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const created = await createResponse.json().catch(() => ({}));
            if (!createResponse.ok || !created.id) {
                throw new Error(created.error || 'Não foi possível salvar a campanha.');
            }

            const submitResponse = await fetch(API_URL + '/api/business/my-campaigns/' + created.id + '/submit', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (!submitResponse.ok) {
                const submitError = await submitResponse.json().catch(() => ({}));
                window.alert(submitError.error || 'A campanha foi salva como rascunho. Envie-a para análise pela lista de campanhas.');
            } else {
                window.alert('Campanha enviada para análise. Ela só aparecerá no feed após aprovação.');
            }
            navigate('/business/campaigns');
        } catch (submitError) {
            setError(submitError.message || 'Não foi possível criar a campanha.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="business-campaign-form-page">
            <Link to="/business/campaigns" className="business-campaign-back"><ArrowLeft size={17} /> Voltar às campanhas</Link>
            <header className="business-campaign-form-header">
                <span><Megaphone size={17} /> PUBLICIDADE NO DESCOBRIR</span>
                <h1>Criar campanha</h1>
                <p>Configure sua divulgação e escolha para onde as pessoas serão encaminhadas ao tocar no anúncio.</p>
            </header>

            {error && <div className="business-campaign-form-error" role="alert">{error}</div>}
            <form onSubmit={handleSubmit} className="business-campaign-form">
                <section className="business-campaign-form-section">
                    <h2>Informações da campanha</h2>
                    <label>Nome interno da campanha
                        <input value={form.name} onChange={event => update('name', event.target.value)} maxLength={255} required placeholder="Ex.: Divulgação de matrícula de novembro" />
                    </label>
                    <div className="business-campaign-form-grid">
                        <label>Objetivo
                            <select value={form.objective} onChange={event => update('objective', event.target.value)}>
                                <option value="traffic">Levar pessoas ao site</option>
                                <option value="brand_awareness">Reconhecimento da marca</option>
                                <option value="conversions">Conversões</option>
                                <option value="leads">Gerar contatos</option>
                                <option value="engagement">Engajamento</option>
                            </select>
                        </label>
                        <label>Orçamento (R$)
                            <input type="number" min="1" step="0.01" value={form.budget} onChange={event => update('budget', event.target.value)} required />
                        </label>
                    </div>
                    <div className="business-campaign-form-grid">
                        <label>Início da veiculação
                            <input type="datetime-local" value={form.start_date} onChange={event => update('start_date', event.target.value)} required />
                        </label>
                        <label>Fim da veiculação
                            <input type="datetime-local" value={form.end_date} onChange={event => update('end_date', event.target.value)} required />
                        </label>
                    </div>
                </section>

                <section className="business-campaign-form-section">
                    <h2>Peça publicitária</h2>
                    <label>Título exibido no feed
                        <input value={form.creative_title} onChange={event => update('creative_title', event.target.value)} maxLength={255} required placeholder="Ex.: Conheça nossa nova coleção" />
                    </label>
                    <label>Descrição
                        <textarea rows="4" value={form.description} onChange={event => update('description', event.target.value)} placeholder="Conte o que está sendo divulgado…" />
                    </label>
                    <label>Imagem do anúncio
                        <span className="business-campaign-file-control">
                            <ImagePlus size={18} />
                            <span>{image ? image.name : 'Selecionar imagem (máximo 5 MB)'}</span>
                            <Upload size={16} />
                            <input type="file" accept="image/*" onChange={handleImage} />
                        </span>
                    </label>
                    {imagePreview && <img className="business-campaign-image-preview" src={imagePreview} alt="Prévia do anúncio" />}
                    {!imagePreview && form.image_url && <img className="business-campaign-image-preview" src={form.image_url} alt="Prévia do anúncio" />}
                    <label>URL da imagem (opcional, alternativa ao envio de arquivo)
                        <input type="url" value={form.image_url} onChange={event => update('image_url', event.target.value)} placeholder="https://…" />
                    </label>
                </section>

                <section className="business-campaign-form-section">
                    <h2>Destino do anúncio</h2>
                    <p className="business-campaign-hint">Ao tocar em “Saiba mais”, a pessoa será encaminhada diretamente para o endereço abaixo.</p>
                    <label>Link de destino
                        <input type="text" value={form.destination_url} onChange={event => update('destination_url', event.target.value)} required placeholder="https://suaempresa.com.br/produto ou /events" />
                    </label>
                    {destination && (
                        <a className="business-campaign-destination-preview" href={destination} target={destination.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">
                            <ExternalLink size={15} /> Testar destino
                        </a>
                    )}
                    <label>Espaço publicitário
                        <select value={form.ad_space_id} onChange={event => update('ad_space_id', event.target.value)} disabled={loadingSpaces || adSpaces.length === 0}>
                            {adSpaces.map(space => <option key={space.id} value={space.id}>{space.name} · {space.location}</option>)}
                        </select>
                    </label>
                    {loadingSpaces && <small>Carregando espaços disponíveis…</small>}
                    {!loadingSpaces && !adSpaces.length && <small>Não há espaços do feed ativos. O administrador precisa habilitar um espaço de publicidade antes da criação.</small>}
                </section>

                <div className="business-campaign-form-actions">
                    <Link to="/business/campaigns">Cancelar</Link>
                    <button type="submit" disabled={saving || loadingSpaces || !adSpaces.length}>
                        {saving ? 'Enviando…' : 'Enviar campanha para análise'}
                    </button>
                </div>
            </form>
        </div>
    );
}
