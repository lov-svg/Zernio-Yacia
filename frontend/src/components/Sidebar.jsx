import { LayoutDashboard, TrendingUp, Users, Image, Clock, Repeat, Inbox, Lightbulb } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export const SIDEBAR_TABS = [
  { value: "resumen", label: "Resumen", icon: LayoutDashboard },
  { value: "tendencia", label: "Tendencia", icon: TrendingUp },
  { value: "audiencia", label: "Audiencia", icon: Users },
  { value: "posts", label: "Posts", icon: Image },
  { value: "cuando", label: "Cuándo publicar", icon: Clock },
  { value: "frecuencia", label: "Frecuencia", icon: Repeat },
  { value: "bandeja", label: "Bandeja", icon: Inbox },
  { value: "ideas", label: "Ideas", icon: Lightbulb },
];

export const Sidebar = () => {
  return (
    <aside className="w-60 shrink-0 border-r border-[#E8E4DB] bg-white/60 backdrop-blur-sm min-h-[calc(100vh-5rem)] sticky top-20 self-start">
      <TabsList className="flex flex-col h-auto items-stretch justify-start gap-1 bg-transparent rounded-none p-3">
        {SIDEBAR_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger
              key={t.value}
              value={t.value}
              data-testid={`tab-${t.value}`}
              className="justify-start rounded-lg border-b-2 border-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#D17D5B]/10 data-[state=active]:text-[#D17D5B] data-[state=active]:shadow-none px-3 py-2.5 text-sm text-stone-500 font-medium gap-3 w-full"
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{t.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </aside>
  );
};
