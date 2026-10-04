import { LayoutDashboard, PlusCircle, History, Settings } from "lucide-react";

export const APP_MODULES = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    id: "tambah",
    title: "Tambah Data",
    icon: PlusCircle,
    adminOnly: false,
  },
  {
    id: "riwayat",
    title: "Riwayat",
    icon: History,
    adminOnly: false,
  },
  {
    id: "admin",
    title: "Pengaturan Admin",
    icon: Settings,
    adminOnly: true,
  }
];