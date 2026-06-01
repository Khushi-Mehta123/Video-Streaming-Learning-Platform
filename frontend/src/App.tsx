import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VideoWatch from './pages/VideoWatch';
import LiveSession from './pages/LiveSession';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-darker text-white font-sans">
        <nav className="border-b border-white/10 px-6 py-4 glass sticky top-0 z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              Video Streaming Platform
            </h1>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto p-6">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/watch/:videoId" element={<VideoWatch />} />
            <Route path="/live/:roomName" element={<LiveSession />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
