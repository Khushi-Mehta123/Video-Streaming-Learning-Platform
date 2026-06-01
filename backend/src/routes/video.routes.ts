import { Router } from 'express';
import { getUploadUrl, triggerProcessing, getVideos, getHlsManifestUrl, serveManifest } from '../controllers/video.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, getVideos);
router.post('/upload-url', authenticate, requireRole('INSTRUCTOR'), getUploadUrl);
router.post('/trigger-processing', authenticate, requireRole('INSTRUCTOR'), triggerProcessing);
router.get('/:videoId/manifest', authenticate, getHlsManifestUrl);
router.get('/:videoId/manifest/:filename', serveManifest);

export default router;
