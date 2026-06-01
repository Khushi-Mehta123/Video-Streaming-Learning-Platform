# 🎓 Video Streaming Platform: Premium Live Classroom & Adaptive Video Streaming

An ultra-premium, production-grade video streaming and real-time live classroom platform. Built with a modern, glassmorphic dark-mode UI, the system leverages scalable microservices architecture, secure WebRTC streaming, adaptive bitrate HLS transcoding, and seamless payment rails.

---

## ✨ Core Features

### 📡 1. Real-Time WebRTC Live Rooms (LiveKit)
* **WebRTC Live Streaming**: Low-latency live classes powered by the LiveKit SDK.
* **Instructor Controls**: Instructors can initiate sessions, manage streaming states, and terminate classrooms securely (`POST /api/live/:roomName/end`).
* **Name Resolution**: Student names are verified through DB queries and rendered inside the LiveKit classroom interface (in place of generic UUID identifiers).
* **Instructor End-Class Action**: When an instructor completes a session, all connected students are automatically disconnected and redirected to a custom completion screen on the dashboard.

### 📅 2. Scheduled Live Classes & Background Notifications (BullMQ)
* **Pre-Scheduled Class Gates**: Instructors can schedule classes ahead of time. Student entry is strictly blocked until the class scheduled start time or until the instructor goes live.
* **BullMQ Notification Workers**: Integrates BullMQ & Redis to schedule background jobs. An automated email is fired to the instructor at the exact moment their class is scheduled to begin.
* **Smart Dashboard Splits**: The instructor and student dashboards automatically split classrooms into **Active Live Classes** and **Completed / Past Classes**.

### 💸 3. Razorpay Premium Video Subscriptions
* **Video Paywalls**: Instructors can configure videos as Premium and assign a ticket price (₹) during upload.
* **Secure S3 Segment Proxying**: Private HLS manifest segments (`.ts` chunk streams) are dynamically presigned on the fly by the server for authorized students, blocking direct unauthenticated downloads (`402 Payment Required`).
* **Razorpay Test Mode Integration**: Dynamic client-side checkout seamlessly verification against server-side cryptographically signed HMAC hashes to unlock playback immediately.

### 🎥 4. Dynamic Multi-Bitrate Adaptive Quality Player (HLS.js)
* **High-Efficiency Transcoding**: Video uploads are processed using backend `ffmpeg` queues into three quality pipelines:
  * **480p** (800kbps)
  * **720p** (1400kbps)
  * **1080p** (2800kbps)
* **Master Manifest Generation**: Generates an adaptive Master Playlist (`index.m3u8`) linking dynamic sub-manifest paths and carrying JWT security tokens downstream.
* **Dynamic Resolution Selector**: A premium frontend toolbar lets students toggle between **Auto (Adaptive Network Quality)** and manual overrides (**480p / 720p / 1080p**) with instant quality switches.

---

## 🛠️ Technology Stack
* **Frontend**: React, TypeScript, Tailwind CSS, Lucide icons, HLS.js, LiveKit components
* **Backend**: Node.js, Express, TypeScript, Prisma ORM, BullMQ, Nodemailer, Fluent-FFmpeg
* **Database**: PostgreSQL (Prisma schema engine)
* **Caching & Queue**: Redis
* **Storage**: Amazon S3 (Segment uploads & raw processing)
* **Streaming Protocol**: WebRTC (LiveKit), HLS (Adaptive multi-bitrate segmented streams)
* **Payments**: Razorpay Node SDK & Checkout JS

---

## 🚀 Setup & Installation

### 📋 Prerequisites
* Docker & Docker Compose
* Node.js v18+ (for local development)

### 🔑 Environment Variables
Create a `.env` file in the `backend` folder matching the following keys:

```env
PORT=5000
JWT_SECRET=your_jwt_secret_key
DATABASE_URL=postgresql://postgres:password@postgres:5432/streaming?schema=public
REDIS_HOST=redis
REDIS_PORT=6379

# AWS Credentials (S3)
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your_s3_bucket_name
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# LiveKit Configuration
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
LIVEKIT_URL=wss://your-livekit-url.cloud

# SMTP Configuration (BullMQ Notification Worker)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# Razorpay Credentials (Development Mode)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 🐳 Starting the Application (Docker Compose)
To download dependencies, push Prisma schema structures, compile backend types, and launch all services:

```bash
docker compose up -d --build
```

Access services locally at:
* **Frontend**: `http://localhost:4173`
* **Backend API**: `http://localhost:5000`
* **LiveKit Server**: `http://localhost:7880`

---

## 🔮 Future Roadmap (Opportunities & Extensions)

### 💬 1. Live Chat & Classroom Interactions
* Integrate a real-time Live Chat widget next to the WebRTC Live Room using WebSockets or LiveKit Data Channels.
* Allow students to ask questions, raise their hands virtually, or answer real-time multiple-choice poll popups initiated by the instructor.

### 💬 2. Video Comments & Nested Discussions
* Add a rich nested commenting system beneath recorded video watch paths (`VideoWatch.tsx`).
* Support student discussions, markdown styling, time-stamped video comments, and instructor answer flags.

### 💖 3. Likes, Ratings & Analytics Dashboard
* Implement a simple Rating (`1-5 stars`) or Recommendation (`Like/Dislike`) framework for recorded videos.
* Build a dedicated **Analytics Dashboard** for Instructors tracking:
  * Total earnings from Premium Video subscriptions (Razorpay dashboard aggregation).
  * Video watch durations and drop-off graphs.
  * Active student enrollment charts.

### 🏆 4. Student Certificates & Quizzes
* Implement end-of-course online quizzes for videos.
* Auto-generate premium PDF certificates upon video completion.
