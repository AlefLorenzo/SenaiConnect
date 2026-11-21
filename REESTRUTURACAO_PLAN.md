# SENAI Connect - REESTRUTURAÇÃO Implementation Plan

## Executive Summary

Based on thorough codebase audit (Phase 1 Diagnóstico), this plan addresses the 18-point REESTRUTURAÇÃO specification to achieve production-ready SENAI Connect with Instagram/WhatsApp usability while maintaining visual identity.

**Current State**: Functional but significant gaps in privacy enforcement, Stories lifecycle, Feed access, Settings persistence, and mock data substitution.

---

## Phase 2: Planejamento - Detailed Findings & Prioritization

### Critical Findings from Audit

| Area | Current State | Required | Gap Severity |
|------|---------------|----------|--------------|
| **Privacy/Visibility** | Frontend-only CSS hiding | Backend enforcement in queries | 🔴 CRITICAL |
| **Stories Lifecycle** | Frontend mock only, no expiration | Full backend: create/view/expire/permissions | 🔴 CRITICAL |
| **Feed Icon (MobileBottomNav)** | Missing - 6 items only | Add Feed as leftmost icon | 🔴 CRITICAL |
| **Settings Page** | Local state only, no persistence | Backend sync, centralized gear on own profile | 🔴 CRITICAL |
| **Group Messaging** | Working but senderName hardcoded 'Unknown' | Fixed - senderName now works | ✅ RESOLVED |
| **Mock Data** | Extensive (storiesService, messagesService, groupsService) | Replace with real API calls | 🟡 HIGH |
| **Password Reset** | Backend exists, no frontend flow | Complete forgot/reset UI | 🟡 HIGH |
| **Socket Reliability** | Heartbeat, reconnect, offline queue | Verify edge cases | 🟢 MEDIUM |
| **Business/Admin** | Separate dashboards | Verify integration | 🟢 MEDIUM |
| **Accessibility** | Partial (ARIA labels, focus) | Full WCAG 2.1 AA | 🟢 MEDIUM |

---

### Implementation Priority Matrix

#### P0 - CRITICAL (Blockers for Production)
1. **Backend Privacy Enforcement** - Modify all controllers to filter by `privacy.showProfile` and `privacy.showEmail`
2. **Stories Backend Completion** - `storyController.js`: add expiration job, privacy checks, permissions
3. **Feed Icon in MobileBottomNav** - Add Feed as index 0, shift others right
4. **Settings Backend Sync** - Create `/api/settings` endpoints, persist theme/notifications/privacy
5. **Centralized Gear Icon** - Show only on own profile, link to Settings page

#### P1 - HIGH (Core Functionality)
6. **Mock Data Elimination** - Replace `storiesService`, `messagesService`, `groupsService` mock methods
7. **Password Reset Frontend** - ForgotPassword page + ResetPassword page with token validation
8. **Story Expiration Cron** - Daily job to mark expired stories, cleanup media
9. **Real-time Story Updates** - Socket events: `new_story`, `story_expired`, `story_deleted`

#### P2 - MEDIUM (Quality & Polish)
10. **Socket Edge Cases** - Test reconnection, message ordering, offline queue flush
11. **Accessibility Audit** - ARIA, focus management, color contrast, screen readers
12. **Performance** - Query optimization, pagination, caching headers
13. **Error Boundaries** - React error boundaries, graceful degradation

#### P3 - NICE TO HAVE
14. **Story Highlights** - Backend + frontend for profile highlights
15. **Advanced Search** - Filters, faceted search, autocomplete
16. **Analytics** - Event tracking (privacy-compliant)

---

## Phase 3: Implementação - Technical Approach

### 1. Backend Privacy Enforcement (P0)

**Files to Modify:**
- `backend/controllers/userController.js` - `getProfile`: filter fields based on privacy settings
- `backend/controllers/postController.js` - `getAll`: join users, filter by privacy
- `backend/controllers/storyController.js` - `getAll`: filter by privacy
- `backend/controllers/followController.js` - `isFollowing` helper for mutuals
- `backend/controllers/searchController.js` - `search`, `getSuggestions`: apply privacy filters
- `backend/controllers/messageController.js` - `getConversations`: respect privacy

**Privacy Logic:**
```sql
-- Profile visibility rules:
CASE 
  WHEN u.privacy_showProfile = 'public' THEN 1
  WHEN u.privacy_showProfile = 'professor' AND currentUser.role = 'professor' THEN 1
  WHEN u.privacy_showProfile = 'private' AND u.id = currentUser.id THEN 1
  WHEN u.id = currentUser.id THEN 1  -- Own profile always visible
  ELSE 0
END
```

**Email visibility:**
```sql
CASE 
  WHEN u.privacy_showEmail = 1 THEN u.email
  ELSE NULL
END
```

### 2. Stories Lifecycle Completion (P0)

**Backend (`backend/controllers/storyController.js`):**
- `create`: Insert with `expires_at = NOW() + INTERVAL 24 HOUR`
- `getAll`: Filter `WHERE expires_at > NOW()` AND privacy check
- `delete`: Owner check + cleanup media file
- Add `getUserStories(userId)` for profile highlights
- Add cron job: `DELETE FROM stories WHERE expires_at < NOW()`

**Frontend (`frontend/src/services/storiesService.js`):**
- Remove all mock implementations
- Implement real API calls with proper error handling
- Add cache invalidation on create/delete

**Socket Events:**
- `new_story` - broadcast to followers
- `story_expired` - notify viewers
- `story_deleted` - remove from viewers

### 3. Feed Icon in MobileBottomNav (P0)

**File:** `frontend/src/components/MobileBottomNav.jsx`

**Change:** Add Feed as index 0:
```javascript
const navItems = [
  { path: '/feed', icon: Home, label: 'Feed', testId: 'nav-feed', index: 0 },  // NEW
  { path: '/', icon: Home, label: 'Início', testId: 'nav-home', index: 1 },    // Renamed
  { path: '/explore', icon: Search, label: 'Explorar', testId: 'nav-explore', index: 2 },
  { path: '/create', icon: Plus, label: 'Criar', isCreate: true, testId: 'nav-create', index: 3 },
  { path: '/messages', icon: MessageCircle, label: 'Mensagens', testId: 'nav-messages', index: 4 },
  { path: '/activity', icon: Heart, label: 'Atividade', testId: 'nav-activity', index: 5 },
  { path: user ? `/profile/${user.id}` : '/login', icon: User, label: 'Perfil', testId: 'nav-profile', index: 6 },
];
```

**Route:** Create `/feed` route in `App.jsx` pointing to Feed page (or Home with feed filter).

### 4. Settings Centralization (P0)

**Backend - New Controller:** `backend/controllers/settingsController.js`
```javascript
// GET /api/settings - Get user settings
// PUT /api/settings - Update user settings
// Schema: theme, notifications (JSON), privacy (JSON)
```

**Backend - New Routes:** `backend/routes/settingsRoutes.js`
```javascript
router.get('/', authenticateToken, settingsController.getSettings);
router.put('/', authenticateToken, settingsController.updateSettings);
```

**Frontend - Settings Page (`frontend/src/pages/Settings.jsx`):**
- Load settings from backend on mount
- Save to backend on change (debounced)
- Remove local state, use server state
- Add loading/error states

**Profile Page (`frontend/src/pages/Profile.jsx`):**
- Show gear icon ONLY when `user.id === currentUser.id`
- Link to `/settings`

### 5. Mock Data Elimination (P1)

**Services to Fix:**
- `frontend/src/services/storiesService.js` - Remove all mock methods
- `frontend/src/services/messagesService.js` - Remove mock, use real API
- `frontend/src/services/groupsService.js` - Remove mock, use real API
- `frontend/src/services/postsService.js` - Verify real API usage

**Config:** `frontend/src/config/api.js` - Set `USE_MOCK = false` for production

### 6. Password Reset Frontend (P1)

**New Pages:**
- `frontend/src/pages/ForgotPassword.jsx` - Email input, send reset link
- `frontend/src/pages/ResetPassword.jsx` - Token validation, new password form

**Routes:** Add to `App.jsx`:
```jsx
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password/:token" element={<ResetPassword />} />
```

### 7. Story Expiration Cron (P1)

**Backend:** `backend/utils/storyCleanup.js`
```javascript
// Run daily at 3 AM
// DELETE FROM stories WHERE expires_at < NOW()
// Clean up orphaned media files in /uploads/stories/
```

**Deployment:** Add to `server.js` or separate cron process.

---

## Phase 4: Testes - Test Strategy

### Unit Tests (Jest + React Testing Library)
- Privacy filter functions (userController, postController, storyController)
- Settings validation and persistence
- Story expiration logic
- Message grouping (group-first, group-continue, group-last)

### Integration Tests
- Auth flow: register → login → me → logout
- Stories: create → view → expire → delete
- Messages: send → receive → read receipts → group sender grouping
- Settings: load → modify → persist → reload
- Follow: follow → unfollow → stats → status

### E2E Tests (Cypress/Playwright)
- **Privacy Test Matrix:**
  | Viewer | Target Privacy | Can See Profile | Can See Email |
  |--------|----------------|-----------------|---------------|
  | Self | any | ✅ | ✅ |
  | Student | public | ✅ | ❌ |
  | Student | professor | ❌ | ❌ |
  | Student | private | ❌ | ❌ |
  | Professor | public | ✅ | ❌ |
  | Professor | professor | ✅ | ❌ |
  | Professor | private | ❌ | ❌ |

- Mobile navigation swipe
- Story creation/viewing flow
- Group messaging with sender names
- Settings persistence across sessions

### Performance Tests
- Feed load time < 2s
- Story viewer < 500ms
- Message history pagination
- Socket reconnection < 3s

---

## Phase 5: Revisão Final - Checklist

### Code Review Checklist
- [ ] No hardcoded secrets (JWT_SECRET in env)
- [ ] No console.log in production code
- [ ] All mock implementations removed
- [ ] Privacy checks in ALL controllers
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize inputs)
- [ ] Rate limiting on all write endpoints
- [ ] Proper error handling (no stack traces to client)
- [ ] CORS configured for production domains only
- [ ] HTTPS enforcement

### Regression Checklist
- [ ] Login/register works
- [ ] Feed loads posts
- [ ] Stories create/view/expire
- [ ] Messages send/receive (individual + group)
- [ ] Groups create/join/leave/mute
- [ ] Profile view/edit
- [ ] Follow/unfollow
- [ ] Notifications real-time
- [ ] Settings persist
- [ ] Dark/light theme
- [ ] Mobile navigation (swipe + tap)
- [ ] Admin panel access control
- [ ] Business dashboard

### Production Build Verification
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] Bundle size acceptable
- [ ] Static assets optimized
- [ ] Environment variables configured

---

## Phase 6: Relatório - Deliverables

### Audit Report Structure
1. **Executive Summary** - Overall readiness score
2. **Findings by Category** - Security, UX, Architecture, Data
3. **Implementation Status Table** - 18-point spec mapping
4. **Test Results** - Unit, Integration, E2E, Privacy Matrix
5. **Production Checklist** - Go/No-Go criteria
6. **Known Limitations** - Technical debt, future work
7. **Deployment Guide** - Steps for responsible deploy

### Status Table Template
| Spec Point | Description | Status | Evidence | Notes |
|------------|-------------|--------|----------|-------|
| 1 | Backend privacy enforcement | 🔴 Not Started | - | Requires DB migration for privacy columns |
| 2 | Stories lifecycle (create/view/expire) | 🔴 Not Started | - | Backend + cron + frontend |
| 3 | Feed icon in MobileBottomNav | 🔴 Not Started | - | Route + nav item |
| 4 | Centralized gear on own profile | 🔴 Not Started | - | Profile.jsx + Settings.jsx |
| 5 | Settings backend persistence | 🔴 Not Started | - | New controller + routes |
| 6 | Mock data elimination | 🟡 Partial | storiesService, messagesService | 3 services |
| 7 | Password reset flow | 🟡 Backend only | passwordController.js | Frontend missing |
| ... | ... | ... | ... | ... |

---

## Dependencies & Blockers

### Database Migrations Needed
1. Add `privacy_showProfile` ENUM('public','professor','private') DEFAULT 'public' to `users`
2. Add `privacy_showEmail` BOOLEAN DEFAULT FALSE to `users`
3. Add `expires_at` DATETIME to `stories` (if not exists)
4. Add `settings` JSON column to `users` for theme/notifications/privacy

### Environment Variables
```env
# Backend
JWT_SECRET=<secure-random-64-char>
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<secure>
DB_NAME=redesocial
VITE_API_URL=http://localhost:5000
VITE_USE_MOCK=false

# Frontend
VITE_API_URL=http://localhost:5000
VITE_USE_MOCK=false
```

### Deployment Order
1. Database migrations
2. Backend deploy (with new controllers/routes)
3. Frontend build + deploy
4. Cron job setup (story cleanup)
5. Smoke tests
6. Monitor for 24h before full traffic

---

## Next Steps

1. **Immediate**: Create database migration for privacy columns
2. **Day 1-2**: Backend privacy enforcement + Stories lifecycle
3. **Day 2-3**: Settings backend + Frontend Settings page
4. **Day 3-4**: Feed icon + MobileBottomNav + Route
5. **Day 4-5**: Mock elimination + Password reset frontend
6. **Day 5-6**: Tests + Review + Report

---

*Plan created after comprehensive Phase 1 Diagnóstico audit. Ready for Phase 3 Implementação upon approval.*