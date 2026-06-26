import { Router } from 'express';
import multer from 'multer';
import { classifyMedia } from '../services/classificationService.js';
import { processReport } from '../agent/orchestrator.js';
import { broadcast } from '../services/sseService.js';
import { awardXP } from '../services/userService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import { storage } from '../config/firebase.js';
import { storeMediaFile } from '../services/mediaUploadService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const reportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many reports from this IP, please try again later' } });

router.post('/', requireAuth, reportLimiter, upload.single('media'), async (req, res) => {
  try {
    const { text, lat, lng, reporter_name, report_id, address } = req.body;
    const reporter_id = req.user.id;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

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
      reporter_name: reporter_name || 'Anonymous',
      address: address || '',
      media_urls: mediaUrls, media_type: mediaType,
      mediaBase64, mediaMimeType,
      classificationResult, cloudVisionResult, classificationAgreement,
    };

    const result = await processReport(reportData, (step) => {
      broadcast('agent_step', step);
    });

    if (result.ticketId && reporter_id !== 'anonymous') {
      await awardXP(reporter_id, result.merged ? 'vote' : 'report');
    }

    res.json({
      success: true,
      ticket_id: result.ticketId,
      merged: !!result.merged,
      classification: classificationResult,
      trace: result.trace,
    });
  } catch (err) {
    console.error('[Report] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
