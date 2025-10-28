import React, { useState } from 'react';
import { Role, User } from '../types';
import { BriefcaseIcon, UserIcon } from './Icons';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.RECRUITER);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      const users = JSON.parse(localStorage.getItem('simuHireUsers') || '[]');

      if (isLogin) {
        // Handle Login
        const foundUser = users.find(
          (u: any) => u.email === email && u.password === password && u.role === role
        );
        if (foundUser) {
          onLoginSuccess({ email: foundUser.email, role: foundUser.role });
        } else {
          setError('Invalid credentials or role mismatch. Please try again.');
        }
      } else {
        // Handle Signup
        const existingUser = users.find((u: any) => u.email === email);
        if (existingUser) {
          setError('An account with this email already exists.');
          return;
        }
        const newUser = { email, password, role };
        users.push(newUser);
        localStorage.setItem('simuHireUsers', JSON.stringify(users));
        onLoginSuccess({ email: newUser.email, role: newUser.role });
      }
    } catch (e) {
        console.error("Auth error:", e);
        setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-slate-800 p-8 rounded-lg border border-slate-700">
        <div className="flex border-b border-slate-700 mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-3 font-semibold transition-colors ${isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-3 font-semibold transition-colors ${!isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">I am a...</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole(Role.RECRUITER)}
                className={`flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-colors ${
                  role === Role.RECRUITER ? 'bg-blue-600/20 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <BriefcaseIcon className="w-5 h-5" />
                Recruiter
              </button>
              <button
                type="button"
                onClick={() => setRole(Role.CANDIDATE)}
                className={`flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-colors ${
                  role === Role.CANDIDATE ? 'bg-green-600/20 border-green-500 text-white' : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <UserIcon className="w-5 h-5" />
                Candidate
              </button>
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
