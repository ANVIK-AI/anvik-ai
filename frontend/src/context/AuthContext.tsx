// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email?: string;
  name?: string;
  spaceIds?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  updateUserProfile: (updates: any) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("checking auth");
        const response = await axios.get(import.meta.env.VITE_PUBLIC_BACKEND_URL + '/user/profile', {
          withCredentials: true,
        })
        console.log("response11 : "+response.data);
        console.table(response.data);
        if(response.status===200){
          setUser(response.data);
        }else if(response.status===401){
          console.log("user not found");
          setUser(null);
        }else{
          console.log("user not found");
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login with Google
  const loginWithGoogle = () => {
    window.location.href = import.meta.env.VITE_PUBLIC_BACKEND_URL + '/auth/google';
  };

  // Logout
  const logout = async () => {
    try {
      await axios.post(import.meta.env.VITE_PUBLIC_BACKEND_URL + '/auth/logout', {}, { withCredentials: true });
      setUser(null);
      // Optional: Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Update user profile
  const updateUserProfile = async (updates: any) => {
    try {
      const response = await axios.patch(
        import.meta.env.VITE_PUBLIC_BACKEND_URL + '/users/profile',
        updates,
        { withCredentials: true }
      );
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    loginWithGoogle,
    logout,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};