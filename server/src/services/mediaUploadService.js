import fs from 'fs';
import path from 'path';

export async function storeMediaFile(buffer, mimetype, originalname, options = {}) {
  const {
    storageClient = null,
    uploadDir = path.join(process.cwd(), 'uploads'),
    publicBaseUrl = '/uploads',
    prefix = 'reports',
  } = options;

  const ext = originalname?.split('.').pop() || 'bin';
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
