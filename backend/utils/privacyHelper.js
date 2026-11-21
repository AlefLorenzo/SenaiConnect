/**
 * Privacy Helper - Centralized privacy enforcement logic
 *
 * Profile visibility rules:
 * - public: Anyone can see
 * - professor: Only professors can see
 * - private: Only the user themselves can see
 * - Own profile: Always visible to self
 *
 * Email visibility:
 * - privacy_showEmail = true: Email visible
 * - privacy_showEmail = false: Email hidden (returns null)
 */

const db = require('../db');

/**
 * Check if viewer can see target user's profile
 * @param {number} viewerId - ID of user viewing
 * @param {number} targetId - ID of user being viewed
 * @param {Object} targetUser - Target user object with privacy settings
 * @returns {boolean}
 */
function canViewProfile(viewerId, targetId, targetUser) {
    // Own profile always visible
    if (viewerId === targetId) return true;

    const privacy = targetUser.privacy_showProfile || 'public';
    const viewerRole = targetUser.viewerRole; // Will be set by caller

    switch (privacy) {
        case 'public':
            return true;
        case 'professor':
            return viewerRole === 'professor' || viewerRole === 'admin';
        case 'private':
            return false;
        default:
            return true; // Default to public
    }
}

/**
 * Check if viewer can see target user's email
 * @param {number} viewerId - ID of user viewing
 * @param {number} targetId - ID of user being viewed
 * @param {Object} targetUser - Target user object with privacy settings
 * @returns {boolean}
 */
function canViewEmail(viewerId, targetId, targetUser) {
    // Own email always visible
    if (viewerId === targetId) return true;
    return targetUser.privacy_showEmail === true || targetUser.privacy_showEmail === 1;
}

/**
 * Get privacy-filtered user profile data
 * @param {Object} user - Raw user object from database
 * @param {number} viewerId - ID of user viewing (or null for unauthenticated)
 * @returns {Object} Filtered user object
 */
function filterUserProfile(user, viewerId) {
    if (!user) return null;

    const canView = viewerId ? canViewProfile(viewerId, user.id, { ...user, viewerRole: user.viewerRole }) : false;
    const canViewEmailFlag = viewerId ? canViewEmail(viewerId, user.id, user) : false;

    const filtered = {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        cover_image: user.cover_image,
        state: user.state,
        city: user.city,
        unit: user.unit,
        area: user.area,
        course: user.course,
        links: user.links,
        skills: user.skills,
        created_at: user.created_at,
        xp: user.xp,
        level: user.level,
        is_business_owner: user.is_business_owner,
        // Privacy metadata for frontend
        _privacy: {
            profileVisibility: user.privacy_showProfile || 'public',
            emailVisible: canViewEmailFlag
        }
    };

    // Only include email if allowed
    if (canViewEmailFlag) {
        filtered.email = user.email;
    }

    // If profile is not viewable, return minimal info
    if (!canView) {
        return {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            _privacy: {
                profileVisibility: user.privacy_showProfile || 'public',
                emailVisible: false,
                restricted: true
            }
        };
    }

    return filtered;
}

/**
 * Build SQL WHERE clause for privacy filtering in queries
 * @param {number} viewerId - ID of user making the request
 * @param {string} tableAlias - Table alias for users table (default 'u')
 * @returns {string} SQL WHERE clause
 */
function buildPrivacyWhereClause(viewerId, tableAlias = 'u') {
    if (!viewerId) {
        // Unauthenticated users can only see public profiles
        return `${tableAlias}.privacy_showProfile = 'public'`;
    }

    return `(
        ${tableAlias}.privacy_showProfile = 'public'
        OR ${tableAlias}.id = ${viewerId}
        OR (${tableAlias}.privacy_showProfile = 'professor' AND EXISTS (
            SELECT 1 FROM users WHERE id = ${viewerId} AND (role = 'professor' OR role = 'admin')
        ))
    )`;
}

/**
 * Build SQL SELECT clause for email with privacy
 * @param {number} viewerId - ID of user making the request
 * @param {string} tableAlias - Table alias for users table (default 'u')
 * @returns {string} SQL SELECT expression for email
 */
function buildEmailSelectClause(viewerId, tableAlias = 'u') {
    if (!viewerId) {
        return 'NULL as email';
    }
    return `CASE WHEN ${tableAlias}.privacy_showEmail = 1 OR ${tableAlias}.id = ${viewerId} THEN ${tableAlias}.email ELSE NULL END as email`;
}

/**
 * Build SQL SELECT clause for profile visibility check
 * @param {number} viewerId - ID of user making the request
 * @param {string} tableAlias - Table alias for users table (default 'u')
 * @returns {string} SQL SELECT expression for profile visibility
 */
function buildProfileVisibilityClause(viewerId, tableAlias = 'u') {
    if (!viewerId) {
        return `${tableAlias}.privacy_showProfile as profile_visibility, FALSE as profile_visible`;
    }
    return `
        ${tableAlias}.privacy_showProfile as profile_visibility,
        CASE
            WHEN ${tableAlias}.id = ${viewerId} THEN TRUE
            WHEN ${tableAlias}.privacy_showProfile = 'public' THEN TRUE
            WHEN ${tableAlias}.privacy_showProfile = 'professor' AND EXISTS (
                SELECT 1 FROM users WHERE id = ${viewerId} AND (role = 'professor' OR role = 'admin')
            ) THEN TRUE
            ELSE FALSE
        END as profile_visible
    `;
}

module.exports = {
    canViewProfile,
    canViewEmail,
    filterUserProfile,
    buildPrivacyWhereClause,
    buildEmailSelectClause,
    buildProfileVisibilityClause
};