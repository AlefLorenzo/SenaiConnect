import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Image, FileText, Shield, Users, GraduationCap, MapPin } from 'lucide-react';
import './AdminNoticeForm.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const PRIORITY_OPTIONS = [
    { value: 'urgent', label: 'Urgente', desc: 'Notificação imediata para todos destinatários', icon: Shield, color: '#DC2626', bg: '#FEF2F2' },
    { value: 'important', label: 'Importante', desc: 'Destaque no mural, notificação padrão', icon: Shield, color: '#FF6B00', bg: '#FFF3E8' },
    { value: 'normal', label: 'Normal', desc: 'Exibição padrão no mural', icon: Shield, color: '#64748B', bg: '#F1F5F9' }
];

const RECIPIENT_GROUPS = [
    { id: 'all', label: 'Todos os alunos', icon: Users, desc: 'Todos os alunos cadastrados' },
    { id: 'courses', label: 'Por Curso', icon: GraduationCap, desc: 'Selecionar cursos específicos' },
    { id: 'units', label: 'Por Unidade', icon: MapPin, desc: 'Selecionar unidades específicas' },
    { id: 'teachers', label: 'Professores', icon: Shield, desc: 'Todos os professores' },
    { id: 'admins', label: 'Administradores', icon: Shield, desc: 'Todos os administradores' }
];

const AdminNoticeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    // Initialize default dates
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultPublished = now.toISOString().slice(0, 16);
    const expire = new Date(now);
    expire.setDate(expire.getDate() + 30);
    const defaultExpires = expire.toISOString().slice(0, 16);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        status: 'published',
        priority: 'important',
        recipients: { type: 'all' },
        published_at: defaultPublished,
        expires_at: defaultExpires,
        is_pinned: false,
        send_notification: true,
        image_url: '',
        attachment_url: '',
        attachment_name: ''
    });

    const [selectedGroups, setSelectedGroups] = useState(['all']);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [recipientOptions, setRecipientOptions] = useState({ courses: [], units: [] });
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [files, setFiles] = useState({ image: null, attachment: null });
    const [previews, setPreviews] = useState({ image: null, attachment: null });
    const [courseSearch, setCourseSearch] = useState('');
    const [unitSearch, setUnitSearch] = useState('');
    const mountedRef = useRef(true);

    useEffect(() => {
        let active = true;
        const loadRecipientOptions = async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/notices/recipient-options`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                if (!res.ok) throw new Error('Não foi possível carregar cursos e unidades.');
                const data = await res.json();
                if (active) setRecipientOptions({
                    courses: Array.isArray(data.courses) ? data.courses : [],
                    units: Array.isArray(data.units) ? data.units : []
                });
            } catch (error) {
                console.error('Erro ao carregar destinatários:', error);
            }
        };
        loadRecipientOptions();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!isEditing) return;

        mountedRef.current = true;
        const loadNotice = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/admin/notices/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok && mountedRef.current) {
                    const notice = await res.json();
                    setFormData(prev => ({
                        ...prev,
                        title: notice.title,
                        content: notice.content,
                        priority: notice.priority,
                        recipients: notice.recipients,
                        published_at: notice.published_at ? new Date(notice.published_at).toISOString().slice(0, 16) : '',
                        expires_at: notice.expires_at ? new Date(notice.expires_at).toISOString().slice(0, 16) : '',
                        is_pinned: notice.is_pinned,
                        send_notification: notice.send_notification,
                        image_url: notice.image_url || '',
                        attachment_url: notice.attachment_url || '',
                        attachment_name: notice.attachment_name || ''
                    }));
                    let savedRecipients = notice.recipients;
                    if (typeof savedRecipients === 'string') {
                        try { savedRecipients = JSON.parse(savedRecipients); }
                        catch { savedRecipients = { type: savedRecipients || 'all' }; }
                    }
                    savedRecipients = savedRecipients && typeof savedRecipients === 'object'
                        ? savedRecipients
                        : { type: 'all' };
                    if (savedRecipients.type === 'courses') {
                        setSelectedCourses(savedRecipients.values || savedRecipients.courses || []);
                    } else if (savedRecipients.type === 'units') {
                        setSelectedUnits(savedRecipients.values || savedRecipients.units || []);
                    }
                    setSelectedGroups([savedRecipients.type || 'all']);
                }
            } catch (error) {
                console.error('Erro ao buscar aviso:', error);
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        };
        loadNotice();
        return () => { mountedRef.current = false; };
    }, [isEditing, id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleRecipientChange = (groupId) => {
        setSelectedGroups([groupId]);
    };

    const buildRecipients = () => {
        const group = selectedGroups[0] || 'all';
        if (group === 'courses') {
            if (selectedCourses.length === 0) throw new Error('Selecione pelo menos um curso.');
            return { type: 'courses', values: selectedCourses };
        }
        if (group === 'units') {
            if (selectedUnits.length === 0) throw new Error('Selecione pelo menos uma unidade.');
            return { type: 'units', values: selectedUnits };
        }
        return { type: group };
    };

    const handleFileSelect = (field) => (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Arquivo deve ter no máximo 5MB');
            return;
        }
        setFiles(prev => ({ ...prev, [field]: file }));
        setFormData(prev => ({ ...prev, [`${field}_url`]: '', [`${field}_name`]: '' }));
        const reader = new FileReader();
        reader.onload = (ev) => setPreviews(prev => ({ ...prev, [field]: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const handleUpload = async (field) => {
        const file = files[field];
        const dataUri = previews[field];
        if (!file) return null;
        if (!dataUri) throw new Error('O arquivo ainda está sendo processado. Tente novamente.');

        const token = sessionStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ file: dataUri, name: file.name, folder: 'notices' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao enviar anexo.');
        return { url: data.url, name: file.name };
    };

    const removeFile = (field) => {
        setFiles(prev => ({ ...prev, [field]: null }));
        setPreviews(prev => ({ ...prev, [field]: null }));
        setFormData(prev => ({ ...prev, [`${field}_url`]: '', [`${field}_name`]: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = sessionStorage.getItem('token');
            const recipients = buildRecipients();
            const publicationStatus = e.nativeEvent?.submitter?.value === 'draft' ? 'draft' : 'published';
            const nextFormData = { ...formData, status: publicationStatus };

            if (files.image && !nextFormData.image_url) {
                const uploaded = await handleUpload('image');
                if (uploaded) nextFormData.image_url = uploaded.url;
            }
            if (files.attachment && !nextFormData.attachment_url) {
                const uploaded = await handleUpload('attachment');
                if (uploaded) {
                    nextFormData.attachment_url = uploaded.url;
                    nextFormData.attachment_name = uploaded.name;
                }
            }

            const payload = {
                ...nextFormData,
                recipients: JSON.stringify(recipients),
                is_pinned: formData.is_pinned ? 1 : 0,
                send_notification: formData.send_notification ? 1 : 0
            };

            const url = isEditing ? `${API_URL}/api/admin/notices/${id}` : `${API_URL}/api/admin/notices`;
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                navigate('/admin/notices');
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao salvar aviso');
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert(error.message || 'Erro ao salvar aviso');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="form-loading">Carregando...</div>;

    const filteredCourses = recipientOptions.courses.filter(course => course.toLowerCase().includes(courseSearch.toLowerCase()));
    const filteredUnits = recipientOptions.units.filter(unit => unit.toLowerCase().includes(unitSearch.toLowerCase()));

    return (
        <div className="admin-notice-form-page">
            <div className="page-header">
                <Link to="/admin/notices" className="back-link">
                    <ArrowLeft size={20} /> Voltar
                </Link>
                <div className="header-content">
                    <h1>{isEditing ? 'Editar Aviso' : 'Criar Novo Aviso'}</h1>
                    <p>{isEditing ? 'Atualize as informações do comunicado' : 'Preencha os campos abaixo para publicar um comunicado'}</p>
                </div>
                <div className="header-actions">
                    <Link to="/admin/notices" className="btn-secondary">Cancelar</Link>
                    <button type="submit" form="noticeForm" name="publication_status" value="draft" className="btn-secondary" disabled={saving}>Salvar Rascunho</button>
                    <button type="submit" form="noticeForm" name="publication_status" value="published" className="btn-primary" disabled={saving}>
                        <Save size={18} /> {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Publicar')}
                    </button>
                </div>
            </div>

            <form id="noticeForm" onSubmit={handleSubmit} className="notice-form">
                {/* Informações Básicas */}
                <section className="form-section">
                    <h2>Informações Básicas</h2>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label htmlFor="title">Título do Aviso <span className="required">*</span></label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Ex: Início do Semestre 2026.2"
                                required
                                maxLength={150}
                            />
                            <span className="help-text">Máximo 150 caracteres. Seja claro e direto.</span>
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="content">Conteúdo / Descrição <span className="required">*</span></label>
                            <textarea
                                id="content"
                                name="content"
                                value={formData.content}
                                onChange={handleChange}
                                placeholder="Descreva o conteúdo do aviso detalhadamente..."
                                required
                                rows={8}
                            />
                            <span className="help-text">Suporte a formatação básica. O conteúdo será exibido no mural dos alunos.</span>
                        </div>
                    </div>
                </section>

                {/* Prioridade */}
                <section className="form-section">
                    <h2>Prioridade</h2>
                    <div className="priority-options">
                        {PRIORITY_OPTIONS.map(opt => (
                            <label key={opt.value} className={`priority-option ${formData.priority === opt.value ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="priority"
                                    value={opt.value}
                                    checked={formData.priority === opt.value}
                                    onChange={handleChange}
                                />
                                <div className="priority-card" style={{ borderColor: formData.priority === opt.value ? opt.color : '#E2E8F0', background: formData.priority === opt.value ? opt.bg : 'white' }}>
                                    <div className="priority-icon" style={{ background: opt.bg, color: opt.color }}>
                                        <opt.icon size={20} />
                                    </div>
                                    <span className="priority-label">{opt.label}</span>
                                    <small className="priority-desc">{opt.desc}</small>
                                </div>
                            </label>
                        ))}
                    </div>
                </section>

                {/* Destinatários */}
                <section className="form-section">
                    <h2>Destinatários</h2>
                    <div className="recipient-selector">
                        {RECIPIENT_GROUPS.map(group => (
                            <label key={group.id} className={`recipient-option ${selectedGroups.includes(group.id) ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="notice-recipient"
                                    checked={selectedGroups.includes(group.id)}
                                    onChange={() => handleRecipientChange(group.id)}
                                />
                                <div className="recipient-card">
                                    <div className="recipient-icon"><group.icon size={20} /></div>
                                    <div>
                                        <span className="recipient-label">{group.label}</span>
                                        <small>{group.desc}</small>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Course selection */}
                    {(selectedGroups.includes('courses') || selectedGroups.length === 0) && (
                        <div className="recipient-detail">
                            <label>Cursos</label>
                            <div className="course-search">
                                <input
                                    type="text"
                                    placeholder="Buscar curso..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                />
                            </div>
                            <div className="course-chips">
                                {filteredCourses.map(course => (
                                    <span
                                        key={course}
                                        className={`course-chip ${selectedCourses.includes(course) ? 'selected' : ''}`}
                                        onClick={() => setSelectedCourses(prev =>
                                            prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
                                        )}
                                    >
                                        {course}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unit selection */}
                    {selectedGroups.includes('units') && (
                        <div className="recipient-detail">
                            <label>Unidades</label>
                            <div className="unit-search">
                                <input
                                    type="text"
                                    placeholder="Buscar unidade..."
                                    value={unitSearch}
                                    onChange={(e) => setUnitSearch(e.target.value)}
                                />
                            </div>
                            <div className="unit-chips">
                                {filteredUnits.map(unit => (
                                    <span
                                        key={unit}
                                        className={`unit-chip ${selectedUnits.includes(unit) ? 'selected' : ''}`}
                                        onClick={() => setSelectedUnits(prev =>
                                            prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
                                        )}
                                    >
                                        {unit}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <span className="help-text">Escolha um público. O aviso ficará visível apenas para os usuários que correspondem à seleção.</span>
                </section>

                {/* Agendamento */}
                <section className="form-section">
                    <h2>Agendamento e Validade</h2>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="published_at">Data de Publicação</label>
                            <input
                                type="datetime-local"
                                id="published_at"
                                name="published_at"
                                value={formData.published_at}
                                onChange={handleChange}
                            />
                            <span className="help-text">Deixe vazio para publicar imediatamente</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="expires_at">Data de Validade</label>
                            <input
                                type="datetime-local"
                                id="expires_at"
                                name="expires_at"
                                value={formData.expires_at}
                                onChange={handleChange}
                            />
                            <span className="help-text">O aviso será ocultado automaticamente após esta data</span>
                        </div>
                    </div>
                    <div className="checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="is_pinned"
                                checked={formData.is_pinned}
                                onChange={handleChange}
                            />
                            <span className="checkbox-custom"></span>
                            <strong>Fixar no topo do mural</strong> - O aviso ficará destacado acima dos demais
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="send_notification"
                                checked={formData.send_notification}
                                onChange={handleChange}
                            />
                            <span className="checkbox-custom"></span>
                            <strong>Enviar notificação push</strong> - Alunos receberão alerta imediato
                        </label>
                    </div>
                </section>

                {/* Anexos */}
                <section className="form-section">
                    <h2>Anexos (Opcional)</h2>
                    <div className="upload-grid">
                        <div className={`upload-area ${previews.image ? 'has-file' : ''}`}>
                            <label htmlFor="imageUpload" className="upload-label">
                                <Image size={32} />
                                <span>{previews.image ? 'Imagem selecionada' : 'Clique para adicionar imagem'}</span>
                                <small>JPG, PNG, WebP • Máx. 5MB</small>
                            </label>
                            <input
                                type="file"
                                id="imageUpload"
                                accept="image/*"
                                onChange={handleFileSelect('image')}
                                style={{ display: 'none' }}
                            />
                            {previews.image && (
                                <div className="file-preview">
                                    <img src={previews.image} alt="Preview" />
                                    <button type="button" className="remove-file" onClick={() => removeFile('image')}>
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            {!previews.image && formData.image_url && (
                                <div className="file-preview">
                                    <img src={formData.image_url} alt="Imagem atualmente salva" />
                                    <button type="button" className="remove-file" onClick={() => removeFile('image')}>
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={`upload-area ${previews.attachment ? 'has-file' : ''}`}>
                            <label htmlFor="attachmentUpload" className="upload-label">
                                <FileText size={32} />
                                <span>{previews.attachment ? 'Arquivo selecionado' : 'Clique para adicionar arquivo'}</span>
                                <small>PDF, DOC, DOCX • Máx. 5MB</small>
                            </label>
                            <input
                                type="file"
                                id="attachmentUpload"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileSelect('attachment')}
                                style={{ display: 'none' }}
                            />
                            {previews.attachment && (
                                <div className="file-preview attachment">
                                    <FileText size={32} color="#E53935" />
                                    <span>{files.attachment?.name}</span>
                                    <button type="button" className="remove-file" onClick={() => removeFile('attachment')}>
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            {!previews.attachment && formData.attachment_url && (
                                <div className="file-preview attachment">
                                    <FileText size={32} color="#E53935" />
                                    <a href={formData.attachment_url} target="_blank" rel="noopener noreferrer">
                                        {formData.attachment_name || 'Abrir arquivo salvo'}
                                    </a>
                                    <button type="button" className="remove-file" onClick={() => removeFile('attachment')}>
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Ações fixas no rodapé */}
                <div className="fixed-actions">
                    <Link to="/admin/notices" className="btn-secondary">Cancelar</Link>
                    <button type="submit" name="publication_status" value="draft" className="btn-secondary" disabled={saving}>Salvar Rascunho</button>
                    <button type="submit" name="publication_status" value="published" className="btn-primary" disabled={saving}>
                        <Save size={18} /> {saving ? 'Salvando...' : (isEditing ? 'Atualizar Aviso' : 'Publicar Aviso')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminNoticeForm;