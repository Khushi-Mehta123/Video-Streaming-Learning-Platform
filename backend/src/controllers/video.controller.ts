import { Request, Response } from 'express';
import { prisma } from '../db';
import { getUploadPresignedUrl, getDownloadPresignedUrl, s3Client } from '../utils/s3';
import { addVideoJob } from '../jobs/video.queue';
import { AuthRequest } from '../middlewares/auth.middleware';
import crypto from 'crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import jwt from 'jsonwebtoken';

export const getUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, contentType, isPremium, price } = req.body;
    const instructorId = req.user!.id;

    const s3Key = `raw/${crypto.randomBytes(16).toString('hex')}-${title.replace(/\s+/g, '_')}`;

    const video = await prisma.video.create({
      data: {
        title,
        description,
        s3Key,
        instructorId,
        isPremium: !!isPremium,
        price: price ? parseFloat(price) : 0.0,
        status: 'PROCESSING' // Will trigger processing once uploaded
      }
    });

    const uploadUrl = await getUploadPresignedUrl(s3Key, contentType || 'video/mp4');

    res.json({ uploadUrl, videoId: video.id, s3Key });
  } catch (error) {
    console.error("Error in getUploadUrl:", error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

export const triggerProcessing = async (req: AuthRequest, res: Response) => {
  try {
    const { videoId, s3Key } = req.body;
    await addVideoJob(videoId, s3Key);
    res.json({ message: 'Video processing started' });
  } catch (error) {
    console.error("Error in triggerProcessing:", error);
    res.status(500).json({ error: 'Failed to start processing' });
  }
};

export const getVideos = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const videos = await prisma.video.findMany({
      include: { 
        instructor: { select: { name: true } },
        purchases: {
          where: {
            userId,
            status: 'COMPLETED'
          },
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedVideos = videos.map(video => ({
      ...video,
      hasPurchased: video.purchases.length > 0 || video.instructorId === userId
    }));

    res.json(formattedVideos);
  } catch (error) {
    console.error("Error in getVideos:", error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

export const getHlsManifestUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.params;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const video = await prisma.video.findUnique({ where: { id: videoId } });

    if (!video || video.status !== 'READY') {
      return res.status(404).json({ error: 'Video not found or not ready' });
    }

    const userId = req.user!.id;
    const isInstructor = userId === video.instructorId;

    if (video.isPremium && !isInstructor) {
      const purchase = await prisma.purchase.findFirst({
        where: {
          userId,
          videoId,
          status: 'COMPLETED'
        }
      });

      if (!purchase) {
        return res.status(402).json({ error: 'Subscription required. Please purchase this video to watch.' });
      }
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const manifestUrl = `${protocol}://${host}/api/videos/${videoId}/manifest/index.m3u8?token=${token}`;

    res.json({ manifestUrl });
  } catch (error) {
    console.error("Error in getHlsManifestUrl:", error);
    res.status(500).json({ error: 'Failed to generate manifest URL' });
  }
};

export const serveManifest = async (req: Request, res: Response) => {
  try {
    const { videoId, filename } = req.params;
    const token = req.query.token as string;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string; role: string };
      userId = decoded.id;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const isInstructor = userId === video.instructorId;
    if (video.isPremium && !isInstructor) {
      const purchase = await prisma.purchase.findFirst({
        where: {
          userId,
          videoId,
          status: 'COMPLETED'
        }
      });
      if (!purchase) {
        return res.status(402).json({ error: 'Subscription required' });
      }
    }

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      return res.status(500).json({ error: 'S3 Bucket not configured' });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `hls/${videoId}/${filename}`,
    });

    const s3Response = await s3Client.send(command);
    const manifestContent = await s3Response.Body?.transformToString();

    if (!manifestContent) {
      return res.status(404).json({ error: 'Manifest content empty or not found' });
    }

    const lines = manifestContent.split('\n');
    const processedLines = [];

    for (let line of lines) {
      const trimmedLine = line.trim();
      // Only sign actual segment TS files; leave relative playlist links (.m3u8) as is but append token
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.endsWith('.ts')) {
        const segmentKey = `hls/${videoId}/${trimmedLine}`;
        const signedSegmentUrl = await getDownloadPresignedUrl(segmentKey);
        processedLines.push(signedSegmentUrl);
      } else if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.endsWith('.m3u8')) {
        processedLines.push(`${trimmedLine}?token=${encodeURIComponent(token)}`);
      } else {
        processedLines.push(line);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(processedLines.join('\n'));
  } catch (error) {
    console.error("Error in serveManifest:", error);
    res.status(500).json({ error: 'Failed to serve manifest' });
  }
};
