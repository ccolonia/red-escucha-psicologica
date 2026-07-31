"use client";

import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { LandingPage } from "@/components/landing-page";
import { AuthLogin } from "@/components/auth-login";
import { AuthRegister } from "@/components/auth-register";
import { AuthForgotPassword } from "@/components/auth-forgot-password";
import {
  PatientDashboard,
  PatientBook,
  PatientAppointments,
  PatientProfile,
} from "@/components/patient-dashboard";
import {
  ProfessionalDashboard,
  ProfessionalSchedule,
  ProfessionalPatients,
  ProfessionalProfile,
} from "@/components/professional-dashboard";
import { ProfessionalPlanilla } from "@/components/professional-planilla";
import { ProfessionalScheduleConfig } from "@/components/professional-schedule-config";
import {
  AdminDashboard,
  AdminAppointments,
  AdminProfessionals,
  AdminPatients,
  AdminContacts,
  AdminProfile,
} from "@/components/admin-dashboard";
import { AdminCMS } from "@/components/admin-cms";
import { AdminPlanilla } from "@/components/admin-planilla";
import { AdminLiquidation } from "@/components/admin-liquidation";
import { AdminTriage } from "@/components/admin-triage";
import { AdminAgendaCentral } from "@/components/admin-agenda-central";
import { DerivadorInteligente } from "@/components/admin-derivador";
import { AdminMap } from "@/components/admin-map";
import { AdminProtocolo } from "@/components/admin-protocolo";
import { AdminLeadFinder } from "@/components/admin-lead-finder";
import { ProfessionalRegister } from "@/components/professional-register";
import { AppNavigation } from "@/components/navigation";
import { Providers } from "@/components/providers";
import { useEffect, useCallback } from "react";

function DashboardContent() {
  const { currentView } = useAppStore();

  const views: Record<string, React.ReactNode> = {
    "patient-dashboard": <PatientDashboard />,
    "patient-appointments": <PatientAppointments />,
    "patient-book": <PatientBook />,
    "patient-profile": <PatientProfile />,
    "professional-dashboard": <ProfessionalDashboard />,
    "professional-schedule": <ProfessionalSchedule />,
    "professional-patients": <ProfessionalPatients />,
    "professional-planilla": <ProfessionalPlanilla />,
    "professional-schedule-config": <ProfessionalScheduleConfig />,
    "professional-profile": <ProfessionalProfile />,
    "admin-dashboard": <AdminDashboard />,
    "admin-appointments": <AdminAppointments />,
    "admin-professionals": <AdminProfessionals />,
    "admin-patients": <AdminPatients />,
    "admin-contacts": <AdminContacts />,
    "admin-triage": <AdminTriage />,
    "admin-planilla": <AdminPlanilla />,
    "admin-liquidation": <AdminLiquidation />,
    "admin-cms": <AdminCMS />,
    "admin-profile": <AdminProfile />,
    "admin-agenda-central": <AdminAgendaCentral />,
    "admin-derivador": <DerivadorInteligente />,
    "admin-map": <AdminMap />,
    "admin-protocolo": <AdminProtocolo />,
    "admin-lead-finder": <AdminLeadFinder />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {views[currentView] || <PatientDashboard />}
      </motion.div>
    </AnimatePresence>
  );
}

function AppContent() {
  const { data: session, status } = useSession();
  const { currentView, setCurrentView } = useAppStore();

  // Map URL hashes to views
  const hashToView: Record<string, string> = {
    "#registro-profesional": "professional-register",
    "#login": "login",
    "#registro": "register",
  };

  // Read URL hash on mount and navigate accordingly
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hashToView[hash]) {
      setCurrentView(hashToView[hash] as any);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for hash changes (e.g. browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hashToView[hash]) {
        setCurrentView(hashToView[hash] as any);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to appropriate dashboard on login
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = (session.user as { role: string }).role;
      if (
        currentView === "landing" ||
        currentView === "login" ||
        currentView === "register"
      ) {
        if (role === "admin" || role === "super_admin") {
          setCurrentView("admin-dashboard");
        } else if (role === "professional") {
          setCurrentView("professional-dashboard");
        } else {
          setCurrentView("patient-dashboard");
        }
      }
    } else if (status === "unauthenticated") {
      if (
        currentView !== "landing" &&
        currentView !== "login" &&
        currentView !== "register" &&
        currentView !== "professional-register" &&
        currentView !== "forgot-password"
      ) {
        setCurrentView("landing");
      }
    }
  }, [status, session, currentView, setCurrentView]);

  // Show professional registration (accessible even when unauthenticated)
  if (currentView === "professional-register") return <ProfessionalRegister />;

  // Show forgot-password (accessible even when unauthenticated)
  if (currentView === "forgot-password") return <AuthForgotPassword />;

  // Show landing/auth when not logged in
  if (status === "unauthenticated" || (!session && status === "loading")) {
    if (currentView === "login") return <AuthLogin />;
    if (currentView === "register") return <AuthRegister />;
    return <LandingPage />;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center paper-texture">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-ivory-300 border-t-gold-400 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-bark-500 font-light">Cargando...</p>
        </div>
      </div>
    );
  }

  // Authenticated layout
  return (
    <div className="min-h-screen bg-background">
      <AppNavigation />
      {/* Desktop: offset for sidebar */}
      <main className="md:ml-64 min-h-screen">
        <div className={`px-4 sm:px-6 lg:px-8 py-6 pt-16 md:pt-6 pb-24 md:pb-6 ${
          currentView === "admin-agenda-central" || currentView === "admin-map"
            ? "w-full max-w-none"
            : "max-w-5xl mx-auto"
        }`}>
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
