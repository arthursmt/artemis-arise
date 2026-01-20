import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "artemis.db");
export const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    proposalId TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'DOC_REVIEW',
    submittedAt TEXT NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decisions (
    decisionId TEXT PRIMARY KEY,
    proposalId TEXT NOT NULL,
    stage TEXT NOT NULL,
    decision TEXT NOT NULL,
    reasons TEXT NOT NULL,
    comment TEXT,
    userId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (proposalId) REFERENCES proposals(proposalId)
  );

  CREATE INDEX IF NOT EXISTS idx_proposals_stage ON proposals(stage);
  CREATE INDEX IF NOT EXISTS idx_decisions_proposalId ON decisions(proposalId);
`);

console.log(`[DB] SQLite database initialized at ${dbPath}`);
