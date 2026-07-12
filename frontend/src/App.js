import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import ResumenTab from "@/components/tabs/ResumenTab";
import TendenciaTab from "@/components/tabs/TendenciaTab";
import AudienciaTab from "@/components/tabs/AudienciaTab";
import PostsTab from "@/components/tabs/PostsTab";
import CuandoTab from "@/components/tabs/CuandoTab";
import FrecuenciaTab from "@/components/tabs/FrecuenciaTab";
import IdeasTab from "@/components/tabs/IdeasTab";
import BandejaTab from "@/components/tabs/BandejaTab";
import api from "@/lib/api";

const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "tendencia", label: "Tendencia" },
  { value: "audiencia", label: "Audiencia" },
  { value: "posts", label: "Posts" },
  { value: "cuando", label: "Cuándo publicar" },
  { value: "frecuencia", label: "Frecuencia" },
  { value: "bandeja", label: "Bandeja" },
  { value: "ideas", label: "Ideas" },
];

function App() {
  const [account, setAccount] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAccount = useCallback(() => {
    api.get("/dashboard/account").then((r) => setAccount(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount, refreshKey]);

  return (
    <div className="App min-h-screen bg-[#FDFBF7]">
      <Toaster position="top-center" richColors />
      <Header account={account} onRefreshed={() => setRefreshKey((k) => k + 1)} />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="resumen">
          <div className="overflow-x-auto -mx-4 px-4 mb-8">
            <TabsList className="bg-transparent border-b border-[#E8E4DB] rounded-none w-full justify-start h-auto p-0 gap-1">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  data-testid={`tab-${t.value}`}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#D17D5B] data-[state=active]:text-[#D17D5B] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm text-stone-500 whitespace-nowrap"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="resumen" key={`r-${refreshKey}`}><ResumenTab /></TabsContent>
          <TabsContent value="tendencia" key={`t-${refreshKey}`}><TendenciaTab /></TabsContent>
          <TabsContent value="audiencia" key={`a-${refreshKey}`}><AudienciaTab /></TabsContent>
          <TabsContent value="posts" key={`p-${refreshKey}`}><PostsTab /></TabsContent>
          <TabsContent value="cuando" key={`c-${refreshKey}`}><CuandoTab /></TabsContent>
          <TabsContent value="frecuencia" key={`f-${refreshKey}`}><FrecuenciaTab /></TabsContent>
          <TabsContent value="bandeja" key={`b-${refreshKey}`}><BandejaTab /></TabsContent>
          <TabsContent value="ideas"><IdeasTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
