import { useEffect, useState } from "react";
import { Eye, Users, Heart, MessageCircle, Bookmark, Share2, Zap, TrendingUp, Star, Percent, BarChart3, Sparkles } from "lucide-react";
import api from "../../lib/api";

const KpiCard = ({ label, value, icon: Icon, sub, delay, format = "number" }) => (
  <div
    className="bg-white border border-[#E8E4DB] rounded-xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 fade-up"
    style={{ animationDelay: `${delay * 60}ms` }}
    data-testid={`kpi-card-${label.toLowerCase().replace(/\s/g, "-")}`}
  >
    <div className="flex items-start justify-between mb-4">
      <span className="text-xs uppercase tracking-[0.1em] text-stone-500 font-medium">{label}</span>
      <Icon className="w-5 h-5 text-[#D17D5B]" strokeWidth={1.5} />
    </div>
    <p className="text-3xl font-semibold text-stone-900 tracking-tight">
      {value == null ? "—" : format === "percent" ? `${Number(value).toLocaleString("es-MX")}%` : Number(value).toLocaleString("es-MX")}
    </p>
    {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
  </div>
);

export default function ResumenTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/overview").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;

  const ins = Object.fromEntries((data.insights || []).map((i) => [i.metric, i.value]));
  const l30 = data.last30 || {};
  const best = data.best_post;
  const range = data.insights?.[0] ? `${data.insights[0].since_date} → ${data.insights[0].until_date}` : null;

  const hasData = data.insights?.length > 0;
  if (!hasData) {
    return (
      <div className="text-center py-20" data-testid="resumen-empty">
        <p className="text-stone-500">Aún no hay datos. Pulsa <strong>Actualizar datos</strong> en la parte superior para traer tus métricas de Instagram.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-1">Últimos 30 días</h2>
        {range && <p className="text-xs text-stone-400 mb-6">{range} · Los datos de Instagram pueden tener hasta 48h de retraso</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <KpiCard label="Alcance" value={ins.reach} icon={Users} delay={0} />
          <KpiCard label="Visualizaciones" value={ins.views} icon={Eye} delay={1} />
          <KpiCard label="Cuentas con engagement" value={ins.accounts_engaged} icon={Zap} delay={2} />
          <KpiCard label="Interacciones" value={ins.total_interactions} icon={TrendingUp} delay={3} />
        </div>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-6">Rendimiento de publicaciones (30 días)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <KpiCard label="Impresiones" value={l30.impressions} icon={BarChart3} delay={0} sub="Suma de vistas totales" />
          <KpiCard label="Alcance orgánico" value={l30.reach} icon={Sparkles} delay={1} sub="Cuentas únicas alcanzadas" />
          <KpiCard label="Tasa de engagement" value={l30.engagement_rate} icon={Percent} delay={2} format="percent" sub={`sobre ${(l30.reach || 0).toLocaleString("es-MX")} de alcance`} />
          <KpiCard label="Publicaciones" value={l30.posts} icon={Star} delay={3} sub={`Promedio ${l30.posts ? (l30.posts / 4.3).toFixed(1) : 0} / semana`} />
        </div>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-6">Interacciones por tipo (30 días)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <KpiCard label="Likes" value={l30.likes} icon={Heart} delay={4} sub={`en ${l30.posts || 0} publicaciones`} />
          <KpiCard label="Comentarios" value={l30.comments} icon={MessageCircle} delay={5} />
          <KpiCard label="Guardados" value={l30.saves} icon={Bookmark} delay={6} />
          <KpiCard label="Compartidos" value={l30.shares} icon={Share2} delay={7} />
        </div>
      </div>

      {best && (
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-6">Mejor publicación</h2>
          <a
            href={best.permalink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="best-post-card"
            className="flex gap-4 items-center bg-white border border-[#E8E4DB] rounded-xl p-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200"
          >
            {best.picture && (
              <img src={best.picture} alt="" className="w-24 h-24 rounded-lg object-cover border border-[#E8E4DB]" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-700 line-clamp-2">{best.caption || "Sin descripción"}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-[#D17D5B]" strokeWidth={1.5} />{best.like_count}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-[#8A9A7B]" strokeWidth={1.5} />{best.comment_count}</span>
              </div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
