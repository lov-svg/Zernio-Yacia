import { useEffect, useState, useCallback } from "react";
import { Sparkles, X, MessageCircle, Mail, TrendingUp, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import api from "../../lib/api";

const BUCKETS = [
  { key: "comments", label: "De comentarios", target: 10, icon: MessageCircle },
  { key: "dms", label: "De DMs", target: 5, icon: Mail },
  { key: "top_content", label: "De tu mejor contenido", target: 10, icon: TrendingUp },
];

const QUICK_REASONS = ["No me interesa el tema", "Ya lo hice antes", "No encaja con mi marca", "Muy complicado de producir", "Otro"];

const IdeaCard = ({ idea, onDiscard }) => (
  <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4 fade-up" data-testid={`idea-card-${idea.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="font-serif font-semibold text-stone-900 leading-snug">{idea.angle}</h4>
        <span className="inline-block mt-2 text-[11px] uppercase tracking-[0.1em] font-medium text-[#D17D5B] bg-[#D17D5B]/10 rounded-full px-3 py-1">
          {idea.format}
        </span>
      </div>
      <button
        onClick={() => onDiscard(idea)}
        data-testid={`discard-idea-btn-${idea.id}`}
        className="shrink-0 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1.5 transition-colors"
        title="Descartar idea"
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>

    {idea.evidence_quotes?.length > 0 && (
      <div className="bg-[#FDFBF7] border border-[#E8E4DB] rounded-lg p-4">
        <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 font-medium mb-2">Lo que lo inspiró</p>
        {idea.evidence_quotes.map((q, i) => (
          <p key={i} className="text-sm text-stone-600 italic mb-1.5 last:mb-0">“{q}”</p>
        ))}
      </div>
    )}

    {idea.why_good_idea && (
      <div>
        <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 font-medium mb-1">Por qué es buena idea</p>
        <p className="text-sm text-stone-600">{idea.why_good_idea}</p>
      </div>
    )}

    {idea.suggested_angle && (
      <div>
        <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 font-medium mb-1">Ángulo sugerido</p>
        <p className="text-sm text-stone-600">{idea.suggested_angle}</p>
      </div>
    )}

    {idea.related_posts?.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {idea.related_posts.map((p) => (
          <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-[#8A9A7B] hover:underline">
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} /> post relacionado
          </a>
        ))}
      </div>
    )}
  </div>
);

export default function IdeasTab() {
  const [data, setData] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [discardTarget, setDiscardTarget] = useState(null);
  const [reasonQuick, setReasonQuick] = useState(QUICK_REASONS[0]);
  const [reasonText, setReasonText] = useState("");

  const load = useCallback(() => {
    api.get("/ideas").then((r) => setData(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async (bucket) => {
    setGenerating(bucket || "all");
    toast.info(bucket ? "Regenerando ideas de este grupo…" : "Generando todas las ideas… puede tardar 1-2 minutos");
    try {
      const r = await api.post("/ideas/generate", { bucket });
      toast.success(`${r.data.count} ideas generadas`);
      load();
    } catch (e) {
      toast.error("Error al generar ideas: " + (e.response?.data?.detail || e.message));
    } finally {
      setGenerating(null);
    }
  };

  const confirmDiscard = async () => {
    try {
      await api.post(`/ideas/${discardTarget.id}/discard`, { reason_quick: reasonQuick, reason_text: reasonText });
      toast.success("Idea descartada. Claude la tendrá en cuenta en la próxima generación.");
      setDiscardTarget(null);
      setReasonText("");
      load();
    } catch (e) {
      toast.error("Error al descartar");
    }
  };

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;

  const total = Object.values(data.buckets).flat().length;

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800">Generador de ideas con IA</h2>
          <p className="text-sm text-stone-500 mt-1">
            Claude analiza tus comentarios, DMs y mejores posts para proponerte ideas ancladas en datos reales. Costo aproximado por generación: $0.10–0.30 USD.
          </p>
        </div>
        <Button
          onClick={() => generate(null)}
          disabled={!!generating}
          data-testid="generate-all-ideas-btn"
          className="bg-[#D17D5B] hover:bg-[#BA6949] text-white rounded-full px-6 py-5 transition-all duration-200 active:scale-95 shrink-0"
        >
          <Sparkles className={`w-4 h-4 mr-2 ${generating === "all" ? "animate-pulse" : ""}`} strokeWidth={1.5} />
          {generating === "all" ? "Generando…" : "Generar todas las ideas"}
        </Button>
      </div>

      {total === 0 && !generating && (
        <p className="text-stone-500 text-center py-8" data-testid="ideas-empty">
          Aún no hay ideas. Pulsa “Generar todas las ideas” (asegúrate de haber actualizado los datos primero).
        </p>
      )}

      {BUCKETS.map((b) => {
        const ideas = data.buckets[b.key] || [];
        const Icon = b.icon;
        return (
          <section key={b.key} data-testid={`bucket-${b.key}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-lg font-medium text-stone-800 flex items-center gap-2">
                <Icon className="w-5 h-5 text-[#D17D5B]" strokeWidth={1.5} />
                {b.label} <span className="text-sm text-stone-400 font-normal">{ideas.length}/{b.target}</span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generate(b.key)}
                disabled={!!generating}
                data-testid={`regenerate-bucket-${b.key}`}
                className="rounded-full border-[#E8E4DB] text-stone-600 hover:bg-[#F5F2EC]"
              >
                <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${generating === b.key ? "animate-spin" : ""}`} strokeWidth={1.5} />
                Regenerar grupo
              </Button>
            </div>
            {ideas.length === 0 ? (
              <p className="text-sm text-stone-400 pl-7">Sin ideas en este grupo todavía.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {ideas.map((i) => <IdeaCard key={i.id} idea={i} onDiscard={setDiscardTarget} />)}
              </div>
            )}
          </section>
        );
      })}

      {data.recent_discards?.length > 0 && (
        <section data-testid="recent-discards">
          <h3 className="text-lg font-medium text-stone-800 mb-3">Últimas descartadas</h3>
          <p className="text-xs text-stone-400 mb-4">Claude lee estos descartes al regenerar para no repetir ideas similares.</p>
          <div className="space-y-2">
            {data.recent_discards.map((d) => (
              <div key={d.id} className="bg-[#F5F2EC] border border-[#E8E4DB] rounded-lg px-4 py-3 text-sm text-stone-600 flex flex-wrap gap-x-2">
                <span className="font-medium text-stone-700">“{d.angle}”</span>
                <span className="text-stone-400">· {d.reason_quick}{d.reason_text ? ` — ${d.reason_text}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <DialogContent className="max-w-md" data-testid="discard-modal">
          <DialogHeader>
            <DialogTitle className="font-serif">Descartar idea</DialogTitle>
            <DialogDescription className="sr-only">Selecciona la razón del descarte</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-stone-600">¿Por qué descartas esta idea? Claude aprenderá de tu respuesta para no proponerte cosas similares.</p>
          <Select value={reasonQuick} onValueChange={setReasonQuick}>
            <SelectTrigger data-testid="discard-reason-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUICK_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Detalles adicionales (opcional)"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            data-testid="discard-reason-text"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardTarget(null)} className="rounded-full">Cancelar</Button>
            <Button onClick={confirmDiscard} data-testid="confirm-discard-btn" className="bg-[#D17D5B] hover:bg-[#BA6949] text-white rounded-full">
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
