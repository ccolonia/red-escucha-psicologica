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
  | "admin-dashboard"
  | "admin-appointments"
  | "admin-professionals"
  | "admin-patients"
  | "admin-contacts";

interface AppState {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "landing",
  setCurrentView: (view) => set({ currentView: view }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
