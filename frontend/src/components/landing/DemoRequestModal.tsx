'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { X, Send, CheckCircle2, AlertCircle, Loader2, Building2, User, Mail, Phone, MessageSquare } from 'lucide-react';

interface DemoRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoRequestModal({ isOpen, onClose }: DemoRequestModalProps) {
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setTimeout(() => firstInputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !organization.trim() || !email.trim()) {
      setErrorMessage('Por favor complete los campos obligatorios.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const payload = {
      full_name: fullName.trim(),
      organization: organization.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      message: message.trim() || null,
      status: 'pending',
    };

    try {
      const res = await fetch('/api/v1/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback directo a Supabase JS si el backend no responde
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
        const { error: supaError } = await supabase.from('demo_requests').insert([payload]);
        if (supaError) {
          throw new Error('No se pudo registrar la solicitud en este momento.');
        }
      } else {
        const resData = await res.json().catch(() => ({}));
        if (resData?.notify_email) {
          await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(resData.notify_email)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              _subject: `[CodexFlow] Nueva Solicitud de Demo: ${payload.organization}`,
              _template: 'table',
              Institucion: payload.organization,
              Contacto: payload.full_name,
              Correo: payload.email,
              Telefono: payload.phone || 'No especificado',
              Fondo_Documental: payload.message || 'No especificado',
            }),
          }).catch(() => {});
        }
      }

      setStatus('success');
      setFullName('');
      setOrganization('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(
        err?.message || 'Ocurrió un error al enviar la solicitud. Por favor verifique su conexión o intente nuevamente.'
      );
    }
  };

  const handleResetAndClose = () => {
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
      >
        {/* Cabecera del modal */}
        <div className="bg-slate-950/80 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 id="modal-title" className="text-lg font-bold text-white">
              Solicitar Demostración o Acceso
            </h3>
            <p className="text-xs text-slate-400">
              Evaluación técnica para diócesis, archivos notariales y curias
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-6">
          {status === 'success' ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/90 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-white">
                ¡Solicitud Registrada con Éxito!
              </h4>
              <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                Hemos recibido los datos de su institución. Nuestro equipo técnico se comunicará
                en breve para coordinar una sesión de demostración con facsímiles de su fondo documental.
              </p>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/30 cursor-pointer"
              >
                Entendido, Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === 'error' && errorMessage && (
                <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-xs text-red-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Nombre completo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    ref={firstInputRef}
                    type="text"
                    required
                    placeholder="Ej. Dr. Carlos Mendoza / Pbro. Manuel Soto"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Organización / Diócesis */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Institución / Diócesis / Archivo <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Diócesis de Cumaná / Archivo General Notarial"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Correo Electrónico Institucional */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="contacto@diocesis.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Teléfono / WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Teléfono / WhatsApp <span className="text-slate-500 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="+58 412 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Mensaje / Fondo documental */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción del Fondo Documental{' '}
                  <span className="text-slate-500 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <textarea
                    rows={3}
                    placeholder="Volumen aproximado de folios, siglos de los documentos, necesidades de indexación..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Botón de Enviar */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrando Solicitud...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Solicitud de Demostración
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
