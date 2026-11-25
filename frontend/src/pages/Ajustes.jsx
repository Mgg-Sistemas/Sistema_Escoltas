import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Info,
  LockKeyhole,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge, Button, Card, Input, Select, useToast } from '../components/ui.jsx';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';

const CATEGORIAS = {
  general: { label: 'General', icono: SlidersHorizontal, descripcion: 'Datos base y preferencias operativas.' },
  apariencia: { label: 'Apariencia', icono: Palette, descripcion: 'Nombre, emblema y colores del sistema.' },
  seguridad: { label: 'Seguridad', icono: LockKeyhole, descripcion: 'Claves temporales, sesión y recuperación.' },
};

function valorInicial(ajuste) {
  if (ajuste.tipo === 'booleano') return String(ajuste.valor ?? '').toLowerCase() === 'true' ? 'true' : 'false';
  return ajuste.valor ?? '';
}

function ControlAjuste({ ajuste, valor, onChange }) {
  if (ajuste.tipo === 'booleano') {
    return (
      <Select
        label={ajuste.descripcion || ajuste.clave}
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        options={[
          { value: 'true', label: 'Activado' },
          { value: 'false', label: 'Desactivado' },
        ]}
      />
    );
  }

  if (ajuste.tipo === 'color') {
    return (
      <div>
        <Input
          label={ajuste.descripcion || ajuste.clave}
          value={valor}
          onChange={(evento) => onChange(evento.target.value)}
          maxLength={20}
        />
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#FF7000'}
          onChange={(evento) => onChange(evento.target.value)}
          aria-label={`Selector de color para ${ajuste.clave}`}
          className="mt-2 h-10 w-20 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
        />
      </div>
    );
  }

  return (
    <Input
      label={ajuste.descripcion || ajuste.clave}
      type={ajuste.tipo === 'secreto' ? 'password' : ajuste.tipo === 'numero' ? 'number' : 'text'}
      value={valor}
      onChange={(evento) => onChange(evento.target.value)}
      maxLength={4000}
    />
  );
}

export default function Ajustes() {
  const toast = useToast();
  const [ajustes, setAjustes] = useState([]);
  const [valores, setValores] = useState({});
  const [originales, setOriginales] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api.listarAjustes();
      const lista = Array.isArray(datos) ? datos : [];
      const iniciales = Object.fromEntries(lista.map((item) => [item.clave, valorInicial(item)]));
      setAjustes(lista);
      setValores(iniciales);
      setOriginales(iniciales);
    } catch (error) {
      toast.error('No se pudieron cargar los ajustes', error.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['ajustes_sistema'] });

  const cambios = useMemo(
    () => ajustes.filter((item) => valores[item.clave] !== undefined && valores[item.clave] !== originales[item.clave]),
    [ajustes, valores, originales],
  );

  const guardar = async () => {
    if (cambios.length === 0) return;
    try {
      setGuardando(true);
      await api.guardarAjustes(cambios.map((item) => ({ clave: item.clave, valor: valores[item.clave] })));
      toast.success('Ajustes guardados', `Se actualizaron ${cambios.length} configuración(es).`);
      await cargar();
    } catch (error) {
      toast.error('No se pudieron guardar los ajustes', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const agrupados = useMemo(() => {
    return Object.entries(CATEGORIAS).map(([clave, meta]) => ({
      clave,
      ...meta,
      _items: ajustes.filter((item) => item.categoria === clave),
    }));
  }, [ajustes]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Ajustes del sistema</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Configura la identidad visual, la moneda, la zona horaria y las reglas de seguridad. Los
          cambios se guardan en la base de datos y se reflejan en tiempo real en los demás usuarios.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 text-brand-900 sm:flex-row sm:items-center">
        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-200">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Solo administradores</p>
          <p className="mt-1 text-sm leading-relaxed text-brand-900/80">
            Las claves iniciales aparecen marcadas como secreto. Se usan al crear cuentas y obligan al
            usuario a cambiarlas en su primer ingreso. Nunca se guardan en texto plano en el perfil.
          </p>
        </div>
        {cambios.length > 0 && <Badge tone="naranja">{cambios.length} sin guardar</Badge>}
      </div>

      {cargando ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">Cargando configuración…</p>
        </Card>
      ) : (
        agrupados.map((grupo) => {
          const Icono = grupo.icono;
          if (grupo._items.length === 0) return null;
          return (
            <Card
              key={grupo.clave}
              title={grupo.label}
              subtitle={grupo.descripcion}
              actions={<Icono className="h-5 w-5 text-brand-700" aria-hidden="true" />}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {grupo._items.map((ajuste) => {
                  const modificado = cambios.some((item) => item.clave === ajuste.clave);
                  return (
                    <div
                      key={ajuste.clave}
                      className={`rounded-xl border p-4 ${modificado ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700">{ajuste.clave}</span>
                        <Badge tone={ajuste.publico ? 'verde' : 'morado'}>
                          {ajuste.publico ? 'Público' : 'Privado'}
                        </Badge>
                        {ajuste.tipo === 'secreto' && <Badge tone="naranja">Secreto</Badge>}
                      </div>
                      <ControlAjuste
                        ajuste={ajuste}
                        valor={valores[ajuste.clave] ?? ''}
                        onChange={(valor) =>
                          setValores((actual) => ({ ...actual, [ajuste.clave]: valor }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          Si cambias la clave inicial de los usuarios, aplicará solo a cuentas nuevas. Las cuentas
          existentes conservan su contraseña actual hasta que se restablezca o se cambie.
        </p>
        <Button
          variant="primary"
          size="lg"
          leftIcon={Save}
          loading={guardando}
          disabled={cambios.length === 0 || cargando}
          onClick={guardar}
          className="w-full sm:w-auto"
        >
          {cambios.length === 0 ? 'No hay cambios' : `Guardar ${cambios.length} cambio(s)`}
        </Button>
      </div>
    </div>
  );
}
