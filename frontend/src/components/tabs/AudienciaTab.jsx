import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import api from "../../lib/api";

const GENDER_LABELS = { F: "Mujeres", M: "Hombres", U: "Sin especificar" };

const DemoChart = ({ rows, horizontal }) => (
  <ResponsiveContainer width="100%" height={horizontal ? Math.max(300, rows.length * 34) : 320}>
    <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 5, right: 30, bottom: 5, left: horizontal ? 60 : 0 }}>
      <CartesianGrid stroke="#F0EDE6" strokeDasharray="3 3" />
      {horizontal ? (
        <>
          <XAxis type="number" tick={{ fontSize: 11, fill: "#8A847C" }} />
          <YAxis type="category" dataKey="bucket" width={150} tick={{ fontSize: 11, fill: "#5C564F" }} />
        </>
      ) : (
        <>
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#8A847C" }} />
          <YAxis tick={{ fontSize: 11, fill: "#8A847C" }} />
        </>
      )}
      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DB", fontSize: 12 }} />
      <Bar dataKey="value" name="Seguidores" radius={[4, 4, 4, 4]}>
        {rows.map((_, i) => (
          <Cell key={i} fill={["#D17D5B", "#8A9A7B", "#C0A980", "#D99B78"][i % 4]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export default function AudienciaTab() {
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    api.get("/dashboard/demographics").then((r) => setDemo(r.data)).catch(() => {});
  }, []);

  if (!demo) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;
  if (!demo.age?.length) return <p className="text-stone-500 py-20 text-center" data-testid="audiencia-empty">Sin datos. Pulsa Actualizar datos.</p>;

  const age = [...(demo.age || [])].sort((a, b) => a.bucket.localeCompare(b.bucket));
  const gender = (demo.gender || []).map((g) => ({ ...g, bucket: GENDER_LABELS[g.bucket] || g.bucket }));
  const country = (demo.country || []).slice(0, 12);
  const city = (demo.city || []).slice(0, 15);

  return (
    <div className="bg-white border border-[#E8E4DB] rounded-xl p-6 sm:p-8 shadow-sm fade-up">
      <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800 mb-6">Demografía de tu audiencia</h2>
      <Tabs defaultValue="age">
        <TabsList className="bg-[#F5F2EC] mb-6">
          <TabsTrigger value="age" data-testid="demo-tab-age">Edad</TabsTrigger>
          <TabsTrigger value="gender" data-testid="demo-tab-gender">Género</TabsTrigger>
          <TabsTrigger value="country" data-testid="demo-tab-country">País</TabsTrigger>
          <TabsTrigger value="city" data-testid="demo-tab-city">Ciudad</TabsTrigger>
        </TabsList>
        <TabsContent value="age"><DemoChart rows={age} /></TabsContent>
        <TabsContent value="gender"><DemoChart rows={gender} /></TabsContent>
        <TabsContent value="country"><DemoChart rows={country} horizontal /></TabsContent>
        <TabsContent value="city"><DemoChart rows={city} horizontal /></TabsContent>
      </Tabs>
    </div>
  );
}
