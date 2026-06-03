"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RefreshCw,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

interface LiquidationRow {
  professionalId: string;
  professionalName: string;
  specialty: string;
  totalAppointments: number;
  attended: number;
  absent: number;
  rescheduled: number;
  cancelled: number;
  pending: number;
  confirmed: number;
  sessionFee: number;
  totalPatientFee: number;
  totalProfessionalFee: number;
  totalRepFee: number;
  hasSheet: boolean;
  repCommission: number;
}

export function AdminLiquidation() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [data, setData] = useState<LiquidationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetch(`/api/admin/liquidation?month=${selectedMonth}&year=${selectedYear}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar liquidación");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar datos de liquidación");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        totalAppointments: acc.totalAppointments + row.totalAppointments,
        attended: acc.attended + row.attended,
        absent: acc.absent + row.absent,
        rescheduled: acc.rescheduled + row.rescheduled,
        cancelled: acc.cancelled + row.cancelled,
        totalPatientFee: acc.totalPatientFee + row.totalPatientFee,
        totalProfessionalFee: acc.totalProfessionalFee + row.totalProfessionalFee,
        totalRepFee: acc.totalRepFee + row.totalRepFee,
      }),
      {
        totalAppointments: 0,
        attended: 0,
        absent: 0,
        rescheduled: 0,
        cancelled: 0,
        totalPatientFee: 0,
        totalProfessionalFee: 0,
        totalRepFee: 0,
      }
    );
  }, [data]);

  const exportCSV = () => {
    const headers = [
      "Profesional",
      "Especialidad",
      "Total Turnos",
      "Atendido",
      "Ausente",
      "Reprogramado",
      "Cancelado",
      "Honorario/Sesión",
      "Total Cobrado",
      "Honorario Prof.",
      "Comisión REP",
    ];

    const rows = data.map((row) => [
      row.professionalName,
      row.specialty,
      row.totalAppointments,
      row.attended,
      row.absent,
      row.rescheduled,
      row.cancelled,
      row.sessionFee,
      row.totalPatientFee,
      row.totalProfessionalFee,
      row.totalRepFee,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `liquidacion_${MONTHS[selectedMonth - 1].toLowerCase()}_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-teal-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Liquidación Mensual
          </h2>
          <p className="text-teal-600 text-sm mt-1">
            Resumen de honorarios por profesional
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-teal-200 text-teal-600"
            onClick={loadData}
          >
            <RefreshCw className="mr-2 w-4 h-4" />
            Actualizar
          </Button>
          {data.length > 0 && (
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-600"
              onClick={exportCSV}
            >
              <Download className="mr-2 w-4 h-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Month/Year Navigator */}
      <Card className="border-teal-100">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="text-teal-600">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <h3 className="text-xl font-bold text-teal-900">
                {MONTHS[selectedMonth - 1]} {selectedYear}
              </h3>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="text-teal-600">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totals.attended}</p>
            <p className="text-sm text-emerald-600">Atendidos</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-amber-700 mt-1">{totals.absent}</p>
            <p className="text-sm text-amber-600">Ausentes</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-blue-500 mx-auto" />
            <p className="text-2xl font-bold text-blue-700 mt-1">{totals.rescheduled}</p>
            <p className="text-sm text-blue-600">Reprogramados</p>
          </CardContent>
        </Card>
        <Card className="border-red-100 bg-red-50/30">
          <CardContent className="p-4 text-center">
            <XCircle className="w-6 h-6 text-red-500 mx-auto" />
            <p className="text-2xl font-bold text-red-700 mt-1">{totals.cancelled}</p>
            <p className="text-sm text-red-600">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Total Financial Summary */}
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Resumen Financiero — {MONTHS[selectedMonth - 1]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border border-teal-100">
              <p className="text-xs text-teal-500">Total Cobrado</p>
              <p className="text-xl font-bold text-teal-900">${totals.totalPatientFee.toLocaleString("es-AR")}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-emerald-500">Honorarios Profesionales</p>
              <p className="text-xl font-bold text-emerald-700">${totals.totalProfessionalFee.toLocaleString("es-AR")}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-amber-500">Comisión REP</p>
              <p className="text-xl font-bold text-amber-700">${totals.totalRepFee.toLocaleString("es-AR")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professionals Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-16 text-center">
            <Stethoscope className="w-16 h-16 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-3 text-lg">No hay datos para este período</p>
            <p className="text-teal-400 text-sm mt-1">Seleccioná otro mes o año</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-teal-100">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-teal-100 bg-teal-50/50">
                    <th className="px-3 py-3 text-left text-teal-700 font-medium">Profesional</th>
                    <th className="px-3 py-3 text-left text-teal-700 font-medium">Especialidad</th>
                    <th className="px-3 py-3 text-center text-teal-700 font-medium">Total</th>
                    <th className="px-3 py-3 text-center text-emerald-600 font-medium">Atendido</th>
                    <th className="px-3 py-3 text-center text-amber-600 font-medium">Ausente</th>
                    <th className="px-3 py-3 text-center text-blue-600 font-medium">Reprog.</th>
                    <th className="px-3 py-3 text-center text-red-600 font-medium">Cancelado</th>
                    <th className="px-3 py-3 text-right text-teal-700 font-medium">$/Sesión</th>
                    <th className="px-3 py-3 text-right text-emerald-700 font-medium">Honor. Prof.</th>
                    <th className="px-3 py-3 text-right text-amber-700 font-medium">Comisión REP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr
                      key={row.professionalId}
                      className="border-b border-teal-50 hover:bg-teal-50/30 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-teal-900">{row.professionalName}</span>
                          {row.hasSheet && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">
                              Planilla
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-teal-600">{row.specialty}</td>
                      <td className="px-3 py-3 text-center font-medium text-teal-900">{row.totalAppointments}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-xs px-2 py-1 rounded-full min-w-[28px]">
                          {row.attended}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-amber-100 text-amber-700 font-bold text-xs px-2 py-1 rounded-full min-w-[28px]">
                          {row.absent}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 font-bold text-xs px-2 py-1 rounded-full min-w-[28px]">
                          {row.rescheduled}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-red-100 text-red-700 font-bold text-xs px-2 py-1 rounded-full min-w-[28px]">
                          {row.cancelled}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-teal-800">${row.sessionFee.toLocaleString("es-AR")}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700">${row.totalProfessionalFee.toLocaleString("es-AR")}</td>
                      <td className="px-3 py-3 text-right font-bold text-amber-700">${row.totalRepFee.toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-teal-200 bg-teal-50/50">
                    <td className="px-3 py-3 font-bold text-teal-900" colSpan={2}>TOTAL</td>
                    <td className="px-3 py-3 text-center font-bold text-teal-900">{totals.totalAppointments}</td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-700">{totals.attended}</td>
                    <td className="px-3 py-3 text-center font-bold text-amber-700">{totals.absent}</td>
                    <td className="px-3 py-3 text-center font-bold text-blue-700">{totals.rescheduled}</td>
                    <td className="px-3 py-3 text-center font-bold text-red-700">{totals.cancelled}</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-700">${totals.totalProfessionalFee.toLocaleString("es-AR")}</td>
                    <td className="px-3 py-3 text-right font-bold text-amber-700">${totals.totalRepFee.toLocaleString("es-AR")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
