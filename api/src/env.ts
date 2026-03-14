export interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
  FRONTEND_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_SECRET: string;
}
