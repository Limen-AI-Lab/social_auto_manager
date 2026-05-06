import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { Profile, UserRole } from '../types';

export type { UserRole };

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  session: Session | null;
  loading: boolean;
  error: string | null;
  /** True when Supabase is configured (env vars set). When false, app runs without auth and treats as admin. */
  isAuthConfigured: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, options?: { display_name?: string; role?: UserRole }) => Promise<void>;
  setError: (error: string | null) => void;
  refreshProfile: () => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  profile: null,
  role: 'viewer',
  session: null,
  loading: true,
  error: null,
  isAuthConfigured: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at, updated_at')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setState((s) => ({ ...s, user: null, profile: null, role: 'viewer', session: null }));
      return;
    }
    const profile = await fetchProfile(session.user.id);
    setState((s) => ({
      ...s,
      user: session.user,
      session,
      profile,
      role: (profile?.role as UserRole) ?? 'viewer',
    }));
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setState((s) => ({ ...s, loading: false, isAuthConfigured: false }));
      return;
    }

    setState((s) => ({ ...s, isAuthConfigured: true }));
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session?.user) {
        setState((s) => ({ ...s, user: null, profile: null, role: 'viewer', session: null, loading: false }));
        return;
      }
      fetchProfile(session.user.id).then((profile) => {
        if (!mounted) return;
        setState((s) => ({
          ...s,
          user: session.user,
          session,
          profile,
          role: (profile?.role as UserRole) ?? 'viewer',
          loading: false,
        }));
      }).catch(() => {
        if (!mounted) return;
        setState((s) => ({ ...s, loading: false }));
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setState((s) => ({ ...s, user: null, profile: null, role: 'viewer', session: null }));
        return;
      }
      fetchProfile(session.user.id).then((profile) => {
        if (!mounted) return;
        setState((s) => ({
          ...s,
          user: session.user,
          session,
          profile,
          role: (profile?.role as UserRole) ?? 'viewer',
        }));
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    setState((s) => ({ ...s, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setState((s) => ({ ...s, user: null, profile: null, role: 'viewer', session: null }));
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    options?: { display_name?: string; role?: UserRole }
  ) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    setState((s) => ({ ...s, error: null }));
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: options?.display_name ?? email.split('@')[0],
          role: options?.role ?? 'viewer',
        },
      },
    });
    if (error) throw error;
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    signUp,
    setError,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** True if current user can publish content (admin or super_admin). */
export function useCanPublish(): boolean {
  const { role } = useAuth();
  return role === 'admin' || role === 'super_admin';
}
