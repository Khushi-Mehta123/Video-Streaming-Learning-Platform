import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { prisma } from '../db';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

export const mailWorker = new Worker('mail-queue', async job => {
  const { to, subject, text, liveRoomId } = job.data;

  // Check if liveRoomId is provided and verify the room is still active
  if (liveRoomId) {
    const room = await prisma.liveRoom.findUnique({ where: { id: liveRoomId } });
    if (!room || room.status === 'COMPLETED') {
      console.log(`[Mail Job] Skipping email for room ${liveRoomId} because it is completed or deleted.`);
      return;
    }
  }

  // If email configuration is missing, simulate sending and log to console
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] configuration missing. Email details:`);
    console.log(`----------------------------------------`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
    console.log(`----------------------------------------`);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log(`[Mail Job] Email successfully sent to ${to}`);
  } catch (error) {
    console.error('[Mail Job] Failed to send email via SMTP, falling back to logging. Error:', error);
    console.log(`[Email Simulation] To: ${to} | Subject: ${subject} | Body: ${text}`);
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  }
});
