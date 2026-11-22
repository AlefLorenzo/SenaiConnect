import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ShieldCheck, UserPlus, MoreVertical, Pencil, Search,
  Bell, BellOff, LogOut, Trash2, UserMinus, Shield, ShieldOff, Loader2,
  Save, AlertTriangle
} from 'lucide-react';
import Avatar from './Avatar';
import messagesService from '../services/messagesService';
import './GroupInfoModal.css';

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.members)) return value.members;
  if (Array.isArray(value?.contacts)) return value.contacts;
  return [];
};

export default function GroupInfoModal({ groupId, group, currentUserId, onClose, onLeave, onDelete, onUpdated, onSearch }) {
  const [details, setDetails] = useState(group || {});
  const [members, setMembers] = useState([]);
  const [adminIds, setAdminIds] = useState((group?.adminIds || []).map(Number));
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [avatarUrl, setAvatarUrl] = useState(group?.avatar || group?.icon || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyUserId, setBusyUserId] = useState(null);
  const [menuUserId, setMenuUserId] = useState(null);
  const [muted, setMuted] = useState(Boolean(group?.isMuted ?? group?.is_muted));
  const me = Number(currentUserId);
  const isAdmin = adminIds.includes(me) || String(group?.role || '').toLowerCase() === 'admin';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groupResult, memberResult, conversationResult] = await Promise.all([
        messagesService.getGroup(groupId, true).catch(() => ({})),
        messagesService.getGroupMembers(groupId),
        messagesService.getConversation(groupId, true).catch(() => ({})),
      ]);
      const nextDetails = { ...group, ...(groupResult || {}), ...(conversationResult || {}) };
      const nextMembers = normalizeList(memberResult);
      const nextAdmins = (conversationResult?.adminIds || group?.adminIds || [])
        .map(Number);
      setDetails(nextDetails);
      setMembers(nextMembers);
      setAdminIds(nextAdmins);
      setName(nextDetails.name || '');
      setDescription(nextDetails.description || '');
      setAvatarUrl(nextDetails.avatar || nextDetails.icon || '');
      setMuted(Boolean(nextDetails.isMuted ?? nextDetails.is_muted));
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as informações do grupo.');
    } finally {
      setLoading(false);
    }
  }, [groupId, group]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (showAddMembers) setShowAddMembers(false);
      else onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, showAddMembers]);

  const filteredMembers = useMemo(() => members.filter(member =>
    (member.name || '').toLocaleLowerCase('pt-BR').includes(memberSearch.trim().toLocaleLowerCase('pt-BR'))
  ), [members, memberSearch]);

  const eligibleContacts = useMemo(() => contacts.filter(contact =>
    !members.some(member => Number(member.id) === Number(contact.id)) &&
    (contact.name || '').toLocaleLowerCase('pt-BR').includes(contactSearch.trim().toLocaleLowerCase('pt-BR'))
  ), [contacts, members, contactSearch]);

  const loadContacts = async () => {
    setShowAddMembers(true);
    setSelectedIds([]);
    setError('');
    try {
      setContacts(normalizeList(await messagesService.getGroupContacts()));
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os contatos elegíveis.');
    }
  };

  const saveDetails = async (event) => {
    event.preventDefault();
    if (!name.trim()) { setError('O nome do grupo não pode ficar vazio.'); return; }
    setSaving(true); setError('');
    try {
      await messagesService.updateGroup(groupId, {
        name: name.trim(),
        description: description.trim(),
        avatar: avatarUrl.trim() || null,
      });
      setEditing(false);
      setSuccess('Informações do grupo atualizadas.');
      await refresh();
      await onUpdated?.();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar as alterações.');
    } finally { setSaving(false); }
  };

  const addMembers = async () => {
    if (!selectedIds.length) return;
    setSaving(true); setError('');
    try {
      await messagesService.addGroupMembers(groupId, selectedIds);
      setShowAddMembers(false);
      setSuccess(selectedIds.length === 1 ? 'Participante adicionado.' : 'Participantes adicionados.');
      await refresh();
      await onUpdated?.();
    } catch (err) {
      setError(err.message || 'Não foi possível adicionar os participantes.');
    } finally { setSaving(false); }
  };

  const changeAdmin = async (member, promote) => {
    setBusyUserId(Number(member.id)); setError(''); setMenuUserId(null);
    try {
      await messagesService.changeGroupAdmin(groupId, Number(member.id), promote);
      setSuccess(promote ? 'Administrador promovido.' : 'Permissão de administrador removida.');
      await refresh();
      await onUpdated?.();
    } catch (err) {
      setError(err.message || 'Não foi possível alterar as permissões.');
    } finally { setBusyUserId(null); }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remover ${member.name || 'este participante'} do grupo?`)) return;
    setBusyUserId(Number(member.id)); setError(''); setMenuUserId(null);
    try {
      await messagesService.removeGroupMember(groupId, Number(member.id));
      setSuccess('Participante removido do grupo.');
      await refresh();
      await onUpdated?.();
    } catch (err) {
      setError(err.message || 'Não foi possível remover o participante.');
    } finally { setBusyUserId(null); }
  };

  const toggleMute = async () => {
    setSaving(true); setError('');
    try {
      await messagesService.toggleGroupMute(groupId, !muted);
      setMuted(!muted);
      setSuccess(!muted ? 'Notificações silenciadas.' : 'Notificações ativadas.');
      await onUpdated?.();
    } catch (err) {
      setError(err.message || 'Não foi possível alterar as notificações.');
    } finally { setSaving(false); }
  };

  const leave = async () => {
    if (!window.confirm('Tem certeza de que deseja sair deste grupo? Você deixará de receber novas mensagens.')) return;
    setSaving(true); setError('');
    try {
      await messagesService.leaveGroup(groupId);
      onLeave?.();
    } catch (err) {
      setError(err.message || 'Não foi possível sair do grupo.');
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    const typed = window.prompt('Para excluir permanentemente este grupo para todos, digite EXCLUIR:');
    if (typed !== 'EXCLUIR') return;
    setSaving(true); setError('');
    try {
      await messagesService.deleteGroup(groupId);
      onDelete?.();
    } catch (err) {
      setError(err.message || 'Não foi possível excluir o grupo.');
      setSaving(false);
    }
  };

  if (!groupId) return null;
  const groupAvatar = details.avatar || details.icon || avatarUrl;
  const createdAt = details.createdAt || details.created_at;
  const admins = members.filter(member => adminIds.includes(Number(member.id)) || String(member.group_role || member.role).toLowerCase() === 'admin');

  return createPortal(
    <div className="group-info-overlay" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="group-info-modal" role="dialog" aria-modal="true" aria-labelledby="group-info-title">
        <header className="group-info-topbar">
          <button type="button" className="group-info-back" onClick={onClose} aria-label="Fechar informações"><X size={21} /></button>
          <h2 id="group-info-title">Informações do grupo</h2>
          <span className="group-info-spacer" />
        </header>

        {loading ? (
          <div className="group-info-loading"><Loader2 className="spin" size={28} /> Carregando grupo...</div>
        ) : (
          <div className="group-info-content">
            <section className="group-info-identity">
              <Avatar user={{ ...details, avatar: groupAvatar }} className="group-info-avatar" />
              {editing ? (
                <form className="group-info-edit-form" onSubmit={saveDetails}>
                  <label>Nome do grupo<input value={name} onChange={e => setName(e.target.value)} maxLength={80} required /></label>
                  <label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={300} /></label>
                  <label>URL da foto do grupo<input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." /></label>
                  <div className="group-info-inline-actions">
                    <button type="button" className="group-info-secondary" onClick={() => setEditing(false)}>Cancelar</button>
                    <button type="submit" className="group-info-primary" disabled={saving}><Save size={16} /> Salvar</button>
                  </div>
                </form>
              ) : (
                <>
                  <h3>{details.name || group?.name || 'Grupo'}</h3>
                  <p>{details.description || 'Nenhuma descrição adicionada.'}</p>
                  <small>{members.length} {members.length === 1 ? 'participante' : 'participantes'}{createdAt ? ` · Criado em ${new Date(createdAt).toLocaleDateString('pt-BR')}` : ''}</small>
                  {isAdmin && <button type="button" className="group-info-edit-button" onClick={() => setEditing(true)}><Pencil size={15} /> Editar informações</button>}
                </>
              )}
            </section>

            <div className="group-info-quick-actions">
              <button type="button" onClick={toggleMute} disabled={saving}><span><BellOff size={19} /></span>{muted ? 'Ativar avisos' : 'Silenciar'}</button>
              {isAdmin && <button type="button" onClick={loadContacts}><span><UserPlus size={19} /></span>Adicionar</button>}
              <button type="button" onClick={() => { onClose(); onSearch?.(); }}><span><Search size={19} /></span>Buscar</button>
            </div>

            {admins.length > 0 && (
              <section className="group-info-admins-section">
                <h4>Administradores</h4>
                <div className="group-info-admins-list">
                  {admins.map(admin => (
                    <div className="group-info-admin-person" key={admin.id}>
                      <Avatar user={admin} className="group-info-member-avatar" />
                      <span>{admin.name || 'Usuário'}</span>
                      {Number(admin.id) === me && <small>Você</small>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="group-info-section">
              <div className="group-info-section-heading">
                <div><h4>Participantes</h4><span>{members.length} pessoas · {admins.length} administradores</span></div>
                {isAdmin && <button type="button" className="group-info-add-button" onClick={loadContacts}><UserPlus size={16} /> Adicionar</button>}
              </div>
              <div className="group-info-search"><Search size={17} /><input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Pesquisar participantes" /></div>
              <div className="group-info-member-list">
                {filteredMembers.map(member => {
                  const memberIsAdmin = adminIds.includes(Number(member.id)) || String(member.group_role || member.role).toLowerCase() === 'admin';
                  const isMe = Number(member.id) === me;
                  return (
                    <div className="group-info-member" key={member.id}>
                      <Avatar user={member} className="group-info-member-avatar" />
                      <div className="group-info-member-details"><strong>{member.name || 'Usuário'}</strong><small>{isMe ? 'Você' : (member.is_online ? 'Online' : 'Participante')}</small></div>
                      {memberIsAdmin && <span className="group-info-admin-tag"><ShieldCheck size={13} /> Admin</span>}
                      {isAdmin && !isMe && (
                        <div className="group-info-member-menu-wrap">
                          <button type="button" className="group-info-menu-button" aria-label={`Opções de ${member.name}`} onClick={() => setMenuUserId(menuUserId === Number(member.id) ? null : Number(member.id))}><MoreVertical size={19} /></button>
                          {menuUserId === Number(member.id) && <div className="group-info-member-menu">
                            <button type="button" onClick={() => changeAdmin(member, !memberIsAdmin)} disabled={busyUserId === Number(member.id)}>{memberIsAdmin ? <><ShieldOff size={15} /> Remover admin</> : <><Shield size={15} /> Promover a admin</>}</button>
                            <button type="button" className="danger" onClick={() => removeMember(member)} disabled={busyUserId === Number(member.id)}><UserMinus size={15} /> Remover do grupo</button>
                          </div>}
                        </div>
                      )}
                      {busyUserId === Number(member.id) && <Loader2 className="spin" size={16} />}
                    </div>
                  );
                })}
                {!filteredMembers.length && <p className="group-info-empty">Nenhum participante encontrado.</p>}
              </div>
            </section>

            <section className="group-info-preferences">
              <button type="button" onClick={toggleMute} disabled={saving}><Bell size={18} /> Notificações <span>{muted ? 'Silenciadas' : 'Ativadas'}</span></button>
            </section>

            <section className="group-info-danger-zone">
              <button type="button" onClick={leave} disabled={saving}><LogOut size={18} /> Sair do grupo</button>
              {isAdmin && <button type="button" onClick={deleteGroup} disabled={saving}><Trash2 size={18} /> Excluir grupo para todos</button>}
            </section>
          </div>
        )}

        {error && <div className="group-info-feedback error" role="alert"><AlertTriangle size={16} /> {error}</div>}
        {success && <div className="group-info-feedback success" role="status">{success}</div>}

        {showAddMembers && (
          <div className="group-info-add-overlay" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setShowAddMembers(false);
          }}>
            <section className="group-info-add-modal" role="dialog" aria-modal="true" aria-labelledby="group-add-title">
              <header><h3 id="group-add-title">Adicionar participantes</h3><button type="button" onClick={() => setShowAddMembers(false)} aria-label="Fechar"><X size={19} /></button></header>
              <div className="group-info-search"><Search size={17} /><input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Buscar pessoas..." /></div>
              <div className="group-info-add-list">
                {eligibleContacts.map(contact => <label key={contact.id} className="group-info-add-contact">
                  <input type="checkbox" checked={selectedIds.includes(Number(contact.id))} onChange={() => setSelectedIds(ids => ids.includes(Number(contact.id)) ? ids.filter(id => id !== Number(contact.id)) : [...ids, Number(contact.id)])} />
                  <Avatar user={contact} className="group-info-member-avatar" />
                  <span><strong>{contact.name}</strong><small>{[contact.has_conversation && 'Já conversaram', contact.is_following && 'Você segue', contact.follows_you && 'Segue você'].filter(Boolean).join(' · ')}</small></span>
                </label>)}
                {!eligibleContacts.length && <p className="group-info-empty">Não há contatos elegíveis para adicionar.</p>}
              </div>
              <footer><button type="button" className="group-info-secondary" onClick={() => setShowAddMembers(false)}>Cancelar</button><button type="button" className="group-info-primary" onClick={addMembers} disabled={!selectedIds.length || saving}>{saving ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />} Adicionar {selectedIds.length || ''}</button></footer>
            </section>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}
