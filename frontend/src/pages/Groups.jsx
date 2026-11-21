import React, { useState, useEffect, useContext } from 'react';
import {
  Users, Search, ChevronLeft, Calendar, LogOut, ArrowRight,
  UserCheck, MessageSquare, BookOpen, Shield, UserX, UserPlus,
  Settings, Trash2, Edit3, MoreVertical, Lock, Globe, BellOff,
  Crown, Star, ChevronDown, Check, X
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import Post from '../components/Post';
import Avatar from '../components/Avatar';
import { validateOrThrow, createGroupSchema, groupSettingsSchema } from '../lib/validation';
import groupsService from '../services/groupsService';
import messagesService from '../services/messagesService';
import { API_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import './Groups.css';

const Groups = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState('mine'); // 'mine' or 'discover'
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Group details
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupPosts, setGroupPosts] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupTab, setGroupTab] = useState('feed'); // 'feed', 'members', 'settings'
  const [newGroupPost, setNewGroupPost] = useState('');
  const [posting, setPosting] = useState(false);

  // Group creation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Group settings modal
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Member management
  const [showMemberActions, setShowMemberActions] = useState(null);
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  // Infinite scroll
  const [groupsPage, setGroupsPage] = useState(1);
  const [hasMoreGroups, setHasMoreGroups] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const observerRef = React.useRef(null);
  const loadMoreRef = React.useRef(null);

  const fetchGroups = async (page = 1, append = false) => {
    if (loadingGroups) return;
    try {
      setLoadingGroups(true);
      const result = activeTab === 'mine'
        ? await groupsService.getMyGroups(true)
        : await groupsService.getAllGroups({ page, limit: 20 });
      const data = Array.isArray(result) ? result : (result.data || []);
      if (append) {
        setGroups(prev => [...prev, ...data]);
      } else {
        setGroups(data);
      }
      setHasMoreGroups(activeTab === 'discover' && data.length >= 20);
      setGroupsPage(page);
    } catch (err) {
      console.error('Erro ao buscar grupos:', err);
      setHasMoreGroups(false);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    setGroups([]);
    setGroupsPage(1);
    setHasMoreGroups(activeTab === 'discover');
    fetchGroups(1, false);
  }, [activeTab]);

  // Infinite scroll observer for groups
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMoreGroups && !loadingGroups) {
          fetchGroups(groupsPage + 1, true);
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMoreGroups, loadingGroups, groupsPage]);

  const handleGroupSelect = async (group) => {
    setSelectedGroup(group);
    setGroupTab('feed');
    setShowMemberActions(null);

    // Fetch group posts using service (handles mock mode automatically)
    try {
      const postsResult = await groupsService.getGroupPosts(group.id);
      setGroupPosts(postsResult.data || postsResult);
    } catch (err) {
      console.error(err);
    }

    // Fetch group members using service (handles mock mode automatically)
    try {
      const membersResult = await groupsService.getGroupMembers(group.id);
      setGroupMembers(membersResult.data || membersResult);
    } catch (err) {
      console.error(err);
    }
  };

  const isGroupAdmin = () => {
    if (!selectedGroup) return false;
    const role = selectedGroup.user_role ?? selectedGroup.userRole;
    const isAdmin = selectedGroup.isAdmin === true || role === 'admin';
    const isModerator = role === 'moderator';
    const isOwner = selectedGroup.is_owner === true || selectedGroup.isOwner === true;
    return isAdmin || isModerator || isOwner;
  };

  const isGroupOwner = () => {
    return selectedGroup && (selectedGroup.is_owner === true || selectedGroup.isOwner === true);
  };

  const canManageGroup = () => {
    if (!selectedGroup) return false;
    const role = selectedGroup.user_role ?? selectedGroup.userRole;
    const isAdmin = selectedGroup.isAdmin === true || role === 'admin';
    const isOwner = selectedGroup.is_owner === true || selectedGroup.isOwner === true;
    return isAdmin || isOwner;
  };

  const canModerateGroup = () => {
    if (!selectedGroup) return false;
    const role = selectedGroup.user_role ?? selectedGroup.userRole;
    const isAdmin = selectedGroup.isAdmin === true || role === 'admin';
    const isModerator = role === 'moderator';
    const isOwner = selectedGroup.is_owner === true || selectedGroup.isOwner === true;
    return isAdmin || isModerator || isOwner;
  };

  const openSettings = async () => {
    if (!selectedGroup) return;
    try {
      const data = await groupsService.getGroup(selectedGroup.id);
      setEditingSettings({
        name: data.name,
        description: data.description,
        isPrivate: data.is_private ?? data.isPrivate ?? false,
        allowMemberPosts: (data.allow_member_posts ?? data.allowMemberPosts) !== false,
        requireApproval: data.require_approval ?? data.requireApproval ?? false,
        coverImage: data.cover_image ?? data.coverImage ?? '',
        rules: data.rules ?? ''
      });
      setSettingsModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!selectedGroup || savingSettings) return;
    try {
      setSavingSettings(true);
      // Validate settings
      const validated = validateOrThrow(groupSettingsSchema, editingSettings);
      const data = await groupsService.updateGroup(selectedGroup.id, validated.data);
      setSelectedGroup(prev => ({ ...prev, ...data }));
      setSettingsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMemberAction = async (memberId, action) => {
    if (!selectedGroup || memberActionLoading) return;
    setMemberActionLoading(true);
    try {
      await groupsService.removeGroupMember(selectedGroup.id, memberId);
      // Refresh members
      const membersData = await groupsService.getGroupMembers(selectedGroup.id);
      setGroupMembers(membersData.data || membersData);
      // Update selected group members count
      if (action === 'kick') {
        setSelectedGroup(prev => ({ ...prev, members_count: prev.members_count - 1 }));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao realizar ação');
    } finally {
      setMemberActionLoading(false);
      setShowMemberActions(null);
    }
  };

  const handlePromoteMember = async (memberId, newRole) => {
    if (!selectedGroup || memberActionLoading) return;
    setMemberActionLoading(true);
    try {
      if (newRole === 'admin') {
        await groupsService.promoteToAdmin(selectedGroup.id, memberId);
      } else if (newRole === 'member') {
        await groupsService.demoteFromAdmin(selectedGroup.id, memberId);
      }
      // Refresh members
      const membersData = await groupsService.getGroupMembers(selectedGroup.id);
      setGroupMembers(membersData.data || membersData);
    } catch (err) {
      console.error(err);
      alert('Erro ao promover membro');
    } finally {
      setMemberActionLoading(false);
      setShowMemberActions(null);
    }
  };

  const handleMessageMember = async (memberId) => {
    if (!selectedGroup || memberActionLoading) return;
    setMemberActionLoading(true);
    try {
      const conversation = await messagesService.createConversation(memberId);
      setShowMemberActions(null);
      navigate(`/messages?conversationId=${conversation.id}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao abrir conversa');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!selectedGroup) return;
    const isMemberValue = selectedGroup.is_member ?? selectedGroup.isMember;
    const isMember = isMemberValue === 1 || isMemberValue === true;

    try {
      if (isMember) {
        await groupsService.leaveGroup(selectedGroup.id);
      } else {
        await groupsService.joinGroup(selectedGroup.id);
      }

      // Toggle membership in local UI state
      setSelectedGroup(prev => ({
        ...prev,
        is_member: !isMember,
        members_count: isMember ? prev.members_count - 1 : prev.members_count + 1
      }));

      // Refresh group list in background
      fetchGroups();

      // Refresh members list
      const membersData = await groupsService.getGroupMembers(selectedGroup.id);
      setGroupMembers(membersData.data || membersData);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro.');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      // Validate group creation
      const validated = validateOrThrow(createGroupSchema, {
        name: newGroupName,
        description: newGroupDesc,
        category: 'study', // default
        isPrivate: newGroupIsPrivate,
        coverImage: '',
        rules: '',
        tags: []
      });
      const data = await groupsService.createGroup(validated.data);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupIsPrivate(false);
      setIsModalOpen(false);
      fetchGroups(1, false);

      // Auto-select the newly created group
        handleGroupSelect({
          id: data.id,
          name: newGroupName,
          description: newGroupDesc,
          members_count: 1,
          is_member: 1,
          is_private: newGroupIsPrivate,
          isPrivate: newGroupIsPrivate,  // Support both snake_case (mock) and camelCase (API)
          is_owner: true,
          isOwner: true,  // Support both snake_case (mock) and camelCase (API)
          user_role: 'admin',
          userRole: 'admin'  // Support both snake_case (mock) and camelCase (API)
        });
    } catch (err) {
      console.error(err);
      alert('Erro ao criar grupo: ' + (err.message || ''));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGroupPost = async () => {
    if (!newGroupPost.trim() || !selectedGroup) return;
    setPosting(true);
    try {
      await groupsService.createGroupPost(selectedGroup.id, { content: newGroupPost });
      setNewGroupPost('');
      // Reload group posts
      const postsResult = await groupsService.getGroupPosts(selectedGroup.id);
      setGroupPosts(postsResult.data || postsResult);
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const handleGroupPostDeleted = (deletedId) => {
    setGroupPosts(prev => prev.filter(p => p.id !== deletedId));
  };

  // Filter groups
  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          g.description.toLowerCase().includes(searchTerm.toLowerCase());
    const isMemberValue = g.is_member ?? g.isMember;
    const isMember = isMemberValue === 1 || isMemberValue === true;

    if (activeTab === 'mine') {
      return matchesSearch && isMember;
    } else {
      return matchesSearch && !isMember;
    }
  });

  if (selectedGroup) {
    const isOwner = isGroupOwner();
    const canManage = canManageGroup();
    const canModerate = canModerateGroup();

    return (
      <div className="group-detail-view groups-page">
        <div className="card group-detail-header" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="group-banner" style={{ height: '120px', background: 'linear-gradient(135deg, #1A237E 0%, #0056D2 100%)' }}></div>
          <div style={{ padding: '16px 20px', position: 'relative' }}>
            <button className="back-btn btn-secondary" onClick={() => { setSelectedGroup(null); fetchGroups(1, false); }} style={{ position: 'absolute', top: '-40px', left: '20px', padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChevronLeft size={16} /> Voltar para Grupos
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginTop: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{selectedGroup.name}</h2>
                  {(selectedGroup.is_private ?? selectedGroup.isPrivate) && <Lock size={16} color="#F59E0B" title="Grupo privado" />}
                  {!(selectedGroup.is_private ?? selectedGroup.isPrivate) && <Globe size={16} color="#10B981" title="Grupo público" />}
                  {isOwner && <Crown size={16} color="#F59E0B" title="Dono do grupo" />}
                  {(selectedGroup.user_role ?? selectedGroup.userRole) === 'admin' && !isOwner && <Shield size={16} color="#0056D2" title="Admin" />}
                  {(selectedGroup.user_role ?? selectedGroup.userRole) === 'moderator' && <Star size={16} color="#F59E0B" title="Moderador" />}
                </div>
                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {selectedGroup.members_count ?? selectedGroup.memberCount} membros
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {selectedGroup.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className={(selectedGroup.is_member ?? selectedGroup.isMember) ? 'btn-secondary' : 'btn-primary'}
                  onClick={handleJoinLeave}
                  style={{ minWidth: '140px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  {(selectedGroup.is_member ?? selectedGroup.isMember) ? (
                    <>
                      <LogOut size={16} /> Sair do Grupo
                    </>
                  ) : (
                    <>
                      <UserCheck size={16} /> Participar
                    </>
                  )}
                </button>
                {canManage && (
                  <button className="btn-secondary" onClick={openSettings} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Settings size={16} /> Configurações
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="groups-tabs">
            <button className={`tab ${groupTab === 'feed' ? 'active' : ''}`} onClick={() => setGroupTab('feed')} style={{ flex: 1, padding: '12px', fontWeight: 600 }}>
              Feed do Grupo
            </button>
            <button className={`tab ${groupTab === 'members' ? 'active' : ''}`} onClick={() => setGroupTab('members')} style={{ flex: 1, padding: '12px', fontWeight: 600 }}>
              Membros ({groupMembers.length})
            </button>
            {canManage && (
              <button className={`tab ${groupTab === 'settings' ? 'active' : ''}`} onClick={() => { setGroupTab('settings'); openSettings(); }} style={{ flex: 1, padding: '12px', fontWeight: 600 }}>
                <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Configurações
              </button>
            )}
          </div>
        </div>

        {groupTab === 'feed' ? (
          <div className="group-feed-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(selectedGroup.is_member ?? selectedGroup.isMember) ? (
              <div className="create-post-card card" style={{ padding: '16px' }}>
                <div className="create-post-top" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <Avatar user={user} className="create-post-avatar" style={{ width: '40px', height: '40px' }} />
                  <input
                    type="text"
                    placeholder={`Compartilhe algo no grupo ${selectedGroup.name}...`}
                    className="create-post-input"
                    value={newGroupPost}
                    onChange={(e) => setNewGroupPost(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') handleCreateGroupPost() }}
                    style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '20px', padding: '8px 16px', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-primary"
                    onClick={handleCreateGroupPost}
                    disabled={posting || !newGroupPost.trim()}
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    {posting ? 'Publicando...' : 'Publicar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Faça parte do grupo para poder visualizar e criar publicações!
              </div>
            )}

            {(selectedGroup.is_member ?? selectedGroup.isMember) && (
              <div className="feed-container">
                {groupPosts.length > 0 ? (
                  groupPosts.map(post => (
                    <Post key={post.id} post={post} onDeleted={handleGroupPostDeleted} />
                  ))
                ) : (
                  <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhuma publicação neste grupo ainda. Escreva a primeira!
                  </div>
                )}
              </div>
            )}
          </div>
        ) : groupTab === 'members' ? (
          <div className="group-members-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {groupMembers.length > 0 ? (
              groupMembers.map(member => {
                const isCurrentUser = member.id === user?.id;
                const isMemberOwner = (member.isOwner ?? member.is_owner) === true;
                // Support both API (member.member.role - snake_case/nested) and mock (member.role - camelCase/flat) data formats
                const memberRole = member.member?.role ?? member.role ?? 'Aluno';
                const isMemberAdmin = memberRole === 'admin';
                const isMemberModerator = memberRole === 'moderator';

                const showActions = showMemberActions === member.id && canManage && !isCurrentUser && !isMemberOwner;
                const showMessageButton = !isCurrentUser && !isMemberOwner;

                const canKick = canManage && !isCurrentUser && !isMemberOwner && (isOwner || (!isMemberAdmin && !isMemberModerator));
                const canPromoteToAdmin = isOwner && !isCurrentUser && !isMemberOwner && !isMemberAdmin;
                const canPromoteToModerator = canManage && !isCurrentUser && !isMemberOwner && !isMemberAdmin && !isMemberModerator;
                const canDemoteAdmin = isOwner && isMemberAdmin;
                const canDemoteModerator = canManage && isMemberModerator;

                return (
                  <div key={member.id} className="card member-item" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <Avatar user={member} style={{ width: '40px', height: '40px' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</h4>
                          {isMemberOwner && <span className="role-badge owner-badge" title="Dono">Dono</span>}
                          {isMemberAdmin && !isMemberOwner && <span className="role-badge admin-badge" title="Admin">Admin</span>}
                          {isMemberModerator && !isMemberAdmin && !isMemberOwner && <span className="role-badge moderator-badge" title="Moderador">Mod</span>}
                          {isCurrentUser && !isMemberOwner && !isMemberAdmin && !isMemberModerator && <span className="role-badge member-badge" title="Membro">Você</span>}
                          {!isCurrentUser && !isMemberOwner && !isMemberAdmin && !isMemberModerator && <span className="role-badge member-badge" title="Membro">Membro</span>}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{memberRole || 'Aluno'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Message button - available to all users except self and group owner */}
                      {showMessageButton && (
                        <button
                          className="icon-btn-transparent"
                          onClick={() => handleMessageMember(member.id)}
                          aria-label="Enviar mensagem"
                          style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MessageSquare size={20} color="#10B981" />
                        </button>
                      )}
                      {/* Admin dropdown - only for admins/owners */}
                      {canManage && !isCurrentUser && !isMemberOwner && (
                        <button
                          className={`icon-btn-transparent ${showMemberActions === member.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMemberActions(showMemberActions === member.id ? null : member.id);
                          }}
                          aria-label="Ações do membro"
                        >
                          <MoreVertical size={20} color="var(--text-secondary)" />
                        </button>
                      )}
                      {showActions && (
                        <div className="member-actions-dropdown" style={{ position: 'absolute', right: '12px', top: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, minWidth: '180px', padding: '4px' }}>
                          {canPromoteToAdmin && (
                            <button key="promote-admin" onClick={() => handlePromoteMember(member.id, 'admin')} className="dropdown-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', borderRadius: '4px' }}>
                              <Shield size={16} color="#0056D2" /> Promover a Admin
                            </button>
                          )}
                          {canPromoteToModerator && (
                            <button key="promote-moderator" onClick={() => handlePromoteMember(member.id, 'moderator')} className="dropdown-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', borderRadius: '4px' }}>
                              <Star size={16} color="#F59E0B" /> Promover a Moderador
                            </button>
                          )}
                          {canDemoteAdmin && (
                            <button key="demote-admin" onClick={() => handlePromoteMember(member.id, 'member')} className="dropdown-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', borderRadius: '4px' }}>
                              <UserX size={16} /> Remover Admin
                            </button>
                          )}
                          {canDemoteModerator && (
                            <button key="demote-moderator" onClick={() => handlePromoteMember(member.id, 'member')} className="dropdown-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', borderRadius: '4px' }}>
                              <UserX size={16} /> Remover Moderador
                            </button>
                          )}
                          {canKick && (
                            <button key="kick-member" onClick={() => handleMemberAction(member.id, 'kick')} className="dropdown-item danger" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444', fontSize: '13px', borderRadius: '4px' }}>
                              <UserX size={16} /> Remover do Grupo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                Nenhum membro listado.
              </div>
            )}
          </div>
        ) : (
          <div className="group-settings-view" style={{ padding: '20px', maxWidth: '600px' }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-primary)' }}>Configurações do Grupo</h3>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="groupName">Nome do Grupo</label>
                <input
                  type="text"
                  id="groupName"
                  value={editingSettings.name}
                  onChange={(e) => setEditingSettings(prev => ({ ...prev, name: e.target.value }))}
                  className="modal-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="groupDesc">Descrição</label>
                <textarea
                  id="groupDesc"
                  value={editingSettings.description}
                  onChange={(e) => setEditingSettings(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o propósito ou tópicos deste grupo..."
                  className="modal-textarea"
                  maxLength={1000}
                />
              </div>
              <div className="form-group">
                <label htmlFor="groupRules">Regras do Grupo</label>
                <textarea
                  id="groupRules"
                  value={editingSettings.rules}
                  onChange={(e) => setEditingSettings(prev => ({ ...prev, rules: e.target.value }))}
                  placeholder="Defina as regras para os membros..."
                  className="modal-textarea"
                  maxLength={2000}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingSettings.isPrivate}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Grupo Privado (requer aprovação para entrar)</span>
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Grupos privados não aparecem na descoberta e exigem aprovação de admin/moderador
                </p>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingSettings.allowMemberPosts}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, allowMemberPosts: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Permitir que membros criem publicações</span>
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingSettings.requireApproval}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, requireApproval: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Exigir aprovação para novos membros (mesmo em grupos públicos)</span>
                </label>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn-secondary" onClick={() => setSettingsModalOpen(false)} disabled={savingSettings}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={savingSettings}>
                  {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="groups-page">
      <div className="groups-header card">
        <div className="groups-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(13, 138, 188, 0.1)', padding: '10px', borderRadius: '50%', color: 'var(--senai-blue-primary)', display: 'flex' }}>
              <Users size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>Grupos Acadêmicos</h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Participe de salas de estudo, projetos e turmas.
              </p>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar grupo</button>
        </div>

        <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '6px 16px', background: 'var(--bg-card)', flex: 1 }}>
            <Search size={18} color="#65676B" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Pesquisar grupos por nome ou tema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', width: '100%', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="groups-tabs">
          <button className={`tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>Meus grupos</button>
          <button className={`tab ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>Descobrir</button>
        </div>
      </div>

      <div className="groups-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredGroups.length > 0 ? (
          filteredGroups.map(group => {
            const isMemberValue = group.is_member ?? group.isMember;
            const isMember = isMemberValue === 1 || isMemberValue === true;
            const isOwner = group.isOwner ?? group.is_owner;
            return (
              <div key={group.id} className="group-item card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div className="group-item-info">
                  <div className="group-icon-large">
                    <Users size={32} color="white" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{group.name}</h3>
                      {(group.is_private ?? group.isPrivate) && <Lock size={16} color="#F59E0B" title="Grupo privado" />}
                      {!(group.is_private ?? group.isPrivate) && <Globe size={16} color="#10B981" title="Grupo público" />}
                      {isMember && isOwner && <Crown size={16} color="#F59E0B" title="Dono do grupo" />}
                      {isMember && (group.user_role ?? group.userRole) === 'admin' && !isOwner && <Shield size={16} color="#0056D2" title="Admin" />}
                      {isMember && (group.user_role ?? group.userRole) === 'moderator' && <Star size={16} color="#F59E0B" title="Moderador" />}
                    </div>
                    <p className="group-members" style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {group.members_count ?? group.memberCount} membros
                    </p>
                    <p className="group-desc" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {group.description || 'Sem descrição.'}
                    </p>
                  </div>
                </div>
                <button className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={() => handleGroupSelect(group)}>
                  Acessar <ArrowRight size={16} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhum grupo encontrado nesta categoria.
          </div>
        )}

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="load-more-trigger" aria-hidden="true">
          {loadingGroups && hasMoreGroups && (
            <div className="load-more-spinner" aria-label="Carregando mais grupos">
              <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid var(--border-color)', borderTopColor: 'var(--senai-blue-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Carregando mais grupos...</span>
            </div>
          )}
          {!hasMoreGroups && groups.length > 0 && (
            <div className="end-of-list" aria-label="Fim da lista" style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: 500, textAlign: 'center', padding: '12px' }}>
              <span>Todos os grupos carregados</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <div className="modal-header">
              <h2>Criar Novo Grupo</h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateGroup} className="edit-profile-form">
              <div className="form-group">
                <label htmlFor="groupName">Nome do Grupo</label>
                <input
                  type="text"
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ex: Estudo de Robótica - 2A"
                  className="modal-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="groupDesc">Descrição</label>
                <textarea
                  id="groupDesc"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Descreva o propósito ou tópicos deste grupo..."
                  className="modal-textarea"
                  maxLength={500}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newGroupIsPrivate}
                    onChange={(e) => setNewGroupIsPrivate(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Grupo Privado (requer aprovação para entrar)</span>
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Grupos privados não aparecem na descoberta e exigem aprovação
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} disabled={creating}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Criando...' : 'Criar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Configurações do Grupo</h2>
              <button className="close-modal-btn" onClick={() => setSettingsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 20px 20px' }}>
              <div className="form-group">
                <label htmlFor="groupName">Nome do Grupo</label>
                <input
                  type="text"
                  id="groupName"
                  value={editingSettings.name}
                  onChange={(e) => setEditingSettings(prev => ({ ...prev, name: e.target.value }))}
                  className="modal-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="groupDesc">Descrição</label>
                <textarea
                  id="groupDesc"
                  value={editingSettings.description}
                  onChange={(e) => setEditingSettings(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o propósito ou tópicos deste grupo..."
                  className="modal-textarea"
                  maxLength={1000}
                />
              </div>
              <div className="form-group">
                <label htmlFor="groupRules">Regras do Grupo</label>
                <textarea
                  id="groupRules"
                  value={editingSettings.rules}
                  onChange={(e) => setEditingSettings(prev => ({ ...prev, rules: e.target.value }))}
                  placeholder="Defina as regras para os membros..."
                  className="modal-textarea"
                  maxLength={2000}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingSettings.isPrivate}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Grupo Privado (requer aprovação para entrar)</span>
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Grupos privados não aparecem na descoberta e exigem aprovação de admin/moderador
                </p>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingSettings.allowMemberPosts}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, allowMemberPosts: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Permitir que membros criem publicações</span>
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingSettings.requireApproval}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, requireApproval: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--senai-blue-primary)' }}
                  />
                  <span>Exigir aprovação para novos membros (mesmo em grupos públicos)</span>
                </label>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn-secondary" onClick={() => setSettingsModalOpen(false)} disabled={savingSettings}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={savingSettings}>
                  {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
