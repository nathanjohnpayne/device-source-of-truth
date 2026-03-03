import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { trackEvent } from '../lib/analytics';
import type { User, UserRole } from '../lib/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isEditor: boolean;
  isAdmin: boolean;
}

const ALLOWED_DOMAINS = ['disney.com', 'disneystreaming.com'];

const DOMAIN_DENIED_MESSAGE =
  'Your email domain is not authorized to access Device Source of Truth.';

function isDomainAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser || !fbUser.email) {
        setState({ firebaseUser: null, user: null, loading: false, error: null });
        return;
      }

      if (!isDomainAllowed(fbUser.email)) {
        await firebaseSignOut(auth);
        trackEvent('login_failed', { reason: 'domain_rejected' });
        setState({
          firebaseUser: null,
          user: null,
          loading: false,
          error: DOMAIN_DENIED_MESSAGE,
        });
        return;
      }

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', fbUser.email));
        const snap = await getDocs(q);

        if (snap.empty) {
          setState({
            firebaseUser: fbUser,
            user: {
              id: fbUser.uid,
              email: fbUser.email,
              role: 'viewer',
              displayName: fbUser.displayName || fbUser.email,
              photoUrl: fbUser.photoURL,
              lastLogin: new Date().toISOString(),
            },
            loading: false,
            error: null,
          });
          return;
        }

        const doc = snap.docs[0];
        setState({
          firebaseUser: fbUser,
          user: { id: doc.id, ...doc.data() } as User,
          loading: false,
          error: null,
        });
      } catch {
        setState({
          firebaseUser: fbUser,
          user: {
            id: fbUser.uid,
            email: fbUser.email!,
            role: 'viewer',
            displayName: fbUser.displayName || fbUser.email!,
            photoUrl: fbUser.photoURL,
            lastLogin: new Date().toISOString(),
          },
          loading: false,
          error: null,
        });
      }
    });

    return unsub;
  }, []);

  const signIn = async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';

      if (!isDomainAllowed(email)) {
        await firebaseSignOut(auth);
        trackEvent('login_failed', { reason: 'domain_rejected' });
        setState((s) => ({
          ...s,
          firebaseUser: null,
          user: null,
          error: DOMAIN_DENIED_MESSAGE,
        }));
        return;
      }

      trackEvent('login', { method: 'google' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      const isDomainError =
        message.includes('domain') ||
        message.includes('permission-denied') ||
        message.includes('PERMISSION_DENIED');
      setState((s) => ({
        ...s,
        firebaseUser: null,
        user: null,
        error: isDomainError ? DOMAIN_DENIED_MESSAGE : message,
      }));
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setState({ firebaseUser: null, user: null, loading: false, error: null });
  };

  const role: UserRole = state.user?.role ?? 'viewer';

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    isEditor: role === 'editor' || role === 'admin',
    isAdmin: role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
