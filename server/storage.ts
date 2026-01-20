import { randomUUID } from "crypto";
import { db } from "./db";
import type {
  Proposal,
  ProposalPayload,
  ProposalSummary,
  ProposalDetail,
  Decision,
  InsertDecision,
  ProposalStageType,
} from "@shared/schema";
import { ProposalStage, DecisionType } from "@shared/schema";

export interface IStorage {
  // Proposal operations
  createProposal(payload: ProposalPayload): Promise<Proposal>;
  getProposalsByStage(stage: ProposalStageType): Promise<ProposalSummary[]>;
  getProposalDetail(proposalId: string): Promise<ProposalDetail | undefined>;
  updateProposalStage(proposalId: string, stage: ProposalStageType): Promise<void>;
  
  // Decision operations
  createDecision(proposalId: string, decision: InsertDecision): Promise<Decision>;
  getDecisionsByProposalId(proposalId: string): Promise<Decision[]>;
}

export class SQLiteStorage implements IStorage {
  async createProposal(payload: ProposalPayload): Promise<Proposal> {
    const proposalId = randomUUID();
    const submittedAt = new Date().toISOString();
    const stage = ProposalStage.DOC_REVIEW;

    const stmt = db.prepare(`
      INSERT INTO proposals (proposalId, stage, submittedAt, payload)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(proposalId, stage, submittedAt, JSON.stringify(payload));

    return {
      proposalId,
      stage,
      submittedAt,
      payload,
    };
  }

  async getProposalsByStage(stage: ProposalStageType): Promise<ProposalSummary[]> {
    const stmt = db.prepare(`
      SELECT proposalId, stage, submittedAt, payload
      FROM proposals
      WHERE stage = ?
      ORDER BY submittedAt DESC
    `);

    const rows = stmt.all(stage) as Array<{
      proposalId: string;
      stage: string;
      submittedAt: string;
      payload: string;
    }>;

    return rows.map((row) => {
      const payload: ProposalPayload = JSON.parse(row.payload);
      const members = payload.members || [];
      
      // Calculate evidence counts
      let evidenceRequiredCount = members.length; // Each member needs evidence
      let evidenceCompletedCount = 0;
      
      for (const member of members) {
        if (member.evidencePhotos && member.evidencePhotos.length > 0) {
          evidenceCompletedCount++;
        }
      }

      return {
        proposalId: row.proposalId,
        groupId: payload.groupId,
        leaderName: payload.leaderName,
        membersCount: members.length,
        totalAmount: payload.totalAmount,
        submittedAt: row.submittedAt,
        stage: row.stage as ProposalStageType,
        evidenceRequiredCount,
        evidenceCompletedCount,
      };
    });
  }

  async getProposalDetail(proposalId: string): Promise<ProposalDetail | undefined> {
    const stmt = db.prepare(`
      SELECT proposalId, stage, submittedAt, payload
      FROM proposals
      WHERE proposalId = ?
    `);

    const row = stmt.get(proposalId) as {
      proposalId: string;
      stage: string;
      submittedAt: string;
      payload: string;
    } | undefined;

    if (!row) {
      return undefined;
    }

    const decisions = await this.getDecisionsByProposalId(proposalId);

    return {
      proposalId: row.proposalId,
      stage: row.stage as ProposalStageType,
      submittedAt: row.submittedAt,
      payload: JSON.parse(row.payload),
      decisions,
    };
  }

  async updateProposalStage(proposalId: string, stage: ProposalStageType): Promise<void> {
    const stmt = db.prepare(`
      UPDATE proposals
      SET stage = ?
      WHERE proposalId = ?
    `);

    stmt.run(stage, proposalId);
  }

  async createDecision(proposalId: string, decision: InsertDecision): Promise<Decision> {
    const decisionId = randomUUID();
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO decisions (decisionId, proposalId, stage, decision, reasons, comment, userId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      decisionId,
      proposalId,
      decision.stage,
      decision.decision,
      JSON.stringify(decision.reasons),
      decision.comment || null,
      decision.userId,
      createdAt
    );

    return {
      decisionId,
      proposalId,
      stage: decision.stage as ProposalStageType,
      decision: decision.decision as typeof DecisionType[keyof typeof DecisionType],
      reasons: decision.reasons,
      comment: decision.comment,
      userId: decision.userId,
      createdAt,
    };
  }

  async getDecisionsByProposalId(proposalId: string): Promise<Decision[]> {
    const stmt = db.prepare(`
      SELECT decisionId, proposalId, stage, decision, reasons, comment, userId, createdAt
      FROM decisions
      WHERE proposalId = ?
      ORDER BY createdAt ASC
    `);

    const rows = stmt.all(proposalId) as Array<{
      decisionId: string;
      proposalId: string;
      stage: string;
      decision: string;
      reasons: string;
      comment: string | null;
      userId: string;
      createdAt: string;
    }>;

    return rows.map((row) => ({
      decisionId: row.decisionId,
      proposalId: row.proposalId,
      stage: row.stage as ProposalStageType,
      decision: row.decision as typeof DecisionType[keyof typeof DecisionType],
      reasons: JSON.parse(row.reasons),
      comment: row.comment || undefined,
      userId: row.userId,
      createdAt: row.createdAt,
    }));
  }
}

export const storage = new SQLiteStorage();
