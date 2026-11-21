import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, checkGoogleAuth } from '../lib/supabase';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return query.get('error_description') ?? hash.get('error_description');
  });

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    // 현재 세션 복원. 실패해도 로그인 버튼을 다시 사용할 수 있도록 한다.
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(errorMessage(sessionError));
      setUser(session?.user ?? null);
    }).catch((sessionError: unknown) => {
      if (active) setError(errorMessage(sessionError));
    }).finally(() => {
      if (active) setLoading(false);
    });

    // 로그인/로그아웃 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase || signingIn) return;
    setError(null);
    setSigningIn(true);
    try {
      await checkGoogleAuth();
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (signInError) throw signInError;
    } catch (signInError) {
      setError(errorMessage(signInError));
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setError(errorMessage(signOutError));
    }
  };

  return { user, loading, signingIn, error, signInWithGoogle, signOut };
}
