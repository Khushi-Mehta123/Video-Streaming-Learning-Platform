import { Request, Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import crypto from 'crypto';
import { addMailJob } from '../jobs/mail.queue';

const livekitHost = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const livekitApiKey = process.env.LIVEKIT_API_KEY || 'devkey';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

const roomService = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret);

export const createLiveRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { title, scheduledAt } = req.body;
    const instructorId = req.user!.id;

    const instructor = await prisma.user.findUnique({ where: { id: instructorId } });
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    const roomName = `room-${crypto.randomBytes(8).toString('hex')}`;
    const isScheduled = !!scheduledAt;

    const liveRoom = await prisma.liveRoom.create({
      data: {
        title,
        roomName,
        instructorId,
        scheduledAt: isScheduled ? new Date(scheduledAt) : null,
        status: isScheduled ? 'SCHEDULED' : 'LIVE',
      }
    });

    if (isScheduled) {
      const scheduledTime = new Date(scheduledAt).getTime();
      const delayMs = Math.max(0, scheduledTime - Date.now());

      // Queue BullMQ email notification
      const emailText = `Hello ${instructor.name},\n\nYour scheduled live class "${title}" is starting now!\nJoin session here: http://localhost:5173/live/${roomName}\n\nHappy teaching!`;
      await addMailJob(
        instructor.email,
        `Class Starting Soon: ${title}`,
        emailText,
        delayMs,
        liveRoom.id
      );
    } else {
      // Instant class: create the room in LiveKit immediately
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 10 * 60, // 10 minutes
        maxParticipants: 100,
      });
    }

    res.json(liveRoom);
  } catch (error) {
    console.error('Error in createLiveRoom:', error);
    res.status(500).json({ error: 'Failed to create live room' });
  }
};

export const generateToken = async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;
    const user = req.user!;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const room = await prisma.liveRoom.findUnique({ where: { roomName } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isInstructor = user.id === room.instructorId;

    if (room.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This session has already ended.' });
    }

    if (room.status === 'SCHEDULED') {
      if (isInstructor) {
        // Instructor started the scheduled class!
        await prisma.liveRoom.update({
          where: { id: room.id },
          data: { status: 'LIVE' }
        });
        try {
          await roomService.createRoom({
            name: roomName,
            emptyTimeout: 10 * 60, // 10 minutes
            maxParticipants: 100,
          });
        } catch (err) {
          // Ignore if room already exists
        }
      } else {
        // Student trying to join
        const now = new Date();
        if (room.scheduledAt && now < new Date(room.scheduledAt)) {
          return res.status(400).json({ 
            error: `This class is scheduled for ${new Date(room.scheduledAt).toLocaleString()}. You can only join after that.` 
          });
        } else {
          return res.status(400).json({ error: 'The instructor has not started the class yet.' });
        }
      }
    }

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: user.id,
      name: dbUser.name,
    });

    at.addGrant({ 
      roomJoin: true, 
      room: roomName, 
      canPublish: isInstructor, 
      canSubscribe: true 
    });

    const token = await at.toJwt();
    res.json({ token, livekitUrl: livekitHost.replace('ws://', 'ws://') });
  } catch (error) {
    console.error('Error in generateToken:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
};

export const getLiveRooms = async (req: Request, res: Response) => {
  try {
    const rooms = await prisma.liveRoom.findMany({
      include: { instructor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live rooms' });
  }
};

export const endLiveRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;
    const instructorId = req.user!.id;

    const room = await prisma.liveRoom.findUnique({ where: { roomName } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.instructorId !== instructorId) {
      return res.status(403).json({ error: 'Only the instructor who created this room can end it.' });
    }

    await prisma.liveRoom.update({
      where: { id: room.id },
      data: {
        status: 'COMPLETED',
        isActive: false
      }
    });

    try {
      await roomService.deleteRoom(roomName);
    } catch (err) {
      console.warn('Room might not have existed on LiveKit server or was already deleted:', err);
    }

    res.json({ message: 'Live class successfully completed and closed.' });
  } catch (error) {
    console.error('Error in endLiveRoom:', error);
    res.status(500).json({ error: 'Failed to end live room' });
  }
};
