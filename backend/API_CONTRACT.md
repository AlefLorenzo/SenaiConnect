# API Contract - Messaging Infrastructure

## Overview
This document describes the REST API endpoints and Socket.IO events for the messaging system in the Rede Social SENAI platform.

---

## REST API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

### Conversations

#### GET /messages/conversations
Get all conversations (individual + groups) for the authenticated user.

**Query Parameters:**
- `type` (optional): `all` | `individual` | `groups` - Filter by conversation type

**Response:**
```json
{
  "data": [
    {
      "conversation_id": 123,
      "isGroup": false,
      "participants": [
        { "id": 1, "name": "Você", "avatar": null, "isOnline": true },
        { "id": 2, "name": "Maria Silva", "avatar": "url", "role": "student", "isOnline": true, "lastSeen": "2024-01-15T10:30:00Z", "lastSeenPrivacy": "everyone" }
      ],
      "last_message": {
        "content": "Olá! Tudo bem?",
        "senderName": "Maria Silva",
        "type": "text",
        "status": "read",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "unreadCount": 0,
      "updatedAt": "2024-01-15T10:30:00Z",
      "isPinned": false,
      "isMuted": false,
      "isImportant": false
    },
    {
      "conversation_id": 101,
      "isGroup": true,
      "name": "Dev Team SENAI",
      "description": "Equipe de desenvolvimento",
      "avatar": "url",
      "participants": [
        { "id": 1, "name": "Você", "avatar": null, "role": "admin", "isOnline": true },
        { "id": 2, "name": "Maria Silva", "avatar": "url", "role": "member", "isOnline": true }
      ],
      "adminIds": [1],
      "last_message": {
        "content": "Deploy agendado para amanhã",
        "senderName": "Ana Carolina",
        "type": "text",
        "status": "read",
        "createdAt": "2024-01-15T10:25:00Z"
      },
      "unreadCount": 5,
      "updatedAt": "2024-01-15T10:25:00Z",
      "isPinned": false,
      "isMuted": false,
      "isImportant": true
    }
  ]
}
```

#### GET /messages/conversations/:id
Get conversation details by ID.

**Response (Individual):**
```json
{
  "id": 2,
  "isGroup": false,
  "participants": [
    { "id": 1, "name": "Você", "avatar": null, "isOnline": true },
    { "id": 2, "name": "Maria Silva", "avatar": "url", "role": "student", "isOnline": true, "lastSeen": "2024-01-15T10:30:00Z", "lastSeenPrivacy": "everyone" }
  ]
}
```

**Response (Group):**
```json
{
  "id": 101,
  "isGroup": true,
  "name": "Dev Team SENAI",
  "description": "Equipe de desenvolvimento",
  "avatar": "url",
  "participants": [
    { "id": 1, "name": "Você", "avatar": null, "role": "admin", "isOnline": true, "lastSeen": null },
    { "id": 2, "name": "Maria Silva", "avatar": "url", "role": "member", "isOnline": true, "lastSeen": null }
  ],
  "adminIds": [1],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /messages/conversations/:id/history
Get paginated message history for a conversation.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": 101,
      "conversationId": 1,
      "senderId": 2,
      "senderName": "Maria Silva",
      "senderAvatar": "url",
      "content": "Olá! Tudo bem?",
      "type": "text",
      "message_type": "text",
      "status": "read",
      "createdAt": "2024-01-15T10:30:00Z",
      "mediaUrl": null,
      "fileName": null,
      "fileSize": null,
      "fileType": null
    }
  ],
  "contact": {
    "id": 2,
    "isGroup": false,
    "name": "Maria Silva",
    "avatar": "url",
    "participants": [...]
  },
  "isGroup": false,
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "hasMore": false
  }
}
```

#### POST /messages/conversations
Create a new individual conversation.

**Request Body:**
```json
{
  "participantId": 2
}
```

**Response:**
```json
{
  "id": 2,
  "isGroup": false,
  "participants": [...],
  "last_message": null,
  "unreadCount": 0,
  "updatedAt": "2024-01-15T10:30:00Z",
  "isPinned": false,
  "isMuted": false,
  "isImportant": false
}
```

---

### Messages

#### POST /messages/conversations/:id/messages
Send a message to a conversation (individual or group).

**Request Body (multipart/form-data or JSON):**
```json
{
  "content": "Mensagem de texto",
  "type": "text", // text, image, document, file
  "mediaUrl": "https://...", // optional
  "fileName": "documento.pdf", // optional
  "fileSize": 1024000, // optional
  "fileType": "application/pdf", // optional
  "attachments": [ // optional, for multiple files
    {
      "mediaUrl": "https://...",
      "messageType": "image",
      "fileName": "foto.jpg",
      "fileSize": 512000,
      "fileType": "image/jpeg"
    }
  ],
  "clientMessageId": "uuid-v4" // optional, for deduplication
}
```

**Response (201):**
```json
{
  "id": 1001,
  "conversationId": 1,
  "senderId": 1,
  "senderName": "Você",
  "senderAvatar": null,
  "content": "Mensagem de texto",
  "type": "text",
  "message_type": "text",
  "status": "enviada",
  "createdAt": "2024-01-15T10:30:00Z",
  "mediaUrl": null,
  "fileName": null,
  "fileSize": null,
  "fileType": null
}
```

#### POST /messages/messages/upload
Upload media file for messages.

**Request:** multipart/form-data with `file` field

**Response:**
```json
{
  "url": "/uploads/messages/1705321234-foto.jpg",
  "fileName": "foto.jpg",
  "fileSize": 1024000,
  "fileType": "image/jpeg"
}
```

#### POST /messages/conversations/:id/read
Mark messages as read in a conversation.

**Response:**
```json
{ "success": true }
```

---

### Typing Indicators

#### POST /messages/conversations/:id/typing/start
Send typing start indicator.

**Request Body:**
```json
{
  "conversationId": 1
}
```

**Response:**
```json
{ "success": true }
```

#### POST /messages/conversations/:id/typing/stop
Send typing stop indicator.

**Request Body:**
```json
{
  "conversationId": 1
}
```

**Response:**
```json
{ "success": true }
```

---

### Groups

#### GET /groups/my-groups
Get authenticated user's groups with full details.

**Response:**
```json
[
  {
    "id": 101,
    "name": "Dev Team SENAI",
    "description": "Equipe de desenvolvimento",
    "avatar": "url",
    "members_count": 7,
    "role": "admin",
    "is_muted": false,
    "is_important": true,
    "participants": [...],
    "adminIds": [1],
    "last_message": {...},
    "unreadCount": 5,
    "updatedAt": "2024-01-15T10:25:00Z"
  }
]
```

#### GET /groups
Get all public groups (for discovery).

#### POST /groups
Create a new group.

**Request Body:**
```json
{
  "name": "Novo Grupo",
  "description": "Descrição do grupo",
  "icon": "https://...", // optional
  "participants": [2, 3, 4] // optional, initial members
}
```

**Response:**
```json
{ "id": 102, "message": "Grupo criado com sucesso!" }
```

#### GET /groups/:id
Get group details.

#### POST /groups/:id/join
Join a group.

#### POST /groups/:id/leave
Leave a group.

#### GET /groups/:id/members
Get group members.

#### POST /groups/:id/members
Add members to group (admin only).

**Request Body:**
```json
{ "userIds": [5, 6] }
```

#### DELETE /groups/:id/members/:userId
Remove member from group (admin only or self).

#### POST /groups/:id/mute
Mute/unmute group notifications.

**Request Body:**
```json
{ "mute": true }
```

#### POST /groups/:id/important
Mark group as important/unimportant.

**Request Body:**
```json
{ "important": true }
```

---

## Socket.IO Events

### Connection
```javascript
const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  socket.emit('register', userId);
});
```

### Client → Server Events

| Event | Data | Description |
|-------|------|-------------|
| `register` | `userId: number` | Register user socket |
| `join_conversation` | `conversationId: number` | Join conversation for typing indicators |
| `leave_conversation` | `conversationId: number` | Leave conversation |
| `typing_start` | `{ conversationId, receiverId? }` | User started typing |
| `typing_stop` | `{ conversationId }` | User stopped typing |
| `messages_read` | `{ conversationId, byUserId }` | Messages marked as read |

### Server → Client Events

| Event | Data | Description |
|-------|------|-------------|
| `new_message` | `Message` | New message received |
| `typing_start` | `{ conversationId, userId, userName }` | User started typing |
| `typing_stop` | `{ conversationId, userId }` | User stopped typing |
| `messages_read` | `{ conversationId, byUserId }` | Messages read by user |
| `user_online` | `{ userId, isOnline: boolean }` | User presence changed |
| `conversation_created` | `{ conversation: Conversation }` | New conversation created |
| `group_updated` | `{ groupId, action, members, addedUserIds?, removedUserId? }` | Group membership changed |

### Event Payloads

#### new_message
```json
{
  "id": 1001,
  "conversationId": 1,
  "senderId": 2,
  "senderName": "Maria Silva",
  "senderAvatar": "url",
  "content": "Olá!",
  "type": "text",
  "message_type": "text",
  "status": "enviada",
  "createdAt": "2024-01-15T10:30:00Z",
  "mediaUrl": null,
  "fileName": null,
  "fileSize": null,
  "fileType": null
}
```

#### typing_start
```json
{
  "conversationId": 1,
  "userId": 2,
  "userName": "Maria Silva"
}
```

#### typing_stop
```json
{
  "conversationId": 1,
  "userId": 2
}
```

#### messages_read
```json
{
  "conversationId": 1,
  "byUserId": 2
}
```

#### user_online
```json
{
  "userId": 2,
  "isOnline": true
}
```

#### conversation_created
```json
{
  "conversation": {
    "id": 102,
    "isGroup": true,
    "name": "Novo Grupo",
    "description": "Descrição",
    "avatar": "url",
    "participants": [...],
    "adminIds": [1],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### group_updated
```json
{
  "groupId": 101,
  "action": "member_joined", // member_joined, member_left, members_added, member_removed
  "userId": 5,
  "addedUserIds": [5, 6],
  "removedUserId": 3,
  "members": [...]
}
```

---

## Data Models

### Message
```typescript
interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'document' | 'file';
  message_type: 'text' | 'image' | 'document' | 'file';
  status: 'enviada' | 'entregue' | 'lida' | 'sent' | 'delivered' | 'read';
  createdAt: string; // ISO 8601
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  replyTo?: { id: number; content: string; senderName: string };
  isEdited?: boolean;
  editedAt?: string;
  deletedForEveryone?: boolean;
  deletedAt?: string;
}
```

### Conversation
```typescript
interface Conversation {
  conversation_id: number;
  isGroup: boolean;
  // Individual
  participants?: User[];
  // Group
  name?: string;
  description?: string;
  avatar?: string;
  adminIds?: number[];
  participants?: Participant[];
  // Common
  last_message?: MessagePreview;
  unreadCount: number;
  updatedAt: string;
  isPinned: boolean;
  isMuted: boolean;
  isImportant: boolean;
}
```

### Participant
```typescript
interface Participant {
  id: number;
  name: string;
  avatar?: string;
  role: 'admin' | 'member';
  isOnline: boolean;
  lastSeen?: string;
}
```

### Group
```typescript
interface Group {
  id: number;
  name: string;
  description?: string;
  avatar?: string;
  members_count: number;
  role: 'admin' | 'member';
  is_muted: boolean;
  is_important: boolean;
  participants: Participant[];
  adminIds: number[];
  last_message?: MessagePreview;
  unreadCount: number;
  updatedAt: string;
}
```

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Descrição do erro"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not a member, not admin, etc.)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Rate Limiting

- **Message sending**: 30 messages per minute per user
- **API requests**: Standard Express rate limiting (configurable)

---

## File Upload

- **Max image size**: 10MB
- **Max document size**: 25MB
- **Allowed image types**: JPEG, PNG, GIF, WebP, HEIC
- **Allowed document types**: PDF, DOC, DOCX, TXT, ZIP
- **Storage**: Local filesystem at `/uploads/messages/`
- **Access**: Static files served at `/uploads/messages/<filename>`

---

## Security

### Input Sanitization
All message content is sanitized to prevent XSS:
- HTML entities encoded (`<`, `>`, `&`, `"`, `'`, `/`)
- No script execution possible

### Authorization
- Users only access conversations they're part of
- Group operations require membership
- Admin operations require admin role
- File access via authenticated endpoints

### Data Validation
- File type validation on upload
- File size limits enforced
- Message content length limits (configurable)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-15 | Initial API contract |
| 1.1.0 | 2024-01-15 | Added conversation_created, group_updated events; fixed endpoint paths; added rate limiting; added XSS sanitization |