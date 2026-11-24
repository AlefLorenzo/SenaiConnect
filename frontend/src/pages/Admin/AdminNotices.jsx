import { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../../context/SocketContext.jsx';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import './Admin.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AdminNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { socket } = useContext(SocketContext);

  const [formData, setFormData] = useState({
    title: '', content: '', unit: '', priority: 'normal', expires_at: ''
  });

  const fetchNotices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/notices`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
      });
      if (res.ok) setNotices(await res.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotices();

    if (socket) {
      socket.on('new_notice', (nt) => setNotices(prev => [nt, ...prev]));
      socket.on('notice_updated', (nt) => setNotices(prev => prev.map(p => p.id === nt.id ? nt : p)));
      socket.on('notice_deleted', ({ id }) => setNotices(prev => prev.filter(p => p.id !== id)));
    }

    return () => {
      if (socket) {
        socket.off('new_notice');
        socket.off('notice_updated');
        socket.off('notice_deleted');
      }
    };
  }, [socket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = `${API_URL}/api/admin/notices${editingId ? '/' + editingId : ''}`;
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + sessionStorage.getItem('token') 
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setModalOpen(false);
        if (!socket) fetchNotices();
      } else {
        alert('Erro ao salvar aviso');
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja apagar este aviso?')) return;
    try {
      await fetch(`${API_URL}/api/admin/notices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
      });
      if (!socket) fetchNotices();
    } catch (e) { console.error(e); }
  };

  const openModal = (nt = null) => {
    if (nt) {
      setEditingId(nt.id);
      setFormData({
        title: nt.title, content: nt.content || '', unit: nt.unit || '',
        priority: nt.priority || 'normal', expires_at: nt.expires_at ? nt.expires_at.split('T')[0] : ''
      });
    } else {
      setEditingId(null);
      setFormData({ title: '', content: '', unit: '', priority: 'normal', expires_at: '' });
    }
    setModalOpen(true);
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h2>Gestão de Avisos</h2>
        <button className="admin-btn primary" onClick={() => openModal()}><Plus size={16}/> Novo Aviso</button>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Prioridade</th>
              <th>Unidade</th>
              <th>Data Criação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {notices.length === 0 ? (
              <tr><td colSpan="5" className="admin-empty">Nenhum aviso cadastrado.</td></tr>
            ) : notices.map(nt => (
              <tr key={nt.id}>
                <td>{nt.title}</td>
                <td><span className={`admin-badge ${nt.priority}`}>{nt.priority}</span></td>
                <td>{nt.unit || 'Todas'}</td>
                <td>{new Date(nt.created_at).toLocaleDateString()}</td>
                <td className="admin-action-cell">
                  <button className="admin-btn secondary" onClick={() => openModal(nt)}><Edit2 size={14}/></button>
                  <button className="admin-btn danger" onClick={() => handleDelete(nt.id)}><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="admin-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editingId ? 'Editar Aviso' : 'Novo Aviso'}</h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="admin-form-group">
                <label>Título *</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="admin-form-group">
                <label>Conteúdo</label>
                <textarea rows="4" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="admin-form-group" style={{ flex: 1 }}>
                  <label>Prioridade</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div className="admin-form-group" style={{ flex: 1 }}>
                  <label>Expira em (opcional)</label>
                  <input type="date" value={formData.expires_at} onChange={e => setFormData({...formData, expires_at: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="admin-btn primary" style={{ width: '100%', marginTop: '10px' }}>
                Salvar Aviso
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
