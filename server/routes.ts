import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  proposalPayloadSchema,
  insertDecisionSchema,
  ProposalStage,
  DecisionType,
} from "@shared/schema";
import type { ProposalStageType } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============================================
  // Hunting App Endpoints
  // ============================================
  
  // POST /api/proposals/submit - Accept proposal submissions from Hunting
  app.post("/api/proposals/submit", async (req, res) => {
    try {
      const parseResult = proposalPayloadSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid proposal payload",
          details: parseResult.error.flatten(),
        });
      }

      const proposal = await storage.createProposal(parseResult.data);
      
      console.log(`[Proposals] Created proposal ${proposal.proposalId} for group ${parseResult.data.groupId}`);
      
      return res.status(201).json({
        success: true,
        proposalId: proposal.proposalId,
        stage: proposal.stage,
        submittedAt: proposal.submittedAt,
      });
    } catch (error) {
      console.error("[Proposals] Error creating proposal:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================
  // Gate (Backoffice) Endpoints
  // ============================================

  // GET /api/gate/proposals?stage=DOC_REVIEW|RISK_REVIEW|APPROVED|REJECTED
  app.get("/api/gate/proposals", async (req, res) => {
    try {
      const stage = req.query.stage as string;
      
      // Validate stage parameter
      const validStages = Object.values(ProposalStage);
      if (!stage || !validStages.includes(stage as ProposalStageType)) {
        return res.status(400).json({
          error: "Invalid or missing stage parameter",
          validStages,
        });
      }

      const proposals = await storage.getProposalsByStage(stage as ProposalStageType);
      
      return res.json({
        stage,
        count: proposals.length,
        proposals,
      });
    } catch (error) {
      console.error("[Gate] Error fetching proposals:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/gate/proposals/:proposalId - Get proposal details
  app.get("/api/gate/proposals/:proposalId", async (req, res) => {
    try {
      const { proposalId } = req.params;
      
      const proposal = await storage.getProposalDetail(proposalId);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      return res.json(proposal);
    } catch (error) {
      console.error("[Gate] Error fetching proposal detail:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/gate/proposals/:proposalId/decision - Make a decision
  app.post("/api/gate/proposals/:proposalId/decision", async (req, res) => {
    try {
      const { proposalId } = req.params;
      
      // Validate decision payload
      const parseResult = insertDecisionSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid decision payload",
          details: parseResult.error.flatten(),
        });
      }

      const decisionData = parseResult.data;

      // Fetch current proposal
      const proposal = await storage.getProposalDetail(proposalId);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Validate that decision stage matches current proposal stage
      if (proposal.stage !== decisionData.stage) {
        return res.status(400).json({
          error: "Decision stage does not match proposal stage",
          currentStage: proposal.stage,
          decisionStage: decisionData.stage,
        });
      }

      // Cannot make decisions on already completed proposals
      if (proposal.stage === ProposalStage.APPROVED || proposal.stage === ProposalStage.REJECTED) {
        return res.status(400).json({
          error: "Cannot make decisions on completed proposals",
          stage: proposal.stage,
        });
      }

      // Create decision record
      const decision = await storage.createDecision(proposalId, decisionData);

      // Determine new stage based on decision
      let newStage: ProposalStageType;
      
      if (decisionData.decision === DecisionType.REJECT) {
        // Reject at any stage -> REJECTED
        newStage = ProposalStage.REJECTED;
      } else if (decisionData.decision === DecisionType.APPROVE) {
        if (decisionData.stage === ProposalStage.DOC_REVIEW) {
          // Approve at DOC_REVIEW -> RISK_REVIEW
          newStage = ProposalStage.RISK_REVIEW;
        } else if (decisionData.stage === ProposalStage.RISK_REVIEW) {
          // Approve at RISK_REVIEW -> APPROVED
          newStage = ProposalStage.APPROVED;
        } else {
          return res.status(400).json({ error: "Invalid approval stage" });
        }
      } else {
        return res.status(400).json({ error: "Invalid decision type" });
      }

      // Update proposal stage
      await storage.updateProposalStage(proposalId, newStage);

      console.log(`[Gate] Decision ${decision.decisionId}: ${decisionData.decision} at ${decisionData.stage} -> ${newStage}`);

      return res.status(201).json({
        success: true,
        decisionId: decision.decisionId,
        previousStage: proposal.stage,
        newStage,
        decision: decisionData.decision,
      });
    } catch (error) {
      console.error("[Gate] Error creating decision:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "artemis-arise-backend" });
  });

  return httpServer;
}
