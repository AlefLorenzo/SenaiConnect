import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, Edit, UserX, UserPlus } from 'lucide-react';
import './AdminUsers.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const RoleBadge = ({ role, adminRole }) => {
    if (adminRole) {
        const configs = {
            super_admin: { label: 'Super Admin', class: 'role-admin' },
            admin_unidade: { label: 'Admin Unidade', class: 'role-admin-unidade' },
            admin_moderacao: { label: 'Moderação', class: 'role-moderacao' },
            admin_suporte: { label: 'Suporte', class: 'role-suporte' }
        };
        const config = configs[adminRole] || { label: adminRole, class: 'role-admin' };
        return <span className={`role-badge admin ${config.class}`}>{config.label}</span>;
    }
    const configs = {
        Aluno: { label: 'Aluno', class: 'role-student' },
        Professor: { label: 'Professor', class: 'role-teacher' },
        Administrador: { label: 'Admin', class: 'role-admin' }
    };
    const config = configs[role] || { label: role, class: 'role-student' };
    return <span className={`role-badge ${config.class}`}>{config.label}</span>;
};

const StatusBadge = ({ blocked, pendingOnboarding }) => {
    if (blocked) return <span className="status-badge status-blocked">Bloqueado</span>;
    if (pendingOnboarding) return <span className="status-badge status-pending">Pendente Onboarding</span>;
    return <span className="status-badge status-active">Ativo</span>;
};

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, totalAdmins: 0, totalBlocked: 0 });
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
    const [viewModal, setViewModal] = useState(null);
    const [editModal, setEditModal] = useState(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('admin_token');
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (roleFilter) params.append('role', roleFilter);
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`${API_URL}/api/admin/users?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, roleFilter, statusFilter]);

    const fetchStats = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await fetch(`${API_URL}/api/admin/users/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Erro ao buscar stats:', error);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchUsers();
        fetchStats();
    }, [fetchUsers, fetchStats]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleRoleChange = (e) => {
        setRoleFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const toggleBlock = async (id, currentlyBlocked) => {
        if (!window.confirm(`Tem certeza que deseja ${currentlyBlocked ? 'desbloquear' : 'bloquear'} este usuário?`)) return;
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await fetch(`${API_URL}/api/admin/users/${id}/block`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ block: !currentlyBlocked })
            });
            if (res.ok) {
                fetchUsers();
                fetchStats();
            }
        } catch (error) {
            console.error('Erro ao bloquear/desbloquear:', error);
        }
    };

    const openViewModal = (user) => setViewModal(user);
    const openEditModal = (user) => {
        setEditModal({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            admin_role: user.admin_role || '',
            unit_id: user.unit_id || '',
            bio: user.bio || '',
            course: user.course || '',
            area: user.area || '',
            unit: user.unit || '',
            state: user.state || '',
            city: user.city || '',
            is_private: user.is_private,
            hide_email: user.hide_email
        });
    };

    const closeModals = () => {
        setViewModal(null);
        setEditModal(null);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await fetch(`${API_URL}/api/admin/users/${editModal.id}/profile`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(editModal)
            });
            if (res.ok) {
                closeModals();
                fetchUsers();
            }
        } catch (error) {
            console.error('Erro ao atualizar:', error);
        }
    };

    if (loading) return <div className="loading-state">Carregando usuários...</div>;

    return (
        <div className="admin-users">
            <div className="page-header">
                <div>
                    <h1>Gerenciamento de Usuários</h1>
                    <p>Visualize, busque e gerencie contas de usuários</p>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
                <div className="stat-mini students">
                    <div className="stat-mini-value">{stats.totalStudents?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Alunos</div>
                </div>
                <div className="stat-mini teachers">
                    <div className="stat-mini-value">{stats.totalTeachers?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Professores</div>
                </div>
                <div className="stat-mini admins">
                    <div className="stat-mini-value">{stats.totalAdmins?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Administradores</div>
                </div>
                <div className="stat-mini blocked">
                    <div className="stat-mini-value">{stats.totalBlocked?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Bloqueados</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Lista de Usuários</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nome, e-mail, curso..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="filter-group">
                            <select value={roleFilter} onChange={handleRoleChange}>
                                <option value="">Todos os perfis</option>
                                <option value="Aluno">Aluno</option>
                                <option value="Professor">Professor</option>
                                <option value="Administrador">Administrador</option>
                            </select>
                            <select value={statusFilter} onChange={handleStatusChange}>
                                <option value="">Todos os status</option>
                                <option value="active">Ativo</option>
                                <option value="blocked">Bloqueado</option>
                                <option value="pending">Pendente Onboarding</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Usuário</th>
                                <th>Perfil</th>
                                <th>Curso / Área</th>
                                <th>Último Acesso</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length > 0 ? users.map((user, index) => (
                                <tr key={user.id}>
                                    <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar">{user.name?.charAt(0) || '?'}</div>
                                            <div className="user-info">
                                                <div className="user-name">{user.name}</div>
                                                <div className="user-email">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <RoleBadge role={user.role} adminRole={user.admin_role} />
                                    </td>
                                    <td>
                                        <div className="user-meta">
                                            {user.course && <div className="meta-item">{user.course}</div>}
                                            {user.unit && <div className="meta-item unit">{user.unit}</div>}
                                        </div>
                                    </td>
                                    <td>{user.last_access ? formatDateTime(user.last_access) : 'Nunca'}</td>
                                    <td>
                                        <StatusBadge blocked={user.is_blocked} pendingOnboarding={!user.onboarding_completed} />
                                    </td>
                                    <td>
                                        <div className="actions">
                                            <button className="action-btn" onClick={() => openViewModal(user)} title="Ver detalhes">
                                                <Eye size={16} />
                                            </button>
                                            <button className="action-btn" onClick={() => openEditModal(user)} title="Editar">
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className={`action-btn ${user.is_blocked ? 'unblock' : 'block'}`}
                                                onClick={() => toggleBlock(user.id, user.is_blocked)}
                                                title={user.is_blocked ? 'Desbloquear' : 'Bloquear'}
                                            >
                                                {user.is_blocked ? <UserPlus size={16} /> : <UserX size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="empty-row">Nenhum usuário encontrado</td>
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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} usuários)
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

            {/* View Modal */}
            {viewModal && (
                <div className="modal-overlay" onClick={closeModals}>
                    <div className="modal large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes do Usuário</h2>
                            <button onClick={closeModals} className="modal-close">&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="user-detail-header">
                                <div className="user-avatar-large">{viewModal.name?.charAt(0) || '?'}</div>
                                <div className="user-main-info">
                                    <h3>{viewModal.name}</h3>
                                    <p>{viewModal.email}</p>
                                    <div className="user-badges">
                                        <RoleBadge role={viewModal.role} adminRole={viewModal.admin_role} />
                                        <StatusBadge blocked={viewModal.is_blocked} pendingOnboarding={!viewModal.onboarding_completed} />
                                    </div>
                                </div>
                            </div>
                            <div className="detail-grid">
                                <div className="detail-column">
                                    <h4>Informações Básicas</h4>
                                    <div className="info-row"><label>Nome</label><span>{viewModal.name}</span></div>
                                    <div className="info-row"><label>E-mail</label><span>{viewModal.email}</span></div>
                                    <div className="info-row"><label>Perfil</label><span>{viewModal.role}</span></div>
                                    {viewModal.admin_role && <div className="info-row"><label>Role Admin</label><span>{viewModal.admin_role}</span></div>}
                                    <div className="info-row"><label>Curso</label><span>{viewModal.course || '-'}</span></div>
                                    <div className="info-row"><label>Área</label><span>{viewModal.area || '-'}</span></div>
                                    <div className="info-row"><label>Unidade</label><span>{viewModal.unit || '-'}</span></div>
                                    <div className="info-row"><label>Estado</label><span>{viewModal.state || '-'}</span></div>
                                    <div className="info-row"><label>Cidade</label><span>{viewModal.city || '-'}</span></div>
                                </div>
                                <div className="detail-column">
                                    <h4>Configurações</h4>
                                    <div className="info-row"><label>Perfil Privado</label><span>{viewModal.is_private ? 'Sim' : 'Não'}</span></div>
                                    <div className="info-row"><label>Ocultar E-mail</label><span>{viewModal.hide_email ? 'Sim' : 'Não'}</span></div>
                                    <div className="info-row"><label>Onboarding</label><span>{viewModal.onboarding_completed ? 'Concluído' : 'Pendente'}</span></div>
                                    <div className="info-row"><label>Cadastrado em</label><span>{formatDate(viewModal.created_at)}</span></div>
                                    <div className="info-row"><label>Último Acesso</label><span>{viewModal.last_access ? formatDateTime(viewModal.last_access) : 'Nunca'}</span></div>
                                </div>
                            </div>
                            {viewModal.bio && (
                                <div className="bio-section">
                                    <h4>Biografia</h4>
                                    <p>{viewModal.bio}</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeModals}>Fechar</button>
                            <button className="btn-primary" onClick={() => { closeModals(); openEditModal(viewModal); }}>Editar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal && (
                <div className="modal-overlay" onClick={closeModals}>
                    <div className="modal large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar Usuário: {editModal.name}</h2>
                            <button onClick={closeModals} className="modal-close">&times;</button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="modal-body">
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Nome Completo <span className="required">*</span></label>
                                    <input type="text" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} required />
                                </div>
                                <div className="form-group full-width">
                                    <label>E-mail <span className="required">*</span></label>
                                    <input type="email" value={editModal.email} onChange={e => setEditModal({...editModal, email: e.target.value})} required />
                                </div>
                                <div className="form-group">
                                    <label>Perfil</label>
                                    <select value={editModal.role} onChange={e => setEditModal({...editModal, role: e.target.value})}>
                                        <option value="Aluno">Aluno</option>
                                        <option value="Professor">Professor</option>
                                        <option value="Administrador">Administrador</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Role Admin</label>
                                    <select value={editModal.admin_role} onChange={e => setEditModal({...editModal, admin_role: e.target.value})}>
                                        <option value="">Nenhum</option>
                                        <option value="super_admin">Super Admin</option>
                                        <option value="admin_unidade">Admin Unidade</option>
                                        <option value="admin_moderacao">Moderação</option>
                                        <option value="admin_suporte">Suporte</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Unidade ID</label>
                                    <input type="number" value={editModal.unit_id} onChange={e => setEditModal({...editModal, unit_id: e.target.value})} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Curso</label>
                                    <input type="text" value={editModal.course} onChange={e => setEditModal({...editModal, course: e.target.value})} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Área</label>
                                    <input type="text" value={editModal.area} onChange={e => setEditModal({...editModal, area: e.target.value})} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Unidade</label>
                                    <input type="text" value={editModal.unit} onChange={e => setEditModal({...editModal, unit: e.target.value})} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Estado</label>
                                    <input type="text" value={editModal.state} onChange={e => setEditModal({...editModal, state: e.target.value})} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Cidade</label>
                                    <input type="text" value={editModal.city} onChange={e => setEditModal({...editModal, city: e.target.value})} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Biografia</label>
                                    <textarea value={editModal.bio} onChange={e => setEditModal({...editModal, bio: e.target.value})} rows={3} />
                                </div>
                            </div>
                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={editModal.is_private} onChange={e => setEditModal({...editModal, is_private: e.target.checked})} />
                                    <span className="checkbox-custom"></span>
                                    <span>Perfil Privado</span>
                                </label>
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={editModal.hide_email} onChange={e => setEditModal({...editModal, hide_email: e.target.checked})} />
                                    <span className="checkbox-custom"></span>
                                    <span>Ocultar E-mail</span>
                                </label>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={closeModals}>Cancelar</button>
                                <button type="submit" className="btn-primary">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;