import { useState, useEffect } from 'react';
import { authService } from '../services/api';

// In-memory storage for token
let memoryToken: string | null = null;

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!sessionStorage.getItem('krypton_token'));

  const login = async (token: string) => {
    try {
      const res = await authService.login(token);
      memoryToken = res.token;
      sessionStorage.setItem('krypton_token', res.token);
      setIsAuthenticated(true);
      return true;
    } catch (e) {
      return false;
    }
  };

  const logout = () => {
    memoryToken = null;
    sessionStorage.removeItem('krypton_token');
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout, token: memoryToken || sessionStorage.getItem('krypton_token') };
}
