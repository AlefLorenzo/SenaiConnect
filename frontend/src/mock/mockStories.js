/**
 * Mock Stories Data
 * Comprehensive mock data for stories feature with edge cases
 */

// Main stories feed (stories from followed users)
export const mockStories = [
  {
    id: 1,
    user: {
      id: 2,
      name: 'Maria Silva',
      avatar: null,
      isOnline: true,
    },
    items: [
      {
        id: 101,
        type: 'image',
        url: 'https://picsum.photos/seed/story1/1080/1920',
        text: 'Novo projeto incrível! 🚀',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        viewed: false,
      },
      {
        id: 102,
        type: 'video',
        url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
        text: 'Demo do app',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        viewed: true,
      },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    viewsCount: 24,
    hasUnviewed: true,
  },
  {
    id: 2,
    user: {
      id: 3,
      name: 'João Santos',
      avatar: null,
      isOnline: false,
      lastSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    items: [
      {
        id: 201,
        type: 'image',
        url: 'https://picsum.photos/seed/story2/1080/1920',
        text: 'Café da manhã ☕',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        viewed: true,
      },
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    viewsCount: 12,
    hasUnviewed: false,
  },
  {
    id: 3,
    user: {
      id: 4,
      name: 'Ana Carolina Oliveira',
      avatar: null,
      isOnline: true,
    },
    items: [
      {
        id: 301,
        type: 'text',
        url: null,
        text: 'Quem mais está animado para o hackathon? 🎯',
        backgroundColor: '#667eea',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        viewed: false,
      },
      {
        id: 302,
        type: 'image',
        url: 'https://picsum.photos/seed/story3/1080/1920',
        text: 'Preparando o pitch',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        viewed: false,
      },
      {
        id: 303,
        type: 'image',
        url: 'https://picsum.photos/seed/story4/1080/1920',
        text: 'Equipe reunida! 💪',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        viewed: false,
      },
    ],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(),
    viewsCount: 8,
    hasUnviewed: true,
  },
  {
    id: 4,
    user: {
      id: 5,
      name: 'Pedro Henrique',
      avatar: null,
      isOnline: true,
    },
    items: [
      {
        id: 401,
        type: 'image',
        url: 'https://picsum.photos/seed/story5/1080/1920',
        text: 'Novo certificado AWS! ☁️',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        viewed: true,
      },
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    viewsCount: 45,
    hasUnviewed: false,
  },
  {
    id: 5,
    user: {
      id: 6,
      name: 'Fernanda Lima Costa',
      avatar: null,
      isOnline: false,
      lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    items: [
      {
        id: 501,
        type: 'text',
        url: null,
        text: 'Dica do dia: use TypeScript! 😎',
        backgroundColor: '#3178c6',
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        viewed: true,
      },
    ],
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
    viewsCount: 31,
    hasUnviewed: false,
  },
  {
    id: 6,
    user: {
      id: 7,
      name: 'Carlos Eduardo',
      avatar: null,
      isOnline: true,
    },
    items: [
      {
        id: 601,
        type: 'image',
        url: 'https://picsum.photos/seed/story6/1080/1920',
        text: 'Meu setup novo 🖥️',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        viewed: false,
      },
    ],
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
    viewsCount: 19,
    hasUnviewed: true,
  },
  {
    id: 7,
    user: {
      id: 8,
      name: 'Juliana',
      avatar: null,
      isOnline: true,
    },
    items: [
      {
        id: 701,
        type: 'video',
        url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
        text: 'Tutorial React hooks',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        viewed: true,
      },
    ],
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    viewsCount: 67,
    hasUnviewed: false,
  },
  {
    id: 8,
    user: {
      id: 9,
      name: 'Roberto Almeida',
      avatar: null,
      isOnline: false,
      lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    items: [
      {
        id: 801,
        type: 'image',
        url: 'https://picsum.photos/seed/story7/1080/1920',
        text: 'Formatura! 🎓',
        backgroundColor: null,
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        viewed: true,
      },
    ],
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    viewsCount: 89,
    hasUnviewed: false,
  },
];

// Add story (user's own story)
export const mockAddStory = {
  id: 0,
  user: {
    id: 1,
    name: 'Você',
    avatar: null,
  },
  items: [],
  isAddStory: true,
};

// User-specific stories (for profile view)
export const mockUserStories = {
  2: [
    {
      id: 1,
      user: { id: 2, name: 'Maria Silva', avatar: null },
      items: [
        {
          id: 101,
          type: 'image',
          url: 'https://picsum.photos/seed/story1/1080/1920',
          text: 'Novo projeto incrível! 🚀',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          viewed: true,
        },
        {
          id: 102,
          type: 'video',
          url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
          text: 'Demo do app',
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          viewed: true,
        },
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
      viewsCount: 24,
      hasUnviewed: false,
    },
  ],
  3: [
    {
      id: 2,
      user: { id: 3, name: 'João Santos', avatar: null },
      items: [
        {
          id: 201,
          type: 'image',
          url: 'https://picsum.photos/seed/story2/1080/1920',
          text: 'Café da manhã ☕',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          viewed: true,
        },
      ],
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      viewsCount: 12,
      hasUnviewed: false,
    },
  ],
  4: [
    {
      id: 3,
      user: { id: 4, name: 'Ana Carolina Oliveira', avatar: null },
      items: [
        {
          id: 301,
          type: 'text',
          url: null,
          text: 'Quem mais está animado para o hackathon? 🎯',
          backgroundColor: '#667eea',
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          viewed: true,
        },
        {
          id: 302,
          type: 'image',
          url: 'https://picsum.photos/seed/story3/1080/1920',
          text: 'Preparando o pitch',
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          viewed: true,
        },
        {
          id: 303,
          type: 'image',
          url: 'https://picsum.photos/seed/story4/1080/1920',
          text: 'Equipe reunida! 💪',
          createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          viewed: true,
        },
      ],
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(),
      viewsCount: 8,
      hasUnviewed: false,
    },
  ],
  1: [
    {
      id: 999,
      user: { id: 1, name: 'Você', avatar: null },
      items: [
        {
          id: 9991,
          type: 'image',
          url: 'https://picsum.photos/seed/mystory/1080/1920',
          text: 'Minha story',
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          viewed: true,
        },
      ],
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
      viewsCount: 5,
      hasUnviewed: false,
    },
  ],
};

// Mock Highlights data
export const mockHighlights = {
  1: [
    {
      id: 1,
      userId: 1,
      title: 'Viagens',
      coverUrl: 'https://picsum.photos/seed/travel/1080/1920',
      stories: [9991],
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      userId: 1,
      title: 'Projetos',
      coverUrl: 'https://picsum.photos/seed/projects/1080/1920',
      stories: [9991],
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  2: [
    {
      id: 3,
      userId: 2,
      title: 'Trabalho',
      coverUrl: 'https://picsum.photos/seed/work/1080/1920',
      stories: [101, 102],
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

// Edge cases for testing
export const mockEdgeCaseStories = {
  // User with very long name
  longName: {
    id: 99,
    user: {
      id: 99,
      name: 'Alexandre Augusto de Oliveira Santos',
      avatar: null,
      isOnline: true,
    },
    items: [
      {
        id: 9901,
        type: 'text',
        text: 'Nome longo testando truncamento',
        backgroundColor: '#ff6b6b',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    viewsCount: 0,
    hasUnviewed: true,
  },

  // Story with only text (no media)
  textOnly: {
    id: 100,
    user: { id: 100, name: 'Test User', avatar: null },
    items: [
      {
        id: 10001,
        type: 'text',
        text: 'Story apenas com texto e cor de fundo',
        backgroundColor: '#4ecdc4',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    viewsCount: 0,
    hasUnviewed: true,
  },

  // Expired story (for testing expiration UI)
  expired: {
    id: 101,
    user: { id: 101, name: 'Expired Story', avatar: null },
    items: [
      {
        id: 10101,
        type: 'image',
        url: 'https://picsum.photos/seed/expired/1080/1920',
        text: 'Esta story expirou',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    viewsCount: 10,
    hasUnviewed: false,
  },
};