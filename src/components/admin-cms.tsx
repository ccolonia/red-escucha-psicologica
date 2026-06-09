"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Image as ImageIcon,
  Brain,
  Heart,
  HandHeart,
  BarChart3,
  MessageSquare,
  Settings,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  Share2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ===== Types =====
interface HeroSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
  secondaryCta: string;
  imageUrl: string;
  order: number;
  active: boolean;
}

interface SpecialtyTab {
  id: string;
  label: string;
  order: number;
  active: boolean;
  specialties?: Specialty[];
}

interface Specialty {
  id: string;
  icon: string;
  label: string;
  description: string;
  tabId: string;
  order: number;
  active: boolean;
  tab?: SpecialtyTab;
}

interface PhilosophyItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  active: boolean;
}

interface StepItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  active: boolean;
}

interface StatItem {
  id: string;
  value: string;
  label: string;
  order: number;
  active: boolean;
}

interface TestimonialItem {
  id: string;
  text: string;
  name: string;
  role: string;
  order: number;
  active: boolean;
}

interface SiteConfigItem {
  id: string;
  key: string;
  value: string;
  group: string;
}

const ICON_OPTIONS = [
  "Brain",
  "Heart",
  "Shield",
  "Users",
  "Baby",
  "UserCheck",
  "HeartHandshake",
  "Sparkles",
  "HandHeart",
  "BookOpen",
  "CalendarPlus",
  "MessageCircle",
  "Leaf",
];

type CMSTab =
  | "hero"
  | "specialties"
  | "philosophy"
  | "steps"
  | "stats"
  | "testimonials"
  | "social"
  | "registration"
  | "config";

const TABS: {
  id: CMSTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "hero", label: "Inicio", icon: ImageIcon },
  { id: "specialties", label: "Especialidades", icon: Brain },
  { id: "philosophy", label: "Filosofía", icon: Heart },
  { id: "steps", label: "Cómo Funciona", icon: HandHeart },
  { id: "stats", label: "Estadísticas", icon: BarChart3 },
  { id: "testimonials", label: "Testimonios", icon: MessageSquare },
  { id: "social", label: "Redes Sociales", icon: Share2 },
  { id: "registration", label: "Campos de Registro", icon: ClipboardList },
  { id: "config", label: "Configuración", icon: Settings },
];

const GROUP_LABELS: Record<string, string> = {
  general: "General",
  contact: "Contacto",
  whatsapp: "WhatsApp",
  sections: "Secciones",
  social: "Redes Sociales",
};

// ===== Main Component =====
export function AdminCMS() {
  const [activeTab, setActiveTab] = useState<CMSTab>("hero");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Gestión de Contenido (CMS)</h1>
        <p className="text-teal-100 mt-1">
          Administrá el contenido de la página de inicio
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-teal-100 text-teal-800 shadow-sm"
                  : "text-teal-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "hero" && <HeroSlidesTab />}
      {activeTab === "specialties" && <SpecialtiesTab />}
      {activeTab === "philosophy" && <PhilosophyTab />}
      {activeTab === "steps" && <StepsTab />}
      {activeTab === "stats" && <StatsTab />}
      {activeTab === "testimonials" && <TestimonialsTab />}
      {activeTab === "social" && <SocialLinksTab />}
      {activeTab === "registration" && <RegistrationFieldsTab />}
      {activeTab === "config" && <ConfigTab />}
    </div>
  );
}

// ===== Loading Skeleton =====
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

// ===== Reorder Helper =====
async function swapOrder(
  items: { id: string; order: number }[],
  itemId: string,
  direction: "up" | "down",
  apiPath: string
) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((s) => s.id === itemId);
  if (direction === "up" && idx === 0) return false;
  if (direction === "down" && idx === sorted.length - 1) return false;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  const swapItem = sorted[swapIdx];

  await Promise.all([
    fetch(`/api/cms/${apiPath}/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: swapItem.order }),
    }),
    fetch(`/api/cms/${apiPath}/${swapItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: sorted[idx].order }),
    }),
  ]);
  return true;
}

// ===== Hero Slides Tab =====
function HeroSlidesTab() {
  const [items, setItems] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<HeroSlide | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/cms/hero-slides")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = isNew
        ? "/api/cms/hero-slides"
        : `/api/cms/hero-slides/${editItem!.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editItem),
      });
      if (res.ok) {
        toast.success(isNew ? "Slide creado" : "Slide actualizado");
        setEditItem(null);
        load();
      } else {
        toast.error("Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este slide?")) return;
    try {
      const res = await fetch(`/api/cms/hero-slides/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Slide eliminado");
        load();
      } else toast.error("Error al eliminar");
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleToggleActive = async (item: HeroSlide) => {
    try {
      const res = await fetch(`/api/cms/hero-slides/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, active: !item.active }),
      });
      if (res.ok) {
        toast.success(item.active ? "Slide desactivado" : "Slide activado");
        load();
      }
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const moveOrder = async (item: HeroSlide, direction: "up" | "down") => {
    const moved = await swapOrder(items, item.id, direction, "hero-slides");
    if (moved) load();
  };

  if (loading) return <LoadingSkeleton />;

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-teal-900">Slides del Inicio</h2>
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => {
            setIsNew(true);
            setEditItem({
              id: "",
              badge: "",
              title: "",
              description: "",
              cta: "Contactanos",
              secondaryCta: "Conocer Especialidades",
              imageUrl: "",
              order: items.length,
              active: true,
            });
          }}
        >
          <Plus className="mr-2 w-4 h-4" /> Agregar Slide
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <ImageIcon className="w-12 h-12 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-2">No hay slides</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar pr-1">
          {sorted.map((item) => (
            <Card
              key={item.id}
              className={`border-teal-100 ${!item.active ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                      >
                        #{item.order + 1}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                      >
                        {item.badge || "Sin badge"}
                      </Badge>
                      {!item.active && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                        >
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-teal-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-sm text-teal-600 truncate">
                      {item.description}
                    </p>
                    <p className="text-xs text-teal-400 mt-1">
                      CTA: {item.cta} | {item.secondaryCta}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-teal-200"
                      onClick={() => moveOrder(item, "up")}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-teal-200"
                      onClick={() => moveOrder(item, "down")}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Switch
                      checked={item.active}
                      onCheckedChange={() => handleToggleActive(item)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-teal-200 text-teal-600"
                      onClick={() => {
                        setIsNew(false);
                        setEditItem({ ...item });
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-red-200 text-red-500"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-900">
              {isNew ? "Nuevo Slide" : "Editar Slide"}
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Badge</Label>
                <Input
                  value={editItem.badge}
                  onChange={(e) =>
                    setEditItem({ ...editItem, badge: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="Psicología Online"
                />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editItem.title}
                  onChange={(e) =>
                    setEditItem({ ...editItem, title: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="Tu bienestar emocional es nuestra prioridad"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={editItem.description}
                  onChange={(e) =>
                    setEditItem({ ...editItem, description: e.target.value })
                  }
                  className="border-teal-200"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CTA Principal</Label>
                  <Input
                    value={editItem.cta}
                    onChange={(e) =>
                      setEditItem({ ...editItem, cta: e.target.value })
                    }
                    className="border-teal-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CTA Secundario</Label>
                  <Input
                    value={editItem.secondaryCta}
                    onChange={(e) =>
                      setEditItem({ ...editItem, secondaryCta: e.target.value })
                    }
                    className="border-teal-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL de Imagen</Label>
                <Input
                  value={editItem.imageUrl}
                  onChange={(e) =>
                    setEditItem({ ...editItem, imageUrl: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="/images/carousel/nature.png"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={editItem.order}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border-teal-200"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={editItem.active}
                    onCheckedChange={(checked) =>
                      setEditItem({ ...editItem, active: checked })
                    }
                  />
                  <Label>Activo</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditItem(null)}
              className="border-teal-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <Save className="mr-2 w-4 h-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Specialties Tab =====
function SpecialtiesTab() {
  const [tabs, setTabs] = useState<SpecialtyTab[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTab, setEditTab] = useState<SpecialtyTab | null>(null);
  const [editSpec, setEditSpec] = useState<Specialty | null>(null);
  const [isNewTab, setIsNewTab] = useState(false);
  const [isNewSpec, setIsNewSpec] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/cms/specialty-tabs").then((r) => r.json()),
      fetch("/api/cms/specialties").then((r) => r.json()),
    ])
      .then(([tabsData, specsData]) => {
        setTabs(tabsData);
        setSpecialties(specsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveTab = async () => {
    setSaving(true);
    try {
      const url = isNewTab
        ? "/api/cms/specialty-tabs"
        : `/api/cms/specialty-tabs/${editTab!.id}`;
      const res = await fetch(url, {
        method: isNewTab ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editTab),
      });
      if (res.ok) {
        toast.success(isNewTab ? "Pestaña creada" : "Pestaña actualizada");
        setEditTab(null);
        load();
      } else toast.error("Error al guardar");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const deleteTab = async (id: string) => {
    if (!confirm("¿Eliminar esta pestaña y todas sus especialidades?"))
      return;
    try {
      const res = await fetch(`/api/cms/specialty-tabs/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Pestaña eliminada");
        load();
      } else toast.error("Error al eliminar");
    } catch {
      toast.error("Error de conexión");
    }
  };

  const toggleTabActive = async (tab: SpecialtyTab) => {
    try {
      const res = await fetch(`/api/cms/specialty-tabs/${tab.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tab, active: !tab.active }),
      });
      if (res.ok) {
        toast.success(tab.active ? "Pestaña desactivada" : "Pestaña activada");
        load();
      }
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const saveSpec = async () => {
    setSaving(true);
    try {
      const url = isNewSpec
        ? "/api/cms/specialties"
        : `/api/cms/specialties/${editSpec!.id}`;
      const res = await fetch(url, {
        method: isNewSpec ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSpec),
      });
      if (res.ok) {
        toast.success(
          isNewSpec ? "Especialidad creada" : "Especialidad actualizada"
        );
        setEditSpec(null);
        load();
      } else toast.error("Error al guardar");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const deleteSpec = async (id: string) => {
    if (!confirm("¿Eliminar esta especialidad?")) return;
    try {
      const res = await fetch(`/api/cms/specialties/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Especialidad eliminada");
        load();
      } else toast.error("Error al eliminar");
    } catch {
      toast.error("Error de conexión");
    }
  };

  const toggleSpecActive = async (spec: Specialty) => {
    try {
      const res = await fetch(`/api/cms/specialties/${spec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...spec, active: !spec.active }),
      });
      if (res.ok) {
        toast.success(
          spec.active ? "Especialidad desactivada" : "Especialidad activada"
        );
        load();
      }
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  if (loading) return <LoadingSkeleton />;

  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-teal-900">Especialidades</h2>
        <div className="flex gap-2">
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => {
              setIsNewTab(true);
              setEditTab({ id: "", label: "", order: tabs.length, active: true });
            }}
          >
            <Plus className="mr-2 w-4 h-4" /> Pestaña
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => {
              setIsNewSpec(true);
              setEditSpec({
                id: "",
                icon: "Brain",
                label: "",
                description: "",
                tabId: tabs[0]?.id || "",
                order: 0,
                active: true,
              });
            }}
          >
            <Plus className="mr-2 w-4 h-4" /> Especialidad
          </Button>
        </div>
      </div>

      {/* Tabs List */}
      <div className="space-y-3 mb-6 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar pr-1">
        {sortedTabs.length === 0 ? (
          <Card className="border-teal-100">
            <CardContent className="py-12 text-center">
              <Brain className="w-12 h-12 text-teal-200 mx-auto" />
              <p className="text-teal-600 mt-2">No hay pestañas de especialidades</p>
            </CardContent>
          </Card>
        ) : (
          sortedTabs.map((tab) => {
            const tabSpecs = specialties
              .filter((s) => s.tabId === tab.id)
              .sort((a, b) => a.order - b.order);
            const isExpanded = expandedTab === tab.id;
            return (
              <Card
                key={tab.id}
                className={`border-teal-100 ${!tab.active ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-2 text-left"
                      onClick={() =>
                        setExpandedTab(isExpanded ? null : tab.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-teal-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-teal-400" />
                      )}
                      <Badge
                        variant="outline"
                        className="bg-teal-50 border-teal-200 text-teal-700"
                      >
                        {tab.label}
                      </Badge>
                      <span className="text-sm text-teal-500">
                        ({tabSpecs.length} especialidades)
                      </span>
                      {!tab.active && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                        >
                          Inactivo
                        </Badge>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={tab.active}
                        onCheckedChange={() => toggleTabActive(tab)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-teal-200 text-teal-600"
                        onClick={() => {
                          setIsNewTab(false);
                          setEditTab({ ...tab });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-red-200 text-red-500"
                        onClick={() => deleteTab(tab.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 space-y-2 pl-6 border-l-2 border-teal-100">
                      {tabSpecs.length === 0 ? (
                        <p className="text-sm text-teal-400 italic">
                          Sin especialidades
                        </p>
                      ) : (
                        tabSpecs.map((spec) => (
                          <div
                            key={spec.id}
                            className="flex items-center justify-between p-2 bg-teal-50/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                              >
                                {spec.icon}
                              </Badge>
                              <span className="text-sm font-medium text-teal-800">
                                {spec.label}
                              </span>
                              {!spec.active && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                                >
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={spec.active}
                                onCheckedChange={() => toggleSpecActive(spec)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-teal-200 text-teal-600"
                                onClick={() => {
                                  setIsNewSpec(false);
                                  setEditSpec({ ...spec });
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-red-200 text-red-500"
                                onClick={() => deleteSpec(spec.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Tab Dialog */}
      <Dialog
        open={!!editTab}
        onOpenChange={(open) => {
          if (!open) setEditTab(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-900">
              {isNewTab ? "Nueva Pestaña" : "Editar Pestaña"}
            </DialogTitle>
          </DialogHeader>
          {editTab && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editTab.label}
                  onChange={(e) =>
                    setEditTab({ ...editTab, label: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="Psicología Clínica"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={editTab.order}
                    onChange={(e) =>
                      setEditTab({
                        ...editTab,
                        order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border-teal-200"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={editTab.active}
                    onCheckedChange={(checked) =>
                      setEditTab({ ...editTab, active: checked })
                    }
                  />
                  <Label>Activo</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTab(null)}
              className="border-teal-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveTab}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <Save className="mr-2 w-4 h-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Specialty Dialog */}
      <Dialog
        open={!!editSpec}
        onOpenChange={(open) => {
          if (!open) setEditSpec(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-900">
              {isNewSpec ? "Nueva Especialidad" : "Editar Especialidad"}
            </DialogTitle>
          </DialogHeader>
          {editSpec && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Icono</Label>
                <Select
                  value={editSpec.icon}
                  onValueChange={(v) => setEditSpec({ ...editSpec, icon: v })}
                >
                  <SelectTrigger className="border-teal-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editSpec.label}
                  onChange={(e) =>
                    setEditSpec({ ...editSpec, label: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="Terapia Individual"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={editSpec.description}
                  onChange={(e) =>
                    setEditSpec({ ...editSpec, description: e.target.value })
                  }
                  className="border-teal-200"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Pestaña</Label>
                <Select
                  value={editSpec.tabId}
                  onValueChange={(v) =>
                    setEditSpec({ ...editSpec, tabId: v })
                  }
                >
                  <SelectTrigger className="border-teal-200">
                    <SelectValue placeholder="Seleccionar pestaña" />
                  </SelectTrigger>
                  <SelectContent>
                    {tabs.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={editSpec.order}
                    onChange={(e) =>
                      setEditSpec({
                        ...editSpec,
                        order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border-teal-200"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={editSpec.active}
                    onCheckedChange={(checked) =>
                      setEditSpec({ ...editSpec, active: checked })
                    }
                  />
                  <Label>Activo</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSpec(null)}
              className="border-teal-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveSpec}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <Save className="mr-2 w-4 h-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Generic CRUD Tab Helper =====
function GenericCRUDTab<T extends { id: string; order: number; active: boolean }>({
  title,
  apiPath,
  dialogTitle,
  renderFields,
  renderCard,
  createDefault,
  emptyIcon: EmptyIcon,
  emptyMessage,
}: {
  title: string;
  apiPath: string;
  dialogTitle?: string;
  renderFields: (item: T, setItem: (item: T) => void) => React.ReactNode;
  renderCard: (
    item: T,
    onEdit: () => void,
    onDelete: () => void,
    onToggleActive: () => void,
    onMoveUp: () => void,
    onMoveDown: () => void
  ) => React.ReactNode;
  createDefault: () => T;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyMessage?: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/cms/${apiPath}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = isNew
        ? `/api/cms/${apiPath}`
        : `/api/cms/${apiPath}/${editItem!.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editItem),
      });
      if (res.ok) {
        toast.success(isNew ? "Creado exitosamente" : "Actualizado exitosamente");
        setEditItem(null);
        load();
      } else toast.error("Error al guardar");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    try {
      const res = await fetch(`/api/cms/${apiPath}/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Eliminado exitosamente");
        load();
      } else toast.error("Error al eliminar");
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleToggleActive = async (item: T) => {
    try {
      const res = await fetch(`/api/cms/${apiPath}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, active: !item.active }),
      });
      if (res.ok) {
        toast.success(item.active ? "Desactivado" : "Activado");
        load();
      }
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const handleMoveUp = async (item: T) => {
    const moved = await swapOrder(items, item.id, "up", apiPath);
    if (moved) load();
  };

  const handleMoveDown = async (item: T) => {
    const moved = await swapOrder(items, item.id, "down", apiPath);
    if (moved) load();
  };

  if (loading) return <LoadingSkeleton />;

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-teal-900">{title}</h2>
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => {
            setIsNew(true);
            setEditItem(createDefault());
          }}
        >
          <Plus className="mr-2 w-4 h-4" /> Agregar
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            {EmptyIcon && <EmptyIcon className="w-12 h-12 text-teal-200 mx-auto" />}
            <p className="text-teal-600 mt-2">
              {emptyMessage || "No hay elementos"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar pr-1">
          {sorted.map((item) =>
            renderCard(
              item,
              () => {
                setIsNew(false);
                setEditItem({ ...item });
              },
              () => handleDelete(item.id),
              () => handleToggleActive(item),
              () => handleMoveUp(item),
              () => handleMoveDown(item)
            )
          )}
        </div>
      )}

      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-900">
              {isNew
                ? `Nuevo${dialogTitle ? ` ${dialogTitle}` : ""}`
                : `Editar${dialogTitle ? ` ${dialogTitle}` : ""}`}
            </DialogTitle>
          </DialogHeader>
          {editItem && renderFields(editItem, (item) => setEditItem(item))}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditItem(null)}
              className="border-teal-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <Save className="mr-2 w-4 h-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Philosophy Tab =====
function PhilosophyTab() {
  return (
    <GenericCRUDTab<PhilosophyItem>
      title="Filosofía"
      apiPath="philosophy"
      dialogTitle="elemento"
      emptyIcon={Heart}
      emptyMessage="No hay elementos de filosofía"
      createDefault={() => ({
        id: "",
        icon: "HandHeart",
        title: "",
        description: "",
        order: 0,
        active: true,
      })}
      renderFields={(item, setItem) => (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Icono</Label>
            <Select
              value={item.icon}
              onValueChange={(v) => setItem({ ...item, icon: v })}
            >
              <SelectTrigger className="border-teal-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((icon) => (
                  <SelectItem key={icon} value={icon}>
                    {icon}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={item.title}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
              className="border-teal-200"
              placeholder="Empatía y contención"
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={item.description}
              onChange={(e) =>
                setItem({ ...item, description: e.target.value })
              }
              className="border-teal-200"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={item.order}
                onChange={(e) =>
                  setItem({ ...item, order: parseInt(e.target.value) || 0 })
                }
                className="border-teal-200"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={item.active}
                onCheckedChange={(checked) =>
                  setItem({ ...item, active: checked })
                }
              />
              <Label>Activo</Label>
            </div>
          </div>
        </div>
      )}
      renderCard={(item, onEdit, onDelete, onToggleActive, onMoveUp, onMoveDown) => (
        <Card
          key={item.id}
          className={`border-teal-100 ${!item.active ? "opacity-60" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                  >
                    #{item.order + 1}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                  >
                    {item.icon}
                  </Badge>
                  {!item.active && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                    >
                      Inactivo
                    </Badge>
                  )}
                </div>
                <p className="font-medium text-teal-900">{item.title}</p>
                <p className="text-sm text-teal-600 line-clamp-2">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveUp}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveDown}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Switch checked={item.active} onCheckedChange={onToggleActive} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-teal-200 text-teal-600"
                  onClick={onEdit}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-200 text-red-500"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}

// ===== Steps Tab =====
function StepsTab() {
  return (
    <GenericCRUDTab<StepItem>
      title="Cómo Funciona"
      apiPath="steps"
      dialogTitle="paso"
      emptyIcon={HandHeart}
      emptyMessage="No hay pasos configurados"
      createDefault={() => ({
        id: "",
        icon: "CalendarPlus",
        title: "",
        description: "",
        order: 0,
        active: true,
      })}
      renderFields={(item, setItem) => (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Icono</Label>
            <Select
              value={item.icon}
              onValueChange={(v) => setItem({ ...item, icon: v })}
            >
              <SelectTrigger className="border-teal-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((icon) => (
                  <SelectItem key={icon} value={icon}>
                    {icon}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={item.title}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
              className="border-teal-200"
              placeholder="Solicitá tu turno"
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={item.description}
              onChange={(e) =>
                setItem({ ...item, description: e.target.value })
              }
              className="border-teal-200"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={item.order}
                onChange={(e) =>
                  setItem({ ...item, order: parseInt(e.target.value) || 0 })
                }
                className="border-teal-200"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={item.active}
                onCheckedChange={(checked) =>
                  setItem({ ...item, active: checked })
                }
              />
              <Label>Activo</Label>
            </div>
          </div>
        </div>
      )}
      renderCard={(item, onEdit, onDelete, onToggleActive, onMoveUp, onMoveDown) => (
        <Card
          key={item.id}
          className={`border-teal-100 ${!item.active ? "opacity-60" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-teal-400 font-mono text-sm font-bold">
                    {String(item.order + 1).padStart(2, "0")}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                  >
                    {item.icon}
                  </Badge>
                  {!item.active && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                    >
                      Inactivo
                    </Badge>
                  )}
                </div>
                <p className="font-medium text-teal-900">{item.title}</p>
                <p className="text-sm text-teal-600 line-clamp-2">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveUp}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveDown}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Switch checked={item.active} onCheckedChange={onToggleActive} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-teal-200 text-teal-600"
                  onClick={onEdit}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-200 text-red-500"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}

// ===== Stats Tab =====
function StatsTab() {
  return (
    <GenericCRUDTab<StatItem>
      title="Estadísticas"
      apiPath="stats"
      dialogTitle="estadística"
      emptyIcon={BarChart3}
      emptyMessage="No hay estadísticas configuradas"
      createDefault={() => ({
        id: "",
        value: "",
        label: "",
        order: 0,
        active: true,
      })}
      renderFields={(item, setItem) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                value={item.value}
                onChange={(e) => setItem({ ...item, value: e.target.value })}
                className="border-teal-200"
                placeholder="30+"
              />
            </div>
            <div className="space-y-2">
              <Label>Etiqueta</Label>
              <Input
                value={item.label}
                onChange={(e) => setItem({ ...item, label: e.target.value })}
                className="border-teal-200"
                placeholder="Años de experiencia"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={item.order}
                onChange={(e) =>
                  setItem({ ...item, order: parseInt(e.target.value) || 0 })
                }
                className="border-teal-200"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={item.active}
                onCheckedChange={(checked) =>
                  setItem({ ...item, active: checked })
                }
              />
              <Label>Activo</Label>
            </div>
          </div>
        </div>
      )}
      renderCard={(item, onEdit, onDelete, onToggleActive, onMoveUp, onMoveDown) => (
        <Card
          key={item.id}
          className={`border-teal-100 ${!item.active ? "opacity-60" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-teal-900">
                  {item.value}
                </span>
                <span className="text-teal-600">{item.label}</span>
                {!item.active && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                  >
                    Inactivo
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveUp}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveDown}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Switch checked={item.active} onCheckedChange={onToggleActive} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-teal-200 text-teal-600"
                  onClick={onEdit}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-200 text-red-500"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}

// ===== Testimonials Tab =====
function TestimonialsTab() {
  return (
    <GenericCRUDTab<TestimonialItem>
      title="Testimonios"
      apiPath="testimonials"
      dialogTitle="testimonio"
      emptyIcon={MessageSquare}
      emptyMessage="No hay testimonios configurados"
      createDefault={() => ({
        id: "",
        text: "",
        name: "",
        role: "",
        order: 0,
        active: true,
      })}
      renderFields={(item, setItem) => (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Texto</Label>
            <Textarea
              value={item.text}
              onChange={(e) => setItem({ ...item, text: e.target.value })}
              className="border-teal-200"
              rows={4}
              placeholder="Mi experiencia fue increíble..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                className="border-teal-200"
                placeholder="María G."
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Input
                value={item.role}
                onChange={(e) => setItem({ ...item, role: e.target.value })}
                className="border-teal-200"
                placeholder="Paciente"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={item.order}
                onChange={(e) =>
                  setItem({ ...item, order: parseInt(e.target.value) || 0 })
                }
                className="border-teal-200"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={item.active}
                onCheckedChange={(checked) =>
                  setItem({ ...item, active: checked })
                }
              />
              <Label>Activo</Label>
            </div>
          </div>
        </div>
      )}
      renderCard={(item, onEdit, onDelete, onToggleActive, onMoveUp, onMoveDown) => (
        <Card
          key={item.id}
          className={`border-teal-100 ${!item.active ? "opacity-60" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="text-xs bg-teal-50 border-teal-200 text-teal-700"
                  >
                    #{item.order + 1}
                  </Badge>
                  {!item.active && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                    >
                      Inactivo
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-teal-700 italic line-clamp-2 mb-1">
                  &ldquo;{item.text}&rdquo;
                </p>
                <p className="font-medium text-teal-900">
                  {item.name}{" "}
                  <span className="text-teal-500 font-normal">
                    — {item.role}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveUp}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-teal-200"
                  onClick={onMoveDown}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Switch checked={item.active} onCheckedChange={onToggleActive} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-teal-200 text-teal-600"
                  onClick={onEdit}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-200 text-red-500"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}

// ===== Registration Fields Tab =====
interface RegistrationFieldItem {
  id: string;
  label: string;
  fieldKey: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  active: boolean;
  placeholder: string | null;
  helperText: string | null;
  order: number;
  section: string;
}

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Texto" },
  { value: "select", label: "Selección (desplegable)" },
  { value: "textarea", label: "Área de texto" },
];

const SECTION_OPTIONS = [
  { value: "personal", label: "Datos Personales" },
];

function RegistrationFieldsTab() {
  const [fields, setFields] = useState<RegistrationFieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editField, setEditField] = useState<RegistrationFieldItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [optionsText, setOptionsText] = useState("");

  const load = useCallback(() => {
    fetch("/api/cms/registration-fields")
      .then((r) => r.json())
      .then((data: RegistrationFieldItem[]) => {
        setFields(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar los campos de registro");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleNew = () => {
    const maxOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order)) + 1 : 0;
    setEditField({
      id: "",
      label: "",
      fieldKey: "",
      fieldType: "text",
      options: null,
      required: false,
      active: true,
      placeholder: "",
      helperText: "",
      order: maxOrder,
      section: "personal",
    });
    setOptionsText("");
    setIsNew(true);
    setShowDialog(true);
  };

  const handleEdit = (field: RegistrationFieldItem) => {
    setEditField({ ...field });
    setOptionsText(field.options ? JSON.parse(field.options).join("\n") : "");
    setIsNew(false);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editField) return;
    if (!editField.label.trim() || !editField.fieldKey.trim()) {
      toast.error("El nombre y la clave del campo son obligatorios");
      return;
    }

    // Validate fieldKey format (only lowercase letters, numbers, underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(editField.fieldKey)) {
      toast.error("La clave debe comenzar con letra minúscula y solo contener letras, números y guiones bajos");
      return;
    }

    setSaving(true);
    try {
      // Build options JSON from textarea lines
      const parsedOptions =
        editField.fieldType === "select" && optionsText.trim()
          ? JSON.stringify(optionsText.split("\n").map((o) => o.trim()).filter(Boolean))
          : null;

      const payload = {
        ...editField,
        options: parsedOptions,
      };

      const url = isNew
        ? "/api/cms/registration-fields"
        : `/api/cms/registration-fields/${editField.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isNew ? "Campo creado exitosamente" : "Campo actualizado exitosamente");
        setShowDialog(false);
        load();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar el campo");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cms/registration-fields/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Campo eliminado exitosamente");
        setDeleteConfirm(null);
        load();
      } else {
        toast.error("Error al eliminar el campo");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (field: RegistrationFieldItem) => {
    try {
      const res = await fetch(`/api/cms/registration-fields/${field.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...field, active: !field.active }),
      });
      if (res.ok) {
        load();
      } else {
        toast.error("Error al cambiar el estado");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const moveOrder = async (field: RegistrationFieldItem, direction: "up" | "down") => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.id === field.id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;
    const swapWith = direction === "up" ? sorted[idx - 1] : sorted[idx + 1];
    try {
      await Promise.all([
        fetch(`/api/cms/registration-fields/${field.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...field, order: swapWith.order }),
        }),
        fetch(`/api/cms/registration-fields/${swapWith.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...swapWith, order: field.order }),
        }),
      ]);
      load();
    } catch {
      toast.error("Error al reordenar");
    }
  };

  const fieldTypeLabel = (type: string) => {
    return FIELD_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
  };

  if (loading) return <LoadingSkeleton />;

  const personalFields = fields.filter((f) => f.section === "personal").sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-teal-900">Campos de Registro</h2>
          <p className="text-sm text-teal-600 mt-0.5">
            Administrá los campos del formulario de registro de profesionales
          </p>
        </div>
        <Button onClick={handleNew} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="mr-2 w-4 h-4" />
          Nuevo Campo
        </Button>
      </div>

      {personalFields.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 text-teal-300 mx-auto mb-3" />
            <p className="text-teal-500">No hay campos de registro configurados</p>
            <p className="text-sm text-teal-400 mt-1">Hacé clic en &quot;Nuevo Campo&quot; para agregar el primero</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {personalFields.map((field) => (
            <Card key={field.id} className={`border-teal-100 ${!field.active ? "opacity-50" : ""}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveOrder(field, "up")} className="p-0.5 hover:text-teal-600 text-teal-400" disabled={field.order === 0}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveOrder(field, "down")} className="p-0.5 hover:text-teal-600 text-teal-400">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-teal-900">{field.label}</span>
                      {field.required && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                          Obligatorio
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs bg-teal-50 text-teal-600 border-teal-200">
                        {fieldTypeLabel(field.fieldType)}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200 font-mono">
                        {field.fieldKey}
                      </Badge>
                    </div>
                    {field.placeholder && (
                      <p className="text-xs text-teal-400 mt-0.5">Placeholder: {field.placeholder}</p>
                    )}
                    {field.fieldType === "select" && field.options && (
                      <p className="text-xs text-teal-400 mt-0.5">
                        Opciones: {JSON.parse(field.options).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.active}
                      onCheckedChange={() => handleToggleActive(field)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(field)} className="h-8 w-8 p-0">
                      <Pencil className="w-4 h-4 text-teal-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(field.id)} className="h-8 w-8 p-0">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar campo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Esta acción no se puede deshacer. El campo será eliminado permanentemente del formulario de registro.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={saving}>
              {saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo Campo de Registro" : "Editar Campo de Registro"}</DialogTitle>
          </DialogHeader>
          {editField && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-teal-700">Nombre del campo *</Label>
                  <Input
                    value={editField.label}
                    onChange={(e) => setEditField({ ...editField, label: e.target.value })}
                    placeholder="Ej: Título, Sexo, Teléfono"
                    className="border-teal-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-teal-700">Clave interna *</Label>
                  <Input
                    value={editField.fieldKey}
                    onChange={(e) => setEditField({ ...editField, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                    placeholder="Ej: title, gender, phone"
                    className="border-teal-200 font-mono"
                    disabled={!isNew}
                  />
                  <p className="text-xs text-teal-400">Solo letras minúsculas, números y guiones bajos</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-teal-700">Tipo de campo</Label>
                  <Select value={editField.fieldType} onValueChange={(v) => setEditField({ ...editField, fieldType: v })}>
                    <SelectTrigger className="border-teal-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-teal-700">Sección</Label>
                  <Select value={editField.section} onValueChange={(v) => setEditField({ ...editField, section: v })}>
                    <SelectTrigger className="border-teal-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-teal-700">Placeholder</Label>
                <Input
                  value={editField.placeholder || ""}
                  onChange={(e) => setEditField({ ...editField, placeholder: e.target.value || null })}
                  placeholder="Texto de ejemplo dentro del campo"
                  className="border-teal-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-teal-700">Texto de ayuda</Label>
                <Input
                  value={editField.helperText || ""}
                  onChange={(e) => setEditField({ ...editField, helperText: e.target.value || null })}
                  placeholder="Texto informativo debajo del campo"
                  className="border-teal-200"
                />
              </div>
              {editField.fieldType === "select" && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-teal-700">Opciones (una por línea)</Label>
                  <Textarea
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder={"Lic.\nDr.\nDra.\nNinguno"}
                    className="border-teal-200"
                    rows={4}
                  />
                  <p className="text-xs text-teal-400">Ingresá cada opción en una línea separada</p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editField.required}
                    onCheckedChange={(v) => setEditField({ ...editField, required: v })}
                  />
                  <Label className="text-sm text-teal-700">Campo obligatorio</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editField.active}
                    onCheckedChange={(v) => setEditField({ ...editField, active: v })}
                  />
                  <Label className="text-sm text-teal-700">Visible</Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-teal-700">Orden</Label>
                <Input
                  type="number"
                  value={editField.order}
                  onChange={(e) => setEditField({ ...editField, order: parseInt(e.target.value) || 0 })}
                  className="border-teal-200 w-24"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
              {isNew ? "Crear Campo" : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Social Links Tab =====
function SocialLinksTab() {
  const [links, setLinks] = useState({
    facebook: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
  });
  const [originalLinks, setOriginalLinks] = useState({
    facebook: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/settings/social-links")
      .then((r) => r.json())
      .then((data) => {
        const loaded = {
          facebook: data.facebook || "",
          instagram: data.instagram || "",
          tiktok: data.tiktok || "",
          linkedin: data.linkedin || "",
        };
        setLinks(loaded);
        setOriginalLinks(loaded);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar las redes sociales");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (field: keyof typeof links, value: string) => {
    setLinks((prev) => ({ ...prev, [field]: value }));
  };

  const hasChanges =
    links.facebook !== originalLinks.facebook ||
    links.instagram !== originalLinks.instagram ||
    links.tiktok !== originalLinks.tiktok ||
    links.linkedin !== originalLinks.linkedin;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(links),
      });
      if (res.ok) {
        toast.success("Redes sociales actualizadas correctamente");
        setOriginalLinks({ ...links });
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar las redes sociales");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const socialFields = [
    {
      key: "facebook" as const,
      label: "Facebook",
      placeholder: "https://facebook.com/redescucha",
      iconPrefix: "fb",
      color: "bg-blue-600",
    },
    {
      key: "instagram" as const,
      label: "Instagram",
      placeholder: "https://instagram.com/redescucha",
      iconPrefix: "ig",
      color: "bg-gradient-to-br from-purple-600 to-pink-500",
    },
    {
      key: "tiktok" as const,
      label: "TikTok",
      placeholder: "https://tiktok.com/@redescucha",
      iconPrefix: "tt",
      color: "bg-gray-900",
    },
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      placeholder: "https://linkedin.com/company/redescucha",
      iconPrefix: "in",
      color: "bg-blue-700",
    },
  ];

  if (loading) return <LoadingSkeleton />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-teal-900">
            Redes Sociales
          </h2>
          <p className="text-sm text-teal-600 mt-0.5">
            Administrá los enlaces de las redes sociales que se muestran en el pie de página
          </p>
          {hasChanges && (
            <p className="text-sm text-amber-600 mt-0.5">
              Hay cambios sin guardar
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {saving ? (
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
          ) : (
            <Save className="mr-2 w-4 h-4" />
          )}
          Guardar Cambios
        </Button>
      </div>

      <Card className="border-teal-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-teal-800">
            Enlaces de Redes Sociales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {socialFields.map((field) => {
            const isChanged = links[field.key] !== originalLinks[field.key];
            const hasValue = links[field.key].trim() !== "";
            return (
              <div key={field.key} className="space-y-1.5">
                <Label
                  className={`text-sm flex items-center gap-2 ${
                    isChanged
                      ? "text-amber-700 font-medium"
                      : "text-teal-700"
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${field.color}`}
                  >
                    {field.iconPrefix}
                  </span>
                  {field.label}
                  {isChanged && (
                    <span className="text-xs text-amber-500">(modificado)</span>
                  )}
                  {!hasValue && (
                    <span className="text-xs text-teal-400 font-normal">
                      (no se mostrará en el footer)
                    </span>
                  )}
                </Label>
                <Input
                  value={links[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`border-teal-200 ${
                    isChanged ? "border-amber-300 bg-amber-50/30" : ""
                  }`}
                />
                <p className="text-xs text-teal-500">
                  Dejá vacío para ocultar este ícono del pie de página
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Config Tab =====
function ConfigTab() {
  const [configs, setConfigs] = useState<SiteConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch("/api/cms/site-config")
      .then((r) => r.json())
      .then((data: SiteConfigItem[]) => {
        setConfigs(data);
        const vals: Record<string, string> = {};
        data.forEach((c) => {
          vals[c.key] = c.value;
        });
        setEditedValues(vals);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes = Object.entries(editedValues)
        .filter(([key, value]) => {
          const original = configs.find((c) => c.key === key);
          return original && original.value !== value;
        })
        .map(([key, value]) => {
          const original = configs.find((c) => c.key === key);
          return { key, value, group: original?.group || "general" };
        });

      if (changes.length === 0) {
        toast.info("No hay cambios para guardar");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/cms/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (res.ok) {
        toast.success(`${changes.length} configuraciones actualizadas`);
        load();
      } else toast.error("Error al guardar");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const groups = Array.from(new Set(configs.map((c) => c.group)));

  const getChangedCount = () => {
    return Object.entries(editedValues).filter(([key, value]) => {
      const original = configs.find((c) => c.key === key);
      return original && original.value !== value;
    }).length;
  };

  const formatKey = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  if (loading) return <LoadingSkeleton />;

  const changedCount = getChangedCount();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-teal-900">
            Configuración del Sitio
          </h2>
          {changedCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">
              {changedCount} cambio{changedCount !== 1 ? "s" : ""} sin guardar
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || changedCount === 0}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {saving ? (
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
          ) : (
            <Save className="mr-2 w-4 h-4" />
          )}
          Guardar Cambios
        </Button>
      </div>

      <div className="space-y-6 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar pr-1">
        {groups.map((group) => (
          <Card key={group} className="border-teal-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-teal-800">
                {GROUP_LABELS[group] || group}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {configs
                .filter((c) => c.group === group)
                .map((config) => {
                  const isChanged =
                    editedValues[config.key] !== undefined &&
                    editedValues[config.key] !== config.value;
                  return (
                    <div key={config.key} className="space-y-1">
                      <Label
                        className={`text-sm ${
                          isChanged
                            ? "text-amber-700 font-medium"
                            : "text-teal-700"
                        }`}
                      >
                        {formatKey(config.key)}
                        {isChanged && (
                          <span className="ml-2 text-xs text-amber-500">
                            (modificado)
                          </span>
                        )}
                      </Label>
                      {config.key.includes("description") ||
                      config.key.includes("message") ? (
                        <Textarea
                          value={editedValues[config.key] || ""}
                          onChange={(e) =>
                            setEditedValues({
                              ...editedValues,
                              [config.key]: e.target.value,
                            })
                          }
                          className={`border-teal-200 ${
                            isChanged ? "border-amber-300 bg-amber-50/30" : ""
                          }`}
                          rows={2}
                        />
                      ) : (
                        <Input
                          value={editedValues[config.key] || ""}
                          onChange={(e) =>
                            setEditedValues({
                              ...editedValues,
                              [config.key]: e.target.value,
                            })
                          }
                          className={`border-teal-200 ${
                            isChanged ? "border-amber-300 bg-amber-50/30" : ""
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
