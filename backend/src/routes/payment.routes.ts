import { Router } from 'express';
import { createOrder, verifySignature } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/create-order', authenticate, createOrder);
router.post('/verify', authenticate, verifySignature);

export default router;
