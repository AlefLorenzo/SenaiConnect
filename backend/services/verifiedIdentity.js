'use strict';

const crypto = require('crypto');
const db = require('../db');
const { supabaseAuthRequest } = require('./supabaseAuth');

const identityCache = new Map();
const identityRequests = new Map();
const MAX_CACHE_ENTRIES = 5000;
const DEFAULT_CACHE_TTL_MS = 15000;

function cacheTtlMs() {
  const configured = Number(process.env.AUTH_IDENTITY_CACHE_TTL_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_CACHE_TTL_MS;
  return Math.min(30000, Math.max(1000, configured));
}

function unauthorizedError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function tokenFingerprint(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function loadIdentity(token) {
  const authUser = await supabaseAuthRequest('user', {
    method: 'GET',
    accessToken: token
  });

  if (!authUser || !authUser.id) {
    throw unauthorizedError(401, 'Sessão inválida. Entre novamente.');
  }

  const [profiles] = await db.query(
    'SELECT id, name, email, role, admin_role, unit_id, is_blocked, onboarding_completed FROM users WHERE auth_user_id = ?',
    [authUser.id]
  );

  if (!profiles.length) {
    throw unauthorizedError(403, 'Sua conta Auth ainda não está vinculada a um perfil SENAI Connect.');
  }

  const profile = profiles[0];
  if (profile.is_blocked) {
    throw unauthorizedError(403, 'Esta conta está bloqueada.');
  }

  return {
    authUser,
    user: {
      id: profile.id,
      authUserId: authUser.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      admin_role: profile.admin_role,
      unit_id: profile.unit_id,
      onboarding_completed: profile.onboarding_completed
    }
  };
}

function rememberIdentity(key, identity) {
  if (!identityCache.has(key) && identityCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = identityCache.keys().next().value;
    if (oldestKey) identityCache.delete(oldestKey);
  }

  identityCache.delete(key);
  identityCache.set(key, {
    identity,
    expiresAt: Date.now() + cacheTtlMs()
  });
}

/**
 * Resolve Supabase identity once per short token window and coalesce concurrent
 * requests. Only a SHA-256 fingerprint is kept in memory; the bearer token itself
 * is never cached. The short TTL limits the delay before block/revocation changes
 * take effect while removing duplicate Auth + profile round trips during page loads.
 */
async function getVerifiedIdentity(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) throw unauthorizedError(401, 'Token de acesso não fornecido.');

  const key = tokenFingerprint(token);
  const cached = identityCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    // Refresh insertion order for bounded LRU eviction.
    identityCache.delete(key);
    identityCache.set(key, cached);
    return cached.identity;
  }

  if (cached) identityCache.delete(key);

  const pending = identityRequests.get(key);
  if (pending) return pending;

  const request = loadIdentity(token);
  identityRequests.set(key, request);

  try {
    const identity = await request;
    rememberIdentity(key, identity);
    return identity;
  } finally {
    if (identityRequests.get(key) === request) {
      identityRequests.delete(key);
    }
  }
}

function clearIdentityCache() {
  identityCache.clear();
  identityRequests.clear();
}

module.exports = { getVerifiedIdentity, clearIdentityCache };
