import fs from 'fs';
import path from 'path';

const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/x-wav'
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function storeMediaFile(buffer, mimetype, originalname, options = {}) {
  if (buffer && buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds maximum limit of 25MB');
  }

  const ext = (originalname?.split('.').pop() || 'bin').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIMETYPES.includes(mimetype)) {
    throw new Error('Unsupported file type or extension');
  }

  const {
    storageClient = null,
    uploadDir = path.join(process.cwd(), 'uploads'),
    publicBaseUrl = '/uploads',
    prefix = 'reports',
  } = options;

  const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

  if (storageClient) {
    try {
      const file = storageClient.file(`${prefix}/${filename}`);
      await file.save(buffer, { contentType: mimetype });
      await file.makePublic();
      return {
        url: `https://storage.googleapis.com/${storageClient.name}/${prefix}/${filename}`,
        filename,
        storedLocally: false,
      };
    } catch (err) {
      console.warn(`[MediaUpload] Firebase Storage upload failed, falling back to local file: ${err.message}`);
    }
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fs.writeFileSync(path.join(uploadDir, filename), buffer);

  return {
    url: `${publicBaseUrl}/${filename}`,
    filename,
    storedLocally: true,
  };
}
