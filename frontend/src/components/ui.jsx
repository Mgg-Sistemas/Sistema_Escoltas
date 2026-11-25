import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Info,
  Inbox,
  Loader2,
  X,
} from 'lucide-react';
import { TONES } from '../lib/constants.js';

// ---------- Botones ----------

export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false } = {}) {
  const variantes = {
    primary: 'bg-naranja-cromado text-white shadow-cromado hover:brightness-110 disabled:bg-chrome-400 disabled:shadow-none',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:text-slate-400',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:bg-rose-300',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-300',
  };
  const tamanos = {
    sm: 'min-h-9 px-3 text-sm',
    md: 'min-h-11 px-4 text-sm',
    lg: 'min-h-12 px-5 text-base',
  };
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${variantes[variant]} ${tamanos[size]} ${fullWidth ? 'w-full' : ''}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${buttonClasses({ variant, size, fullWidth })} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : LeftIcon ? <LeftIcon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
      {RightIcon && !loading ? <RightIcon className="h-4 w-4" aria-hidden="true" /> : null}
    </button>
  );
}

// ---------- Contenedores ----------

export function Card({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'gris', icon: Icon, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[tone] || TONES.gris} ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', loading = false }) {
  const tonos = {
    brand: 'bg-brand-50 text-brand-700',
    verde: 'bg-emerald-50 text-emerald-700',
    amarillo: 'bg-amber-50 text-amber-700',
    rojo: 'bg-rose-50 text-rose-700',
    morado: 'bg-violet-50 text-violet-700',
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="mt-4 h-4 w-24" />
        <Skeleton className="mt-2 h-8 w-16" />
        <Skeleton className="mt-2 h-3 w-32" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-md">
      {Icon && (
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tonos[tone] || tonos.brand}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value ?? '—'}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ---------- Formularios ----------

const campoBase =
  'block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100 disabled:text-slate-500';

export function Field({ label, htmlFor, help, error, required = false, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-rose-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{help}</p>
      ) : null}
    </div>
  );
}

export function Input({ label, help, error, required, className = '', containerClassName = '', id, ...props }) {
  const generado = useId();
  const inputId = id || generado;
  return (
    <Field label={label} htmlFor={inputId} help={help} error={error} required={required} className={containerClassName}>
      <input id={inputId} className={`${campoBase} ${error ? 'border-rose-400' : ''} ${className}`} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Select({ label, help, error, required, options = [], children, className = '', containerClassName = '', id, ...props }) {
  const generado = useId();
  const selectId = id || generado;
  return (
    <Field label={label} htmlFor={selectId} help={help} error={error} required={required} className={containerClassName}>
      <select id={selectId} className={`${campoBase} ${error ? 'border-rose-400' : ''} ${className}`} aria-invalid={Boolean(error)} {...props}>
        {children}
        {options.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function Textarea({ label, help, error, required, rows = 3, className = '', containerClassName = '', id, ...props }) {
  const generado = useId();
  const textareaId = id || generado;
  return (
    <Field label={label} htmlFor={textareaId} help={help} error={error} required={required} className={containerClassName}>
      <textarea id={textareaId} rows={rows} className={`${campoBase} resize-y ${error ? 'border-rose-400' : ''} ${className}`} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

// ---------- Modales y ayudas ----------

const TAMANOS_MODAL = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const manejarTecla = (evento) => {
      if (evento.key === 'Escape') onClose?.();
    };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', manejarTecla);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', manejarTecla);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-panel animate-fade-in sm:rounded-2xl ${TAMANOS_MODAL[size] || TAMANOS_MODAL.md}`}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title = '¿Estás seguro?',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  loading = false,
  variant = 'danger',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant={variant} onClick={onConfirm} loading={loading} fullWidth className="sm:w-auto">
            {confirmLabel}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={loading} fullWidth className="sm:w-auto">
            {cancelLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-relaxed">
          Esta acción no se puede deshacer. Confirma únicamente cuando los datos sean correctos.
        </p>
      </div>
    </Modal>
  );
}

export function HelpTip({ title, children }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span className="relative inline-flex align-middle" onMouseLeave={() => setAbierto(false)}>
      <button
        type="button"
        aria-label={`Ayuda: ${title}`}
        aria-expanded={abierto}
        onMouseEnter={() => setAbierto(true)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onClick={() => setAbierto((valor) => !valor)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>
      {abierto && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-40 w-64 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-panel"
        >
          <strong className="mb-1 block text-sm">{title}</strong>
          {children}
        </span>
      )}
    </span>
  );
}

export function EmptyState({ title, description, actionLabel, onAction, icon: Icon = Inbox, secondary }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction} size="lg">
          {actionLabel}
        </Button>
      )}
      {secondary && <div className="mt-3 text-sm text-slate-500">{secondary}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function Pagination({ page, totalPages, onChange, totalItems }) {
  const paginas = Math.max(1, Number(totalPages) || 1);
  if (paginas <= 1) return null;

  const inicio = Math.max(1, Math.min(page - 2, paginas - 4));
  const fin = Math.min(paginas, Math.max(5, inicio + 4));
  const numeros = Array.from({ length: fin - inicio + 1 }, (_, indice) => inicio + indice);

  return (
    <nav className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between" aria-label="Paginación">
      <p className="text-xs text-slate-500">
        Página <strong className="text-slate-700">{page}</strong> de {paginas}
        {totalItems !== undefined ? ` · ${totalItems} registros` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
        </button>
        {numeros.map((numero) => (
          <button
            key={numero}
            type="button"
            onClick={() => onChange(numero)}
            aria-current={numero === page ? 'page' : undefined}
            className={`hidden h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold sm:inline-flex ${
              numero === page ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {numero}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= paginas}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 disabled:opacity-40"
        >
          Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

// ---------- Notificaciones ----------

const ToastContext = createContext(null);

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast debe usarse dentro de ToastProvider.');
  return contexto;
}

const ESTILOS_TOAST = {
  success: { icon: CheckCircle2, clase: 'border-emerald-200 bg-emerald-50 text-emerald-900', rol: 'status' },
  error: { icon: AlertCircle, clase: 'border-rose-200 bg-rose-50 text-rose-900', rol: 'alert' },
  info: { icon: Info, clase: 'border-blue-200 bg-blue-50 text-blue-900', rol: 'status' },
  warning: { icon: AlertTriangle, clase: 'border-amber-200 bg-amber-50 text-amber-900', rol: 'status' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const quitar = useCallback((id) => {
    setToasts((actuales) => actuales.filter((toast) => toast.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensaje, tipo = 'success', detalle = '') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((actuales) => [...actuales.slice(-3), { id, mensaje, tipo, detalle }]);
      window.setTimeout(() => quitar(id), 5500);
      return id;
    },
    [quitar],
  );

  const valor = useMemo(
    () => ({
      toast: mostrar,
      success: (mensaje, detalle) => mostrar(mensaje, 'success', detalle),
      error: (mensaje, detalle) => mostrar(mensaje, 'error', detalle),
      info: (mensaje, detalle) => mostrar(mensaje, 'info', detalle),
      warning: (mensaje, detalle) => mostrar(mensaje, 'warning', detalle),
      quitar,
    }),
    [mostrar, quitar],
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-24 z-[90] flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const estilo = ESTILOS_TOAST[toast.tipo] || ESTILOS_TOAST.info;
          const Icono = estilo.icon;
          return (
            <div
              key={toast.id}
              role={estilo.rol}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-panel animate-fade-in ${estilo.clase}`}
            >
              <Icono className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{toast.mensaje}</p>
                {toast.detalle && <p className="mt-1 text-xs leading-relaxed opacity-80">{toast.detalle}</p>}
              </div>
              <button
                type="button"
                onClick={() => quitar(toast.id)}
                aria-label="Cerrar notificación"
                className="-mr-1 -mt-1 rounded-lg p-1.5 opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
