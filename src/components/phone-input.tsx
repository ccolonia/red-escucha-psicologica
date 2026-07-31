"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";

// === Lista de países con códigos de llamada internacional ===
// Ordenados por relevancia para REP (Argentina primero, luego LATAM, luego resto).
// El código se guarda sin el '+' porque la utilidad formatPhoneForWhatsApp
// trabaja con dígitos, pero el input muestra el '+' para claridad visual.
//
// Cada país tiene un placeholder con formato local realista, normalizado con
// prefijo "Ej: " para mayor claridad. El placeholder se inyecta dinámicamente
// en el input según el país seleccionado (commit 5d2b0ab ya implementa el
// mecanismo; este commit solo alinea los valores a los estándares solicitados).
const COUNTRIES = [
  { code: "54",   iso: "AR", flag: "🇦🇷", name: "Argentina",         placeholder: "Ej: 11 2345 6789" },
  { code: "598",  iso: "UY", flag: "🇺🇾", name: "Uruguay",           placeholder: "Ej: 99 123 456" },
  { code: "595",  iso: "PY", flag: "🇵🇾", name: "Paraguay",          placeholder: "Ej: 981 123 456" },
  { code: "591",  iso: "BO", flag: "🇧🇴", name: "Bolivia",            placeholder: "Ej: 7012 3456" },
  { code: "56",   iso: "CL", flag: "🇨🇱", name: "Chile",             placeholder: "Ej: 9 1234 5678" },
  { code: "51",   iso: "PE", flag: "🇵🇪", name: "Perú",              placeholder: "Ej: 912 345 678" },
  { code: "593",  iso: "EC", flag: "🇪🇨", name: "Ecuador",           placeholder: "Ej: 99 123 4567" },
  { code: "57",   iso: "CO", flag: "🇨🇴", name: "Colombia",          placeholder: "Ej: 300 123 4567" },
  { code: "58",   iso: "VE", flag: "🇻🇪", name: "Venezuela",         placeholder: "Ej: 412 123 4567" },
  { code: "52",   iso: "MX", flag: "🇲🇽", name: "México",            placeholder: "Ej: 55 1234 5678" },
  { code: "503",  iso: "SV", flag: "🇸🇻", name: "El Salvador",       placeholder: "Ej: 7012 3456" },
  { code: "504",  iso: "HN", flag: "🇭🇳", name: "Honduras",          placeholder: "Ej: 9012 3456" },
  { code: "505",  iso: "NI", flag: "🇳🇮", name: "Nicaragua",         placeholder: "Ej: 8012 3456" },
  { code: "506",  iso: "CR", flag: "🇨🇷", name: "Costa Rica",        placeholder: "Ej: 8312 3456" },
  { code: "507",  iso: "PA", flag: "🇵🇦", name: "Panamá",            placeholder: "Ej: 6012 3456" },
  { code: "502",  iso: "GT", flag: "🇬🇹", name: "Guatemala",         placeholder: "Ej: 5012 3456" },
  { code: "1809", iso: "DO", flag: "🇩🇴", name: "Rep. Dominicana",   placeholder: "Ej: 809 123 4567" },
  { code: "1",    iso: "US", flag: "🇺🇸", name: "Estados Unidos",    placeholder: "Ej: 202 555 0123" },
  { code: "1",    iso: "CA", flag: "🇨🇦", name: "Canadá",            placeholder: "Ej: 202 555 0123" },
  { code: "34",   iso: "ES", flag: "🇪🇸", name: "España",            placeholder: "Ej: 612 34 56 78" },
  { code: "55",   iso: "BR", flag: "🇧🇷", name: "Brasil",            placeholder: "Ej: 11 91234 5678" },
  { code: "44",   iso: "GB", flag: "🇬🇧", name: "Reino Unido",       placeholder: "Ej: 7700 900123" },
  { code: "33",   iso: "FR", flag: "🇫🇷", name: "Francia",           placeholder: "Ej: 6 12 34 56 78" },
  { code: "49",   iso: "DE", flag: "🇩🇪", name: "Alemania",          placeholder: "Ej: 151 23456789" },
  { code: "39",   iso: "IT", flag: "🇮🇹", name: "Italia",            placeholder: "Ej: 312 345 6789" },
];

type PhoneInputProps = {
  value: string;          // Número completo en formato E.164 (ej: "5491176683429" o "51998465686")
  onChange: (fullPhone: string) => void;  // Devuelve el número completo en formato E.164
  defaultCountryCode?: string; // Por defecto "54" (Argentina)
  placeholder?: string;   // Opcional — si no se pasa, usa el placeholder del país seleccionado
  id?: string;
  className?: string;
  required?: boolean;
};

export function PhoneInput({
  value,
  onChange,
  defaultCountryCode = "54",
  placeholder,
  id,
  className = "",
  required = false,
}: PhoneInputProps) {
  // === Estado interno separado limpiamente ===
  // CRÍTICO: NO inicializar con el código de país como número local.
  // - countryCode: solo el código (ej: "54", "51", "1")
  // - localNumber: solo el número local SIN el código (ej: "1176683429", "998465686")
  // El bug anterior inicializaba localNumber con "54" porque detectInitialCountry
  // caía en el fallback y devolvía defaultCountryCode como localNumber.
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [localNumber, setLocalNumber] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // === Ref para evitar loop infinito en la sincronización ===
  // Sin esto, el flujo es: input cambia → useEffect propaga al parent → parent
  // actualiza value → useEffect de sync detecta cambio → vuelve a setear estado
  // → loop infinito. Con la ref, solo sincronizamos cuando el valor que viene
  // del parent es DISTINTO al último que propagamos.
  const lastPropagatedRef = useRef<string>("");

  // === Sincronización UNIDIRECCIONAL: parent → interno ===
  // Solo se ejecuta cuando el value del parent cambia desde afuera
  // (ej: carga inicial con un teléfono ya guardado, o reset del form a "").
  // No se ejecuta cuando nosotros mismos propagamos un cambio al parent.
  useEffect(() => {
    // Si el value que viene es igual al último que propagamos, ignorar
    // (es el eco del nuestro propio onChange → no hacer nada)
    if (value === lastPropagatedRef.current) return;

    // Si el value es vacío (reset del form), limpiar el número local
    // pero MANTENER el countryCode (default Argentina)
    if (!value || value.trim() === "") {
      setLocalNumber("");
      lastPropagatedRef.current = "";
      return;
    }

    // Intentar detectar el código de país del value entrante
    const cleaned = value.replace(/[^0-9]/g, "");
    // Probar códigos de 3 dígitos primero (para no confundir 598 con 54)
    const sortedCodes = [...COUNTRIES]
      .map((c) => c.code)
      .sort((a, b) => b.length - a.length);
    for (const code of sortedCodes) {
      if (cleaned.startsWith(code) && cleaned.length > code.length) {
        // Encontramos el código — separar
        if (code !== countryCode) setCountryCode(code);
        const newLocal = cleaned.substring(code.length);
        if (newLocal !== localNumber) setLocalNumber(newLocal);
        lastPropagatedRef.current = cleaned;
        return;
      }
    }
    // No se detectó código — asumir que es solo número local
    if (cleaned !== localNumber) setLocalNumber(cleaned);
    lastPropagatedRef.current = cleaned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // === Propagación interna → parent ===
  // Cada vez que cambia el countryCode o el localNumber, armar el E.164
  // y mandarlo al parent. Usar la ref para recordar qué propagamos y
  // evitar que el useEffect anterior lo vuelva a procesar.
  useEffect(() => {
    // Limpiar el número local: solo dígitos, sin ceros a la izquierda
    // si el usuario escribió "011..." (formato argentino con 0 inicial).
    const cleanLocal = localNumber.replace(/[^0-9]/g, "").replace(/^0+/, "");
    const fullPhone = `${countryCode}${cleanLocal}`.replace(/[^0-9]/g, "");

    // Solo propagar si cambió realmente
    if (fullPhone !== lastPropagatedRef.current) {
      lastPropagatedRef.current = fullPhone;
      onChange(fullPhone);
    }
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

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
  // Placeholder dinámico: si el parent no pasa uno, usar el del país seleccionado
  // === Placeholder dinámico con prioridad absoluta ===
  // SIEMPRE usa el placeholder del país seleccionado, ignorando el prop
  // `placeholder` que venga del parent. Esto es clave para que el selector
  // de país tenga sentido: si el admin pasa un placeholder fijo, el
  // placeholder no cambiaría al cambiar de país y el selector perdería
  // utilidad. El prop `placeholder` queda solo para fallback si el país
  // no está en la lista (caso edge que no debería pasar).
  const effectivePlaceholder = selectedCountry.placeholder || placeholder || "Ej: 123456789";

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
      {/* SOLO dígitos, espacios y guiones. El código de país NUNCA va acá. */}
      <input
        id={id}
        type="tel"
        required={required}
        value={localNumber}
        onChange={(e) => {
          // Solo permitir dígitos, espacios y guiones (se sanitizan al propagar)
          const cleaned = e.target.value.replace(/[^0-9\s-]/g, "");
          setLocalNumber(cleaned);
        }}
        placeholder={effectivePlaceholder}
        className="flex-1 min-w-0 h-9 px-3 border border-l-0 border-beige-300 bg-beige-100 rounded-r-md text-sm text-forest-500 placeholder:text-forest-300 focus:outline-none focus:border-sage-300 focus:ring-2 focus:ring-sage-300/20"
      />
    </div>
  );
}
