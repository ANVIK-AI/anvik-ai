// Comprehensive test script to verify the implementation
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Backend Implementation');
console.log('================================');

// Test 1: Check if all required files exist
console.log('\n1. Checking required files...');
const requiredFiles = [
  'src/db.ts',
  'src/queue.ts', 
  'src/gemini.ts',
  'src/worker.ts',
  'src/controller/document.controller.ts',
  'src/services/document.service.ts',
  'src/routes/document.routes.ts'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

// Test 2: Check if uploads directory exists
console.log('\n2. Checking uploads directory...');
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  console.log('✅ uploads directory exists');
} else {
  console.log('⚠️  uploads directory will be created on first upload');
}

// Test 3: Check environment variables
console.log('\n3. Checking environment variables...');
const requiredEnvVars = ['DATABASE_URL', 'GEMINI_API_KEY'];
let envVarsOk = true;

for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar} is set`);
  } else {
    console.log(`❌ ${envVar} is missing`);
    envVarsOk = false;
  }
}

if (!envVarsOk) {
  console.log('\n⚠️  Some environment variables are missing. Create a .env file with:');
  console.log('DATABASE_URL=postgres://postgres:postgres@localhost:5432/supermemory');
  console.log('GEMINI_API_KEY=your_google_api_key');
}

// Test 4: Create test files
console.log('\n4. Creating test files...');
const testFiles = [
  { name: 'test-document.txt', content: 'This is a test document for the AI assistant. It contains some sample text that should be processed and converted into memories.' },
  { name: 'test-document.md', content: '# Test Markdown\n\nThis is a **markdown** document with some *formatting*.' },
  { name: 'test-document.json', content: JSON.stringify({ title: 'Test JSON', content: 'This is a JSON document for testing.' }, null, 2) }
];

for (const testFile of testFiles) {
  const filePath = path.join(__dirname, testFile.name);
  fs.writeFileSync(filePath, testFile.content);
  console.log(`✅ Created ${testFile.name}`);
}

// Test 5: Generate test commands
console.log('\n5. Test Commands:');
console.log('================');

console.log('\n📤 Test file upload:');
for (const testFile of testFiles) {
  console.log(`curl -i -X POST \\`);
  console.log(`  -F "file=@${testFile.name}" \\`);
  console.log(`  -F 'containerTags=["sm_project_default"]' \\`);
  console.log(`  http://localhost:4000/v3/documents/file`);
  console.log('');
}

console.log('📝 Test metadata update (replace <DOCUMENT_ID> with actual ID):');
console.log(`curl -i -X PATCH \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"metadata": {"title": "Updated Title", "description": "Updated Description"}}' \\`);
console.log(`  http://localhost:4000/v3/documents/<DOCUMENT_ID>`);

console.log('\n🔍 Test document listing:');
console.log(`curl -i -X POST \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"page": 1, "limit": 10, "sort": "createdAt", "order": "desc"}' \\`);
console.log(`  http://localhost:4000/documents/documents`);

console.log('\n✅ Implementation test completed!');
console.log('\n📋 Next steps:');
console.log('1. Start the server: npm run dev');
console.log('2. Run the test commands above');
console.log('3. Check the database for created documents and memories');
console.log('4. Monitor the background processing in the server logs');
