import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ subdomain, role }: { subdomain: string, role: string }) {
  const pathname = usePathname();

  const links = [
    { href: `/${subdomain}/dashboard`, label: 'Dashboard' },
    { href: `/${subdomain}/ingest`, label: 'Ingesta/Dudosos' },
    { href: `/${subdomain}/settings/users`, label: 'Equipo' }
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-8">CodexFlow</h2>
      <nav className="flex flex-col gap-2">
        {links.map(link => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`px-4 py-2 rounded transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-gray-700 text-sm text-gray-400">
        Rol: {role}
      </div>
    </div>
  );
}
