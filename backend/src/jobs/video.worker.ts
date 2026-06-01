import { Worker } from 'bullmq';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../utils/s3';
import { prisma } from '../db';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const processVideo = async (videoId: string, s3Key: string) => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('S3 bucket not configured');

  const localInputPath = path.resolve('/tmp', `${videoId}.mp4`);
  const localOutputDir = path.resolve('/tmp', videoId);
  
  if (!fs.existsSync(localOutputDir)) {
    fs.mkdirSync(localOutputDir, { recursive: true });
  }

  // 1. Download from S3
  const getCommand = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
  const { Body } = await s3Client.send(getCommand);
  if (!Body) throw new Error('Failed to download video from S3');
  
  await pipeline(Body as NodeJS.ReadableStream, fs.createWriteStream(localInputPath));

  // 2. Process with FFMPEG to HLS (Multi-bitrate: 480p, 720p, 1080p)
  const transcodeToResolution = (inputPath: string, outputDir: string, resolution: string, bitrate: string, height: number) => {
    return new Promise((resolve) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-vf scale=-2:${height}`,
          '-profile:v baseline',
          '-level 3.0',
          '-start_number 0',
          '-hls_time 6',
          '-hls_list_size 0',
          `-b:v ${bitrate}`,
          '-f hls',
          `-hls_segment_filename ${path.join(outputDir, `${resolution}_%03d.ts`)}`
        ])
        .output(path.join(outputDir, `${resolution}.m3u8`))
        .on('end', () => {
          console.log(`Successfully transcoded ${resolution}`);
          resolve(true);
        })
        .on('error', (err) => {
          console.error(`Transcoding failed for resolution ${resolution}:`, err.message);
          resolve(false);
        })
        .run();
    });
  };

  console.log('Starting adaptive HLS transcoding...');
  await transcodeToResolution(localInputPath, localOutputDir, '480p', '800k', 480);
  await transcodeToResolution(localInputPath, localOutputDir, '720p', '1400k', 720);
  await transcodeToResolution(localInputPath, localOutputDir, '1080p', '2800k', 1080);

  // Generate Master Playlist (index.m3u8)
  let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n';
  let hasResolution = false;

  if (fs.existsSync(path.join(localOutputDir, '480p.m3u8'))) {
    masterPlaylist += '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p.m3u8\n';
    hasResolution = true;
  }
  if (fs.existsSync(path.join(localOutputDir, '720p.m3u8'))) {
    masterPlaylist += '#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=1280x720\n720p.m3u8\n';
    hasResolution = true;
  }
  if (fs.existsSync(path.join(localOutputDir, '1080p.m3u8'))) {
    masterPlaylist += '#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\n1080p.m3u8\n';
    hasResolution = true;
  }

  if (!hasResolution) {
    throw new Error('All transcoder profiles failed.');
  }

  fs.writeFileSync(path.join(localOutputDir, 'index.m3u8'), masterPlaylist);
  console.log('Master playlist generated successfully.');

  // 3. Upload HLS files back to S3
  const files = fs.readdirSync(localOutputDir);
  for (const file of files) {
    const filePath = path.join(localOutputDir, file);
    const fileContent = fs.readFileSync(filePath);
    const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
    
    const hlsKey = `hls/${videoId}/${file}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: hlsKey,
      Body: fileContent,
      ContentType: contentType,
    }));
  }

  // 4. Update Database Status
  await prisma.video.update({
    where: { id: videoId },
    data: { status: 'READY' }
  });

  // Cleanup
  fs.unlinkSync(localInputPath);
  fs.rmSync(localOutputDir, { recursive: true, force: true });
};

export const worker = new Worker('video-processing', async job => {
  console.log(`Processing job ${job.id}`);
  const { videoId, s3Key } = job.data;
  
  try {
    await processVideo(videoId, s3Key);
    console.log(`Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'FAILED' }
    });
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  }
});
