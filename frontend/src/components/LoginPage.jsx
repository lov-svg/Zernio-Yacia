import { useState } from "react";
import { Button } from "./ui/button";
import supabase from "../lib/supabase";

export const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">Dashboard Instagram</h1>
          <p className="text-stone-500 text-sm">Inicia sesión para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-[#E8E4DB] p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E8E4DB] bg-[#FDFBF7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D17D5B] focus:border-transparent"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E8E4DB] bg-[#FDFBF7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D17D5B] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D17D5B] hover:bg-[#BA6949] text-white rounded-full py-2 transition-all duration-200"
          >
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
};
