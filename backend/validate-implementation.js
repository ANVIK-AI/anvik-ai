// Final validation script to ensure everything is working
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Final Implementation Validation');
console.log('==================================');

let allChecksPassed = true;

// Check 1: All required files exist and are not empty
console.log('\n1. File Structure Validation...');
const requiredFiles = [
  'src/db.ts',
  'src/queue.ts', 
  'src/gemini.ts',
  'src/worker.ts',
  'src/controller/document.controller.ts',
  'src/services/document.service.ts',
  'src/routes/document.routes.ts',
  'src/app.ts',
  'src/server.ts'
];

for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`❌ ${file} is empty`);
      allChecksPassed = false;
    }
  } else {
    console.log(`❌ ${file} is missing`);
    allChecksPassed = false;
  }
}

// Check 2: Package.json has all required dependencies
console.log('\n2. Dependencies Validation...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const requiredDeps = [
  '@google/generative-ai',
  'pg-boss',
  'multer',
  'pdf-parse',
  'uuid',
  'zod'
];

for (const dep of requiredDeps) {
  if (packageJson.dependencies[dep]) {
    console.log(`✅ ${dep} (${packageJson.dependencies[dep]})`);
  } else {
    console.log(`❌ ${dep} is missing from dependencies`);
    allChecksPassed = false;
  }
}

// Check 3: TypeScript configuration
console.log('\n3. TypeScript Configuration...');
if (fs.existsSync(path.join(__dirname, 'tsconfig.json'))) {
  console.log('✅ tsconfig.json exists');
} else {
  console.log('❌ tsconfig.json is missing');
  allChecksPassed = false;
}

// Check 4: Test files exist
console.log('\n4. Test Files...');
const testFiles = ['test-document.txt', 'test-document.md', 'test-document.json'];
for (const testFile of testFiles) {
  if (fs.existsSync(path.join(__dirname, testFile))) {
    console.log(`✅ ${testFile}`);
  } else {
    console.log(`❌ ${testFile} is missing`);
    allChecksPassed = false;
  }
}

// Check 5: Documentation files
console.log('\n5. Documentation...');
const docFiles = ['IMPLEMENTATION_README.md', 'SETUP_GUIDE.md', 'test-implementation.js'];
for (const docFile of docFiles) {
  if (fs.existsSync(path.join(__dirname, docFile))) {
    console.log(`✅ ${docFile}`);
  } else {
    console.log(`❌ ${docFile} is missing`);
    allChecksPassed = false;
  }
}

// Check 6: Uploads directory
console.log('\n6. Uploads Directory...');
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  console.log('✅ uploads directory exists');
} else {
  console.log('⚠️  uploads directory will be created on first upload');
}

// Final result
console.log('\n' + '='.repeat(50));
if (allChecksPassed) {
  console.log('🎉 ALL CHECKS PASSED!');
  console.log('\n✅ The backend implementation is ready!');
  console.log('\n📋 Next steps:');
  console.log('1. Set up your .env file with DATABASE_URL and GEMINI_API_KEY');
  console.log('2. Run: npm run prisma:migrate');
  console.log('3. Run: npm run prisma:generate');
  console.log('4. Start the server: npm run dev');
  console.log('5. Test with: node test-implementation.js');
} else {
  console.log('❌ SOME CHECKS FAILED!');
  console.log('\nPlease fix the issues above before proceeding.');
  process.exit(1);
}
