-- Restrict Supabase client reads to safe profile fields.
-- Direct backend access remains server-side; PostgREST authenticated clients
-- can only read their own row through users_select_own_profile.
REVOKE SELECT ON TABLE public.users FROM authenticated;

GRANT SELECT (
    id, name, username, email, role, admin_role, unit_id, avatar, cover_image, bio,
    state, city, unit, area, course, links, skills, skills_to_learn, interests, objective,
    settings, notification_prefs, accessibility_prefs, privacy_showprofile, privacy_showemail,
    is_private, hide_email, is_blocked, is_business_owner, business_id,
    onboarding_completed, is_verified, is_online, last_seen, last_seen_privacy,
    xp, level, deleted_at, created_at, updated_at
) ON TABLE public.users TO authenticated;
