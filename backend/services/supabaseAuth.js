'use strict';

require('dotenv').config();

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    const error = new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente do backend.');
    error.status = 503;
    throw error;
  }

  return { url, apiKey };
}

async function supabaseAuthRequest(path, options = {}) {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.apiKey,
    'Content-Type': 'application/json',
    ...(options.accessToken ? { Authorization: 'Bearer ' + options.accessToken } : {})
  };

  let response;
  try {
    response = await fetch(config.url + '/auth/v1/' + path, {
      method: options.method || 'POST',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
    });
  } catch (cause) {
    const error = new Error('Não foi possível alcançar o Supabase Auth. Verifique a URL e a conexão do servidor.');
    error.status = 503;
    error.cause = cause;
    throw error;
  }

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
  }

  if (!response.ok) {
    const error = new Error(
      data.msg || data.message || data.error_description || data.error ||
      'O Supabase Auth recusou a solicitação.'
    );
    error.status = response.status;
    error.code = data.code || data.error_code || null;
    throw error;
  }

  return data;
}

module.exports = { getSupabaseConfig, supabaseAuthRequest };
