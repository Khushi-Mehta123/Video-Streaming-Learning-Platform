import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  LiveKitRoom, 
  RoomAudioRenderer,
  VideoConference,
  ControlBar
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ArrowLeft } from 'lucide-react';

const LiveSession = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [roomEnded, setRoomEnded] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isInstructor = user.role === 'INSTRUCTOR';

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const authToken = localStorage.getItem('token');
        const { data } = await axios.get(`http://localhost:5000/api/live/${roomName}/token`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        setToken(data.token);
        setServerUrl(data.livekitUrl);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to join live room');
      }
    };

    fetchToken();
  }, [roomName]);

  const handleEndSession = async () => {
    if (!window.confirm("Are you sure you want to end this class? This will disconnect all students.")) return;
    try {
      const authToken = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/live/${roomName}/end`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      navigate('/dashboard');
    } catch (err) {
      alert('Failed to end class');
    }
  };

  if (roomEnded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <h3 className="text-3xl font-bold text-red-500">Class Completed</h3>
        <p className="text-gray-400 text-lg">This live class has been ended by the instructor. You have been disconnected.</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-6 rounded-lg transition-colors mt-4"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-red-500 font-bold text-xl text-center px-4">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="text-primary hover:underline">
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return <div className="flex justify-center items-center min-h-[60vh]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} /> Leave Session
        </button>
        {isInstructor && (
          <button 
            onClick={handleEndSession}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
          >
            End Class
          </button>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden min-h-[70vh] flex flex-col relative" style={{ height: '70vh' }}>
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={serverUrl}
          data-lk-theme="default"
          style={{ height: '100%' }}
          onDisconnected={() => setRoomEnded(true)}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
};

export default LiveSession;
