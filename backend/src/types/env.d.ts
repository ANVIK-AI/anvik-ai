declare namespace NodeJS {
    interface ProcessEnv {
      JWT_ACCESS_SECRET: string;
      NODE_ENV?: "development" | "test" | "production";
      PORT?: string;
    }
  }
  