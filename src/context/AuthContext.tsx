'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { ProfileRow, UserRole } from '../types/database';
import { signInAction, signUpCustomerAction, signOutAction, AuthActionResult } from '../app/actions/authActions';

interface AuthContextType {
  user: { id: string; email?: string } | null;
  profile: ProfileRow | null;
  role: UserRole | null;
  isLoading: boolean;
  signIn: (formData: { email: string; password: string }) => Promise<AuthActionResult>;
  signUp: (formData: any) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as ProfileRow);
        setRole(data.role as UserRole);
      } else {
        setProfile(null);
        setRole(null);
      }
    } catch {
      setProfile(null);
      setRole(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (currentUser) {
        setUser({ id: currentUser.id, email: currentUser.email });
        fetchProfile(currentUser.id).finally(() => setIsLoading(false));
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (formData: { email: string; password: string }) => {
    setIsLoading(true);
    const result = await signInAction(formData);
    if (result.success && result.userId) {
      setUser({ id: result.userId, email: formData.email });
      await fetchProfile(result.userId);
    }
    setIsLoading(false);
    return result;
  };

  const handleSignUp = async (formData: any) => {
    setIsLoading(true);
    const result = await signUpCustomerAction(formData);
    if (result.success && result.userId) {
      setUser({ id: result.userId, email: formData.email });
      await fetchProfile(result.userId);
    }
    setIsLoading(false);
    return result;
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOutAction();
    setUser(null);
    setProfile(null);
    setRole(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isLoading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
