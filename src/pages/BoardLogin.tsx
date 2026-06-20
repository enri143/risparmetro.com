import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export const BOARD_AUTH_KEY = "board_authenticated";
export const BOARD_PWD_KEY = "board_pwd";

export default function BoardLogin() {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem(BOARD_AUTH_KEY) === "1") navigate("/board", { replace: true });
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== "energia2026") {
      toast.error("Password errata");
      return;
    }
    sessionStorage.setItem(BOARD_AUTH_KEY, "1");
    sessionStorage.setItem(BOARD_PWD_KEY, password);
    navigate("/board", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Salesboard — Accesso</h1>
        </div>
        <p className="text-xs text-muted-foreground">Inserisci la password per accedere.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
          </div>
          <Button type="submit" className="w-full">
            Entra
          </Button>
        </form>
      </Card>
    </div>
  );
}
