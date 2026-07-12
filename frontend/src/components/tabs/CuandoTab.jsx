import { useEffect, useState, Fragment } from "react";
import api from "../../lib/api";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function CuandoTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/best-time").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;
  if (!data.slots?.length) return <p className="text-stone-500 py-20 text-center" data-testid="cuando-empty">Sin datos. Pulsa Actualizar datos.</p>;

  const map = {};
  let max = 0;
  data.slots.forEach((s) => {
    map[`${s.day_of_week}-${s.hour}`] = s;
    if (s.avg_engagement > max) max = s.avg_engagement;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const best = [...data.slots].sort((a, b) => b.avg_engagement - a.avg_engagement).slice(0, 3);

  return (
    <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
      <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-1">Mejores horas para publicar</h2>
      <p className="text-sm text-stone-500 mb-6">Engagement promedio por día y hora, en tu zona horaria ({data.timezone}).</p>

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
                  const s = map[`${di}-${h}`];
                  const intensity = s ? s.avg_engagement / (max || 1) : 0;
                  return (
                    <div
                      key={`${di}-${h}`}
                      title={s ? `${d} ${h}:00 — engagement ${s.avg_engagement} (${s.post_count} posts)` : `${d} ${h}:00 — sin datos`}
                      className="aspect-square rounded-[4px] transition-transform hover:scale-110"
                      style={{
                        backgroundColor: s ? `rgba(209, 125, 91, ${0.15 + intensity * 0.85})` : "#F5F2EC",
                      }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-stone-800 mb-3">Top 3 franjas históricas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {best.map((s, i) => (
            <div key={i} className="bg-[#FDFBF7] border border-[#E8E4DB] rounded-lg p-4" data-testid={`best-slot-${i}`}>
              <p className="text-lg font-semibold text-stone-900">{DAYS[s.day_of_week]} · {s.hour}:00</p>
              <p className="text-xs text-stone-500 mt-1">Engagement promedio: {s.avg_engagement} ({s.post_count} publicaciones)</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
