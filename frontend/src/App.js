import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { LoginPage } from "@/components/LoginPage";
import ResumenTab from "@/components/tabs/ResumenTab";
import TendenciaTab from "@/components/tabs/TendenciaTab";
import AudienciaTab from "@/components/tabs/AudienciaTab";
import PostsTab from "@/components/tabs/PostsTab";
import CuandoTab from "@/components/tabs/CuandoTab";
import FrecuenciaTab from "@/components/tabs/FrecuenciaTab";
import IdeasTab from "@/components/tabs/IdeasTab";
import BandejaTab from "@/components/tabs/BandejaTab";
import api from "@/lib/api";
import supabase from "@/lib/supabase";

function App() {
  const [session, setSession] = useState(undefined);
  const [account, setAccount] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const loadAccount = useCallback(() => {
    if (!session) return;
    api.get("/dashboard/account").then((r) => setAccount(r.data)).catch(() => {});
  }, [session]);

  useEffect(() => { loadAccount(); }, [loadAccount, refreshKey]);

  if (session === undefined) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <p className="text-stone-400 text-sm">Cargando…</p>
    </div>;
  }

  if (!session) {
    return <>
      <Toaster position="top-center" richColors />
      <LoginPage onLogin={() => {}} />
    </>;
  }

  return (
    <div className="App min-h-screen bg-[#FDFBF7]">
      <Toaster position="top-center" richColors />
      <Header account={account} onRefreshed={() => setRefreshKey((k) => k + 1)} />
      <div className="max-w-[1400px] mx-auto flex items-start">
        <Tabs defaultValue="resumen" orientation="vertical" className="flex w-full">
          <Sidebar />
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          <TabsContent value="resumen" key={`r-${refreshKey}`}><ResumenTab /></TabsContent>
          <TabsContent value="tendencia" key={`t-${refreshKey}`}><TendenciaTab /></TabsContent>
          <TabsContent value="audiencia" key={`a-${refreshKey}`}><AudienciaTab /></TabsContent>
          <TabsContent value="posts" key={`p-${refreshKey}`}><PostsTab /></TabsContent>
          <TabsContent value="cuando" key={`c-${refreshKey}`}><CuandoTab /></TabsContent>
          <TabsContent value="frecuencia" key={`f-${refreshKey}`}><FrecuenciaTab /></TabsContent>
          <TabsContent value="bandeja" key={`b-${refreshKey}`}><BandejaTab /></TabsContent>
          <TabsContent value="ideas"><IdeasTab /></TabsContent>
          </main>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
