import { DocumentFileUploadTester } from '../components/document-file-upload-tester';

export function DocumentRoutesTester() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-200">Document Routes Tester</h1>
          <p className="text-gray-400">
            Test the new backend routes:{' '}
            <code className="bg-gray-200 px-2 py-1 rounded">POST /v3/documents/file</code> and{' '}
            <code className="bg-gray-200 px-2 py-1 rounded">PATCH /v3/documents/:id</code>
          </p>
          <div className="text-sm text-gray-400">
            <p>💡 Check the browser console for detailed logging of all API calls</p>
            <p>📤 Upload a file first, then use the returned ID to update its metadata</p>
          </div>
        </div>

        <div className="grid gap-8">
          <DocumentFileUploadTester />
          {/* <DocumentMetadataUpdateTester /> */}
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">How to test:</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Upload a file using the first component</li>
            <li>Copy the returned document ID from the success response</li>
            <li>Paste the ID into the second component's "Document ID" field</li>
            <li>Modify the metadata JSON as needed</li>
            <li>Click "Update Metadata" to test the PATCH endpoint</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
