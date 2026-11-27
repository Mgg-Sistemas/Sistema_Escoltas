import ReporteModulo from "../components/ReporteModulo.jsx";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building,
  CheckCheck,
  Globe,
  Info,
  LockKeyhole,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  User,
} from 'lucide-react';
import { Badge, Button, Card, HelpTip, Input, Select, useToast } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { cambiarSonido, cambiarTema, leerPreferencias } from '../lib/preferencias.js';

const PALETAS = [
  { id: 'grafito', label: 'Grafito Oscuro', desc: 'Negro grafito y gris metalizado, descansado para la vista', color: '#161b22' },
  { id: 'carbon', label: 'Carbón Profundo', desc: 'Negro carbón mate de alto contraste con acentos naranja', color: '#0d1117' },
  { id: 'noche', label: 'Noche Titanio', desc: 'Gris pizarra oscuro profundo con detalles dorados', color: '#1a1f26' },
];

export default function Ajustes() {
  const { user, role, roleLabel } = useAuth();
  const toast = useToast();
  const [ajustes, setAjustes] = useState([]);
  const [valores, setValores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [tasasEnVivo, setTasasEnVivo] = useState(null);
  const [preferencias, setPreferencias] = useState(leerPreferencias);
  const [paletaSeleccionada, setPaletaSeleccionada] = useState(
    localStorage.getItem('escoltas_tema_paleta') || 'grafito'
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datos, tasas] = await Promise.allSettled([
        api.listarAjustes(),
        api.obtenerTasas(),
      ]);

      const lista = datos.status === 'fulfilled' ? datos.value || [] : [];
      setAjustes(lista);
      const mapeo = Object.fromEntries(
        lista.map((a) => [a.clave, a.valor ?? ''])
      );
      setValores(mapeo);

      if (tasas.status === 'fulfilled' && tasas.value) {
        setTasasEnVivo(tasas.value);
      }
    } catch (err) {
      toast.error('Error al cargar configuración: ' + (err.message || 'Error'));
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
    const paletaGuardada = localStorage.getItem('escoltas_tema_paleta') || 'grafito';
    document.documentElement.setAttribute('data-paleta', paletaGuardada);
  }, [cargar]);

  const handleChange = (clave, valor) => {
    setValores((prev) => ({ ...prev, [clave]: valor }));
  };

  const ajustesEditables = useMemo(
    () => new Set(ajustes.filter(({ editable }) => editable === true).map(({ clave }) => clave)),
    [ajustes],
  );
  const puedeGuardar = (clave) => role === 'admin' && ajustesEditables.has(clave);
  const cambios = ajustes.filter(({ clave, valor }) =>
    puedeGuardar(clave) && String(valores[clave] ?? '') !== String(valor ?? ''),
  ).map(({ clave }) => ({ clave, valor: String(valores[clave] ?? '') }));

  const handleGuardar = async () => {
    if (!cambios.length || guardando) return;
    setGuardando(true);
    try {
      await api.guardarAjustes(cambios);
      const guardados = new Map(cambios.map(({ clave, valor }) => [clave, valor]));
      setAjustes((prev) => prev.map((ajuste) =>
        guardados.has(ajuste.clave) ? { ...ajuste, valor: guardados.get(ajuste.clave) } : ajuste,
      ));
      localStorage.setItem('escoltas_tema_paleta', paletaSeleccionada);
      document.documentElement.setAttribute('data-paleta', paletaSeleccionada);
      toast.success('Configuración y preferencias de tema guardadas.');
    } catch (err) {
      toast.error(err.message || 'Error al guardar ajustes');
    } finally {
      setGuardando(false);
    }
  };

  const handleSeleccionarPaleta = (id) => {
    setPaletaSeleccionada(id);
    localStorage.setItem('escoltas_tema_paleta', id);
    document.documentElement.setAttribute('data-paleta', id);
    if (puedeGuardar('tema_paleta')) handleChange('tema_paleta', id);
    toast.success(`Paleta "${PALETAS.find((p) => p.id === id)?.label}" aplicada en tiempo real.`);
  };

  return (
    <div className="space-y-6">
      {!cargando && role === "admin" && ['tasa_dolar_referencia', 'dias_descanso_semanal', 'empresa_nombre', 'empresa_rif'].some((clave) => !ajustesEditables.has(clave)) && (
        <p className="text-sm text-slate-400">Los campos deshabilitados aún requieren configuración en el sistema.</p>
      )}
      <ReporteModulo titulo="Configuración del sistema" archivo="configuracion" columnas={["Ajuste","Categoría","Editable"]}
        filas={ajustes.filter((r) => r.publico === true).map((r) => [r.clave, r.categoria, r.editable ? 'Sí' : 'No'])} deshabilitado={cargando} />
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Ajustes y Configuración</h1>
          <p className="mt-1 text-sm text-slate-400">
            Control de apariencia, tema visual oscuro, parámetros operacionales y datos de la empresa estilo Golden Touch.
          </p>
        </div>

        <Button variant="primary" leftIcon={Save} onClick={handleGuardar} disabled={cargando || guardando || !cambios.length}>
          {guardando ? 'Guardando...' : 'Guardar Ajustes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA 1: APARIENCIA Y TEMA OSCURO */}
        <div className="lg:col-span-2 space-y-6">
          <Card bodyClassName="space-y-6">
            <div className="border-b border-slate-700/60 pb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Moon className="h-5 w-5 text-brand-400" />
                <span>Apariencia y Modo Visual</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                La interfaz está optimizada con un fondo oscuro relajante para evitar el deslumbramiento ocular prolongado.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selecciona la tonalidad oscura de tu preferencia
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PALETAS.map((paleta) => {
                  const seleccionada = paletaSeleccionada === paleta.id;
                  return (
                    <button
                      key={paleta.id}
                      type="button"
                      onClick={() => handleSeleccionarPaleta(paleta.id)}
                      className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                        seleccionada
                          ? 'border-brand-500 bg-slate-800/90 ring-2 ring-brand-500/30'
                          : 'border-slate-700/60 bg-slate-900/60 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="font-semibold text-slate-100 text-sm">{paleta.label}</span>
                        <span
                          className="h-4 w-4 rounded-full border border-slate-600"
                          style={{ backgroundColor: paleta.color }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{paleta.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-700/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tema en este dispositivo"
                value={preferencias.tema}
                onChange={(e) => {
                  cambiarTema(e.target.value);
                  setPreferencias(leerPreferencias());
                }}
                options={[
                  { value: 'oscuro', label: 'Modo Oscuro (Recomendado descansado)' },
                  { value: 'claro', label: 'Modo Claro' },
                ]}
              />
              <Select
                label="Sonido de los avisos"
                value={String(preferencias.sonido)}
                onChange={(e) => {
                  const activado = e.target.value === 'true';
                  cambiarSonido(activado);
                  setPreferencias(leerPreferencias());
                  toast.info(activado ? 'Sonido de avisos activado.' : 'Sonido de avisos desactivado.');
                }}
                options={[
                  { value: 'true', label: 'Sonido Habilitado' },
                  { value: 'false', label: 'Silencioso' },
                ]}
              />
            </div>
          </Card>

          {/* PARÁMETROS OPERATIVOS */}
          <Card bodyClassName="space-y-6">
            <div className="border-b border-slate-700/60 pb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-brand-400" />
                <span>Parámetros Operacionales</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Valores de referencia para cálculos automáticos en nóminas, viáticos y descansos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Tasa de Referencia Oficial BCV (USD / Bs)"
                type="number"
                step="0.01"
                disabled={!puedeGuardar('tasa_dolar_referencia')}
                value={valores.tasa_dolar_referencia ?? ''}
                onChange={(e) => handleChange('tasa_dolar_referencia', e.target.value)}
              />
              <Input
                label="Días de Descanso Reglamentarios por Ciclo"
                type="number"
                disabled={!puedeGuardar('dias_descanso_semanal')}
                value={valores.dias_descanso_semanal ?? ''}
                onChange={(e) => handleChange('dias_descanso_semanal', e.target.value)}
              />
            </div>

            {/* Tasas del Mercado en Vivo: BCV, Euro, PMP Binance */}
            {tasasEnVivo && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#29c081] animate-pulse" />
                    Tasas del Mercado Oficial y P2P en Tiempo Real
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Actualización automática</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Tasa Dólar BCV */}
                  <div className="rounded-xl border border-slate-700/60 bg-[#1c1f24] p-3 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">🇺🇸 Dólar Oficial BCV</span>
                    <p className="text-lg font-black text-slate-100 mt-1">
                      Bs. {Number(tasasEnVivo.bcv_usd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <button
                      type="button"
                      disabled={!puedeGuardar('tasa_dolar_referencia')}
                      onClick={() => {
                        handleChange('tasa_dolar_referencia', String(tasasEnVivo.bcv_usd));
                        toast.success('Tasa BCV aplicada a los parámetros operacionales.');
                      }}
                      className="mt-2 text-[11px] font-bold text-[#ff8a00] hover:underline flex items-center gap-1"
                    >
                      Aplicar esta tasa BCV →
                    </button>
                  </div>

                  {/* Tasa Euro BCV */}
                  <div className="rounded-xl border border-slate-700/60 bg-[#1c1f24] p-3 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">🇪🇺 Euro Oficial BCV</span>
                    <p className="text-lg font-black text-oro mt-1">
                      Bs. {Number(tasasEnVivo.bcv_eur).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-2 block">Banco Central de Venezuela</span>
                  </div>

                  {/* Tasa PMP Binance */}
                  <div className="rounded-xl border border-slate-700/60 bg-[#1c1f24] p-3 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">🟡 PMP Binance P2P</span>
                    <p className="text-lg font-black text-amber-400 mt-1">
                      Bs. {Number(tasasEnVivo.pmp_binance).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-2 block">Promedio Ponderado USDT</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* DATOS DE LA EMPRESA */}
          <Card bodyClassName="space-y-6">
            <div className="border-b border-slate-700/60 pb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Building className="h-5 w-5 text-brand-400" />
                <span>Identidad de la Organización</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Datos fiscales que aparecen en reportes, nóminas y órdenes de servicio de seguridad y custodia.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Razón Social / Nombre"
                disabled={!puedeGuardar('empresa_nombre')}
                value={valores.empresa_nombre ?? ''}
                onChange={(e) => handleChange('empresa_nombre', e.target.value)}
                placeholder="Golden Touch 1127 C.A. / Seguridad y Escoltas"
              />
              <Input
                label="RIF Fiscal"
                disabled={!puedeGuardar('empresa_rif')}
                value={valores.empresa_rif ?? ''}
                onChange={(e) => handleChange('empresa_rif', e.target.value)}
                placeholder="J-50123456-7"
              />
            </div>
          </Card>
        </div>

        {/* COLUMNA 2: PERFIL DEL USUARIO */}
        <div className="space-y-6">
          <Card bodyClassName="space-y-4">
            <div className="border-b border-slate-700/60 pb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <User className="h-5 w-5 text-brand-400" />
                <span>Tu Perfil de Usuario</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Cuenta con la que has iniciado sesión</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-xs text-slate-400">Nombre Completo</span>
                <p className="font-semibold text-slate-100 mt-0.5">{user?.full_name || user?.nombre_completo || user?.usuario || 'Usuario del Sistema'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-xs text-slate-400">Nombre de Usuario</span>
                <p className="font-mono text-slate-200 mt-0.5">@{user?.username || 'admin'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-xs text-slate-400">Rol Activo</span>
                <div className="mt-1">
                  <Badge tone="naranja">{roleLabel}</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-brand-950/20 border-brand-800/40" bodyClassName="space-y-3">
            <div className="flex items-center gap-2 text-brand-400 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4" />
              <span>Seguridad de Sesión</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              La conexión está cifrada de extremo a extremo. Los tokens de autenticación se refrescan automáticamente en segundo plano.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
