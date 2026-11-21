/**
 * Mock Messages Data
 * Comprehensive mock data for messaging feature with individual and group conversations
 */

// Mock conversations list
export const mockConversations = [
  // Individual conversations
  {
    id: 1,
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: null, isOnline: true },
      { id: 2, name: 'Maria Silva', avatar: null, isOnline: true, lastSeen: null },
    ],
    last_message: {
      id: 105,
      content: 'Nos vemos amanhã então! 👋',
      senderId: 2,
      senderName: 'Maria Silva',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: false,
  },
  {
    id: 2,
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: null, isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, isOnline: false, lastSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    ],
    last_message: {
      id: 205,
      content: 'Ok, te aviso quando chegar',
      senderId: 1,
      senderName: 'Você',
      type: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    isPinned: true,
    isMuted: false,
  },
  {
    id: 3,
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: null, isOnline: true },
      { id: 4, name: 'Ana Carolina Oliveira', avatar: null, isOnline: true, lastSeen: null },
    ],
    last_message: {
      id: 305,
      content: '📷 Foto',
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      type: 'image',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 2,
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: false,
  },
  {
    id: 4,
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: null, isOnline: true },
      { id: 5, name: 'Pedro Henrique', avatar: null, isOnline: false, lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    ],
    last_message: {
      id: 405,
      content: 'Parabéns pelo certificado! 🎉',
      senderId: 1,
      senderName: 'Você',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: true,
  },
  {
    id: 5,
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: null, isOnline: true },
      { id: 6, name: 'Fernanda Lima Costa', avatar: null, isOnline: true, lastSeen: null },
    ],
    last_message: {
      id: 505,
      content: 'Valeu pela dica! TypeScript é vida ❤️',
      senderId: 1,
      senderName: 'Você',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: false,
  },

  // Group conversations
  {
    id: 101,
    isGroup: true,
    name: 'Dev Team SENAI',
    description: 'Equipe de desenvolvimento do SENAI',
    avatar: null,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'admin', isOnline: true },
      { id: 2, name: 'Maria Silva', avatar: null, role: 'member', isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, role: 'member', isOnline: false, lastSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { id: 4, name: 'Ana Carolina Oliveira', avatar: null, role: 'member', isOnline: true },
      { id: 5, name: 'Pedro Henrique', avatar: null, role: 'member', isOnline: false },
      { id: 6, name: 'Fernanda Lima Costa', avatar: null, role: 'member', isOnline: true },
      { id: 7, name: 'Carlos Eduardo', avatar: null, role: 'member', isOnline: true },
    ],
    adminIds: [1],
    last_message: {
      id: 10105,
      content: 'Deploy agendado para amanhã 10h',
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    unreadCount: 5,
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: false,
    isImportant: true,
  },
  {
    id: 102,
    isGroup: true,
    name: 'React Study Group',
    description: 'Grupo de estudos React/Next.js',
    avatar: null,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, role: 'admin', isOnline: false },
      { id: 4, name: 'Ana Carolina Oliveira', avatar: null, role: 'member', isOnline: true },
      { id: 7, name: 'Carlos Eduardo', avatar: null, role: 'member', isOnline: true },
      { id: 8, name: 'Juliana', avatar: null, role: 'member', isOnline: true },
      { id: 9, name: 'Roberto Almeida', avatar: null, role: 'member', isOnline: false },
    ],
    adminIds: [3],
    last_message: {
      id: 10205,
      content: '📎 hooks-cheatsheet.pdf',
      senderId: 8,
      senderName: 'Juliana',
      type: 'document',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: true,
    isImportant: false,
  },
  {
    id: 103,
    isGroup: true,
    name: 'Projeto Final - Turma 2024',
    description: 'Coordenação do projeto final da turma',
    avatar: null,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 2, name: 'Maria Silva', avatar: null, role: 'admin', isOnline: true },
      { id: 5, name: 'Pedro Henrique', avatar: null, role: 'member', isOnline: false },
      { id: 10, name: 'Lucas Ferreira', avatar: null, role: 'member', isOnline: true },
      { id: 11, name: 'Mariana Souza', avatar: null, role: 'member', isOnline: true },
      { id: 12, name: 'Gabriel Costa', avatar: null, role: 'member', isOnline: false },
    ],
    adminIds: [2],
    last_message: {
      id: 10305,
      content: 'A apresentação é sexta às 14h',
      senderId: 2,
      senderName: 'Maria Silva',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 3,
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    isPinned: true,
    isMuted: false,
    isImportant: true,
  },
  {
    id: 104,
    isGroup: true,
    name: 'Networking SENAI',
    description: 'Networking entre alunos e ex-alunos',
    avatar: null,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, role: 'member', isOnline: false },
      { id: 6, name: 'Fernanda Lima Costa', avatar: null, role: 'member', isOnline: true },
      { id: 13, name: 'Amanda Ribeiro', avatar: null, role: 'admin', isOnline: true },
      { id: 14, name: 'Thiago Martins', avatar: null, role: 'member', isOnline: false },
      { id: 15, name: 'Camila Santos', avatar: null, role: 'member', isOnline: true },
      { id: 16, name: 'Rafael Oliveira', avatar: null, role: 'member', isOnline: true },
      { id: 17, name: 'Beatriz Lima', avatar: null, role: 'member', isOnline: false },
      { id: 18, name: 'Diego Alves', avatar: null, role: 'member', isOnline: true },
    ],
    adminIds: [13],
    last_message: {
      id: 10405,
      content: 'Vaga aberta: Frontend React na empresa X',
      senderId: 13,
      senderName: 'Amanda Ribeiro',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: false,
    isImportant: false,
  },
  {
    id: 105,
    isGroup: true,
    name: '🎮 Gamers SENAI',
    description: 'Para quem gosta de jogos',
    avatar: null,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 7, name: 'Carlos Eduardo', avatar: null, role: 'admin', isOnline: true },
      { id: 9, name: 'Roberto Almeida', avatar: null, role: 'member', isOnline: false },
      { id: 10, name: 'Lucas Ferreira', avatar: null, role: 'member', isOnline: true },
      { id: 19, name: 'Vinicius Pereira', avatar: null, role: 'member', isOnline: true },
    ],
    adminIds: [7],
    last_message: {
      id: 10505,
      content: 'Alguém pra jogar Valorant agora? 🎯',
      senderId: 19,
      senderName: 'Vinicius Pereira',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    isMuted: true,
    isImportant: false,
  },
];

// Mock messages for each conversation
export const mockMessages = {
  // Conversation 1 - Maria Silva
  1: [
    {
      id: 101,
      conversationId: 1,
      senderId: 2,
      senderName: 'Maria Silva',
      content: 'Oi! Tudo bem?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 102,
      conversationId: 1,
      senderId: 1,
      senderName: 'Você',
      content: 'Oi Maria! Tudo ótimo e com você?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 2 * 60 * 1000).toISOString(),
    },
    {
      id: 103,
      conversationId: 1,
      senderId: 2,
      senderName: 'Maria Silva',
      content: 'Tudo bem! Queria combinar o projeto',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    },
    {
      id: 104,
      conversationId: 1,
      senderId: 1,
      senderName: 'Você',
      content: 'Claro! Quando você tem disponibilidade?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
    },
    {
      id: 105,
      conversationId: 1,
      senderId: 2,
      senderName: 'Maria Silva',
      content: 'Nos vemos amanhã então! 👋',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
  ],

  // Conversation 2 - João Santos
  2: [
    {
      id: 201,
      conversationId: 2,
      senderId: 1,
      senderName: 'Você',
      content: 'João, viu o PR que abri?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 202,
      conversationId: 2,
      senderId: 3,
      senderName: 'João Santos',
      content: 'Vou dar uma olhada agora',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    },
    {
      id: 203,
      conversationId: 2,
      senderId: 3,
      senderName: 'João Santos',
      content: 'LGTM! Aprovado ✅',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000 + 25 * 60 * 1000).toISOString(),
    },
    {
      id: 204,
      conversationId: 2,
      senderId: 1,
      senderName: 'Você',
      content: 'Valeu! Faço o merge',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    },
    {
      id: 205,
      conversationId: 2,
      senderId: 1,
      senderName: 'Você',
      content: 'Ok, te aviso quando chegar',
      type: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
  ],

  // Conversation 3 - Ana Carolina Oliveira
  3: [
    {
      id: 301,
      conversationId: 3,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: 'Oi! Conseguiu resolver o bug?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 302,
      conversationId: 3,
      senderId: 1,
      senderName: 'Você',
      content: 'Sim! Era um problema no useEffect',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    },
    {
      id: 303,
      conversationId: 3,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: 'Ah, clássico! 😅',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
    },
    {
      id: 304,
      conversationId: 3,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: '📷 Foto',
      type: 'image',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      mediaUrl: 'https://picsum.photos/seed/bug/800/600',
    },
    {
      id: 305,
      conversationId: 3,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: 'Olha o print do erro',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 1 * 60 * 1000).toISOString(),
    },
  ],

  // Conversation 101 - Dev Team SENAI (Group)
  101: [
    {
      id: 10101,
      conversationId: 101,
      senderId: 2,
      senderName: 'Maria Silva',
      content: 'Bom dia equipe! 👋',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 10102,
      conversationId: 101,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: 'Bom dia! Prontos para o sprint?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    },
    {
      id: 10103,
      conversationId: 101,
      senderId: 1,
      senderName: 'Você',
      content: 'Sim! Backlog organizado',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    },
    {
      id: 10104,
      conversationId: 101,
      senderId: 7,
      senderName: 'Carlos Eduardo',
      content: '📎 sprint-backlog.pdf',
      type: 'document',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      mediaUrl: 'https://example.com/sprint-backlog.pdf',
    },
    {
      id: 10105,
      conversationId: 101,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: 'Deploy agendado para amanhã 10h',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 10106,
      conversationId: 101,
      senderId: 6,
      senderName: 'Fernanda Lima Costa',
      content: 'Perfeito! Vou revisar os testes',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
  ],

  // Conversation 102 - React Study Group
  102: [
    {
      id: 10201,
      conversationId: 102,
      senderId: 8,
      senderName: 'Juliana',
      content: 'Pessoal, achei esse artigo ótimo sobre React 19',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 10202,
      conversationId: 102,
      senderId: 8,
      senderName: 'Juliana',
      content: 'https://react.dev/blog/2024/12/05/react-19',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000 + 2 * 60 * 1000).toISOString(),
    },
    {
      id: 10203,
      conversationId: 102,
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      content: 'Legal! As Server Components parecem promissoras',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    },
    {
      id: 10204,
      conversationId: 102,
      senderId: 3,
      senderName: 'João Santos',
      content: 'Vou ler no fim de semana',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
    },
    {
      id: 10205,
      conversationId: 102,
      senderId: 8,
      senderName: 'Juliana',
      content: '📎 hooks-cheatsheet.pdf',
      type: 'document',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      mediaUrl: 'https://example.com/hooks-cheatsheet.pdf',
    },
  ],

  // Conversation 103 - Projeto Final
  103: [
    {
      id: 10301,
      conversationId: 103,
      senderId: 2,
      senderName: 'Maria Silva',
      content: 'Equipe, lembrete: apresentação sexta 14h',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 10302,
      conversationId: 103,
      senderId: 10,
      senderName: 'Lucas Ferreira',
      content: 'Slides prontos! 📊',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    },
    {
      id: 10303,
      conversationId: 103,
      senderId: 11,
      senderName: 'Mariana Souza',
      content: 'Demo funcionando perfeitamente ✨',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
    },
    {
      id: 10304,
      conversationId: 103,
      senderId: 1,
      senderName: 'Você',
      content: 'Show! Vamos ensaiar quinta?',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    },
    {
      id: 10305,
      conversationId: 103,
      senderId: 2,
      senderName: 'Maria Silva',
      content: 'A apresentação é sexta às 14h',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

// Mock groups for groups tab
export const mockGroups = [
  {
    id: 101,
    name: 'Dev Team SENAI',
    description: 'Equipe de desenvolvimento do SENAI',
    avatar: null,
    memberCount: 7,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'admin', isOnline: true },
      { id: 2, name: 'Maria Silva', avatar: null, role: 'member', isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, role: 'member', isOnline: false },
      { id: 4, name: 'Ana Carolina Oliveira', avatar: null, role: 'member', isOnline: true },
      { id: 5, name: 'Pedro Henrique', avatar: null, role: 'member', isOnline: false },
      { id: 6, name: 'Fernanda Lima Costa', avatar: null, role: 'member', isOnline: true },
      { id: 7, name: 'Carlos Eduardo', avatar: null, role: 'member', isOnline: true },
    ],
    adminIds: [1],
    muted: false,
    important: true,
    isMember: true,
    last_message: {
      id: 10105,
      content: 'Deploy agendado para amanhã 10h',
      senderId: 4,
      senderName: 'Ana Carolina Oliveira',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    unreadCount: 5,
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 102,
    name: 'React Study Group',
    description: 'Grupo de estudos React/Next.js',
    avatar: null,
    memberCount: 6,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, role: 'admin', isOnline: false },
      { id: 4, name: 'Ana Carolina Oliveira', avatar: null, role: 'member', isOnline: true },
      { id: 7, name: 'Carlos Eduardo', avatar: null, role: 'member', isOnline: true },
      { id: 8, name: 'Juliana', avatar: null, role: 'member', isOnline: true },
      { id: 9, name: 'Roberto Almeida', avatar: null, role: 'member', isOnline: false },
    ],
    adminIds: [3],
    muted: true,
    important: false,
    isMember: true,
    last_message: {
      id: 10205,
      content: '📎 hooks-cheatsheet.pdf',
      senderId: 8,
      senderName: 'Juliana',
      type: 'document',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 103,
    name: 'Projeto Final - Turma 2024',
    description: 'Coordenação do projeto final da turma',
    avatar: null,
    memberCount: 6,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 2, name: 'Maria Silva', avatar: null, role: 'admin', isOnline: true },
      { id: 5, name: 'Pedro Henrique', avatar: null, role: 'member', isOnline: false },
      { id: 10, name: 'Lucas Ferreira', avatar: null, role: 'member', isOnline: true },
      { id: 11, name: 'Mariana Souza', avatar: null, role: 'member', isOnline: true },
      { id: 12, name: 'Gabriel Costa', avatar: null, role: 'member', isOnline: false },
    ],
    adminIds: [2],
    muted: false,
    important: true,
    isMember: true,
    last_message: {
      id: 10305,
      content: 'A apresentação é sexta às 14h',
      senderId: 2,
      senderName: 'Maria Silva',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 3,
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 104,
    name: 'Networking SENAI',
    description: 'Networking entre alunos e ex-alunos',
    avatar: null,
    memberCount: 9,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 3, name: 'João Santos', avatar: null, role: 'member', isOnline: false },
      { id: 6, name: 'Fernanda Lima Costa', avatar: null, role: 'member', isOnline: true },
      { id: 13, name: 'Amanda Ribeiro', avatar: null, role: 'admin', isOnline: true },
      { id: 14, name: 'Thiago Martins', avatar: null, role: 'member', isOnline: false },
      { id: 15, name: 'Camila Santos', avatar: null, role: 'member', isOnline: true },
      { id: 16, name: 'Rafael Oliveira', avatar: null, role: 'member', isOnline: true },
      { id: 17, name: 'Beatriz Lima', avatar: null, role: 'member', isOnline: false },
      { id: 18, name: 'Diego Alves', avatar: null, role: 'member', isOnline: true },
    ],
    adminIds: [13],
    muted: false,
    important: false,
    isMember: true,
    last_message: {
      id: 10405,
      content: 'Vaga aberta: Frontend React na empresa X',
      senderId: 13,
      senderName: 'Amanda Ribeiro',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 105,
    name: '🎮 Gamers SENAI',
    description: 'Para quem gosta de jogos',
    avatar: null,
    memberCount: 5,
    participants: [
      { id: 1, name: 'Você', avatar: null, role: 'member', isOnline: true },
      { id: 7, name: 'Carlos Eduardo', avatar: null, role: 'admin', isOnline: true },
      { id: 9, name: 'Roberto Almeida', avatar: null, role: 'member', isOnline: false },
      { id: 10, name: 'Lucas Ferreira', avatar: null, role: 'member', isOnline: true },
      { id: 19, name: 'Vinicius Pereira', avatar: null, role: 'member', isOnline: true },
    ],
    adminIds: [7],
    muted: true,
    important: false,
    isMember: true,
    last_message: {
      id: 10505,
      content: 'Alguém pra jogar Valorant agora? 🎯',
      senderId: 19,
      senderName: 'Vinicius Pereira',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

// Edge cases for testing
export const mockEdgeCaseMessages = {
  // Very long message
  longMessage: {
    id: 9999,
    conversationId: 1,
    senderId: 2,
    senderName: 'Maria Silva',
    content: 'Esta é uma mensagem muito longa para testar como o sistema lida com quebra de linha e truncamento em prévias. '.repeat(5),
    type: 'text',
    status: 'read',
    createdAt: new Date().toISOString(),
  },

  // Message with reply
  replyMessage: {
    id: 9998,
    conversationId: 1,
    senderId: 1,
    senderName: 'Você',
    content: 'Exatamente!',
    type: 'text',
    status: 'sent',
    createdAt: new Date().toISOString(),
    replyTo: {
      id: 105,
      content: 'Nos vemos amanhã então! 👋',
      senderName: 'Maria Silva',
    },
  },

  // Deleted message
  deletedMessage: {
    id: 9997,
    conversationId: 1,
    senderId: 2,
    senderName: 'Maria Silva',
    content: 'Esta mensagem foi apagada',
    type: 'text',
    status: 'read',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    deleted: true,
    deletedForEveryone: true,
  },

  // Edited message
  editedMessage: {
    id: 9996,
    conversationId: 1,
    senderId: 1,
    senderName: 'Você',
    content: 'Mensagem corrigida ✏️',
    type: 'text',
    status: 'read',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    edited: true,
    editedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },

  // Image message
  imageMessage: {
    id: 9995,
    conversationId: 1,
    senderId: 2,
    senderName: 'Maria Silva',
    content: 'Olha essa foto! 📸',
    type: 'image',
    status: 'read',
    createdAt: new Date().toISOString(),
    mediaUrl: 'https://picsum.photos/seed/test/800/600',
    fileName: 'foto.jpg',
    fileSize: 1024000,
    fileType: 'image/jpeg',
  },

  // Document message
  documentMessage: {
    id: 9994,
    conversationId: 1,
    senderId: 2,
    senderName: 'Maria Silva',
    content: 'Documento importante 📎',
    type: 'document',
    status: 'read',
    createdAt: new Date().toISOString(),
    mediaUrl: 'https://example.com/document.pdf',
    fileName: 'documento.pdf',
    fileSize: 2048000,
    fileType: 'application/pdf',
  },
};

// Mock attachment upload simulation
export const mockUploadMedia = (file, onProgress, abortSignal) => {
  return new Promise((resolve, reject) => {
    // Handle abort
    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      abortSignal.addEventListener('abort', () => {
        clearInterval(interval);
        clearTimeout(timeout);
        reject(new DOMException('Upload cancelado', 'AbortError'));
      });
    }

    // Simulate upload progress
    const total = 100;
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 15;
      if (current >= total) {
        current = 100;
        clearInterval(interval);
      }
      if (onProgress) onProgress(Math.round(current));
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (onProgress) onProgress(100);

      // Return mock URL with data URL for images (simulating local preview)
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        // Create a data URL from the file for immediate preview
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            url: reader.result,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          });
        };
        reader.readAsDataURL(file);
      } else {
        const mockUrl = `https://example.com/documents/${file.name}`;
        resolve({
          url: mockUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
      }
    }, 1500);
  });
};

// Mock file validation
export const validateFile = (file, type) => {
  const FILE_LIMITS = {
    image: {
      maxSize: 10 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']
    },
    document: {
      maxSize: 25 * 1024 * 1024,
      allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed'
      ],
      allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.zip']
    }
  };

  const limits = FILE_LIMITS[type];
  const errors = [];

  if (file.size > limits.maxSize) {
    errors.push(`Arquivo muito grande. Máximo: ${type === 'image' ? '10MB' : '25MB'}`);
  }

  const isValidType = limits.allowedTypes.includes(file.type) ||
    limits.allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

  if (!isValidType) {
    errors.push(`Tipo de arquivo não permitido. Tipos aceitos: ${limits.allowedExtensions.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Mock sanitize file name
export const sanitizeFileName = (name) => {
  return name
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
};