# Artemis Finance - ARISE Backend

## Overview
This is the ARISE Backend for Artemis Finance, serving multiple front-ends:
- **Artemis Hunting**: Field app for originating group loan proposals
- **Artemis Gate**: Backoffice for reviewing and approving proposals

## Project Structure
```
/client          # React + TypeScript frontend (Artemis Hunting)
/server          # Express + TypeScript backend (ARISE Backend)
  /db.ts         # SQLite database setup with better-sqlite3
  /storage.ts    # Storage layer with CRUD operations
  /routes.ts     # API route handlers
/shared          # Shared types and schemas
  /schema.ts     # Zod schemas and TypeScript interfaces
/data            # SQLite database file (artemis.db)
```

## API Endpoints

### Hunting App (Proposal Submission)
- `POST /api/proposals/submit` - Submit a new proposal
  - Body: ProposalPayload (groupId, groupName, leaderName, members[], totalAmount, etc.)
  - Returns: { success, proposalId, stage, submittedAt }

### Gate (Backoffice)
- `GET /api/gate/proposals?stage=<stage>` - List proposals by stage
  - Stages: DOC_REVIEW, RISK_REVIEW, APPROVED, REJECTED
  - Returns: { stage, count, proposals[] }

- `GET /api/gate/proposals/:proposalId` - Get proposal details
  - Returns: { proposalId, stage, submittedAt, payload, decisions[] }

- `POST /api/gate/proposals/:proposalId/decision` - Make a decision
  - Body: { stage, decision, reasons[], comment?, userId }
  - Decision workflow:
    - APPROVE at DOC_REVIEW → moves to RISK_REVIEW
    - APPROVE at RISK_REVIEW → moves to APPROVED
    - REJECT at any stage → moves to REJECTED

### Health Check
- `GET /api/health` - Service health check

## Database
- **SQLite** with better-sqlite3 for persistence
- Database file: `/data/artemis.db`
- WAL mode enabled for better performance
- Data survives server restarts

## Recent Changes
- 2026-01-20: Initial ARISE Backend implementation
  - SQLite persistence with better-sqlite3
  - Proposal submission and storage
  - Gate backoffice endpoints
  - Decision workflow with audit trail

## Development
```bash
npm run dev  # Start development server on port 5000
```

## User Preferences
- Backend-focused implementation
- SQLite preferred over PostgreSQL for simplicity
- No authentication for MVP (userId passed in request body)
- Explicit, simple folder structure
