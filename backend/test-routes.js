// Simple test script to verify the routes work
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a test file
const testContent = 'This is a test document for the AI assistant. It contains some sample text that should be processed and converted into memories.';
const testFilePath = path.join(__dirname, 'test-document.txt');
fs.writeFileSync(testFilePath, testContent);

console.log('Test file created:', testFilePath);
console.log('You can now test the upload route with:');
console.log('');
console.log('curl -i -X POST \\');
console.log('  -F "file=@' + testFilePath + '" \\');
console.log('  -F \'containerTags=["sm_project_default"]\' \\');
console.log('  http://localhost:4000/v3/documents/file');
console.log('');
console.log('And test the metadata update with:');
console.log('curl -i -X PATCH \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"metadata": {"title": "Test Document", "description": "A test document"}}\' \\');
console.log('  http://localhost:4000/v3/documents/<DOCUMENT_ID>');
