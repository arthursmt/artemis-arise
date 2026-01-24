import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  proposalPayloadSchema,
  normalizeProposalPayload,
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
      // Enhanced logging for debugging integration issues
      const contentLength = req.headers["content-length"] || "unknown";
      const rawBody: any = req.body ?? {};
      const bodyKeys = Object.keys(rawBody);
      const membersCount =
        rawBody?.members?.length ||
        rawBody?.payload?.members?.length ||
        0;

      // Normalize input:
      // Accept both:
      // A) { groupId, members, ... }
      // B) { proposalId, payload: { groupId, members, ... } }
      const normalizedBody =
        rawBody?.payload && typeof rawBody.payload === "object"
          ? rawBody.payload
          : rawBody;

      const incomingProposalId =
        rawBody?.proposalId ?? normalizedBody?.proposalId ?? null;

      console.log("[Proposals] Incoming submit request:", {
        contentLength,
        bodyKeys,
        membersCount,
        groupId: normalizedBody?.groupId || "missing",
        wrapped: !!rawBody?.payload,
        incomingProposalId,
      });

      // Validate canonical payload
      const parseResult = proposalPayloadSchema.safeParse(normalizedBody);

      if (!parseResult.success) {
        console.log("[Proposals] Validation failed:", parseResult.error.flatten());
        return res.status(400).json({
          error: "Invalid proposal payload",
          details: parseResult.error.flatten(),
          meta: {
            wrapped: !!rawBody?.payload,
            incomingProposalId,
            normalizedKeys: Object.keys(normalizedBody ?? {}),
          },
        });
      }

      // Normalize derived fields
      const normalizedPayload = normalizeProposalPayload(parseResult.data);
      const proposal = await storage.createProposal(normalizedPayload);

      console.log(
        `[Proposals] SUCCESS - Created proposal ${proposal.proposalId} for group ${normalizedPayload.groupId}, stage=${proposal.stage}`
      );

      return res.status(201).json({
        success: true,
        proposalId: proposal.proposalId,
        stage: proposal.stage,
        submittedAt: proposal.submittedAt,
      });
    } catch (error: any) {
      console.error("[Proposals] Error creating proposal:", error?.message || error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================
  // Hunting Polling Endpoints (for E2E demo)
  // ============================================

  // GET /api/hunt/proposals?status=CHANGES_REQUESTED
  app.get("/api/hunt/proposals", async (req, res) => {
    try {
      const status = String(req.query.status || "");

      // Map status to stage for querying
      if (status === "CHANGES_REQUESTED") {
        const proposals = await storage.getProposalsByStage(ProposalStage.CHANGES_REQUESTED);
        return res.json({
          status,
          count: proposals.length,
          proposals,
        });
      }

      // Return empty for other statuses
      return res.json({ status, count: 0, proposals: [] });
    } catch (error) {
      console.error("[Hunt] Error polling proposals:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/hunt/proposals/:proposalId
  app.get("/api/hunt/proposals/:proposalId", async (req, res) => {
    try {
      const { proposalId } = req.params;

      const proposal = await storage.getProposalDetail(proposalId);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      return res.json(proposal);
    } catch (error) {
      console.error("[Hunt] Error fetching proposal detail:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================
  // Gate (Backoffice) Endpoints
  // ============================================

  // GET /api/gate/proposals?stage=DOC_REVIEW|RISK_REVIEW|APPROVED|REJECTED|CHANGES_REQUESTED
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

      // Cannot make decisions on already completed proposals
      if (proposal.stage === ProposalStage.APPROVED || proposal.stage === ProposalStage.REJECTED) {
        return res.status(400).json({
          error: "Cannot make decisions on completed proposals",
          stage: proposal.stage,
        });
      }

      // Validate that decision stage matches current proposal stage
      if (proposal.stage !== decisionData.stage) {
        return res.status(400).json({
          error: "Decision stage does not match proposal stage",
          currentStage: proposal.stage,
          decisionStage: decisionData.stage,
        });
      }

      // Create decision record
      const decision = await storage.createDecision(proposalId, decisionData);

      // Determine new stage based on decision
      let newStage: ProposalStageType;

      if (decisionData.decision === DecisionType.REJECT) {
        // Reject at any stage -> REJECTED
        newStage = ProposalStage.REJECTED;
      } else if (decisionData.decision === DecisionType.REQUEST_CHANGES) {
        // Request changes -> CHANGES_REQUESTED
        newStage = ProposalStage.CHANGES_REQUESTED;
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

      console.log(
        `[Gate] Decision ${decision.decisionId}: ${decisionData.decision} at ${decisionData.stage} -> ${newStage}`
      );

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