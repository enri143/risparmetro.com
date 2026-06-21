import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Upload, X, Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const brandingSchema = z.object({
  brand_name: z.string().min(1, "Nome brand obbligatorio"),
  brand_phone: z.string().min(1, "Telefono obbligatorio"),
  brand_email: z
    .union([z.string().email("Formato email non valido"), z.literal("")])
    .optional(),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Formato hex non valido (es. #1D9E75)"),
  ragione_sociale: z.string().optional(),
  piva: z.string().optional(),
  logo_url: z.string().min(1, "Carica un logo prima di salvare"),
});

type FormValues = z.infer<typeof brandingSchema>;

// ─── LogoUploader ─────────────────────────────────────────────────────────────

function LogoUploader({
  tenantId,
  logoUrl,
  onUploaded,
  onRemove,
}: {
  tenantId: string | null;
  logoUrl: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!tenantId) {
      toast.error("Sessione non inizializzata — ricarica la pagina");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Il file supera 2 MB");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato non supportato (PNG, JPG, SVG, WebP)");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${tenantId}/logo.${ext}`;

      // Remove any existing logo.* files for this tenant before uploading
      const { data: existing } = await supabase.storage
        .from("brand-assets")
        .list(tenantId, { search: "logo" });
      if (existing && existing.length > 0) {
        await supabase.storage
          .from("brand-assets")
          .remove(existing.map((f) => `${tenantId}/${f.name}`));
      }

      const { error: uploadErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("brand-assets").getPublicUrl(path);

      onUploaded(publicUrl);
      toast.success("Logo caricato");
    } catch (e) {
      toast.error(
        "Errore upload: " + (e instanceof Error ? e.message : "sconosciuto"),
      );
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  if (logoUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center rounded-lg border bg-muted/40 min-h-[96px] p-3">
          <img
            src={logoUrl}
            alt="Logo brand"
            className="max-h-24 max-w-full object-contain"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 min-h-[48px]"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Sostituisci
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="gap-2 min-h-[48px] text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            Rimuovi
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={onInputChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer min-h-[160px] select-none",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/20",
          uploading && "pointer-events-none opacity-60",
        )}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            {uploading ? "Caricamento..." : "Trascina o clicca per selezionare"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PNG, JPG, SVG, WebP · max 2 MB
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={onInputChange}
      />
    </div>
  );
}

// ─── BrandingPreview ──────────────────────────────────────────────────────────

function BrandingPreview({
  logoUrl,
  brandName,
  brandPhone,
  accentColor,
}: {
  logoUrl: string;
  brandName: string;
  brandPhone: string;
  accentColor: string;
}) {
  const hasContent = brandName || brandPhone || logoUrl;

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 min-h-[100px]">
        <p className="text-sm text-muted-foreground text-center">
          Compila i campi per vedere l'anteprima
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 flex items-center justify-center bg-muted rounded-md w-14 h-14 p-1.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageOff className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground leading-tight truncate">
            {brandName || (
              <span className="text-muted-foreground italic font-normal text-sm">
                Nome brand
              </span>
            )}
          </p>
          <div
            className="h-[2px] rounded-full my-1.5"
            style={{ backgroundColor: accentColor || "#1D9E75" }}
          />
          <p className="text-sm text-muted-foreground truncate">
            {brandPhone || (
              <span className="italic">Telefono</span>
            )}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground border-t mt-3 pt-2 uppercase tracking-wide">
        Anteprima testata report PDF
      </p>
    </div>
  );
}

// ─── BrandingTab ──────────────────────────────────────────────────────────────

export function BrandingTab() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      brand_name: "",
      brand_phone: "",
      brand_email: "",
      accent_color: "#1D9E75",
      ragione_sociale: "",
      piva: "",
      logo_url: "",
    },
  });

  const watched = watch();

  useEffect(() => {
    async function load() {
      const { data: tid } = await supabase.rpc("current_tenant_id");
      if (tid) setTenantId(tid as string);

      const { data } = await supabase
        .from("tenant_branding")
        .select("*")
        .maybeSingle();
      if (!data) return;

      setValue("brand_name", data.brand_name ?? "");
      setValue("brand_phone", data.brand_phone ?? "");
      setValue("brand_email", data.brand_email ?? "");
      setValue("accent_color", data.accent_color ?? "#1D9E75");
      setValue("ragione_sociale", data.ragione_sociale ?? "");
      setValue("piva", data.piva ?? "");
      setValue("logo_url", data.logo_url ?? "");
    }
    load();
  }, [setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!tenantId) {
      toast.error("Sessione non inizializzata — ricarica la pagina");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("tenant_branding").upsert(
        {
          tenant_id: tenantId,
          brand_name: values.brand_name,
          brand_phone: values.brand_phone,
          brand_email: values.brand_email || null,
          accent_color: values.accent_color,
          ragione_sociale: values.ragione_sociale || null,
          piva: values.piva || null,
          logo_url: values.logo_url,
        },
        { onConflict: "tenant_id" },
      );
      if (error) throw error;
      toast.success("Branding salvato");
    } catch (e) {
      toast.error(
        "Errore salvataggio: " +
          (e instanceof Error ? e.message : "sconosciuto"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        {/* Colonna sinistra: campi testo */}
        <Card className="p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Dati brand
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="brand_name">Nome brand *</Label>
            <Input
              id="brand_name"
              placeholder="es. Luce Gas Vicenza"
              {...register("brand_name")}
              className={cn(errors.brand_name && "border-destructive")}
            />
            {errors.brand_name && (
              <p className="text-xs text-destructive">
                {errors.brand_name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand_phone">Telefono *</Label>
            <Input
              id="brand_phone"
              placeholder="es. +39 0444 123456"
              {...register("brand_phone")}
              className={cn(errors.brand_phone && "border-destructive")}
            />
            {errors.brand_phone && (
              <p className="text-xs text-destructive">
                {errors.brand_phone.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand_email">Email (opzionale)</Label>
            <Input
              id="brand_email"
              type="email"
              placeholder="es. info@lucegasvicenza.it"
              {...register("brand_email")}
              className={cn(errors.brand_email && "border-destructive")}
            />
            {errors.brand_email && (
              <p className="text-xs text-destructive">
                {errors.brand_email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ragione_sociale">Ragione sociale (opzionale)</Label>
            <Input
              id="ragione_sociale"
              placeholder="es. Luce Gas Vicenza S.r.l."
              {...register("ragione_sociale")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="piva">P.IVA (opzionale)</Label>
            <Input
              id="piva"
              placeholder="es. IT01234567890"
              {...register("piva")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accent_color_text">Colore accent</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={watched.accent_color || "#1D9E75"}
                onChange={(e) =>
                  setValue("accent_color", e.target.value, {
                    shouldValidate: true,
                  })
                }
                className="h-12 w-12 rounded-md border cursor-pointer p-0.5 flex-shrink-0"
                title="Scegli colore"
              />
              <Input
                id="accent_color_text"
                {...register("accent_color")}
                placeholder="#1D9E75"
                className={cn(
                  "font-mono",
                  errors.accent_color && "border-destructive",
                )}
              />
            </div>
            {errors.accent_color && (
              <p className="text-xs text-destructive">
                {errors.accent_color.message}
              </p>
            )}
          </div>
        </Card>

        {/* Colonna destra: logo + preview */}
        <div className="space-y-5">
          <Card className="p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Logo brand *
            </p>
            <LogoUploader
              tenantId={tenantId}
              logoUrl={watched.logo_url ?? ""}
              onUploaded={(url) =>
                setValue("logo_url", url, { shouldValidate: true })
              }
              onRemove={() => {
                setValue("logo_url", "", { shouldValidate: true });
                toast.warning(
                  "Logo rimosso — obbligatorio per salvare il branding",
                );
              }}
            />
            {errors.logo_url && (
              <p className="text-xs text-destructive">
                {errors.logo_url.message}
              </p>
            )}
          </Card>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
              Anteprima testata PDF
            </p>
            <BrandingPreview
              logoUrl={watched.logo_url ?? ""}
              brandName={watched.brand_name ?? ""}
              brandPhone={watched.brand_phone ?? ""}
              accentColor={watched.accent_color ?? "#1D9E75"}
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={saving}
        className="gap-2 min-h-[48px] w-full sm:w-auto"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salva branding
      </Button>
    </form>
  );
}
