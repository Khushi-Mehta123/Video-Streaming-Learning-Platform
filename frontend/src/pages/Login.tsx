import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('STUDENT');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister ? { email, password, name, role } : { email, password };
      
      const { data } = await axios.post(`http://localhost:5000${endpoint}`, payload);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (error) {
      alert('Authentication failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="glass p-8 rounded-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          {isRegister ? 'Join Us' : 'Welcome Back'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input 
                type="text" 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select 
                className="w-full bg-dark border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-primary to-secondary text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            {isRegister ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            className="text-primary hover:underline"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
