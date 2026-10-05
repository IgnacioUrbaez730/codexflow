'use client';
import { useState } from 'react';

export default function DashboardPage({ params }: { params: { subdomain: string } }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    setInviteStatus('sending');
    // Simular el envío de invitación
    setTimeout(() => {
      setInviteStatus('sent');
      setInviteEmail('');
    }, 1000);
  };

  const handleResend = () => {
    setInviteStatus('sending');
    // Simular el reenvío
    setTimeout(() => {
      setInviteStatus('sent');
    }, 1000);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 className="text-2xl font-bold mb-4">Dashboard del Tenant: {params.subdomain}</h1>
      <p className="mb-8">Bienvenido a tu espacio aislado de trabajo.</p>

      <section className="p-6 bg-white rounded shadow-md max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Invitar Digitador</h2>
        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email del digitador</label>
            <input 
              type="email" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={inviteStatus === 'sending'}
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {inviteStatus === 'sending' ? 'Enviando...' : 'Invitar'}
          </button>
        </form>
        
        {inviteStatus === 'sent' && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm">Invitación enviada exitosamente.</span>
            <button 
              onClick={handleResend}
              className="text-sm px-3 py-1 bg-white border border-green-300 rounded hover:bg-green-50 whitespace-nowrap"
            >
              Reenviar Invitación
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
