import { useEffect, useState } from "react";
import { ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import api from "../../lib/api";

export default function FrecuenciaTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/frequency").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;
  if (!data.frequency?.length && !data.decay?.length)
    return <p className="text-stone-500 py-20 text-center" data-testid="frecuencia-empty">Sin datos. Pulsa Actualizar datos.</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-1">Frecuencia vs engagement</h2>
        <p className="text-sm text-stone-500 mb-6">¿Publicar más veces por semana mejora tu engagement?</p>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="posts_per_week" name="Posts/semana" tick={{ fontSize: 11, fill: "#8A847C" }}
                   label={{ value: "Publicaciones por semana", position: "bottom", fontSize: 11, fill: "#8A847C" }} />
            <YAxis type="number" dataKey="avg_engagement_rate" name="Tasa engagement" tick={{ fontSize: 11, fill: "#8A847C" }} unit="%" />
            <ZAxis type="number" dataKey="weeks_count" range={[80, 300]} name="Semanas" />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }}
                     formatter={(v, n) => [typeof v === "number" ? v.toFixed(2) : v, n]} />
            <Scatter data={data.frequency} fill="#D17D5B" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up" style={{ animationDelay: "80ms" }}>
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-1">Vida útil del contenido</h2>
        <p className="text-sm text-stone-500 mb-6">% del engagement final que un post acumula con el tiempo.</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.decay} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
            <XAxis dataKey="bucket_label" tick={{ fontSize: 11, fill: "#8A847C" }} />
            <YAxis unit="%" tick={{ fontSize: 11, fill: "#8A847C" }} domain={[0, 100]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }}
                     formatter={(v) => [`${Number(v).toFixed(1)}%`, "% del engagement final"]} />
            <Line type="monotone" dataKey="avg_pct_of_final" stroke="#8A9A7B" strokeWidth={2.5} dot={{ r: 4, fill: "#8A9A7B" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
