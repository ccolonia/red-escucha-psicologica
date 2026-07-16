import { create } from "zustand";

export type AppView =
  | "landing"
  | "login"
  | "register"
  | "patient-dashboard"
  | "patient-appointments"
  | "patient-book"
  | "patient-profile"
  | "professional-dashboard"
  | "professional-schedule"
  | "professional-patients"
  | "professional-profile"
  | "professional-planilla"
  | "professional-schedule-config"
  | "admin-dashboard"
  | "admin-appointments"
  | "admin-professionals"
  | "admin-patients"
  | "admin-contacts"
  | "admin-triage"
  | "admin-planilla"
  | "admin-liquidation"
  | "admin-cms"
  | "admin-profile"
  | "admin-agenda-central"
  | "admin-derivador"
  | "forgot-password"
  | "professional-register";

interface AppState {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  justRegistered: boolean;
  setJustRegistered: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "landing",
  setCurrentView: (view) => set({ currentView: view }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  justRegistered: false,
  setJustRegistered: (value) => set({ justRegistered: value }),
}));
