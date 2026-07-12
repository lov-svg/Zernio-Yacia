import { useEffect, useState, Fragment } from "react";
import { Inbox, Send, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import api from "../../lib/api";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("es-MX"));

const fmtDuration = (secs) => {
  if (secs == null) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

const Kpi = ({ label, value, icon: Icon, sub, tone = "terracotta", delay }) => {
  const colors = {
    terracotta: "#D17D5B",
    sage: "#8A9A7B",
    olive: "#C0A980",
    slate: "#7B8A9A",
    plum: "#B07BA0",
  };
  return (
    <div
      className="bg-white border border-[#E8E4DB] rounded-xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 fade-up"
      style={{ animationDelay: `${delay * 60}ms` }}
      data-testid={`inbox-kpi-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs uppercase tracking-[0.1em] text-stone-500 font-medium">{label}</span>
        <Icon className="w-5 h-5" strokeWidth={1.5} style={{ color: colors[tone] }} />
      </div>
      <p className="text-3xl font-semibold text-stone-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
};

export default function BandejaTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/inbox").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;
  const t = data.totals || {};

  if (!t.received && !t.sent) {
    return (
      <div className="text-center py-20" data-testid="bandeja-empty">
        <p className="text-stone-500">Aún no hay mensajes. Pulsa <strong>Actualizar datos</strong>.</p>
      </div>
    );
  }

  const totalResponses = (data.response_time_buckets || []).reduce((s, b) => s + b.count, 0);
  const under5 = (data.response_time_buckets || []).filter((b) => b.label === "0-1m" || b.label === "1-5m")
    .reduce((s, b) => s + b.count, 0);
  const pctUnder5 = totalResponses ? Math.round((under5 / totalResponses) * 100) : 0;

  // Heatmap
  const hmMap = {};
  let hmMax = 0;
  (data.when_messages_land || []).forEach((s) => {
    hmMap[`${s.day_of_week}-${s.hour}`] = s.count;
    if (s.count > hmMax) hmMax = s.count;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Bar chart colors por bucket
  const bucketColor = (label) => {
    const map = { "0-1m": "#8A9A7B", "1-5m": "#8A9A7B", "5-15m": "#C0A980",
                  "15-60m": "#D99B78", "1-4h": "#D17D5B", "4-24h": "#B07BA0", "1d+": "#7B8A9A" };
    return map[label] || "#D17D5B";
  };

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div>
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-1">Bandeja de entrada</h2>
        <p className="text-xs text-stone-400 mb-6">
          {t.conversations} conversaciones · Zona horaria {data.timezone}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <Kpi label="Recibidos" value={fmt(t.received)} icon={Inbox} tone="sage" delay={0} sub="Mensajes entrantes" />
          <Kpi label="Enviados" value={fmt(t.sent)} icon={Send} tone="terracotta" delay={1} sub="Respuestas enviadas" />
          <Kpi label="Conversaciones" value={fmt(t.conversations)} icon={MessageSquare} tone="olive" delay={2} />
          <Kpi label="Tiempo mediano" value={fmtDuration(t.median_response_seconds)} icon={Clock} tone="plum" delay={3}
               sub="para primera respuesta" />
          <Kpi label="Sin respuesta" value={fmt(t.waiting_reply)} icon={AlertCircle} tone="slate" delay={4}
               sub="Conversaciones abiertas" />
        </div>
      </div>

      {/* Mensajes en el tiempo */}
      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
        <h3 className="text-lg sm:text-xl font-serif font-semibold text-stone-800 mb-1">Mensajes en el tiempo</h3>
        <p className="text-sm text-stone-500 mb-6">Volumen recibido vs enviado por día.</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.over_time} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A847C" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8A847C" }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="received" name="Recibidos" stroke="#8A9A7B" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="sent" name="Enviados" stroke="#D17D5B" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tiempo de respuesta */}
      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="text-lg sm:text-xl font-serif font-semibold text-stone-800">Distribución de tiempo de respuesta</h3>
          <span className="text-sm text-[#8A9A7B] font-medium" data-testid="inbox-pct-under5">
            {pctUnder5}% en menos de 5 min
          </span>
        </div>
        <p className="text-sm text-stone-500 mb-6">
          Cuánto tardas en enviar la primera respuesta después de un mensaje del cliente ({fmt(totalResponses)} respuestas medidas).
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.response_time_buckets} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A847C" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8A847C" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }}
              formatter={(v, k, p) => [`${v} respuestas (${p.payload.pct_cumulative}% acumulado)`, "Cantidad"]}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {(data.response_time_buckets || []).map((b, i) => (
                <Cell key={i} fill={bucketColor(b.label)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap - Cuándo llegan */}
      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
        <h3 className="text-lg sm:text-xl font-serif font-semibold text-stone-800 mb-1">Cuándo llegan los mensajes</h3>
        <p className="text-sm text-stone-500 mb-6">Volumen por día de semana y hora local ({data.timezone}).</p>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[900px]">
            <div className="grid" style={{ gridTemplateColumns: "48px repeat(24, 1fr)", gap: 3 }}>
              <div />
              {hours.map((h) => (
                <div key={h} className="text-[10px] text-stone-400 text-center">{h}</div>
              ))}
              {DAYS.map((d, di) => (
                <Fragment key={di}>
                  <div className="text-xs text-stone-500 font-medium flex items-center">{d}</div>
                  {hours.map((h) => {
                    const c = hmMap[`${di}-${h}`] || 0;
                    const intensity = hmMax ? c / hmMax : 0;
                    return (
                      <div
                        key={`${di}-${h}`}
                        title={`${d} ${h}:00 — ${c} mensajes`}
                        data-testid={`inbox-cell-${di}-${h}`}
                        className="aspect-square rounded-[4px] transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c ? `rgba(138, 154, 123, ${0.15 + intensity * 0.85})` : "#F5F2EC",
                        }}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top participantes */}
      <div>
        <h3 className="text-lg sm:text-xl font-serif font-semibold text-stone-800 mb-4">Top participantes</h3>
        <div className="bg-white border border-[#E8E4DB] rounded-xl shadow-sm overflow-x-auto" data-testid="inbox-top-participants">
          <table className="w-full text-sm">
            <thead className="bg-[#FDFBF7] border-b border-[#E8E4DB]">
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                <th className="px-4 py-3 font-medium">Participante</th>
                <th className="px-3 py-3 font-medium text-right">Recibidos</th>
                <th className="px-3 py-3 font-medium text-right">Enviados</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE6]">
              {(data.top_participants || []).map((p) => (
                <tr key={p.conversation_id} className="hover:bg-[#FDFBF7] transition-colors">
                  <td className="px-4 py-3 text-stone-700">
                    <p className="font-medium">{p.name}</p>
                    {p.username && <p className="text-xs text-stone-400">@{p.username}</p>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmt(p.received)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-stone-700">{fmt(p.sent)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-[#D17D5B]">{fmt(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
