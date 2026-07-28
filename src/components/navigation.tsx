"use client";

import { signOut, useSession } from "next-auth/react";
import { useAppStore, type AppView } from "@/lib/store";
import {
  Home,
  Calendar,
  CalendarPlus,
  User,
  LayoutDashboard,
  LayoutGrid,
  Clock,
  Users,
  Stethoscope,
  MessageSquare,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Palette,
  Settings2,
  AlertCircle,
  DollarSign,
  Zap,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PATIENT_NAV: NavItem[] = [
  { view: "patient-dashboard", label: "Inicio", icon: Home },
  { view: "patient-appointments", label: "Mis Turnos", icon: Calendar },
  { view: "patient-book", label: "Solicitar", icon: CalendarPlus },
  { view: "patient-profile", label: "Perfil", icon: User },
];

const PROFESSIONAL_NAV: NavItem[] = [
  { view: "professional-dashboard", label: "Inicio", icon: Home },
  { view: "professional-schedule", label: "Mi Agenda", icon: Clock },
  { view: "professional-schedule-config", label: "Config. Agenda", icon: Settings2 },
  { view: "professional-patients", label: "Pacientes", icon: Users },
  { view: "professional-planilla", label: "Planilla", icon: FileText },
  { view: "professional-profile", label: "Mi Perfil", icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { view: "admin-dashboard", label: "Inicio", icon: LayoutDashboard },
  { view: "admin-triage", label: "Triage", icon: AlertCircle },
  { view: "admin-agenda-central", label: "Agenda Central", icon: LayoutGrid },
  { view: "admin-derivador", label: "Derivador", icon: Zap },
  { view: "admin-map", label: "Mapa Consultorios", icon: MapPin },
  { view: "admin-appointments", label: "Turnos", icon: Calendar },
  { view: "admin-professionals", label: "Profesionales", icon: Stethoscope },
  { view: "admin-patients", label: "Pacientes", icon: Users },
  { view: "admin-contacts", label: "Consultas", icon: MessageSquare },
  { view: "admin-planilla", label: "Planilla", icon: FileText },
  { view: "admin-liquidation", label: "Liquidación", icon: DollarSign },
  { view: "admin-cms", label: "CMS", icon: Palette },
  { view: "admin-profile", label: "Mi Perfil", icon: Shield },
];

export function AppNavigation() {
  const { data: session } = useSession();
  const { currentView, setCurrentView, sidebarOpen, setSidebarOpen } =
    useAppStore();

  const role = (session?.user as { role?: string })?.role || "patient";
  const allNavItems = role === "admin" || role === "super_admin" ? ADMIN_NAV : role === "professional" ? PROFESSIONAL_NAV : PATIENT_NAV;
  // CMS nav item only visible to super_admin
  const navItems = allNavItems.filter((item) => {
    if (item.view === "admin-cms" && role !== "super_admin") return false;
    return true;
  });

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-white border-r border-teal-100 z-40">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-teal-100">
          <img
            src="/images/logo.png"
            alt="Red Escucha Psicológica"
            className="w-9 h-9 rounded-lg object-contain"
          />
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-base text-teal-800">Red Escucha</span>
            <span className="text-[10px] text-sage-500 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>Psicológica</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                currentView === item.view
                  ? "bg-teal-100 text-teal-800"
                  : "text-teal-600 hover:bg-teal-50 hover:text-teal-800"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-teal-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
              <User className="w-4 h-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-teal-900 truncate">
                {session?.user?.name}
              </p>
              <p className="text-xs text-teal-500 truncate capitalize">
                {role === "super_admin"
                  ? "Super Admin"
                  : role === "admin"
                  ? "Administrador"
                  : role === "professional"
                  ? "Profesional"
                  : "Paciente"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-teal-200 text-teal-600 hover:bg-teal-50 h-9"
            onClick={() => signOut({ redirect: false })}
          >
            <LogOut className="mr-2 w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-teal-100">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <img
              src="/images/logo.png"
              alt="Red Escucha Psicológica"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-sm text-teal-800">Red Escucha</span>
              <span className="text-[9px] text-sage-500 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>Psicológica</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-teal-600"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "md:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white border-r border-teal-100 transition-transform flex flex-col overflow-y-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                setCurrentView(item.view);
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                currentView === item.view
                  ? "bg-teal-100 text-teal-800"
                  : "text-teal-600 hover:bg-teal-50 hover:text-teal-800"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-teal-100 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
              <User className="w-4 h-4 text-teal-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-teal-900 truncate">
                {session?.user?.name}
              </p>
              <p className="text-xs text-teal-500 capitalize">
                {role === "super_admin"
                  ? "Super Admin"
                  : role === "admin"
                  ? "Administrador"
                  : role === "professional"
                  ? "Profesional"
                  : "Paciente"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-teal-200 text-teal-600 hover:bg-teal-50 h-9"
            onClick={() => {
              setSidebarOpen(false);
              signOut({ redirect: false });
            }}
          >
            <LogOut className="mr-2 w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-teal-100 safe-area-bottom">
        <div className="flex items-center justify-around py-1">
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
                currentView === item.view
                  ? "text-teal-700"
                  : "text-teal-400"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          {navItems.length > 4 && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 text-teal-400 min-w-[64px]"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">Más</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
