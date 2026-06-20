import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Impostazioni } from "@/lib/board/types";

interface Ctx {
  impostazioni: Impostazioni | null;
  loading: boolean;
  reload: () => Promise<void>;
  save: (patch: Partial<Impostazioni>) => Promise<void>;
}

const ImpostazioniCtx = createContext<Ctx | null>(null);

export function ImpostazioniProvider({ children }: { children: ReactNode }) {
  const [impostazioni, setImpostazioni] = useState<Impostazioni | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setImpostazioni((prev) => {
      if (!prev) setLoading(true);
      return prev;
    });
    const { data } = await supabase.from("impostazioni").select("*").eq("id", 1).maybeSingle();
    if (data) setImpostazioni(data as unknown as Impostazioni);
    setLoading(false);
  }, []);

  const save = useCallback(async (patch: Partial<Impostazioni>) => {
    await supabase.from("impostazioni").update(patch).eq("id", 1);
    await reload();
  }, [reload]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <ImpostazioniCtx.Provider value={{ impostazioni, loading, reload, save }}>
      {children}
    </ImpostazioniCtx.Provider>
  );
}

export function useImpostazioni() {
  const ctx = useContext(ImpostazioniCtx);
  if (!ctx) throw new Error("useImpostazioni must be inside ImpostazioniProvider");
  return ctx;
}
