## setup guide

To run backend and databases through docker run:

```bash
cd backend/ && docker compose up -d && npm run dev
```

open another terminal and run

```bash
cd frontend/ && npm run dev
```

to setup prisma run these commands in backend folder

```bash
npx prisma generate

npx prisma migrate dev
```

Make sure to do npm install in both directories and also add .env files for both backend and frontend
for .env files refer .env.example in frontend and backend

To access/see database through a prisma UI run:

```bash
cd backend/ && npx prisma studio
```
