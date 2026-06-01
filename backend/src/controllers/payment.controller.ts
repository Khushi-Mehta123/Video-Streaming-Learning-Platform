import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth.middleware';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykey123';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret123';

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body;
    const userId = req.user!.id;

    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (!video.isPremium) {
      return res.status(400).json({ error: 'This video is free and does not require payment' });
    }

    // Check if already purchased
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId,
        videoId,
        status: 'COMPLETED',
      },
    });

    if (existingPurchase) {
      return res.status(400).json({ error: 'You have already purchased this video' });
    }

    // Razorpay amount is in paise (INR * 100)
    const amountInPaise = Math.round(video.price * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${videoId.substring(0, 10)}`,
    });

    // Create a pending purchase record
    await prisma.purchase.upsert({
      where: { orderId: order.id },
      update: {
        userId,
        videoId,
        status: 'PENDING',
      },
      create: {
        userId,
        videoId,
        orderId: order.id,
        status: 'PENDING',
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

export const verifySignature = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const userId = req.user!.id;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing signature verification parameters' });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    // Update purchase record to COMPLETED
    const purchase = await prisma.purchase.findUnique({ where: { orderId } });
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase transaction record not found' });
    }

    await prisma.purchase.update({
      where: { orderId },
      data: {
        paymentId,
        signature,
        status: 'COMPLETED',
      },
    });

    res.json({ success: true, message: 'Payment verified and video unlocked!' });
  } catch (error) {
    console.error('Error in verifySignature:', error);
    res.status(500).json({ error: 'Signature verification failed' });
  }
};
