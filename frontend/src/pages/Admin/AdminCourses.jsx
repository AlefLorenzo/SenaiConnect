import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import './AdminCourses.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const StatusBadge = ({ status }) => {
    const configs = {
        active: { label: 'Ativo', class: 'status-active' },
        draft: { label: 'Rascunho', class: 'status-draft' },
        archived: { label: 'Arquivado', class: 'status-archived' }
    };
    const config = configs[status] || configs.draft;
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
};

const AdminCourses = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });

    const fetchCourses = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`${API_URL}/api/admin/courses?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setCourses(data.courses);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar cursos:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, statusFilter]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchCourses();
    }, [fetchCourses]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este curso?')) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/courses/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchCourses();
        } catch (error) {
            console.error('Erro ao excluir:', error);
        }
    };

    if (loading) return <div className="loading-state">Carregando cursos...</div>;

    return (
        <div className="admin-courses">
            <div className="page-header">
                <div>
                    <h1>Gerenciamento de Cursos</h1>
                    <p>Gerencie cursos e formações disponíveis na plataforma</p>
                </div>
                <Link to="/admin/courses/new" className="btn-primary">
                    <Plus size={18} /> Novo Curso
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Lista de Cursos</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por título, área..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <select value={statusFilter} onChange={handleStatusChange} className="filter-select">
                            <option value="">Todos os status</option>
                            <option value="active">Ativo</option>
                            <option value="draft">Rascunho</option>
                            <option value="archived">Arquivado</option>
                        </select>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Título</th>
                                <th>Área</th>
                                <th>Unidade</th>
                                <th>Modalidade</th>
                                <th>Período</th>
                                <th>Vagas</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.length > 0 ? courses.map((course, index) => (
                                <tr key={course.id}>
                                    <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                    <td>
                                        <div className="course-title">{course.title}</div>
                                        <div className="course-author">Por {course.author_name}</div>
                                    </td>
                                    <td>{course.area || '-'}</td>
                                    <td>{course.unit || '-'}</td>
                                    <td>{course.modality || 'Presencial'}</td>
                                    <td>{course.period || '-'}</td>
                                    <td>{course.vacancies || 0}</td>
                                    <td><StatusBadge status={course.status} /></td>
                                    <td>
                                        <div className="actions">
                                            <Link to={`/admin/courses/${course.id}/edit`} className="action-btn" title="Editar">
                                                <Edit size={16} />
                                            </Link>
                                            <button className="action-btn danger" onClick={() => handleDelete(course.id)} title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="empty-row">Nenhum curso encontrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="pagination">
                        <button
                            className="pagination-btn"
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="pagination-info">
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} cursos)
                        </span>
                        <button
                            className="pagination-btn"
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminCourses;