import { useEffect, useState } from "react";
import { Eye, Users, Heart, MessageCircle, Bookmark, Share2, Zap, TrendingUp } from "lucide-react";
import api from "../../lib/api";

const KpiCard = ({ label, value, icon: Icon, sub, delay }) => (
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
      {value != null ? Number(value).toLocaleString("es-MX") : "—"}
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
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-6">Interacciones por tipo (30 días)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <KpiCard label="Likes" value={l30.likes} icon={Heart} delay={4} sub={`en ${l30.posts || 0} publicaciones`} />
          <KpiCard label="Comentarios" value={l30.comments} icon={MessageCircle} delay={5} />
          <KpiCard label="Guardados" value={l30.saves} icon={Bookmark} delay={6} />
          <KpiCard label="Compartidos" value={l30.shares} icon={Share2} delay={7} />
        </div>
      </div>
    </div>
  );
}
