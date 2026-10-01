"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ============================================================================
// ProfessionalSearchSelect — Combobox con buscador en tiempo real
// ============================================================================
//
// Reemplaza al <Select> nativo de shadcn por un Combobox con búsqueda
// instantánea por Nombre, Apellido o Especialidad.
//
// Características:
//   - Filtrado insensible a mayúsculas/minúsculas y tildes (NFD normalize)
//   - Placeholder: "Buscar profesional por nombre o especialidad..."
//   - Trigger muestra el Nombre en negrita + badge de Especialidad
//   - Lista con altura máxima fija (max-h-64) y scroll suave
//   - Mensaje "No se encontraron profesionales" cuando no hay coincidencias
//   - Accesibilidad: aria-expanded, role=combobox, navegación por teclado
// ============================================================================

export interface Professional {
  id: string;
  specialty: string;
  user: { name: string; email: string; active: boolean };
}

interface ProfessionalSearchSelectProps {
  professionals: Professional[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Optional className para el trigger */
  className?: string;
}

// === Helper de normalización ===
// Elimina tildes/diacríticos y pasa a minúsculas para comparación robusta.
// Ej: "Psicología Clínica" → "psicologia clinica"
// Ej: "María Belén" → "maria belen"
function normalizeText(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function ProfessionalSearchSelect({
  professionals,
  selectedId,
  onSelect,
  className,
}: ProfessionalSearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedProf = React.useMemo(
    () => professionals.find((p) => p.id === selectedId) || null,
    [professionals, selectedId]
  );

  // === Filtrado en tiempo real ===
  // Normaliza el query y cada campo del profesional, luego busca coincidencias
  // en nombre + especialidad. Insensible a mayúsculas, tildes y espacios extra.
  const filteredProfessionals = React.useMemo(() => {
    if (!query.trim()) return professionals;
    const q = normalizeText(query);
    return professionals.filter((p) => {
      const name = normalizeText(p.user?.name || "");
      const specialty = normalizeText(p.specialty || "");
      const email = normalizeText(p.user?.email || "");
      return (
        name.includes(q) ||
        specialty.includes(q) ||
        email.includes(q)
      );
    });
  }, [professionals, query]);

  // === Reset del query al cerrar el popover ===
  // Para que la próxima vez que se abra, muestre todos los profesionales.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Pequeño delay para evitar flicker visual al cerrar
      setTimeout(() => setQuery(""), 150);
    }
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Seleccionar profesional"
            className={cn(
              "w-full justify-between border-teal-200 font-normal",
              !selectedProf && "text-muted-foreground"
            )}
          >
            {selectedProf ? (
              <span className="flex items-center gap-2 truncate">
                <span className="font-bold text-teal-900 truncate">
                  {selectedProf.user.name}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                  {selectedProf.specialty}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Buscar profesional por nombre o especialidad...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
          <Command shouldFilter={false} className="w-full">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Buscar por nombre o especialidad..."
                value={query}
                onValueChange={setQuery}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandList className="max-h-64 overflow-y-auto">
              <CommandEmpty>
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No se encontraron profesionales.
                </div>
              </CommandEmpty>
              <CommandGroup>
                {filteredProfessionals.map((prof) => {
                  const isSelected = prof.id === selectedId;
                  return (
                    <CommandItem
                      key={prof.id}
                      value={prof.id}
                      onSelect={() => handleSelect(prof.id)}
                      className="flex items-center justify-between gap-2 py-2 px-3 cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={cn(
                          "truncate text-sm",
                          isSelected ? "font-bold text-teal-900" : "font-medium text-foreground"
                        )}>
                          {prof.user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {prof.specialty}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
