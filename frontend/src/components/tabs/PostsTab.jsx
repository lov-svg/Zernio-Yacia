import { useEffect, useState } from "react";
import { Heart, MessageCircle, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import api from "../../lib/api";

export default function PostsTab() {
  const [posts, setPosts] = useState(null);
  const [sort, setSort] = useState("engagement");
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    api.get(`/dashboard/posts?sort=${sort}`).then((r) => setPosts(r.data.posts)).catch(() => {});
  }, [sort]);

  const openPost = async (p) => {
    setSelected(p);
    setComments([]);
    try {
      const r = await api.get(`/dashboard/posts/${p.id}/comments`);
      setComments(r.data.comments);
    } catch {}
  };

  if (!posts) return <p className="text-stone-500 text-sm py-12">Cargando…</p>;
  if (!posts.length) return <p className="text-stone-500 py-20 text-center" data-testid="posts-empty">Sin datos. Pulsa Actualizar datos.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-800">Publicaciones ({posts.length})</h2>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-56 bg-white" data-testid="posts-sort-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="engagement">Mejor rendimiento</SelectItem>
            <SelectItem value="likes">Más likes</SelectItem>
            <SelectItem value="comments">Más comentarios</SelectItem>
            <SelectItem value="recent">Más recientes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {posts.map((p, i) => (
          <button
            key={p.id}
            onClick={() => openPost(p)}
            data-testid={`post-card-${p.id}`}
            className="group relative rounded-xl overflow-hidden border border-[#E8E4DB] bg-white shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 text-left fade-up"
            style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
          >
            <div className="aspect-square bg-[#F5F2EC] overflow-hidden">
              {p.picture && (
                <img src={p.picture} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              )}
            </div>
            <div className="p-3">
              <p className="text-xs text-stone-600 line-clamp-2 min-h-[2rem]">{p.caption || "Sin descripción"}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-[#D17D5B]" strokeWidth={1.5} />{p.like_count}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-[#8A9A7B]" strokeWidth={1.5} />{p.comment_count}</span>
                <span className="ml-auto">{p.created_time ? new Date(p.created_time).toLocaleDateString("es-MX") : ""}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="post-detail-modal">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-lg pr-6">Detalle de la publicación</DialogTitle>
                <DialogDescription className="sr-only">Métricas y comentarios de la publicación</DialogDescription>
              </DialogHeader>
              <div className="flex gap-4 items-start">
                {selected.picture && <img src={selected.picture} alt="" className="w-28 h-28 rounded-lg object-cover border border-[#E8E4DB]" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700">{selected.caption}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                    <span className="flex items-center gap-1"><Heart className="w-4 h-4 text-[#D17D5B]" strokeWidth={1.5} />{selected.like_count} likes</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4 text-[#8A9A7B]" strokeWidth={1.5} />{selected.comment_count} comentarios</span>
                  </div>
                  {selected.permalink && (
                    <a href={selected.permalink} target="_blank" rel="noopener noreferrer" data-testid="post-permalink-link"
                       className="inline-flex items-center gap-1 text-xs text-[#D17D5B] hover:underline mt-2">
                      Ver en Instagram <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-stone-800 mb-3">Comentarios reales</h3>
                {comments.length === 0 ? (
                  <p className="text-sm text-stone-400">No hay comentarios guardados para esta publicación.</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-[#FDFBF7] border border-[#E8E4DB] rounded-lg p-3">
                        <p className="text-xs font-medium text-stone-700">@{c.username || "usuario"}</p>
                        <p className="text-sm text-stone-600 mt-0.5">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
