import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import './AdminContentForm.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMPTY_FORM = {
  title: '',
  description: '',
  unit: '',
  area: '',
  duration: '',
  modality: 'Presencial',
  period: '',
  skills: '',
  vacancies: 0,
  enrollment_info: '',
  status: 'ativo',
  image_url: '',
};

const AdminCourseForm = () => {
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
        const response = await fetch(`${API_URL}/api/admin/courses/${id}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o curso.');
        if (active) {
          setForm({ ...EMPTY_FORM, ...data, vacancies: Number(data.vacancies) || 0 });
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
    setForm(previous => ({ ...previous, [name]: name === 'vacancies' ? value : value }));
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
    if (!imageFile || !imagePreview.startsWith('data:')) return form.image_url;
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: imagePreview, name: imageFile.name, folder: 'courses' })
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
      const payload = { ...form, image_url: imageUrl, vacancies: Math.max(0, Number(form.vacancies) || 0) };
      const response = await fetch(
        isEditing ? `${API_URL}/api/admin/courses/${id}` : `${API_URL}/api/admin/courses`,
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
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o curso.');
      navigate('/admin/courses');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-content-form-loading">Carregando curso…</div>;

  return (
    <div className="admin-content-form-page">
      <div className="admin-content-form-heading">
        <Link to="/admin/courses" className="admin-content-back"><ArrowLeft size={18} /> Voltar aos cursos</Link>
        <h1>{isEditing ? 'Editar curso' : 'Novo curso'}</h1>
        <p>Defina os dados, a unidade de destino e se o curso deve aparecer para os usuários.</p>
      </div>

      {error && <div className="admin-content-form-error" role="alert">{error}</div>}

      <form className="admin-content-form" onSubmit={handleSubmit}>
        <div className="admin-content-form-grid">
          <label className="admin-content-field admin-content-field-full">
            <span>Nome do curso *</span>
            <input name="title" value={form.title} onChange={handleChange} required maxLength={255} />
          </label>

          <label className="admin-content-field admin-content-field-full">
            <span>Descrição</span>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
          </label>

          <label className="admin-content-field">
            <span>Área</span>
            <input name="area" value={form.area} onChange={handleChange} placeholder="Ex.: Tecnologia" />
          </label>

          <label className="admin-content-field">
            <span>Unidade de destino</span>
            <select name="unit" value={form.unit} onChange={handleChange}>
              <option value="">Todas as unidades</option>
              {Array.from(new Set([...(form.unit ? [form.unit] : []), ...unitOptions])).map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            <small>Ao informar uma unidade, o curso aparece apenas para usuários vinculados a ela.</small>
          </label>

          <label className="admin-content-field">
            <span>Duração</span>
            <input name="duration" value={form.duration} onChange={handleChange} placeholder="Ex.: 120 horas" />
          </label>

          <label className="admin-content-field">
            <span>Modalidade</span>
            <select name="modality" value={form.modality} onChange={handleChange}>
              <option>Presencial</option>
              <option>Semipresencial</option>
              <option>EAD</option>
              <option>Híbrido</option>
            </select>
          </label>

          <label className="admin-content-field">
            <span>Período</span>
            <input name="period" value={form.period} onChange={handleChange} placeholder="Ex.: Noite" />
          </label>

          <label className="admin-content-field">
            <span>Vagas</span>
            <input name="vacancies" type="number" min="0" value={form.vacancies} onChange={handleChange} />
          </label>

          <label className="admin-content-field admin-content-field-full">
            <span>Competências / conteúdos</span>
            <textarea name="skills" value={form.skills} onChange={handleChange} rows={2} placeholder="Separe os itens por vírgula" />
          </label>

          <label className="admin-content-field admin-content-field-full">
            <span>Informações de matrícula</span>
            <textarea name="enrollment_info" value={form.enrollment_info} onChange={handleChange} rows={3} />
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
          <Link to="/admin/courses" className="admin-content-cancel">Cancelar</Link>
          <button type="submit" disabled={saving}>
            <Save size={17} /> {saving ? 'Salvando…' : 'Salvar curso'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminCourseForm;
