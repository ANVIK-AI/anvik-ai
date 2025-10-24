import { useState } from 'react';

export function DocumentMetadataUpdateTester() {
  const [documentId, setDocumentId] = useState('');
  const [metadata, setMetadata] = useState('{"category": "test", "priority": "high", "tags": ["sample", "test"]}');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (!documentId.trim()) {
      setError('Please enter a document ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      let metadataObj;
      try {
        metadataObj = JSON.parse(metadata);
      } catch (err) {
        setError('Invalid JSON in metadata field');
        return;
      }

      console.log('🔄 Updating metadata for document:', documentId);
      console.log('📝 New metadata:', metadataObj);

      const startTime = Date.now();
      const res = await fetch(`http://localhost:4000/v3/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: metadataObj }),
        credentials: 'include',
      });
      const endTime = Date.now();

      console.log('📥 Response status:', res.status);
      console.log('⏱️ Request took:', endTime - startTime, 'ms');

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Update failed:', errorText);
        setError(`Update failed: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();
      console.log('✅ Update success:', data);
      setResponse(data);
    } catch (err) {
      console.error('💥 Update error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg space-y-4">
      <h3 className="text-lg font-bold">Metadata Update Test (PATCH /v3/documents/:id)</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Document ID:</label>
        <input
          type="text"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          className="block w-full text-sm border rounded p-2"
          placeholder="Enter document ID from file upload response"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Metadata (JSON object):</label>
        <textarea
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          className="block w-full text-sm border rounded p-2 font-mono"
          rows={4}
          placeholder='{"category": "test", "priority": "high", "tags": ["sample", "test"]}'
        />
      </div>

      <button
        onClick={handleUpdate}
        disabled={loading || !documentId.trim()}
        className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
      >
        {loading ? 'Updating...' : 'Update Metadata'}
      </button>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && (
        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <strong>Success:</strong>
          <pre className="mt-2 text-sm">{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Console logs will show:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>🔄 Document ID being updated</li>
          <li>📝 Metadata being sent</li>
          <li>📥 Response status and timing</li>
          <li>✅ Success response or ❌ Error details</li>
        </ul>
      </div>
    </div>
  );
}
