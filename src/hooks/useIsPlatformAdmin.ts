import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useIsPlatformAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (!cancelled) {
        setIsAdmin(!error && data === true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
