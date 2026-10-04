import React from "react";
import { APP_MODULES } from "../config/modules";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ activeModule, setActiveModule, isOpen, setIsOpen }) {
  const { isAdmin } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-6 font-bold text-indigo-600 text-lg">
          ActivityHub Pro
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {APP_MODULES.map((mod) => {
            if (mod.adminOnly && !isAdmin) return null;
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;

            return (
              <button
                key={mod.id}
                onClick={() => {
                  setActiveModule(mod.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{mod.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}