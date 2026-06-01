import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Video, Play, Upload, Radio } from 'lucide-react';

const Dashboard = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  // Scheduling states
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTimeStr, setScheduledTimeStr] = useState('');

  // Premium video states
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState('');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) navigate('/');
    fetchData();

    // Dynamically inject Razorpay Checkout SDK
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [vRes, lRes] = await Promise.all([
        axios.get('http://localhost:5000/api/videos', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/live', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setVideos(vRes.data);
      setLiveRooms(lRes.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      // 1. Get presigned URL
      const { data } = await axios.post('http://localhost:5000/api/videos/upload-url', {
        title,
        contentType: uploadFile.type,
        isPremium,
        price: isPremium ? parseFloat(price) : 0.0
      }, { headers: { Authorization: `Bearer ${token}` } });

      // 2. Upload to S3
      await axios.put(data.uploadUrl, uploadFile, {
        headers: { 'Content-Type': uploadFile.type }
      });

      // 3. Trigger processing
      await axios.post('http://localhost:5000/api/videos/trigger-processing', {
        videoId: data.videoId,
        s3Key: data.s3Key
      }, { headers: { Authorization: `Bearer ${token}` } });

      alert('Upload successful! Video is now processing.');
      setUploadFile(null);
      setTitle('');
      setIsPremium(false);
      setPrice('');
      fetchData();
    } catch (error) {
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePayment = async (video: any) => {
    try {
      const { data: orderData } = await axios.post('http://localhost:5000/api/payments/create-order', {
        videoId: video.id
      }, { headers: { Authorization: `Bearer ${token}` } });

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Unacademy Streaming',
        description: `Purchase: ${video.title}`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            await axios.post('http://localhost:5000/api/payments/verify', {
              orderId: orderData.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert('Payment Successful! Video unlocked.');
            fetchData();
          } catch (err) {
            alert('Payment verification failed.');
          }
        },
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: {
          color: '#3B82F6'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to initiate payment');
    }
  };

  const handleCreateLiveClass = async () => {
    if (!liveTitle) {
      alert('Please enter a title');
      return;
    }

    let scheduledAt = null;
    if (isScheduled) {
      if (!scheduledTimeStr) {
        alert('Please select a date and time');
        return;
      }
      scheduledAt = new Date(scheduledTimeStr).toISOString();
    }

    try {
      const { data } = await axios.post('http://localhost:5000/api/live/create', {
        title: liveTitle,
        scheduledAt
      }, { headers: { Authorization: `Bearer ${token}` } });

      setShowLiveModal(false);
      setLiveTitle('');
      setIsScheduled(false);
      setScheduledTimeStr('');

      if (isScheduled) {
        alert('Live class scheduled successfully!');
        fetchData();
      } else {
        navigate(`/live/${data.roomName}`);
      }
    } catch (error) {
      alert('Failed to create live class');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Hello, {user.name}</h2>
        {user.role === 'INSTRUCTOR' && (
          <button 
            onClick={() => setShowLiveModal(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <Radio size={20} /> Go Live
          </button>
        )}
      </div>

      {showLiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass p-8 rounded-2xl w-full max-w-md space-y-6 border border-white/10 relative">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-red-400">
                <Radio /> Create Live Class
              </h3>
              <button 
                onClick={() => setShowLiveModal(false)} 
                className="text-gray-400 hover:text-white text-2xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={liveTitle}
                  onChange={e => setLiveTitle(e.target.value)}
                  placeholder="e.g. Learn React Advanced"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="schedule-class"
                  className="rounded border-white/10 bg-white/5 text-primary focus:ring-0"
                  checked={isScheduled}
                  onChange={e => setIsScheduled(e.target.checked)}
                />
                <label htmlFor="schedule-class" className="text-sm font-medium cursor-pointer">Schedule for later</label>
              </div>
              {isScheduled && (
                <div>
                  <label className="block text-sm font-medium mb-1">Scheduled Date & Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    value={scheduledTimeStr}
                    onChange={e => setScheduledTimeStr(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowLiveModal(false)}
                className="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateLiveClass}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {user.role === 'INSTRUCTOR' && (
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload /> Upload Video</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Introduction to TypeScript"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Video File</label>
                <input 
                  type="file" 
                  accept="video/mp4"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="video-premium"
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-0 cursor-pointer"
                  checked={isPremium}
                  onChange={e => setIsPremium(e.target.checked)}
                />
                <label htmlFor="video-premium" className="text-sm font-medium cursor-pointer select-none">Make this video Premium (Paid)</label>
              </div>

              {isPremium && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-300">Price (₹):</label>
                  <input 
                    type="number" 
                    min="1"
                    placeholder="299"
                    className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={isUploading}
                className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isUploading ? 'Uploading & Initiating...' : 'Upload Video'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-red-400"><Radio /> Active Live Classes</h3>
          <div className="space-y-4">
            {liveRooms.filter(r => r.isActive && r.status !== 'COMPLETED').length === 0 ? (
              <p className="text-gray-400">No active live classes.</p>
            ) : (
              liveRooms.filter(r => r.isActive && r.status !== 'COMPLETED').map(room => {
                const now = new Date();
                const start = room.scheduledAt ? new Date(room.scheduledAt) : null;
                const isUpcoming = room.status === 'SCHEDULED' && start && now < start;
                const isMyClass = user.role === 'INSTRUCTOR' && user.id === room.instructorId;

                return (
                  <div 
                    key={room.id} 
                    className={`glass p-4 rounded-xl flex justify-between items-center border-l-4 transition-all duration-300 ${
                      isUpcoming ? 'border-l-yellow-500 hover:border-l-yellow-400' : 'border-l-red-500 hover:border-l-red-400'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg">{room.title}</h4>
                        {isUpcoming ? (
                          <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                            Scheduled
                          </span>
                        ) : (
                          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-semibold animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">Instructor: {room.instructor.name}</p>
                      {room.status === 'SCHEDULED' && start && (
                        <p className="text-xs text-yellow-400/80">
                          Starts at: {start.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div>
                      {isUpcoming ? (
                        isMyClass ? (
                          <button 
                            onClick={() => navigate(`/live/${room.roomName}`)}
                            className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-white px-4 py-2 rounded-lg font-bold transition-all duration-300"
                          >
                            Start Class
                          </button>
                        ) : (
                          <button 
                            disabled
                            className="bg-white/5 text-gray-500 px-4 py-2 rounded-lg font-bold cursor-not-allowed text-sm"
                          >
                            Join at {start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </button>
                        )
                      ) : (
                        <button 
                          onClick={() => navigate(`/live/${room.roomName}`)}
                          className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg font-bold transition-all duration-300"
                        >
                          {isMyClass ? 'Resume Class' : 'Join'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Past Live Classes */}
          <h3 className="text-2xl font-bold mt-8 mb-4 flex items-center gap-2 text-gray-400">
            <Radio className="opacity-50" /> Completed / Past Classes
          </h3>
          <div className="space-y-4">
            {liveRooms.filter(r => !r.isActive || r.status === 'COMPLETED').length === 0 ? (
              <p className="text-gray-500">No completed live classes yet.</p>
            ) : (
              liveRooms.filter(r => !r.isActive || r.status === 'COMPLETED').map(room => (
                <div 
                  key={room.id} 
                  className="glass p-4 rounded-xl flex justify-between items-center border-l-4 border-l-gray-600 opacity-70 hover:opacity-100 transition-all duration-300"
                >
                  <div>
                    <h4 className="font-bold text-lg text-gray-300">{room.title}</h4>
                    <p className="text-sm text-gray-500">Instructor: {room.instructor.name}</p>
                    {room.scheduledAt && (
                      <p className="text-xs text-gray-500">
                        Class Date: {new Date(room.scheduledAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-500 text-sm font-semibold bg-white/5 px-3 py-1 rounded-lg">
                    Completed
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Video /> Recorded Videos</h3>
          <div className="space-y-4">
            {videos.length === 0 ? (
              <p className="text-gray-400">No videos available.</p>
            ) : (
              videos.map(video => {
                const canWatch = !video.isPremium || video.hasPurchased || user.role === 'INSTRUCTOR';

                return (
                  <div key={video.id} className="glass p-4 rounded-xl flex justify-between items-center border-l-4 border-l-primary hover:border-l-primary/80 transition-all duration-300">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg">{video.title}</h4>
                        {video.isPremium ? (
                          <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                            Premium (₹{video.price})
                          </span>
                        ) : (
                          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                            Free
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">Instructor: {video.instructor.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full inline-block font-semibold ${
                        video.status === 'READY' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {video.status}
                      </span>
                    </div>

                    <div>
                      {video.status === 'READY' && (
                        canWatch ? (
                          <button 
                            onClick={() => navigate(`/watch/${video.id}`)}
                            className="bg-primary/20 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-lg font-bold transition-all duration-300 flex items-center gap-2"
                          >
                            <Play size={16} /> Watch
                          </button>
                        ) : (
                          <button 
                            onClick={() => handlePayment(video)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold transition-all duration-300"
                          >
                            Buy ₹{video.price}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
