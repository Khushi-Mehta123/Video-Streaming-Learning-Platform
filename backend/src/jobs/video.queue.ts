import { Queue } from 'bullmq';

export const videoQueue = new Queue('video-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});

export const addVideoJob = async (videoId: string, s3Key: string) => {
  await videoQueue.add('process-video', { videoId, s3Key });
};
