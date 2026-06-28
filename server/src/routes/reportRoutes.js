import { Router } from 'express';
import multer from 'multer';
import { classifyMedia } from '../services/classificationService.js';
import { processReport } from '../agent/orchestrator.js';
import { broadcast } from '../services/sseService.js';
import { awardXP, getUser } from '../services/userService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import { storage } from '../config/firebase.js';
import { storeMediaFile } from '../services/mediaUploadService.js';

const router = Router();
const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/x-wav'
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPG/PNG/WEBP images, MP4/WEBM videos, and MP3/WAV/OGG audios are allowed.'), false);
    }
    cb(null, true);
  }
});

const reportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many reports from this IP, please try again later' } });

router.post('/', requireAuth, reportLimiter, upload.single('media'), async (req, res) => {
  try {
    const { text, lat, lng, reporter_name, report_id, address } = req.body;
    const reporter_id = req.user.id;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    let finalReporterName = 'Anonymous';
    if (reporter_id) {
      try {
        const user = await getUser(reporter_id);
        if (user && user.display_name) {
          finalReporterName = user.display_name;
        }
      } catch (err) {
        console.error('[Report] Failed to resolve reporter name:', err);
      }
    }
    if (finalReporterName === 'Anonymous' && reporter_name) {
      finalReporterName = reporter_name;
    }

    let classificationResult = null;
    let cloudVisionResult = null;
    let classificationAgreement = true;
    let mediaUrls = [];
    let mediaType = 'image';

    let mediaBase64 = null;
    let mediaMimeType = null;

    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      mediaBase64 = base64;
      mediaMimeType = req.file.mimetype;
      mediaType = req.file.mimetype.startsWith('video') ? 'video' : req.file.mimetype.startsWith('audio') ? 'audio' : 'image';

      const uploadResult = await storeMediaFile(req.file.buffer, req.file.mimetype, req.file.originalname, {
        storageClient: storage,
      });
      mediaUrls = [uploadResult.url];

      const classification = await classifyMedia(base64, req.file.mimetype, text);
      classificationResult = classification.classificationResult;
      cloudVisionResult = classification.cloudVisionResult;
      classificationAgreement = classification.classificationAgreement;
    }

    const reportData = {
      id: report_id || undefined,
      text, lat: latitude, lng: longitude,
      reporter_id: reporter_id,
      reporter_name: finalReporterName,
      address: address || '',
      media_urls: mediaUrls, media_type: mediaType,
      mediaBase64, mediaMimeType,
      classificationResult, cloudVisionResult, classificationAgreement,
    };

    // Run the heavy multi-agent pipeline in the background asynchronously
    processReport(reportData, (step) => {
      broadcast('agent_step', step);
    }).catch((err) => {
      console.error('[Async Agent Pipeline] Critical Error:', err);
    });



    res.json({
      success: true,
      ticket_id: report_id || reportData.id,
      merged: false,
      status: 'queued',
    });
  } catch (err) {
    console.error('[Report] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/geocode/proxy', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng parameter' });
    }
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!mapsKey) {
      return res.status(500).json({ error: 'Maps API key not configured on server' });
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Geocode Proxy] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
