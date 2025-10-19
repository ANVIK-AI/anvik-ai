import { Pool } from "pg";


const pool = new Pool({
connectionString: process.env.EMBEDDINGS_DATABASE_URL,
max: 10
});


export default pool;