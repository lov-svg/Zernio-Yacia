import { useState } from "react";
import { RefreshCw, CircleCheck, CircleAlert, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import api from "../lib/api";
import supabase from "../lib/supabase";

const PROFILE_PIC_URL = "https://mueblemom.com/wp-content/uploads/2026/07/1784556013-23a946b107e236e616e659b81a3d0c02.jpg";

export const Header = ({ account, onRefreshed }) => {
  const [refreshing, setRefreshing] = useState(false);
  const snap = account?.snapshot;
  const health = account?.health;
  const last = account?.last_refresh;

  const doRefresh = async () => {
    setRefreshing(true);
    toast.info("Actualizando datos desde Zernio… puede tardar ~1 minuto");
    try {
      await api.post("/dashboard/refresh");
      toast.success("Datos actualizados correctamente");
      onRefreshed();
    } catch (e) {
      toast.error("Error al actualizar: " + (e.response?.data?.detail || e.message));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8E4DB] bg-white/70 backdrop-blur-xl" data-testid="dashboard-header">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <img src={PROFILE_PIC_URL} alt={snap?.username || "Perfil"} className="w-12 h-12 rounded-full object-cover border-2 border-[#D17D5B]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-lg text-stone-900 truncate" data-testid="header-username">
                {snap ? `@${snap.username}` : "Dashboard Instagram"}
              </h1>
              {health && (
                <span className="flex items-center gap-1 text-xs" data-testid="header-health">
                  {health.status === "healthy" ? (
                    <><CircleCheck className="w-3.5 h-3.5 text-[#8A9A7B]" strokeWidth={2} /><span className="text-[#8A9A7B] font-medium hidden sm:inline">Saludable</span></>
                  ) : (
                    <><CircleAlert className="w-3.5 h-3.5 text-red-500" strokeWidth={2} /><span className="text-red-500 font-medium hidden sm:inline">{health.status}</span></>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              {snap ? `${snap.followers_count?.toLocaleString("es-MX")} seguidores · ${snap.display_name}` : "Sin datos aún"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {last?.finished_at && (
            <span className="text-xs text-stone-400 hidden md:block" data-testid="header-last-update">
              Última actualización: {new Date(last.finished_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
          <Button
            onClick={doRefresh}
            disabled={refreshing}
            data-testid="refresh-data-btn"
            className="bg-[#D17D5B] hover:bg-[#BA6949] text-white rounded-full px-5 transition-all duration-200 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.5} />
            {refreshing ? "Actualizando…" : "Actualizar datos"}
          </Button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
};
