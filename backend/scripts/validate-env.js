'use strict';

require('dotenv').config();

const errors = [];

function hasValue(name) {
  const value = String(process.env[name] || '').trim();
  return value.length > 0 && !/^(COLE_AQUI.*|CHANGEME.*|CHANGE_ME.*|YOUR_.*|\[.*\])$/i.test(value);
}

function requireOneOf(names, label) {
  if (!names.some(hasValue)) {
    errors.push(label + ': configure uma destas variáveis: ' + names.join(' ou '));
  }
}

function validateUrl(name, allowedProtocols) {
  if (!hasValue(name)) return;

  try {
    const parsed = new URL(process.env[name]);
    if (!allowedProtocols.includes(parsed.protocol)) {
      errors.push(name + ': protocolo inválido.');
    }
    if (!parsed.hostname) {
      errors.push(name + ': host ausente.');
    }
  } catch {
    errors.push(name + ': informe uma URL válida.');
  }
}

requireOneOf(['SUPABASE_URL'], 'Supabase Auth');
requireOneOf(['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'], 'Chave pública do Supabase');
requireOneOf(['DATABASE_URL', 'SUPABASE_DB_URL'], 'Banco PostgreSQL');

validateUrl('SUPABASE_URL', ['https:', 'http:']);

const databaseUrl = hasValue('DATABASE_URL')
  ? process.env.DATABASE_URL
  : (hasValue('SUPABASE_DB_URL') ? process.env.SUPABASE_DB_URL : '');
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      errors.push('DATABASE_URL: use uma URI PostgreSQL (postgres:// ou postgresql://).');
    }
    if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
      errors.push('DATABASE_URL: confira host e nome do banco na URI.');
    }
  } catch {
    errors.push('DATABASE_URL: URI inválida. Copie novamente em Supabase > Connect.');
  }
}

if (process.env.PORT && (!Number.isInteger(Number(process.env.PORT)) || Number(process.env.PORT) < 1 || Number(process.env.PORT) > 65535)) {
  errors.push('PORT: informe um número entre 1 e 65535.');
}

if (errors.length > 0) {
  console.error('\n[ SENAI Connect ] Configuração incompleta:');
  errors.forEach((error) => console.error(' - ' + error));
  console.error('\nRevise o arquivo backend/.env. Nenhum valor secreto foi exibido.\n');
  process.exit(1);
}

console.log('[ SENAI Connect ] Variáveis obrigatórias encontradas e URLs validadas.');
