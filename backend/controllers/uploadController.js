const crypto = require('crypto');

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

const ALLOWED_FOLDERS = new Set(['notices', 'courses', 'events', 'posts', 'avatars']);
const BUCKET = 'senai-connect-media';

function getStorageConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error('Armazenamento de mídia não configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY no backend.');
    error.status = 503;
    throw error;
  }
  return { url, key };
}

const uploadController = {
  uploadFile: async (req, res) => {
    try {
      const { file, name, folder } = req.body || {};
      if (typeof file !== 'string' || !file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      const matches = file.match(/^data:([A-Za-z0-9.+-]+\\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\\r\\n]+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Formato de arquivo inválido.' });
      }

      const mimeType = matches[1].toLowerCase();
      const base64Data = matches[2].replace(/\\s/g, '');
      const extension = MIME_EXTENSIONS[mimeType];
      if (!extension) {
        return res.status(400).json({ error: `Tipo de arquivo não permitido: ${mimeType}` });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.length) {
        return res.status(400).json({ error: 'O arquivo enviado está vazio ou inválido.' });
      }
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'O tamanho máximo do arquivo é 5MB.' });
      }

      const requestedFolder = folder || (req.user?.admin_role ? 'notices' : 'posts');
      if (!ALLOWED_FOLDERS.has(requestedFolder)) {
        return res.status(400).json({ error: 'Pasta de destino inválida.' });
      }
      if (['notices', 'courses', 'events'].includes(requestedFolder) && !req.user?.admin_role) {
        return res.status(403).json({ error: 'Apenas administradores podem enviar arquivos institucionais.' });
      }

      const baseName = pathSafeName(name);
      const fileName = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}_${baseName}.${extension}`;
      const objectPath = `${requestedFolder}/${fileName}`;
      const { url, key } = getStorageConfig();
      const uploadUrl = `${url}/storage/v1/object/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': mimeType,
          'Content-Length': String(buffer.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-upsert': 'false'
        },
        body: buffer
      });

      if (!response.ok) {
        const details = await response.text();
        console.error('Supabase Storage upload failed:', response.status, details.slice(0, 500));
        return res.status(502).json({ error: 'Não foi possível salvar a imagem no armazenamento permanente. Tente novamente.' });
      }

      const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
      return res.status(201).json({
        message: 'Upload realizado com sucesso!',
        url: publicUrl,
        name: fileName,
        original_name: String(name || 'arquivo'),
        type: mimeType,
        size: buffer.length
      });
    } catch (error) {
      console.error('Erro no upload:', error);
      return res.status(error.status || 500).json({
        error: error.status ? error.message : 'Erro interno no servidor ao processar upload.'
      });
    }
  }
};

function pathSafeName(value) {
  const original = String(value || 'arquivo');
  const withoutExtension = original.replace(/\\.[^.]+$/, '');
  return withoutExtension.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'arquivo';
}

module.exports = uploadController;
