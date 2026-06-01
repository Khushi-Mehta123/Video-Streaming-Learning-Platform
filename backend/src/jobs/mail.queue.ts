import { Queue } from 'bullmq';

export const mailQueue = new Queue('mail-queue', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});

export const addMailJob = async (
  to: string,
  subject: string,
  text: string,
  delayMs: number,
  liveRoomId?: string
) => {
  await mailQueue.add(
    'send-email',
    { to, subject, text, liveRoomId },
    { delay: delayMs }
  );
};
