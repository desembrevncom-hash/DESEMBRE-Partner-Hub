import { MockBatch } from '@/types/mockDispatches';

interface BatchDataTableProps {
  batches: MockBatch[];
  onSelectBatch: (id: string) => void;
  selectedId: string | null;
}

export function BatchDataTable({ batches, onSelectBatch, selectedId }: BatchDataTableProps) {
  if (batches.length === 0) {
    return <div className="text-gray-500">No mock batches found.</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {batches.map((batch) => (
            <tr 
              key={batch.id} 
              onClick={() => onSelectBatch(batch.id)}
              className={`cursor-pointer hover:bg-gray-50 ${selectedId === batch.id ? 'bg-blue-50' : ''}`}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {batch.id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {batch.channel}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {batch.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(batch.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
