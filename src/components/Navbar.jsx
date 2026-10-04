import React, { useState } from "react";
import { Lock, Unlock, Menu, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AdminModal from "./AdminModal";

export default function Navbar({ activeModule, setActiveModule, toggleSidebar }) {
  const { isAdmin, logoutAdmin } = useAuth();
  const [showAdminModal, setShowAdminModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 lg:text-xl">
            Activity Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 sm:flex">
                <ShieldCheck className="h-4 w-4" /> Mode Admin Full CRUD
              </span>
              <button
                onClick={logoutAdmin}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                <Unlock className="h-4 w-4 text-emerald-600" /> Kunci / Keluar Admin
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition border border-indigo-200"
            >
              <Lock className="h-4 w-4 text-indigo-600" /> Buka Akses Admin
            </button>
          )}
        </div>
      </header>

      <AdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={() => setActiveModule("admin")}
      />
    </>
  );
}