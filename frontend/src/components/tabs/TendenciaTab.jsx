import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../../lib/api";

const METRICS = [
  { key: "reach", label: "Alcance", color: "#D17D5B" },
  { key: "views", label: "Visualizaciones", color: "#8A9A7B" },
  { key: "likes", label: "Likes", color: "#C0A980" },
  { key: "comments", label: "Comentarios", color: "#D99B78" },
  { key: "saves", label: "Guardados", color: "#7B8A9A" },
  { key: "shares", label: "Compartidos", color: "#B07BA0" },
];

export default function TendenciaTab() {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(["reach", "views"]);

  useEffect(() => {
    api.get("/dashboard/trend?days=90").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;
  if (!data.daily?.length) return <p className="text-stone-500 py-20 text-center" data-testid="tendencia-empty">Sin datos. Pulsa Actualizar datos.</p>;

  const toggle = (k) =>
    setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  return (
    <div className="space-y-8">
      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-2">Tendencia día a día (90 días)</h2>
        <p className="text-sm text-stone-500 mb-4">Solo se muestran los días con publicaciones registradas por Zernio.</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              data-testid={`trend-metric-${m.key}`}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 active:scale-95 ${
                active.includes(m.key)
                  ? "text-white border-transparent"
                  : "bg-white text-stone-500 border-[#E8E4DB] hover:bg-[#F5F2EC]"
              }`}
              style={active.includes(m.key) ? { backgroundColor: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={data.daily} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A847C" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8A847C" }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {METRICS.filter((m) => active.includes(m.key)).map((m) => (
              <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={{ r: 2.5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.follower_history?.length > 0 && (
        <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
          <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-2">Crecimiento de seguidores</h2>
          <p className="text-sm text-stone-500 mb-6">Se registra un punto por cada actualización de datos; la curva crecerá con el tiempo.</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.follower_history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A847C" }} />
              <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fontSize: 11, fill: "#8A847C" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }} />
              <Line type="monotone" dataKey="follower_count" name="Seguidores" stroke="#D17D5B" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
