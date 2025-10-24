# Backend Setup Guide

## Environment Setup

Create a `.env` file in the backend directory with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgres://postgres:postgres@localhost:5432/supermemory

# Google Gemini API Configuration
GEMINI_API_KEY=your_google_api_key_here

# Vector Configuration (768 for text-embedding-004)
VECTOR_DIM=768

# Server Configuration
PORT=4000
```

## Database Setup

1. **Install PostgreSQL** (if not already installed)
2. **Create the database**:
   ```bash
   createdb supermemory
   ```
3. **Run Prisma migrations**:
   ```bash
   npm run prisma:migrate
   ```
4. **Generate Prisma client**:
   ```bash
   npm run prisma:generate
   ```

## Google Gemini API Setup

1. **Get API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key
   - Copy the key to your `.env` file

2. **Enable required APIs**:
   - Gemini API
   - Text Embedding API

## Installation & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Test the implementation**:
   ```bash
   node test-implementation.js
   ```

## Testing the Routes

### 1. File Upload Test
```bash
curl -i -X POST \
  -F "file=@test-document.txt" \
  -F 'containerTags=["sm_project_default"]' \
  http://localhost:4000/v3/documents/file
```

### 2. Metadata Update Test
```bash
curl -i -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"title": "Updated Title"}}' \
  http://localhost:4000/v3/documents/<DOCUMENT_ID>
```

### 3. Document Listing Test
```bash
curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "limit": 10}' \
  http://localhost:4000/documents/documents
```

## Troubleshooting

### Common Issues:

1. **Database Connection Error**:
   - Check if PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Ensure database exists

2. **Gemini API Error**:
   - Verify GEMINI_API_KEY is set
   - Check API key permissions
   - Ensure billing is enabled

3. **File Upload Error**:
   - Check file size (max 10MB)
   - Verify file type is allowed
   - Ensure uploads directory exists

4. **Background Processing Not Working**:
   - Check pg-boss is running
   - Verify queue is initialized
   - Check worker registration

## Monitoring

- **Server Logs**: Check console output for errors
- **Database**: Monitor document status changes
- **Queue**: Check pg-boss job status
- **Files**: Monitor uploads directory cleanup

## Production Considerations

1. **File Storage**: Replace local storage with S3/GCS
2. **Authentication**: Implement proper session management
3. **Rate Limiting**: Configure appropriate limits
4. **Monitoring**: Add proper logging and metrics
5. **Security**: Implement proper input validation
6. **Scaling**: Consider horizontal scaling for workers
