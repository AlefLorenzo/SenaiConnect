const fs = require('fs');
const path = require('path');

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

const uploadController = {
  uploadFile: async (req, res) => {
    try {
      const { file, name, folder } = req.body || {};
      if (typeof file !== 'string' || !file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      // Accept only a well-formed Base64 data URI. Do not trust an extension
      // supplied by the browser; the stored extension is derived from MIME.
      const matches = file.match(/^data:([A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Formato de arquivo inválido.' });
      }

      const mimeType = matches[1].toLowerCase();
      const base64Data = matches[2].replace(/\s/g, '');
      const extension = MIME_EXTENSIONS[mimeType];
      if (!extension) {
        return res.status(400).json({ error: `Tipo de arquivo não permitido: ${mimeType}` });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.length) {
        return res.status(400).json({ error: 'O arquivo enviado está vazio ou inválido.' });
      }

      const maxSize = 5 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return res.status(400).json({ error: 'O tamanho máximo do arquivo é 5MB.' });
      }

      const folderName = ALLOWED_FOLDERS.has(folder) ? folder : 'notices';
      const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
      const uploadsDir = path.resolve(uploadsRoot, folderName);
      if (!uploadsDir.startsWith(uploadsRoot + path.sep)) {
        return res.status(400).json({ error: 'Pasta de destino inválida.' });
      }
      fs.mkdirSync(uploadsDir, { recursive: true });

      const baseName = path.basename(String(name || 'arquivo'), path.extname(String(name || '')));
      const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'arquivo';
      const randomSuffix = require('crypto').randomBytes(8).toString('hex');
      const fileName = `${Date.now()}_${randomSuffix}_${safeBaseName}.${extension}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, buffer, { flag: 'wx' });

      const urlPath = `uploads/${folderName}/${encodeURIComponent(fileName)}`;
      const host = req.get('host');
      if (!host) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Não foi possível determinar o endereço público do arquivo.' });
      }
      const publicUrl = `${req.protocol}://${host}/${urlPath}`;

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
      return res.status(500).json({ error: 'Erro interno no servidor ao processar upload.' });
    }
  }
};

module.exports = uploadController;
