"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";

// === Lista de países con códigos de llamada internacional ===
// Ordenados por relevancia para REP (Argentina primero, luego LATAM, luego resto).
// El código se guarda sin el '+' porque la utilidad formatPhoneForWhatsApp
// trabaja con dígitos, pero el input muestra el '+' para claridad visual.
const COUNTRIES = [
  { code: "54",  iso: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "598", iso: "UY", flag: "🇺🇾", name: "Uruguay" },
  { code: "595", iso: "PY", flag: "🇵🇾", name: "Paraguay" },
  { code: "591", iso: "BO", flag: "🇧🇴", name: "Bolivia" },
  { code: "56",  iso: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "51",  iso: "PE", flag: "🇵🇪", name: "Perú" },
  { code: "593", iso: "EC", flag: "🇪🇨", name: "Ecuador" },
  { code: "57",  iso: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "58",  iso: "VE", flag: "🇻🇪", name: "Venezuela" },
  { code: "52",  iso: "MX", flag: "🇲🇽", name: "México" },
  { code: "503", iso: "SV", flag: "🇸🇻", name: "El Salvador" },
  { code: "504", iso: "HN", flag: "🇭🇳", name: "Honduras" },
  { code: "505", iso: "NI", flag: "🇳🇮", name: "Nicaragua" },
  { code: "506", iso: "CR", flag: "🇨🇷", name: "Costa Rica" },
  { code: "507", iso: "PA", flag: "🇵🇦", name: "Panamá" },
  { code: "1",   iso: "US", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "1",   iso: "CA", flag: "🇨🇦", name: "Canadá" },
  { code: "34",  iso: "ES", flag: "🇪🇸", name: "España" },
  { code: "55",  iso: "BR", flag: "🇧🇷", name: "Brasil" },
  { code: "44",  iso: "GB", flag: "🇬🇧", name: "Reino Unido" },
  { code: "33",  iso: "FR", flag: "🇫🇷", name: "Francia" },
  { code: "49",  iso: "DE", flag: "🇩🇪", name: "Alemania" },
  { code: "39",  iso: "IT", flag: "🇮🇹", name: "Italia" },
];

type PhoneInputProps = {
  value: string;          // Solo el número local, SIN el código de país
  onChange: (fullPhone: string) => void;  // Devuelve el número completo en formato E.164 (ej: "51998465686")
  defaultCountryCode?: string; // Por defecto "54" (Argentina)
  placeholder?: string;
  id?: string;
  className?: string;
  required?: boolean;
};

export function PhoneInput({
  value,
  onChange,
  defaultCountryCode = "54",
  placeholder = "Ej: 11 7668 3429",
  id,
  className = "",
  required = false,
}: PhoneInputProps) {
  // === Detectar el código de país inicial ===
  // Si el valor que viene ya tiene un código de país (ej: "51998465686"),
  // intentar detectarlo y separar el número local. Si no, usar el default.
  const detectInitialCountry = (): { countryCode: string; localNumber: string } => {
    if (!value) {
      return { countryCode: defaultCountryCode, localNumber: "" };
    }
    const cleaned = value.replace(/[^0-9]/g, "");
    // Probar códigos de 3 dígitos primero (para no confundir 598 con 54)
    const sortedCodes = [...COUNTRIES]
      .map((c) => c.code)
      .sort((a, b) => b.length - a.length);
    for (const code of sortedCodes) {
      if (cleaned.startsWith(code) && cleaned.length > code.length) {
        return { countryCode: code, localNumber: cleaned.substring(code.length) };
      }
    }
    return { countryCode: defaultCountryCode, localNumber: cleaned };
  };

  const initial = detectInitialCountry();
  const [countryCode, setCountryCode] = useState(initial.countryCode);
  const [localNumber, setLocalNumber] = useState(initial.localNumber);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // === Cuando cambia el código o el número, propagar al parent ===
  useEffect(() => {
    const fullPhone = `${countryCode}${localNumber}`.replace(/[^0-9]/g, "");
    onChange(fullPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, localNumber]);

  // === Cerrar dropdown al hacer click afuera ===
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // === Si el value cambia desde afuera (ej: reset del form), sincronizar ===
  useEffect(() => {
    const detected = detectInitialCountry();
    if (detected.countryCode !== countryCode || detected.localNumber !== localNumber) {
      setCountryCode(detected.countryCode);
      setLocalNumber(detected.localNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  // === Filtrar países por búsqueda ===
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.iso.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`relative flex ${className}`}>
      {/* === Selector de país === */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 h-9 px-2 border border-beige-300 bg-beige-100 rounded-l-md hover:bg-beige-200 transition-colors text-sm"
          aria-label="Seleccionar país"
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="text-forest-500 font-medium text-xs">+{countryCode}</span>
          <ChevronsUpDown className="w-3 h-3 text-forest-400" />
        </button>
        {dropdownOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-beige-300 rounded-lg shadow-lg max-h-72 overflow-hidden flex flex-col">
            {/* Buscador */}
            <div className="p-2 border-b border-beige-200">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar país..."
                className="w-full px-2 py-1 text-sm border border-beige-300 rounded focus:outline-none focus:border-sage-300"
                autoFocus
              />
            </div>
            {/* Lista de países */}
            <div className="overflow-y-auto flex-1">
              {filteredCountries.map((c) => (
                <button
                  key={`${c.iso}-${c.code}`}
                  type="button"
                  onClick={() => {
                    setCountryCode(c.code);
                    setDropdownOpen(false);
                    setSearchQuery("");
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-beige-100 transition-colors text-left ${
                    c.code === countryCode ? "bg-sage-300/15" : ""
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-forest-500">{c.name}</span>
                  <span className="text-forest-400 text-xs">+{c.code}</span>
                  {c.code === countryCode && <Check className="w-3 h-3 text-sage-500" />}
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <div className="px-3 py-4 text-sm text-forest-400 text-center">
                  No se encontraron países
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === Input del número local === */}
      <input
        id={id}
        type="tel"
        required={required}
        value={localNumber}
        onChange={(e) => {
          // Solo permitir dígitos, espacios y guiones (se sanitizan al enviar)
          const cleaned = e.target.value.replace(/[^0-9\s-]/g, "");
          setLocalNumber(cleaned);
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-9 px-3 border border-l-0 border-beige-300 bg-beige-100 rounded-r-md text-sm text-forest-500 placeholder:text-forest-300 focus:outline-none focus:border-sage-300 focus:ring-2 focus:ring-sage-300/20"
      />
    </div>
  );
}
