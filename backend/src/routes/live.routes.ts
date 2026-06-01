import { Router } from 'express';
import { createLiveRoom, generateToken, getLiveRooms, endLiveRoom } from '../controllers/live.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, getLiveRooms);
router.post('/create', authenticate, requireRole('INSTRUCTOR'), createLiveRoom);
router.get('/:roomName/token', authenticate, generateToken);
router.post('/:roomName/end', authenticate, requireRole('INSTRUCTOR'), endLiveRoom);

export default router;
