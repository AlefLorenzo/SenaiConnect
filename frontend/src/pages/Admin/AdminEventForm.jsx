import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import './AdminContentForm.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMPTY_FORM = {
  title: '',
  description: '',
  event_date: '',
  event_time: '',
  location: '',
  unit: '',
  category: '',
  vacancies: 0,
  image_url: '',
  status: 'ativo',
};

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const AdminEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/admin/notices/recipient-options`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as unidades.');
        if (active) setUnitOptions(Array.isArray(data.units) ? data.units : []);
      })
      .catch(err => {
        if (active) setError(err.message);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isEditing) return undefined;
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin/events/${id}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o evento.');
        if (active) {
          setForm({
            ...EMPTY_FORM,
            ...data,
            event_date: toLocalDateTime(data.event_date),
            vacancies: Number(data.vacancies) || 0,
          });
          setImagePreview(data.image_url || '');
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [id, isEditing]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB.');
      event.target.value = '';
      return;
    }
    setImageFile(file);
    setForm(previous => ({ ...previous, image_url: '' }));
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ''));
    reader.onerror = () => setError('Não foi possível ler a imagem selecionada.');
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setForm(previous => ({ ...previous, image_url: '' }));
  };

  const uploadImage = async () => {
    if (!imageFile) return form.image_url;
    if (!imagePreview.startsWith('data:')) throw new Error('A imagem ainda está sendo processada. Tente novamente.');
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: imagePreview, name: imageFile.name, folder: 'events' })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a imagem.');
    return data.url;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const imageUrl = await uploadImage();
      const payload = { ...form, event_date: new Date(form.event_date).toISOString(), image_url: imageUrl, vacancies: Math.max(0, Number(form.vacancies) || 0) };
      const response = await fetch(
        isEditing ? `${API_URL}/api/admin/events/${id}` : `${API_URL}/api/admin/events`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o evento.');
      navigate('/admin/events');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-content-form-loading">Carregando evento…</div>;

  return (
    <div className="admin-content-form-page">
      <div className="admin-content-form-heading">
        <Link to="/admin/events" className="admin-content-back"><ArrowLeft size={18} /> Voltar aos eventos</Link>
        <h1>{isEditing ? 'Editar evento' : 'Novo evento'}</h1>
        <p>Defina as informações, a unidade de destino e a visibilidade do evento.</p>
      </div>

      {error && <div className="admin-content-form-error" role="alert">{error}</div>}

      <form className="admin-content-form" onSubmit={handleSubmit}>
        <div className="admin-content-form-grid">
          <label className="admin-content-field admin-content-field-full">
            <span>Nome do evento *</span>
            <input name="title" value={form.title} onChange={handleChange} required maxLength={255} />
          </label>

          <label className="admin-content-field admin-content-field-full">
            <span>Descrição</span>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
          </label>

          <label className="admin-content-field">
            <span>Data e hora *</span>
            <input name="event_date" type="datetime-local" value={form.event_date} onChange={handleChange} required />
          </label>

          <label className="admin-content-field">
            <span>Horário exibido (opcional)</span>
            <input name="event_time" value={form.event_time} onChange={handleChange} placeholder="Ex.: 08:00" />
          </label>

          <label className="admin-content-field">
            <span>Local</span>
            <input name="location" value={form.location} onChange={handleChange} />
          </label>

          <label className="admin-content-field">
            <span>Unidade de destino</span>
            <select name="unit" value={form.unit} onChange={handleChange}>
              <option value="">Todas as unidades</option>
              {Array.from(new Set([...(form.unit ? [form.unit] : []), ...unitOptions])).map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            <small>Ao informar uma unidade, o evento aparece apenas para usuários vinculados a ela.</small>
          </label>

          <label className="admin-content-field">
            <span>Categoria</span>
            <input name="category" value={form.category} onChange={handleChange} placeholder="Ex.: Workshop" />
          </label>

          <label className="admin-content-field">
            <span>Vagas</span>
            <input name="vacancies" type="number" min="0" value={form.vacancies} onChange={handleChange} />
          </label>

          <div className="admin-content-field admin-content-field-full">
            <span>Imagem de capa</span>
            {imagePreview && (
              <div className="admin-content-image-preview">
                <img src={imagePreview} alt="Prévia da capa" />
                <button type="button" onClick={handleRemoveImage}>Remover imagem</button>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageSelect} />
            <small>PNG, JPG, WebP ou GIF • máximo de 5MB. Também pode informar uma URL abaixo.</small>
            <input name="image_url" type="url" value={form.image_url} onChange={(event) => { handleChange(event); setImageFile(null); setImagePreview(event.target.value); }} placeholder="https://…" />
          </div>

          <label className="admin-content-field">
            <span>Visibilidade</span>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="ativo">Publicado — mostrar aos usuários</option>
              <option value="rascunho">Rascunho — somente no painel</option>
              <option value="arquivado">Arquivado — oculto dos usuários</option>
            </select>
          </label>
        </div>

        <div className="admin-content-form-actions">
          <Link to="/admin/events" className="admin-content-cancel">Cancelar</Link>
          <button type="submit" disabled={saving}>
            <Save size={17} /> {saving ? 'Salvando…' : 'Salvar evento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminEventForm;
