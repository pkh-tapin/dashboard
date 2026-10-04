import React, { useState } from "react";
import { Lock, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AdminModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const { loginAdmin } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loginAdmin(password)) {
      setError(false);
      setPassword("");
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Lock className="h-5 w-5 text-indigo-600" />
            <span>Akses Mode Admin</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Masukkan Kata Sandi
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sandi default: admin123"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-xs text-red-500">Kata sandi salah!</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition active:scale-[0.98]"
          >
            Masuk Kunci Admin
          </button>
        </form>
      </div>
    </div>
  );
}