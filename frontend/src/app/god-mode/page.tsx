export default function GodModePage() {
  // Dummy data for ONGs
  const ongs = [
    { id: 1, name: 'ONG Esperanza', users: 12, quotaUsed: 80 },
    { id: 2, name: 'Fundación Vida', users: 4, quotaUsed: 15 },
    { id: 3, name: 'Caritas Local', users: 25, quotaUsed: 95 },
  ];

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Panel de Superadmin</h2>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuarios</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuota Usada (%)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ongs.map((ong) => (
              <tr key={ong.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ong.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ong.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ong.users}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${ong.quotaUsed > 90 ? 'bg-red-600' : 'bg-blue-600'}`} 
                      style={{ width: `${ong.quotaUsed}%` }}
                    ></div>
                  </div>
                  <span className="text-xs mt-1 inline-block">{ong.quotaUsed}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
