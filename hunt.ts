import { Router } from "express";

// Ajuste o path conforme seu projeto:
import { db } from "../db/sqlite";

export const huntRouter = Router();

/**
 * GET /api/hunt/proposals?status=CHANGES_REQUESTED
 * Retorna lista leve para polling do Hunt.
 */
huntRouter.get("/proposals", (req, res) => {
  const status = String(req.query.status || "");

  if (status !== "CHANGES_REQUESTED") {
    return res.json([]); // polling só pra esse caso no MVP
  }

  const rows = db.prepare(`
    SELECT
      proposal_id as proposalId,
      group_id as groupId,
      leader_name as leaderName,
      members_count as membersCount,
      total_amount as totalAmount,
      submitted_at as submittedAt,
      stage as status
    FROM proposals
    WHERE stage = ?
    ORDER BY datetime(submitted_at) DESC
    LIMIT 50
  `).all(status);

  res.json(rows);
});

/**
 * GET /api/hunt/proposals/:proposalId
 * Retorna detalhes da proposta para o Hunt revisar/corrigir.
 */
huntRouter.get("/proposals/:proposalId", (req, res) => {
  const { proposalId } = req.params;

  const row = db.prepare(`
    SELECT
      proposal_id as proposalId,
      stage as status,
      submitted_at as submittedAt,
      payload_json as payloadJson
    FROM proposals
    WHERE proposal_id = ?
  `).get(proposalId);

  if (!row) return res.status(404).json({ error: "Proposal not found." });

  res.json({
    proposalId: row.proposalId,
    status: row.status,
    submittedAt: row.submittedAt,
    payload: JSON.parse(row.payloadJson)
  });
});
