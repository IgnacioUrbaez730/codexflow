import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">Hello World! 👋</h1>
      <p className="text-xl text-gray-700 mb-8 text-center max-w-md">
        CodexFlow está vivo y respirando en Vercel. Esta es una página temporal para confirmar que el despliegue es exitoso.
      </p>
      
      <div className="flex gap-4">
        <Link 
          href="/register" 
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700 transition"
        >
          Ir a Registro
        </Link>
        <Link 
          href="/superadmin" 
          className="px-6 py-3 bg-gray-800 text-white font-semibold rounded shadow hover:bg-gray-900 transition"
        >
          Panel Superadmin
        </Link>
      </div>
    </div>
  );
}
