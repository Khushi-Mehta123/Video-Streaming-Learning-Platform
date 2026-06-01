import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Hls from 'hls.js';
import { ArrowLeft } from 'lucide-react';

const VideoWatch = () => {
  const { videoId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`http://localhost:5000/api/videos/${videoId}/manifest`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (videoRef.current) {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hlsRef.current = hls;
            hls.loadSource(data.manifestUrl);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, parsedData) => {
              setLevels(hls.levels);
              setCurrentLevel(hls.currentLevel);
              videoRef.current?.play().catch(e => console.log('Auto-play prevented'));
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (event, switchData) => {
              setCurrentLevel(hls.currentLevel);
            });
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari support (no quality control interface)
            videoRef.current.src = data.manifestUrl;
            videoRef.current.addEventListener('loadedmetadata', () => {
              videoRef.current?.play().catch(e => console.log('Auto-play prevented'));
            });
          }
        }
      } catch (err: any) {
        if (err.response?.status === 402) {
          setError(err.response?.data?.error || 'Payment Required. Please purchase this video to watch.');
        } else {
          setError('Failed to load video');
        }
      }
    };

    fetchManifest();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [videoId]);

  return (
    <div className="space-y-6">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} /> Back to Dashboard
      </button>

      <div className="glass p-4 rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center relative">
        {error ? (
          <p className="text-red-500 font-bold text-center px-4">{error}</p>
        ) : (
          <video 
            ref={videoRef} 
            className="w-full h-full"
            controls 
            autoPlay
          />
        )}
      </div>

      {!error && levels.length > 0 && (
        <div className="glass p-4 rounded-xl flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-300">Video Quality Controls</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Resolution:</span>
            <select
              value={currentLevel}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCurrentLevel(val);
                if (hlsRef.current) {
                  hlsRef.current.currentLevel = val;
                }
              }}
              className="bg-slate-900 border border-white/10 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-xs font-semibold cursor-pointer"
            >
              <option value="-1">Auto (Adaptive)</option>
              {levels.map((level, idx) => (
                <option key={idx} value={idx}>
                  {level.height}p ({Math.round(level.bitrate / 1000)}kbps)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoWatch;
