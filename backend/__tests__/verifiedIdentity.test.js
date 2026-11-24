'use strict';

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../services/supabaseAuth', () => ({
  supabaseAuthRequest: jest.fn()
}));

const db = require('../db');
const { supabaseAuthRequest } = require('../services/supabaseAuth');
const { getVerifiedIdentity, clearIdentityCache } = require('../services/verifiedIdentity');

describe('verified identity cache', () => {
  beforeEach(() => {
    clearIdentityCache();
    jest.clearAllMocks();
    jest.useRealTimers();

    supabaseAuthRequest.mockResolvedValue({ id: 'auth-user-1', email: 'aluno@example.com' });
    db.query.mockResolvedValue([[
      {
        id: 42,
        name: 'Aluno',
        email: 'aluno@example.com',
        role: 'aluno',
        admin_role: null,
        unit_id: 1,
        is_blocked: false,
        onboarding_completed: true
      }
    ]]);
  });

  afterEach(() => {
    jest.useRealTimers();
    clearIdentityCache();
  });

  test('reuses successful Auth and profile validation for the same token', async () => {
    const first = await getVerifiedIdentity('token-a');
    const second = await getVerifiedIdentity('token-a');

    expect(first.user).toEqual(second.user);
    expect(supabaseAuthRequest).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('coalesces simultaneous requests so they share one Auth round trip', async () => {
    let resolveAuth;
    supabaseAuthRequest.mockImplementation(() => new Promise(resolve => {
      resolveAuth = resolve;
    }));

    const first = getVerifiedIdentity('token-b');
    const second = getVerifiedIdentity('token-b');

    expect(supabaseAuthRequest).toHaveBeenCalledTimes(1);
    resolveAuth({ id: 'auth-user-1' });

    const [firstIdentity, secondIdentity] = await Promise.all([first, second]);
    expect(firstIdentity.user.id).toBe(42);
    expect(secondIdentity.user.id).toBe(42);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('revalidates the token after the short cache window expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-21T12:00:00Z'));

    await getVerifiedIdentity('token-c');
    jest.advanceTimersByTime(16000);
    await getVerifiedIdentity('token-c');

    expect(supabaseAuthRequest).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  test('does not cache blocked or unlinked profiles', async () => {
    db.query.mockResolvedValue([[{
      id: 42,
      name: 'Aluno',
      is_blocked: true
    }]]);

    await expect(getVerifiedIdentity('token-d')).rejects.toMatchObject({ status: 403 });
    await expect(getVerifiedIdentity('token-d')).rejects.toMatchObject({ status: 403 });

    expect(supabaseAuthRequest).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
