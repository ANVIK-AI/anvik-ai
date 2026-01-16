# AWS RDS PostgreSQL Deployment Guide

This guide covers migrating from Docker PostgreSQL to AWS RDS PostgreSQL.

## Architecture Overview

The application uses **two PostgreSQL databases**:

| Database       | Purpose                                                  | Special Requirements |
| -------------- | -------------------------------------------------------- | -------------------- |
| `appdb`        | Main application data (users, documents, sessions, etc.) | Prisma ORM           |
| `embeddingsdb` | Vector embeddings for AI/ML features                     | pgvector extension   |

Both databases run on a **single RDS instance** for cost efficiency.

---

## Step 1: Create RDS Instance

### Option A: AWS Console

1. Go to **RDS Console** > **Create database**
2. Choose **PostgreSQL** engine, version **15.x or higher** (required for pgvector)
3. Settings:
   - **DB instance identifier**: `anvik-ai-db`
   - **Master username**: `postgres` (or your preferred username)
   - **Master password**: Use a strong password
4. Instance configuration:
   - **db.t3.micro** for development/testing
   - **db.t3.medium** or higher for production
5. Storage:
   - Start with 20 GB, enable autoscaling
6. Connectivity:
   - Create new VPC or use existing
   - **Public access**: Yes (for initial setup, can restrict later)
   - Create new security group
7. Database options:
   - **Initial database name**: Leave empty (we'll create databases manually)
8. Click **Create database**

### Option B: AWS CLI

```bash
aws rds create-db-instance \
    --db-instance-identifier anvik-ai-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password YOUR_SECURE_PASSWORD \
    --allocated-storage 20 \
    --storage-type gp3 \
    --publicly-accessible \
    --backup-retention-period 7
```

---

## Step 2: Configure Security Group

Add inbound rules to allow PostgreSQL connections:

| Type       | Protocol | Port | Source                        |
| ---------- | -------- | ---- | ----------------------------- |
| PostgreSQL | TCP      | 5432 | Your IP / Application servers |

---

## Step 3: Initialize Databases

Once RDS is available, run the initialization script:

```bash
# Get your RDS endpoint from the AWS console
RDS_ENDPOINT="your-instance.xxxxxxxxxxxx.region.rds.amazonaws.com"

# Run the initialization script
psql -h $RDS_ENDPOINT -U postgres -d postgres -f scripts/init-rds-databases.sql
```

This script will:

1. Create `appdb` database
2. Create `embeddingsdb` database
3. Enable the `pgvector` extension
4. Create the embeddings table

---

## Step 4: Configure Environment Variables

Update your `.env` file with RDS connection strings:

```bash
# AWS RDS Configuration
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@your-instance.region.rds.amazonaws.com:5432/appdb?schema=public&sslmode=require"
EMBEDDINGS_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@your-instance.region.rds.amazonaws.com:5432/embeddingsdb?schema=public&sslmode=require"

# Production settings
NODE_ENV="production"
SESSION_SECRET="your-secure-random-session-secret"
COOKIE_DOMAIN="your-domain.com"
```

**Important**: The `sslmode=require` parameter ensures encrypted connections to RDS.

---

## Step 5: Run Database Migrations

Apply Prisma migrations to create tables in `appdb`:

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Apply migrations to production database
npx prisma migrate deploy
```

---

## Step 6: Migrate Existing Data (Optional)

If you have data in your Docker PostgreSQL that needs to be migrated:

### Export from Docker PostgreSQL

```bash
# Export main database
docker exec -t your-postgres-container pg_dump -U postgres appdb > appdb_backup.sql

# Export embeddings database
docker exec -t your-embeddings-container pg_dump -U postgres embeddingsdb > embeddingsdb_backup.sql
```

### Import to RDS

```bash
# Import main database
psql -h $RDS_ENDPOINT -U postgres -d appdb < appdb_backup.sql

# Import embeddings database
psql -h $RDS_ENDPOINT -U postgres -d embeddingsdb < embeddingsdb_backup.sql
```

---

## Step 7: Verify Connection

Test the connection from your application:

```bash
# Set environment variables
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@your-instance.region.rds.amazonaws.com:5432/appdb?schema=public&sslmode=require"
export NODE_ENV="production"

# Start the application
npm run start
```

Check the health endpoint:

```bash
curl http://localhost:4000/health
```

---

## Production Checklist

- [ ] RDS instance created with PostgreSQL 15+
- [ ] Security group configured (restrict to application servers only)
- [ ] Databases (`appdb`, `embeddingsdb`) created
- [ ] pgvector extension enabled in `embeddingsdb`
- [ ] Prisma migrations applied
- [ ] Environment variables configured with SSL
- [ ] Backups enabled (automated RDS backups)
- [ ] CloudWatch monitoring configured
- [ ] Connection pooling considered (RDS Proxy for high traffic)

---

## Troubleshooting

### Connection Refused

- Check security group allows your IP/server
- Verify RDS instance is publicly accessible (or use VPC peering)

### SSL Connection Errors

- Ensure `sslmode=require` in connection string
- Check `NODE_ENV=production` is set

### pgvector Extension Not Found

- Verify RDS PostgreSQL version is 15.2 or higher
- pgvector is pre-installed on RDS, just run `CREATE EXTENSION vector`

### ivfflat Index Errors

- ivfflat requires data to exist before creating index
- Create the index after loading initial data

---

## Cost Optimization Tips

1. **Use Reserved Instances** for predictable workloads (up to 60% savings)
2. **Right-size** your instance - start small, scale as needed
3. **Enable Storage Autoscaling** to avoid over-provisioning
4. **Use RDS Proxy** for connection pooling with Lambda/serverless
5. **Schedule stop/start** for dev/test instances during off-hours
