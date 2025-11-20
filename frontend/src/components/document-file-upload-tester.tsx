import { useState } from 'react';

export function DocumentFileUploadTester() {
  const [file, setFile] = useState<File | null>(null);
  const [containerTags, setContainerTags] = useState('["test_project"]');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // formData.append('id', 1);

      if (containerTags.trim()) {
        formData.append('containerTags', containerTags);
      }

      console.log('🚀 Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);

      const startTime = Date.now();
      const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/v3/documents/file`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const endTime = Date.now();

      console.log('📥 Response status:', res.status);
      console.log('⏱️ Request took:', endTime - startTime, 'ms');

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Upload failed:', errorText);
        setError(`Upload failed: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();
      console.log('✅ Upload success:', data);
      setResponse(data);
    } catch (err) {
      console.error('💥 Upload error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg space-y-4 bg-blue-50">
      <h3 className="text-lg font-bold text-gray-900">File Upload Test (POST /v3/documents/file)</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Select File:</label>
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm border rounded p-2"
          accept=".txt,.md,.pdf,.csv,.json,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
        />
        {file && (
          <p className="text-sm text-gray-900">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Container Tags (JSON array):</label>
        <input
          type="text"
          value={containerTags}
          onChange={(e) => setContainerTags(e.target.value)}
          className="block w-full text-sm border rounded p-2 text-gray-900"
          placeholder='["test_project"]'
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="px-4 py-2 bg-blue-500 rounded disabled:bg-gray-400 text-gray-900"
      >
        {loading ? 'Uploading...' : 'Upload File'}
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

      <div className="text-xs text-gray-900 space-y-1">
        <p><strong>Console logs will show:</strong></p>
        <ul className="list-disc list-inside space-y-1 text-gray-900">
          <li>📤 Request details (file name, size, type)</li>
          <li>📥 Response status and timing</li>
          <li>✅ Success response or ❌ Error details</li>
        </ul>
      </div>
    </div>
  );
}
