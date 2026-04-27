"use client";

import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { LandingPage } from "@/components/landing-page";
import { AuthLogin } from "@/components/auth-login";
import { AuthRegister } from "@/components/auth-register";
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
} from "@/components/professional-dashboard";
import {
  AdminDashboard,
  AdminAppointments,
  AdminProfessionals,
  AdminPatients,
  AdminContacts,
} from "@/components/admin-dashboard";
import { AppNavigation } from "@/components/navigation";
import { Providers } from "@/components/providers";
import { useEffect } from "react";

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
    "admin-dashboard": <AdminDashboard />,
    "admin-appointments": <AdminAppointments />,
    "admin-professionals": <AdminProfessionals />,
    "admin-patients": <AdminPatients />,
    "admin-contacts": <AdminContacts />,
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

  // Redirect to appropriate dashboard on login
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = (session.user as { role: string }).role;
      if (
        currentView === "landing" ||
        currentView === "login" ||
        currentView === "register"
      ) {
        if (role === "admin") {
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
        currentView !== "register"
      ) {
        setCurrentView("landing");
      }
    }
  }, [status, session, currentView, setCurrentView]);

  // Show landing/auth when not logged in
  if (status === "unauthenticated" || (!session && status === "loading")) {
    if (currentView === "login") return <AuthLogin />;
    if (currentView === "register") return <AuthRegister />;
    return <LandingPage />;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50/30 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-teal-600">Cargando...</p>
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
        <div className="px-4 sm:px-6 lg:px-8 py-6 pt-16 md:pt-6 pb-24 md:pb-6 max-w-5xl mx-auto">
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
