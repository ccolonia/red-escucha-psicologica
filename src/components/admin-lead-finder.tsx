"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, UserPlus, MessageCircle, Trash2, Edit3,
  Loader2, Zap, AlertCircle, Users, Stethoscope, Brain,
  CheckCircle2, X, Filter, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/lib/email";

// === Taxonomía geográfica oficial REP ===
const REGIONS = {
  CABA: [
    "Agronomía","Barracas","Chacarita","Coghlan","Constitución","La Boca",
    "Monte Castro","Nueva Pompeya","Parque Avellaneda","Parque Chacabuco",
    "Parque Chas","Puerto Madero","Retiro","Saavedra","San Cristóbal",
    "San Telmo","Villa del Parque","Villa Gral. Mitre","Villa Ortúzar",
    "Villa Pueyrredón","Villa Real","Villa Riachuelo","Villa Santa Rita",
    "Villa Soldati","Villa Lugano","Liniers","Vélez Sarsfield",
    "Caballito","Flores","Palermo","Belgrano","Recoleta","Almagro","Boedo",
    "Núñez","Devoto","Saavedra","Versalles","Villa Urquiza",
  ],
  ZONA_SUR: [
    "Florencio Varela","Almirante Brown","Lomas de Zamora","Ezeiza",
    "Esteban Echeverría","Avellaneda","Quilmes",
  ],
  ZONA_OESTE: ["La Matanza","Morón","Ituzaingó","Merlo","Moreno","Tres de Febrero"],
  ZONA_NORTE: [
    "San Isidro","San Miguel","José León Suárez","José C. Paz","Pilar Centro",
    "Malvinas Argentinas","Loma Hermosa","Villa Ballester","San Martín",
    "San Andrés","Villa Maipú","Billinghurst","Vicente López","Tigre","San Fernando",
  ],
};

const ALL_LOCATIONS = [
  ...Object.entries(REGIONS).flatMap(([region, locs]) => locs.map(l => ({ region, location: l }))),
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NUEVO: { label: "Nuevo", color: "bg-blue-100 text-blue-700 border-blue-200" },
  CONTACTADO: { label: "Contactado", color: "bg-amber-100 text-amber-700 border-amber-200" },
  CV_RECIBIDO: { label: "CV Recibido", color: "bg-purple-100 text-purple-700 border-purple-200" },
  ENTREVISTADO: { label: "Entrevistado", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  APROBADO: { label: "Aprobado", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  DESCARTADO: { label: "Descartado", color: "bg-red-100 text-red-600 border-red-200" },
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  PSYCHOLOGIST: { label: "Psicólogo/a", icon: Brain, color: "bg-teal-100 text-teal-700 border-teal-200" },
  PSYCHIATRIST: { label: "Psiquiatra", icon: Stethoscope, color: "bg-purple-100 text-purple-700 border-purple-200" },
};

type Prospect = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: string;
  region: string;
  location: string;
  address: string | null;
  status: string;
  notes: string | null;
  source: string;
  createdAt: string;
};

export function AdminLeadFinder() {
  const [activeTab, setActiveTab] = useState<"crm" | "radar">("crm");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Usamos "ALL" como valor centinela para los filtros "Todos" porque Radix UI
  // lanza un error si un <SelectItem> tiene value="" (cadena vacía).
  const [filterRegion, setFilterRegion] = useState("ALL");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<Prospect | null>(null);
  const [newForm, setNewForm] = useState({ fullName: "", email: "", phone: "", prospectRole: "PSYCHOLOGIST", region: "CABA", location: "", notes: "" });

  const loadProspects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    // Convertimos "ALL" de vuelta a vacío para no enviar el parámetro a la API
    if (filterRegion && filterRegion !== "ALL") params.set("region", filterRegion);
    if (filterRole && filterRole !== "ALL") params.set("role", filterRole);
    if (filterStatus && filterStatus !== "ALL") params.set("status", filterStatus);
    try {
      const res = await fetch(`/api/admin/lead-finder?${params.toString()}`);
      const data = await res.json();
      setProspects(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar prospectos");
    } finally {
      setLoading(false);
    }
  }, [search, filterRegion, filterRole, filterStatus]);

  useEffect(() => { loadProspects(); }, [loadProspects]);

  const handleCreate = async () => {
    if (!newForm.fullName || !newForm.phone) { toast.error("Nombre y teléfono son obligatorios"); return; }
    try {
      const res = await fetch("/api/admin/lead-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newForm.fullName, email: newForm.email, phone: newForm.phone,
          prospectRole: newForm.prospectRole, region: newForm.region, location: newForm.location,
          notes: newForm.notes, source: "MANUAL_ENTRY",
        }),
      });
      if (res.ok) {
        toast.success("Prospecto creado");
        setNewDialogOpen(false);
        setNewForm({ fullName: "", email: "", phone: "", prospectRole: "PSYCHOLOGIST", region: "CABA", location: "", notes: "" });
        loadProspects();
      } else { const d = await res.json(); toast.error(d.error || "Error"); }
    } catch { toast.error("Error de conexión"); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch("/api/admin/lead-finder", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      toast.success(`Estado: ${STATUS_CONFIG[status]?.label || status}`);
    } catch { toast.error("Error al actualizar"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este prospecto?")) return;
    try {
      await fetch(`/api/admin/lead-finder?id=${id}`, { method: "DELETE" });
      setProspects(prev => prev.filter(p => p.id !== id));
      toast.success("Prospecto eliminado");
    } catch { toast.error("Error al eliminar"); }
  };

  const handleWhatsApp = (p: Prospect) => {
    const roleLabel = ROLE_CONFIG[p.role]?.label || "Profesional";
    const msg = encodeURIComponent(`Hola ${p.fullName}, te escribimos de Red Escucha Psicológica. Vimos tu perfil profesional y estamos convocando ${roleLabel}s en ${p.location || p.region} para derivación de pacientes. ¿Te interesaría sumarte a la red?`);
    window.open(`https://wa.me/${formatPhoneForWhatsApp(p.phone)}?text=${msg}`, "_blank");
  };

  const handleSaveEdit = async () => {
    if (!editDialog) return;
    try {
      await fetch("/api/admin/lead-finder", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editDialog.id, fullName: editDialog.fullName, email: editDialog.email, phone: editDialog.phone, region: editDialog.region, location: editDialog.location, notes: editDialog.notes }),
      });
      setProspects(prev => prev.map(p => p.id === editDialog.id ? editDialog : p));
      setEditDialog(null);
      toast.success("Prospecto actualizado");
    } catch { toast.error("Error al guardar"); }
  };

  // Estadísticas rápidas
  const stats = {
    total: prospects.length,
    nuevos: prospects.filter(p => p.status === "NUEVO").length,
    aprobados: prospects.filter(p => p.status === "APROBADO").length,
    porRegion: {
      CABA: prospects.filter(p => p.region === "CABA").length,
      ZONA_SUR: prospects.filter(p => p.region === "ZONA_SUR").length,
      ZONA_OESTE: prospects.filter(p => p.region === "ZONA_OESTE").length,
      ZONA_NORTE: prospects.filter(p => p.region === "ZONA_NORTE").length,
    },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">LeadFinder</h2>
            <p className="text-xs text-teal-500">CRM de Reclutamiento + Radar de Mapas</p>
          </div>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
          <UserPlus className="w-4 h-4 mr-1.5" />
          Nuevo Prospecto
        </Button>
      </div>

      {/* Widget: Alerta de Demanda Insatisfecha */}
      <Card className="border-amber-200 bg-amber-50/50 mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-bold text-amber-800">Demanda Insatisfecha por Zona</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(stats.porRegion).map(([region, count]) => (
              <div key={region} className={`rounded-lg p-2 text-center border ${count === 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
                <p className="text-[10px] text-slate-500 font-medium">{region.replace("ZONA_", "Zona ")}</p>
                <p className={`text-lg font-bold ${count === 0 ? "text-red-600" : "text-teal-700"}`}>{count}</p>
                <p className="text-[9px] text-slate-400">{count === 0 ? "Sin cobertura" : "prospectos"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-teal-100 pb-2">
        <button onClick={() => setActiveTab("crm")} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === "crm" ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-600 hover:bg-teal-100"}`}>
          <Users className="w-4 h-4 inline mr-1.5" /> Tablero CRM
        </button>
        <button onClick={() => setActiveTab("radar")} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === "radar" ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-600 hover:bg-teal-100"}`}>
          <MapPin className="w-4 h-4 inline mr-1.5" /> Radar de Mapas
        </button>
      </div>

      {/* === Tab CRM === */}
      {activeTab === "crm" && (
        <div className="flex-1 overflow-y-auto">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
              <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
            </div>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-teal-200"><SelectValue placeholder="Región" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todas</SelectItem><SelectItem value="CABA">CABA</SelectItem><SelectItem value="ZONA_SUR">Zona Sur</SelectItem><SelectItem value="ZONA_OESTE">Zona Oeste</SelectItem><SelectItem value="ZONA_NORTE">Zona Norte</SelectItem></SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-teal-200"><SelectValue placeholder="Profesión" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todas</SelectItem><SelectItem value="PSYCHOLOGIST">Psicólogo/a</SelectItem><SelectItem value="PSYCHIATRIST">Psiquiatra</SelectItem></SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-teal-200"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todos</SelectItem>{Object.entries(STATUS_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto" /></div>
          ) : prospects.length === 0 ? (
            <Card className="border-teal-100"><CardContent className="py-12 text-center"><Users className="w-10 h-10 text-teal-200 mx-auto mb-2" /><p className="text-teal-500 text-sm">No hay prospectos. Hacé clic en "Nuevo Prospecto" para comenzar.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {prospects.map(p => {
                const RoleIcon = ROLE_CONFIG[p.role]?.icon || Brain;
                return (
                  <Card key={p.id} className="border-teal-100 hover:shadow-sm transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                            <RoleIcon className="w-4 h-4 text-teal-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-teal-900 truncate">{p.fullName}</p>
                              <Badge variant="outline" className={`text-[9px] ${ROLE_CONFIG[p.role]?.color}`}>{ROLE_CONFIG[p.role]?.label}</Badge>
                              <Badge variant="outline" className={`text-[9px] ${STATUS_CONFIG[p.status]?.color}`}>{STATUS_CONFIG[p.status]?.label}</Badge>
                            </div>
                            <p className="text-[10px] text-teal-500 truncate mt-0.5">📍 {p.region.replace("ZONA_","Zona ")} — {p.location}</p>
                            {p.phone && <p className="text-[10px] text-teal-400">{p.phone}</p>}
                            {p.notes && <p className="text-[10px] text-slate-400 italic truncate mt-0.5">{p.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleWhatsApp(p)} className="p-1.5 rounded-md bg-emerald-50 border border-emerald-200 hover:bg-emerald-100" title="WhatsApp">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          <button onClick={() => setEditDialog(p)} className="p-1.5 rounded-md bg-white border border-teal-200 hover:bg-teal-50" title="Editar">
                            <Edit3 className="w-3.5 h-3.5 text-teal-500" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md bg-white border border-red-200 hover:bg-red-50" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                      {/* Cambiar estado rápido */}
                      <div className="flex items-center gap-1 mt-2 ml-10">
                        <span className="text-[9px] text-teal-400">Estado:</span>
                        <Select value={p.status} onValueChange={v => handleStatusChange(p.id, v)}>
                          <SelectTrigger className="h-6 text-[10px] w-[120px] border-teal-200"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(STATUS_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === Tab Radar === */}
      {activeTab === "radar" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Card className="border-teal-100 max-w-md w-full">
            <CardContent className="p-6 text-center">
              <MapPin className="w-12 h-12 text-teal-200 mx-auto mb-3" />
              <p className="font-medium text-teal-700">Radar de Mapas</p>
              <p className="text-xs text-teal-500 mt-1">
                Próximamente: búsqueda activa de profesionales en Google Maps / OpenStreetMap
                con importación directa al CRM.
              </p>
              <p className="text-xs text-teal-400 mt-2">
                Mientras tanto, usá el CRM para cargar prospectos manualmente
                o importarlos desde búsquedas externas.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === Modal Nuevo Prospecto === */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-teal-900">Nuevo Prospecto</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nombre completo *</Label><Input value={newForm.fullName} onChange={e => setNewForm({...newForm, fullName: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
              <div><Label className="text-xs">Teléfono *</Label><Input value={newForm.phone} onChange={e => setNewForm({...newForm, phone: e.target.value})} placeholder="+54 11..." className="h-8 text-sm border-teal-200" /></div>
            </div>
            <div><Label className="text-xs">Email (opcional)</Label><Input type="email" value={newForm.email} onChange={e => setNewForm({...newForm, email: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Profesión</Label><Select value={newForm.prospectRole} onValueChange={v => setNewForm({...newForm, prospectRole: v})}><SelectTrigger className="h-8 text-sm border-teal-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PSYCHOLOGIST">Psicólogo/a</SelectItem><SelectItem value="PSYCHIATRIST">Psiquiatra</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Región</Label><Select value={newForm.region} onValueChange={v => setNewForm({...newForm, region: v, location: ""})}><SelectTrigger className="h-8 text-sm border-teal-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CABA">CABA</SelectItem><SelectItem value="ZONA_SUR">Zona Sur</SelectItem><SelectItem value="ZONA_OESTE">Zona Oeste</SelectItem><SelectItem value="ZONA_NORTE">Zona Norte</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label className="text-xs">Barrio / Localidad</Label><Select value={newForm.location} onValueChange={v => setNewForm({...newForm, location: v})}><SelectTrigger className="h-8 text-sm border-teal-200"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{(REGIONS[newForm.region as keyof typeof REGIONS] || []).map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Notas</Label><Input value={newForm.notes} onChange={e => setNewForm({...newForm, notes: e.target.value})} placeholder="Observaciones..." className="h-8 text-sm border-teal-200" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)} className="border-teal-300">Cancelar</Button>
            <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700 text-white">Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Editar === */}
      <Dialog open={!!editDialog} onOpenChange={open => !open && setEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-teal-900">Editar Prospecto</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-3 py-2">
              <div><Label className="text-xs">Nombre</Label><Input value={editDialog.fullName} onChange={e => setEditDialog({...editDialog, fullName: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Teléfono</Label><Input value={editDialog.phone} onChange={e => setEditDialog({...editDialog, phone: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
                <div><Label className="text-xs">Email</Label><Input value={editDialog.email || ""} onChange={e => setEditDialog({...editDialog, email: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Región</Label><Select value={editDialog.region} onValueChange={v => setEditDialog({...editDialog, region: v})}><SelectTrigger className="h-8 text-sm border-teal-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CABA">CABA</SelectItem><SelectItem value="ZONA_SUR">Zona Sur</SelectItem><SelectItem value="ZONA_OESTE">Zona Oeste</SelectItem><SelectItem value="ZONA_NORTE">Zona Norte</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Localidad</Label><Input value={editDialog.location} onChange={e => setEditDialog({...editDialog, location: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
              </div>
              <div><Label className="text-xs">Notas</Label><Input value={editDialog.notes || ""} onChange={e => setEditDialog({...editDialog, notes: e.target.value})} className="h-8 text-sm border-teal-200" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} className="border-teal-300">Cancelar</Button>
            <Button onClick={handleSaveEdit} className="bg-teal-600 hover:bg-teal-700 text-white">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
