"use client";

import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { user, loading, login, logout } = useAuth();

  return (
    <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">AI Coach</h1>
      <div>
        {loading ? (
          <div>Loading...</div>
        ) : user ? (
          <div className="flex items-center space-x-4">
            <span>Welcome, {user.displayName || 'User'}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-md"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md"
          >
            Login with Google
          </button>
        )}
      </div>
    </header>
  );
} 