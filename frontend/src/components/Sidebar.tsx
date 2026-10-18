"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Scan, 
  BookOpen, 
  Users, 
  BarChart3, 
  PanelLeftClose, 
  PanelLeftOpen,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import SidebarItem from './SidebarItem';
import LogoutButton from './LogoutButton';

interface SidebarProps {
  subdomain: string;
  role: string;
}

export default function Sidebar({ subdomain, role }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();

  const isDigitizer = role === 'digitizer';
  const isEvaluator = role === 'evaluator';

  const links = isDigitizer
    ? [
        { href: `/${subdomain}/visor`, label: 'Visor de Indexación', icon: Scan },
        { href: `/${subdomain}/metrics`, label: 'Mis Métricas', icon: BarChart3 },
        { href: `/${subdomain}/manual`, label: 'Manual & Ayuda', icon: HelpCircle },
      ]
    : isEvaluator
    ? [
        { href: `/${subdomain}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
        { href: `/${subdomain}/evaluacion`, label: 'Mesa de Evaluación', icon: ShieldCheck },
        { href: `/${subdomain}/visor`, label: 'Visor de Indexación', icon: Scan },
        { href: `/${subdomain}/records`, label: 'Registros', icon: BookOpen },
        { href: `/${subdomain}/manual`, label: 'Manual & Ayuda', icon: HelpCircle },
      ]
    : [
        { href: `/${subdomain}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
        { href: `/${subdomain}/evaluacion`, label: 'Mesa de Evaluación', icon: ShieldCheck },
        { href: `/${subdomain}/ingest`, label: 'Ingesta/Dudosos', icon: UploadCloud },
        { href: `/${subdomain}/visor`, label: 'Visor de Indexación', icon: Scan },
        { href: `/${subdomain}/records`, label: 'Registros', icon: BookOpen },
        { href: `/${subdomain}/settings/users`, label: 'Equipo', icon: Users },
        { href: `/${subdomain}/manual`, label: 'Manual & Ayuda', icon: HelpCircle },
      ];

  return (
    <>
      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-gray-900 text-white flex flex-col p-3 transition-all duration-300 ease-in-out border-r border-gray-800 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-gray-800 pb-3 mb-4 transition-all ${
            isCollapsed
              ? 'flex-col gap-2 justify-center'
              : 'justify-between px-2'
          }`}
        >
          {isCollapsed ? (
            <>
              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                title="Expandir barra lateral (Ctrl + B)"
                aria-label="Expandir barra lateral"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
              <span className="text-xs font-black tracking-widest text-blue-400">
                CF
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">
                  CodexFlow
                </span>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                title="Colapsar barra lateral (Ctrl + B)"
                aria-label="Colapsar barra lateral"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <div key={link.href} onClick={closeMobile}>
                <SidebarItem
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  isActive={isActive}
                  isCollapsed={isCollapsed}
                />
              </div>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="mt-auto pt-3 border-t border-gray-800 flex flex-col gap-3">
          {!isCollapsed && (
            <>
              {role === 'superadmin' ? (
                <div className="px-2 flex flex-col gap-1.5">
                  <div className="bg-indigo-950 border border-indigo-700/60 text-indigo-200 px-2.5 py-1.5 rounded text-[11px] font-medium leading-tight shadow-2xs">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-400">
                      Modo Auditoría
                    </div>
                    <div className="font-semibold text-white truncate mt-0.5">
                      Rol: Superadmin
                    </div>
                    <div className="text-[10px] text-indigo-300 truncate">
                      Auditando: <span className="font-semibold text-white">{subdomain}</span>
                    </div>
                  </div>
                  <Link
                    href="/superadmin"
                    className="text-[11px] text-indigo-400 hover:text-indigo-200 flex items-center gap-1 font-semibold transition-colors px-1 py-0.5"
                  >
                    <span>← Panel Global</span>
                  </Link>
                </div>
              ) : (
                <div className="px-2 text-xs text-gray-400 flex items-center justify-between">
                  <span>Rol:</span>
                  <span className="font-semibold text-gray-300 capitalize">
                    {role === 'evaluator' ? 'Evaluador de Calidad' : role}
                  </span>
                </div>
              )}
            </>
          )}
          <div className={isCollapsed ? 'flex justify-center' : 'w-full'}>
            <LogoutButton isCollapsed={isCollapsed} className={isCollapsed ? '' : 'w-full'} />
          </div>
        </div>
      </aside>
    </>
  );
}
