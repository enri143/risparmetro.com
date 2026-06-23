import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { Skeleton } from "@/components/ui/skeleton";

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsPlatformAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-sm font-medium text-muted-foreground">Accesso riservato.</p>
        <Link
          to="/board"
          className="text-sm text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
        >
          Torna al board
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
