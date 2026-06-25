import { Router } from 'express';
import multer from 'multer';
import { classifyMedia } from '../services/classificationService.js';
import { processReport } from '../agent/orchestrator.js';
import { broadcast } from '../services/sseService.js';
import { awardXP } from '../services/userService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/', upload.single('media'), async (req, res) => {
  try {
    const { text, lat, lng, reporter_id, reporter_name } = req.body;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    let classificationResult = null;
    let cloudVisionResult = null;
    let classificationAgreement = true;
    let mediaUrls = [];
    let mediaType = 'image';

    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
      mediaUrls = [`data:${req.file.mimetype};base64,${base64.substring(0, 50)}...`];

      const classification = await classifyMedia(base64, req.file.mimetype, text);
      classificationResult = classification.classificationResult;
      cloudVisionResult = classification.cloudVisionResult;
      classificationAgreement = classification.classificationAgreement;
    }

    const reportData = {
      text, lat: latitude, lng: longitude,
      reporter_id: reporter_id || 'anonymous',
      reporter_name: reporter_name || 'Anonymous',
      media_urls: mediaUrls, media_type: mediaType,
      classificationResult, cloudVisionResult, classificationAgreement,
    };

    const result = await processReport(reportData, (step) => {
      broadcast('agent_step', step);
    });

    if (reporter_id) await awardXP(reporter_id, 'report');

    res.json({ success: true, ticket_id: result.ticketId, trace: result.trace });
  } catch (err) {
    console.error('[Report] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
