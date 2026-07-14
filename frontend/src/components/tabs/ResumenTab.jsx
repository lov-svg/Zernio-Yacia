import { useEffect, useState, Fragment } from "react";
import { ArrowUpRight, ArrowDownRight, Instagram, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import api from "../../lib/api";

const PALETTE = {
  terracotta: "#D17D5B",
  sage: "#8A9A7B",
  olive: "#C0A980",
  slate: "#7B8A9A",
  plum: "#B07BA0",
  ink: "#3F3A34",
  border: "#E8E4DB",
  muted: "#8A847C",
};

const fmt = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return v.toLocaleString("es-MX");
};
const fmtFull = (n) => (n == null ? "—" : Number(n).toLocaleString("es-MX"));
const fmtPct = (n, dec = 2) => (n == null ? "—" : `${Number(n).toFixed(dec)}%`);

const pctDelta = (cur, prior) => {
  if (prior == null || prior === 0) return cur ? 100 : 0;
  return ((cur - prior) / prior) * 100;
};

const DeltaLabel = ({ value, suffix = "vs anterior" }) => {
  if (value == null) return null;
  const positive = value > 0;
  const color = value === 0 ? PALETTE.muted : positive ? PALETTE.sage : PALETTE.terracotta;
  const Icon = value === 0 ? null : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-1 text-xs font-medium mt-2" style={{ color }}>
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />}
      <span>{value === 0 ? "0%" : `${Math.abs(value).toFixed(0)}% ${suffix}`}</span>
    </div>
  );
};

const KpiCell = ({ label, value, delta, sub, testid }) => (
  <div className="flex-1 min-w-[160px] px-6 py-5 border-b sm:border-b-0 sm:border-r border-[#E8E4DB] last:border-r-0" data-testid={testid}>
    <p className="text-xs text-stone-500 mb-1">{label}</p>
    <p className="text-2xl font-semibold text-stone-900 tracking-tight">{value}</p>
    {delta !== undefined && <DeltaLabel value={delta} />}
    {sub && <p className="text-xs text-stone-400 mt-2">{sub}</p>}
  </div>
);

const Card = ({ title, subtitle, right, children, testid, className = "" }) => (
  <div className={`bg-white border border-[#E8E4DB] rounded-xl p-5 sm:p-6 shadow-sm ${className}`} data-testid={testid}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
        {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="text-xs text-stone-500 text-right">{right}</div>}
    </div>
    {children}
  </div>
);

const shortWeek = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};
const shortDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

export default function ResumenTab() {
  const [data, setData] = useState(null);
  const [bt, setBt] = useState(null);

  useEffect(() => {
    api.get("/dashboard/overview").then((r) => setData(r.data)).catch(() => {});
    api.get("/dashboard/best-time").then((r) => setBt(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;

  const l30 = data.last30 || {};
  const p30 = data.prior30 || {};
  const followers = data.followers || {};
  const best = data.best_post;
  const range = data.insights?.[0] ? `${data.insights[0].since_date} → ${data.insights[0].until_date}` : null;

  if (!data.insights?.length) {
    return (
      <div className="text-center py-20" data-testid="resumen-empty">
        <p className="text-stone-500">Aún no hay datos. Pulsa <strong>Actualizar datos</strong> arriba para traer tus métricas de Instagram.</p>
      </div>
    );
  }

  const interactionsCur = (l30.likes || 0) + (l30.comments || 0) + (l30.saves || 0) + (l30.shares || 0);

  const weekly = (data.weekly || []).map((w) => ({ ...w, label: shortWeek(w.week_start) }));
  const dailyChart = (data.daily_last30 || []).map((d) => ({
    ...d, label: shortDate(d.date),
    interactions: (d.likes || 0) + (d.comments || 0) + (d.saves || 0) + (d.shares || 0),
  }));
  const followerChart = (data.follower_history_30d || []).map((f) => ({ ...f, label: shortDate(f.date) }));
  if (followerChart.length === 1) {
    followerChart.unshift({ ...followerChart[0], label: "inicio" });
  }
  const freqChart = (data.frequency || []).map((f) => ({
    label: `${f.posts_per_week}/sem`,
    engagement_rate: Number(f.avg_engagement_rate) || 0,
    weeks: f.weeks_count,
  }));
  const accChart = (data.accumulation || []).map((b) => ({
    label: b.bucket_label,
    pct: Number(b.avg_pct_of_final) || 0,
  }));

  return (
    <div className="space-y-6">
      {/* TOP KPI STRIP */}
      <div className="bg-white border border-[#E8E4DB] rounded-xl shadow-sm fade-up overflow-hidden">
        <div className="flex flex-wrap divide-y sm:divide-y-0 sm:divide-x divide-[#E8E4DB]">
          <KpiCell testid="kpi-engagement-rate" label="Tasa de engagement"
            value={fmtPct(l30.engagement_rate)} delta={pctDelta(l30.engagement_rate, p30.engagement_rate)} />
          <KpiCell testid="kpi-total-reach" label="Alcance total"
            value={fmt(l30.reach)} delta={pctDelta(l30.reach, p30.reach)} />
          <KpiCell testid="kpi-total-followers" label="Seguidores totales"
            value={fmt(followers.count)}
            sub={`${followers.delta_30d >= 0 ? "+" : ""}${followers.delta_30d} en 30 días`} />
          <KpiCell testid="kpi-posts-period" label="Publicaciones (30d)"
            value={fmt(l30.posts)} delta={pctDelta(l30.posts, p30.posts)} />
          <div className="flex-1 min-w-[200px] px-6 py-5" data-testid="kpi-best-post">
            <p className="text-xs text-stone-500 mb-2">Mejor publicación</p>
            {best ? (
              <a href={best.permalink || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                {best.picture && (
                  <img src={best.picture} alt="" className="w-11 h-11 rounded-lg object-cover border border-[#E8E4DB]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{best.like_count} likes</p>
                  <p className="text-xs text-[#D17D5B] group-hover:underline inline-flex items-center gap-0.5">
                    Ver en Instagram <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                  </p>
                </div>
              </a>
            ) : <p className="text-stone-400 text-sm">—</p>}
          </div>
        </div>
        {range && (
          <div className="px-6 py-2 bg-[#FDFBF7] border-t border-[#E8E4DB] text-xs text-stone-400">
            Ventana: {range} · Los datos de Instagram pueden tener hasta 48h de retraso
          </div>
        )}
      </div>

      {/* POSTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Publicaciones por plataforma" subtitle="Top plataformas por número de posts" right={`${l30.posts || 0} posts total`} testid="chart-posts-per-platform">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[{ label: "Instagram", posts: l30.posts || 0 }]} margin={{ top: 20, right: 10, bottom: 30, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} />
              <Bar dataKey="posts" fill={PALETTE.terracotta} radius={[6, 6, 0, 0]} maxBarSize={64}>
                <LabelList dataKey="posts" position="top" fill={PALETTE.ink} fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Publicaciones en el tiempo" subtitle="Por semana · últimos 30 días" right={`${l30.posts || 0} posts total`} testid="chart-posts-over-time">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekly} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} />
              <Bar dataKey="posts" name="Publicaciones" fill={PALETTE.terracotta} radius={[6, 6, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="posts" position="top" fill={PALETTE.ink} fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* LIKES ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Likes por plataforma" subtitle="Top plataformas por likes" right={`${fmt(l30.likes)} likes total`} testid="chart-likes-per-platform">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[{ label: "Instagram", likes: l30.likes || 0 }]} margin={{ top: 20, right: 10, bottom: 30, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} />
              <Bar dataKey="likes" fill={PALETTE.sage} radius={[6, 6, 0, 0]} maxBarSize={64}>
                <LabelList dataKey="likes" position="top" fill={PALETTE.ink} fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Likes en el tiempo" subtitle="Por semana · últimos 30 días" right={`${fmt(l30.likes)} likes total`} testid="chart-likes-over-time">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekly} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} />
              <Bar dataKey="likes" name="Likes" fill={PALETTE.sage} radius={[6, 6, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="likes" position="top" fill={PALETTE.ink} fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ENGAGEMENT OVER TIME + SIDE METRICS */}
      <Card title="Engagement en el tiempo" subtitle="Interacciones y alcance por día · últimos 30 días" testid="chart-engagement-over-time">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyChart} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="interactions" name="Interacciones" stroke={PALETTE.terracotta} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="reach" name="Alcance" stroke={PALETTE.sage} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 lg:grid-cols-2 gap-3 content-start" data-testid="engagement-side-metrics">
            {[
              { label: "Likes", value: l30.likes, color: PALETTE.terracotta },
              { label: "Comentarios", value: l30.comments, color: PALETTE.sage },
              { label: "Compartidos", value: l30.shares, color: PALETTE.olive },
              { label: "Guardados", value: l30.saves, color: PALETTE.plum },
              { label: "Vistas", value: l30.views, color: PALETTE.slate },
              { label: "Impresiones", value: l30.impressions, color: PALETTE.terracotta },
              { label: "Alcance", value: l30.reach, color: PALETTE.sage },
              { label: "Interacciones", value: interactionsCur, color: PALETTE.olive },
              { label: "Eng. Rate", value: `${(l30.engagement_rate || 0).toFixed(2)}%`, color: PALETTE.plum, raw: true },
            ].map((m) => (
              <div key={m.label} className="border border-[#E8E4DB] rounded-lg px-3 py-2 bg-[#FDFBF7]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: m.color }} />
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider">{m.label}</span>
                </div>
                <p className="text-lg font-semibold text-stone-900 leading-tight">{m.raw ? m.value : fmt(m.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* BEST TIME + FOLLOWER EVOLUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Mejor hora para publicar"
          subtitle={bt?.timezone ? `Zona horaria ${bt.timezone}` : "—"}
          right={
            <span className="text-[10px] inline-flex items-center gap-1">
              <span className="text-stone-400">menos</span>
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "rgba(138,154,123,0.25)" }} />
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "rgba(138,154,123,0.5)" }} />
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: PALETTE.sage }} />
              <span className="text-stone-400">más</span>
            </span>
          }
          testid="chart-best-time-mini"
        >
          <MiniHeatmap slots={bt?.slots} />
        </Card>

        <Card title="Evolución de seguidores" subtitle="Por cuenta · últimos 30 días" right={`${fmt(followers.count)} totales`} testid="chart-follower-evolution">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={followerChart} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis domain={["dataMin - 20", "dataMax + 20"]} tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="follower_count" name="Seguidores" stroke={PALETTE.terracotta} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* PLATFORM BREAKDOWN */}
      <Card title="Desglose por plataforma" subtitle="Métricas agregadas en la ventana" testid="table-platform-breakdown">
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm">
            <thead className="bg-[#FDFBF7] border-y border-[#E8E4DB]">
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                <th className="px-5 py-3 font-medium">Plataforma</th>
                <th className="px-3 py-3 font-medium text-right">Posts</th>
                <th className="px-3 py-3 font-medium text-right">Likes</th>
                <th className="px-3 py-3 font-medium text-right">Coment.</th>
                <th className="px-3 py-3 font-medium text-right">Compart.</th>
                <th className="px-3 py-3 font-medium text-right">Guard.</th>
                <th className="px-3 py-3 font-medium text-right">Vistas</th>
                <th className="px-3 py-3 font-medium text-right">Impres.</th>
                <th className="px-3 py-3 font-medium text-right">Alcance</th>
                <th className="px-5 py-3 font-medium text-right">ER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE6]">
              {(data.platform_breakdown || []).map((p) => (
                <tr key={p.platform} className="hover:bg-[#FDFBF7]">
                  <td className="px-5 py-3 text-stone-700 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Instagram className="w-4 h-4" style={{ color: PALETTE.terracotta }} strokeWidth={1.6} />
                      <span className="capitalize">{p.platform}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.posts)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.likes)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.comments)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.shares)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.saves)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.views)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.impressions)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.reach)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium" style={{ color: PALETTE.sage }}>{fmtPct(p.engagement_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* TOP PERFORMING */}
      <Card title="Top publicaciones" subtitle="Ordenadas por engagement compuesto" testid="table-top-performing">
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm">
            <thead className="bg-[#FDFBF7] border-y border-[#E8E4DB]">
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                <th className="px-5 py-3 font-medium">Publicación</th>
                <th className="px-3 py-3 font-medium text-right">Likes</th>
                <th className="px-3 py-3 font-medium text-right">Coment.</th>
                <th className="px-3 py-3 font-medium text-right">Compart.</th>
                <th className="px-3 py-3 font-medium text-right">Guard.</th>
                <th className="px-3 py-3 font-medium text-right">Vistas</th>
                <th className="px-3 py-3 font-medium text-right">Impres.</th>
                <th className="px-3 py-3 font-medium text-right">Alcance</th>
                <th className="px-5 py-3 font-medium text-right">ER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE6]">
              {(data.top_posts || []).map((p) => (
                <tr key={p.id} className="hover:bg-[#FDFBF7]">
                  <td className="px-5 py-3">
                    <a href={p.permalink || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                      {p.picture && <img src={p.picture} alt="" className="w-10 h-10 rounded object-cover border border-[#E8E4DB]" />}
                      <div className="min-w-0 max-w-[260px]">
                        <p className="text-xs text-stone-700 line-clamp-1 group-hover:text-[#D17D5B]">{p.caption || "Sin descripción"}</p>
                        <p className="text-xs text-stone-400">{p.created_time ? new Date(p.created_time).toLocaleDateString("es-MX") : ""}</p>
                      </div>
                    </a>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.like_count)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.comment_count)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.shares)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.saves)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.views)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.impressions)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmtFull(p.reach)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium" style={{ color: PALETTE.terracotta }}>{p.engagement_rate == null ? "—" : fmtPct(p.engagement_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* FREQUENCY VS ENGAGEMENT + ACCUMULATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Frecuencia de publicación vs Engagement" subtitle="Tu cadencia óptima" testid="chart-frequency-vs-engagement">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={freqChart} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis unit="%" tick={{ fontSize: 11, fill: PALETTE.muted }} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} formatter={(v) => `${Number(v).toFixed(2)}%`} />
              <Line type="monotone" dataKey="engagement_rate" name="ER promedio" stroke={PALETTE.terracotta} strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-stone-500 mt-3">
            <Instagram className="inline w-3 h-3 mr-1" style={{ color: PALETTE.terracotta }} />
            Cadencia óptima: <strong className="text-stone-700">{bestCadence(freqChart)}</strong>
          </p>
        </Card>

        <Card title="Acumulación de engagement" subtitle="Cómo se acumula el engagement tras publicar" testid="chart-engagement-accumulation">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={accChart} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.terracotta} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={PALETTE.terracotta} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PALETTE.border}`, fontSize: 12 }} formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Area type="monotone" dataKey="pct" name="% del final" stroke={PALETTE.terracotta} strokeWidth={2} fill="url(#accGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          {accChart.length > 0 && (
            <p className="text-xs text-stone-500 mt-3">
              La mitad del engagement se acumula en <strong className="text-stone-700">{halfEngagementBucket(accChart)}</strong>.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function bestCadence(freqChart) {
  if (!freqChart.length) return "—";
  const b = [...freqChart].sort((a, c) => c.engagement_rate - a.engagement_rate)[0];
  return `${b.label} (ER ${b.engagement_rate.toFixed(2)}%)`;
}

function halfEngagementBucket(accChart) {
  const found = accChart.find((b) => b.pct >= 50);
  return found ? found.label : "más de 30 días";
}

const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function MiniHeatmap({ slots }) {
  if (!slots?.length) return <p className="text-stone-400 text-sm py-8 text-center">Sin datos</p>;
  const map = {};
  let max = 0;
  slots.forEach((s) => {
    map[`${s.day_of_week}-${s.hour}`] = s;
    if (s.avg_engagement > max) max = s.avg_engagement;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const best = [...slots].sort((a, b) => b.avg_engagement - a.avg_engagement).slice(0, 3);
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid" style={{ gridTemplateColumns: "36px repeat(24, 1fr)", gap: 2 }}>
            <div />
            {hours.map((h) => (
              <div key={h} className="text-[9px] text-stone-400 text-center">{h % 3 === 0 ? h : ""}</div>
            ))}
            {DAYS_SHORT.map((d, di) => (
              <Fragment key={di}>
                <div className="text-[10px] text-stone-500 font-medium flex items-center">{d}</div>
                {hours.map((h) => {
                  const s = map[`${di}-${h}`];
                  const intensity = s ? s.avg_engagement / (max || 1) : 0;
                  return (
                    <div
                      key={`${di}-${h}`}
                      title={s ? `${d} ${h}:00 — eng ${s.avg_engagement}` : `${d} ${h}:00`}
                      className="aspect-square rounded-[2px]"
                      style={{ backgroundColor: s ? `rgba(138, 154, 123, ${0.15 + intensity * 0.85})` : "#F5F2EC" }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4 text-xs text-stone-500">
        <span className="font-medium">Mejores franjas:</span>
        {best.map((s, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full bg-[#FDFBF7] border border-[#E8E4DB]">
            {DAYS_SHORT[s.day_of_week]} {s.hour}:00
          </span>
        ))}
      </div>
    </div>
  );
}
