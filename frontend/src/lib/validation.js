import { z } from 'zod';

/**
 * Validation Schemas using Zod
 * Centralized validation for forms and API calls
 */

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória').min(6, 'Senha deve ter pelo menos 6 caracteres'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória').min(6, 'Senha deve ter pelo menos 6 caracteres').max(128, 'Senha muito longa'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
  role: z.enum(['ALUNO', 'PROFESSOR', 'EMPRESA']).optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Você deve aceitar os termos' }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  password: z.string().min(1, 'Senha é obrigatória').min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(1, 'Nova senha é obrigatória').min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

// ============================================
// Profile Schemas
// ============================================

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo').optional(),
  bio: z.string().max(500, 'Biografia deve ter no máximo 500 caracteres').optional(),
  avatar: z.string().url('URL de avatar inválida').optional().or(z.literal('')),
  cover_image: z.string().url('URL de capa inválida').optional().or(z.literal('')),
  state: z.string().max(50, 'Estado muito longo').optional().or(z.literal('')),
  city: z.string().max(100, 'Cidade muito longa').optional().or(z.literal('')),
  unit: z.string().max(100, 'Unidade muito longa').optional().or(z.literal('')),
  area: z.string().max(100, 'Área muito longa').optional().or(z.literal('')),
  course: z.string().max(100, 'Curso muito longo').optional().or(z.literal('')),
  links: z.string().url('URL inválida').optional().or(z.literal('')),
  skills: z.array(z.string()).optional(),
});

export const profileSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  privacy: z.enum(['public', 'friends', 'private']).optional(),
});

// ============================================
// Post Schemas
// ============================================

export const createPostSchema = z.object({
  content: z.string().min(1, 'Conteúdo é obrigatório').max(5000, 'Publicação muito longa (máx. 5000 caracteres)'),
  type: z.enum(['text', 'image', 'video', 'link', 'question', 'tip', 'project', 'event']).default('text'),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  media: z.array(z.object({
    url: z.string().url('URL de mídia inválida'),
    type: z.enum(['image', 'video']),
    alt: z.string().optional(),
  })).max(10, 'Máximo 10 arquivos de mídia').optional(),
  tags: z.array(z.string().min(1).max(50)).max(10, 'Máximo 10 tags').optional(),
  location: z.string().max(200, 'Localização muito longa').optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const commentSchema = z.object({
  content: z.string().min(1, 'Comentário não pode ser vazio').max(2000, 'Comentário muito longo'),
  parentId: z.string().optional(), // For replies
});

export const shareSchema = z.object({
  postId: z.string().min(1, 'ID da publicação é obrigatório'),
  content: z.string().max(500, 'Conteúdo do compartilhamento muito longo').optional(),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
});

// ============================================
// Story Schemas
// ============================================

export const createStorySchema = z.object({
  media: z.object({
    url: z.string().url('URL de mídia inválida'),
    type: z.enum(['image', 'video']),
    duration: z.number().min(1).max(30).optional(), // seconds for videos
  }),
  text: z.string().max(500, 'Texto muito longo').optional(),
  mentions: z.array(z.string()).max(10, 'Máximo 10 menções').optional(),
  location: z.string().max(200).optional(),
  isCloseFriends: z.boolean().default(false),
});

export const viewStorySchema = z.object({
  storyId: z.string().min(1, 'ID da história é obrigatório'),
});

// ============================================
// Message Schemas
// ============================================

export const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  recipientId: z.string().optional(),
  content: z.string().min(1, 'Mensagem não pode ser vazia').max(4000, 'Mensagem muito longa'),
  type: z.enum(['text', 'image', 'video', 'file', 'audio', 'location', 'contact']).default('text'),
  media: z.object({
    url: z.string().url('URL de mídia inválida'),
    type: z.enum(['image', 'video', 'file', 'audio']),
    name: z.string().optional(),
    size: z.number().optional(),
  }).optional(),
  replyToId: z.string().optional(),
}).refine((data) => data.conversationId || data.recipientId, {
  message: 'Destinatário ou conversa é obrigatório',
  path: ['recipientId'],
});

export const createConversationSchema = z.object({
  recipientId: z.string().min(1, 'Destinatário é obrigatório'),
  isGroup: z.boolean().default(false),
  name: z.string().min(1, 'Nome do grupo é obrigatório').max(100).optional(),
  members: z.array(z.string()).min(2, 'Grupo deve ter pelo menos 2 membros').optional(),
});

// ============================================
// Group Schemas
// ============================================

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  category: z.string().min(1, 'Categoria é obrigatória').max(50),
  isPrivate: z.boolean().default(false),
  coverImage: z.string().url('URL de capa inválida').optional().or(z.literal('')),
  rules: z.string().max(2000, 'Regras muito longas').optional(),
  tags: z.array(z.string().min(1).max(30)).max(10, 'Máximo 10 tags').optional(),
});

export const updateGroupSchema = createGroupSchema.partial();

export const groupSettingsSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100).optional(),
  description: z.string().max(1000).optional(),
  isPrivate: z.boolean().optional(),
  coverImage: z.string().url().optional().or(z.literal('')),
  rules: z.string().max(2000).optional(),
  allowMemberPosts: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

// ============================================
// Notification Schemas
// ============================================

export const notificationPreferencesSchema = z.object({
  email: z.object({
    likes: z.boolean().default(true),
    comments: z.boolean().default(true),
    follows: z.boolean().default(true),
    mentions: z.boolean().default(true),
    messages: z.boolean().default(true),
    groups: z.boolean().default(true),
    events: z.boolean().default(true),
    marketing: z.boolean().default(false),
  }).optional(),
  push: z.object({
    likes: z.boolean().default(true),
    comments: z.boolean().default(true),
    follows: z.boolean().default(true),
    mentions: z.boolean().default(true),
    messages: z.boolean().default(true),
    groups: z.boolean().default(true),
    events: z.boolean().default(true),
  }).optional(),
  inApp: z.object({
    likes: z.boolean().default(true),
    comments: z.boolean().default(true),
    follows: z.boolean().default(true),
    mentions: z.boolean().default(true),
    messages: z.boolean().default(true),
    groups: z.boolean().default(true),
    events: z.boolean().default(true),
  }).optional(),
  frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
  quietHours: z.object({
    enabled: z.boolean().default(false),
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM inválido').optional(),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM inválido').optional(),
  }).optional(),
});

// ============================================
// Search Schemas
// ============================================

export const searchSchema = z.object({
  q: z.string().min(1, 'Termo de busca é obrigatório').max(200, 'Busca muito longa'),
  type: z.enum(['all', 'users', 'posts', 'groups', 'hashtags']).default('all'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
  filters: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    authorId: z.string().optional(),
    groupId: z.string().optional(),
    hashtag: z.string().optional(),
  }).optional(),
});

// ============================================
// File Upload Schemas
// ============================================

export const uploadImageSchema = z.object({
  file: z.instanceof(File, { message: 'Arquivo é obrigatório' }),
  folder: z.enum(['avatars', 'covers', 'posts', 'stories', 'groups', 'messages']).default('posts'),
}).refine((data) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return allowedTypes.includes(data.file.type);
}, { message: 'Tipo de arquivo não permitido (use JPEG, PNG, WebP ou GIF)', path: ['file'] })
.refine((data) => data.file.size <= 10 * 1024 * 1024, { message: 'Arquivo muito grande (máx. 10MB)', path: ['file'] });

export const uploadVideoSchema = z.object({
  file: z.instanceof(File, { message: 'Arquivo é obrigatório' }),
  folder: z.enum(['posts', 'stories', 'messages']).default('posts'),
}).refine((data) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  return allowedTypes.includes(data.file.type);
}, { message: 'Tipo de vídeo não permitido (use MP4, WebM ou MOV)', path: ['file'] })
.refine((data) => data.file.size <= 100 * 1024 * 1024, { message: 'Vídeo muito grande (máx. 100MB)', path: ['file'] });

export const uploadDocumentSchema = z.object({
  file: z.instanceof(File, { message: 'Arquivo é obrigatório' }),
  folder: z.enum(['documents', 'projects']).default('documents'),
}).refine((data) => {
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  return allowedTypes.includes(data.file.type);
}, { message: 'Tipo de documento não permitido (use PDF, DOC ou DOCX)', path: ['file'] })
.refine((data) => data.file.size <= 20 * 1024 * 1024, { message: 'Documento muito grande (máx. 20MB)', path: ['file'] });

// ============================================
// Event Schemas
// ============================================

export const createEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').min(3, 'Título muito curto').max(200, 'Título muito longo'),
  description: z.string().max(5000, 'Descrição muito longa').optional(),
  startDate: z.string().datetime({ message: 'Data de início inválida' }),
  endDate: z.string().datetime({ message: 'Data de fim inválida' }).optional(),
  location: z.string().max(500, 'Localização muito longa').optional(),
  isOnline: z.boolean().default(false),
  meetingLink: z.string().url('Link de reunião inválido').optional().or(z.literal('')),
  maxAttendees: z.number().min(1, 'Mínimo 1 participante').max(10000, 'Máximo 10000 participantes').optional(),
  isPrivate: z.boolean().default(false),
  coverImage: z.string().url('URL de capa inválida').optional().or(z.literal('')),
  tags: z.array(z.string().min(1).max(30)).max(10, 'Máximo 10 tags').optional(),
}).refine((data) => {
  if (data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, { message: 'Data de fim deve ser posterior à data de início', path: ['endDate'] });

// ============================================
// Course Schemas
// ============================================

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').min(3, 'Título muito curto').max(200, 'Título muito longo'),
  description: z.string().min(10, 'Descrição muito curta').max(5000, 'Descrição muito longa'),
  category: z.string().min(1, 'Categoria é obrigatória').max(100),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  duration: z.number().min(1, 'Duração mínima 1 hora').optional(),
  price: z.number().min(0, 'Preço não pode ser negativo').default(0),
  isPublished: z.boolean().default(false),
  coverImage: z.string().url('URL de capa inválida').optional().or(z.literal('')),
  tags: z.array(z.string().min(1).max(30)).max(15, 'Máximo 15 tags').optional(),
  requirements: z.array(z.string().max(200)).optional(),
  learningOutcomes: z.array(z.string().max(300)).optional(),
});

// ============================================
// Admin Schemas
// ============================================

export const adminUserActionSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  action: z.enum(['ban', 'unban', 'verify', 'unverify', 'promote', 'demote', 'delete']),
  reason: z.string().max(500, 'Motivo muito longo').optional(),
  duration: z.number().min(1).optional(), // days for ban
});

export const adminReportActionSchema = z.object({
  reportId: z.string().min(1, 'ID do relatório é obrigatório'),
  action: z.enum(['dismiss', 'warn', 'ban_user', 'remove_content', 'escalate']),
  moderatorNotes: z.string().max(1000, 'Notas muito longas').optional(),
});

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate data against a schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @returns {Object} { success: boolean, data?: any, errors?: z.ZodError }
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.flatten() };
}

/**
 * Validate and throw on error
 * @param {z.ZodSchema} schema - Zod schema
 * @param {unknown} data - Data to validate
 * @returns {any} Validated data
 * @throws {z.ZodError} If validation fails
 */
export function validateOrThrow(schema, data) {
  return schema.parse(data);
}

/**
 * Create a form validation hook
 * @param {z.ZodSchema} schema - Zod schema
 * @returns {Object} Hook utilities
 */
export function createFormValidator(schema) {
  return {
    validate: (data) => validate(schema, data),
    validateOrThrow: (data) => validateOrThrow(schema, data),
    validateField: (fieldName, value) => {
      const fieldSchema = schema.shape[fieldName];
      if (!fieldSchema) return { success: true };
      return validate(fieldSchema, value);
    },
    getDefaultValues: () => {
      // Extract default values from schema
      const defaults = {};
      for (const key of Object.keys(schema.shape)) {
        const field = schema.shape[key];
        if (field._def.defaultValue !== undefined) {
          defaults[key] = field._def.defaultValue();
        }
      }
      return defaults;
    },
  };
}

// ============================================
// Pre-built Form Validators
// ============================================

export const loginValidator = createFormValidator(loginSchema);
export const registerValidator = createFormValidator(registerSchema);
export const profileUpdateValidator = createFormValidator(profileUpdateSchema);
export const createPostValidator = createFormValidator(createPostSchema);
export const createStoryValidator = createFormValidator(createStorySchema);
export const sendMessageValidator = createFormValidator(sendMessageSchema);
export const createGroupValidator = createFormValidator(createGroupSchema);
export const createEventValidator = createFormValidator(createEventSchema);
export const createCourseValidator = createFormValidator(createCourseSchema);
export const notificationPreferencesValidator = createFormValidator(notificationPreferencesSchema);
export const searchValidator = createFormValidator(searchSchema);

export default {
  // Schemas
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileUpdateSchema,
  profileSettingsSchema,
  createPostSchema,
  updatePostSchema,
  commentSchema,
  shareSchema,
  createStorySchema,
  viewStorySchema,
  sendMessageSchema,
  createConversationSchema,
  createGroupSchema,
  updateGroupSchema,
  groupSettingsSchema,
  notificationPreferencesSchema,
  searchSchema,
  uploadImageSchema,
  uploadVideoSchema,
  uploadDocumentSchema,
  createEventSchema,
  createCourseSchema,
  adminUserActionSchema,
  adminReportActionSchema,
  // Helpers
  validate,
  validateOrThrow,
  createFormValidator,
  // Pre-built validators
  loginValidator,
  registerValidator,
  profileUpdateValidator,
  createPostValidator,
  createStoryValidator,
  sendMessageValidator,
  createGroupValidator,
  createEventValidator,
  createCourseValidator,
  notificationPreferencesValidator,
  searchValidator,
};