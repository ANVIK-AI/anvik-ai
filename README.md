## setup guide
To run backend and databases through docker run:
``` bash
cd backend/ && docker compose up -d && npm run dev
```
open another terminal and run
```bash
cd frontend/ && npm run dev
```
Make sure to do npm install in both directories and also add .env files for both backend and frontend
