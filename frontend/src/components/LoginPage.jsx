import { useState } from "react";
import { Button } from "./ui/button";
import supabase from "../lib/supabase";

export const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(err.message);
      setGoogleLoading(false);
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
          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E8E4DB]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-stone-400">o</span>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full bg-white hover:bg-stone-50 text-stone-700 rounded-full py-2 border border-[#E8E4DB] transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            {googleLoading ? "Conectando…" : "Continuar con Google"}
          </Button>
        </form>
      </div>
    </div>
  );
};
