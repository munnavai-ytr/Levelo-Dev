'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  auth, 
  googleProvider, 
  isFirebaseConfigured, 
  localAuth 
} from '@/lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthLoading, setUser, setIsAuthLoading } = useAppStore();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // 1. If Firebase is configured and available
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Game Developer',
            photoURL: firebaseUser.photoURL
          });
        } else {
          // Check if local demo user exists
          const local = localAuth.getUser();
          if (local) {
            setUser(local);
          } else {
            setUser(null);
          }
        }
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Fallback: check local storage auth for testing/demo
      const local = localAuth.getUser();
      if (local) {
        setUser(local);
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    }
  }, [setUser, setIsAuthLoading]);

  const signInGoogle = useCallback(async () => {
    setAuthError(null);
    if (isFirebaseConfigured && auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          setUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || 'Game Creator',
            photoURL: result.user.photoURL
          });
          router.push('/dashboard');
        }
      } catch (err: any) {
        console.error('Google sign-in error:', err);
        setAuthError(err.message || 'Failed to sign in with Google');
        throw err;
      }
    } else {
      // In local mode without Firebase credentials
      if (process.env.NODE_ENV === 'production') {
        setAuthError('Firebase credentials are required in production.');
        return;
      }
      const demoUser = localAuth.loginDemo('Google User', 'creator@levelo.ai');
      setUser(demoUser);
      router.push('/dashboard');
    }
  }, [setUser, router]);

  const signInEmail = useCallback(async (email: string, pass: string) => {
    setAuthError(null);
    if (isFirebaseConfigured && auth) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        if (res.user) {
          setUser({
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName || email.split('@')[0],
            photoURL: res.user.photoURL
          });
          router.push('/dashboard');
        }
      } catch (err: any) {
        setAuthError(err.message || 'Failed to sign in');
        throw err;
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        setAuthError('Firebase credentials are required in production.');
        return;
      }
      const demoUser = localAuth.loginDemo(email.split('@')[0], email);
      setUser(demoUser);
      router.push('/dashboard');
    }
  }, [setUser, router]);

  const signUpEmail = useCallback(async (email: string, pass: string) => {
    setAuthError(null);
    if (isFirebaseConfigured && auth) {
      try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        if (res.user) {
          setUser({
            uid: res.user.uid,
            email: res.user.email,
            displayName: email.split('@')[0],
            photoURL: res.user.photoURL
          });
          router.push('/dashboard');
        }
      } catch (err: any) {
        setAuthError(err.message || 'Failed to create account');
        throw err;
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        setAuthError('Firebase credentials are required in production.');
        return;
      }
      const demoUser = localAuth.loginDemo(email.split('@')[0], email);
      setUser(demoUser);
      router.push('/dashboard');
    }
  }, [setUser, router]);

  const signOut = useCallback(async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error('Sign-out error:', err);
      }
    }
    localAuth.logout();
    setUser(null);
    router.push('/login');
  }, [setUser, router]);

  return {
    user,
    isAuthLoading,
    authError,
    setAuthError,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOut,
    isFirebaseConfigured
  };
}
