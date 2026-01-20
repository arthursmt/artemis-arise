import { z } from "zod";

// Proposal stages for workflow
export const ProposalStage = {
  DOC_REVIEW: "DOC_REVIEW",
  RISK_REVIEW: "RISK_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ProposalStageType = typeof ProposalStage[keyof typeof ProposalStage];

// Decision types
export const DecisionType = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
} as const;

export type DecisionTypeType = typeof DecisionType[keyof typeof DecisionType];

// Member schema for group loan
export const memberSchema = z.object({
  memberId: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  loanAmount: z.number(),
  evidencePhotos: z.array(z.string()).optional(),
  signature: z.string().optional(),
});

export type Member = z.infer<typeof memberSchema>;

// Full proposal payload from Hunting app
export const proposalPayloadSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  leaderName: z.string(),
  leaderPhone: z.string().optional(),
  members: z.array(memberSchema),
  totalAmount: z.number(),
  contractText: z.string().optional(),
  evidencePhotos: z.array(z.string()).optional(),
  formData: z.record(z.any()).optional(),
});

export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;

// Stored proposal
export interface Proposal {
  proposalId: string;
  stage: ProposalStageType;
  submittedAt: string;
  payload: ProposalPayload;
}

// Proposal summary for list view
export interface ProposalSummary {
  proposalId: string;
  groupId: string;
  leaderName: string;
  membersCount: number;
  totalAmount: number;
  submittedAt: string;
  stage: ProposalStageType;
  evidenceRequiredCount: number;
  evidenceCompletedCount: number;
}

// Decision record
export interface Decision {
  decisionId: string;
  proposalId: string;
  stage: ProposalStageType;
  decision: DecisionTypeType;
  reasons: string[];
  comment?: string;
  userId: string;
  createdAt: string;
}

// Decision request schema
export const insertDecisionSchema = z.object({
  stage: z.enum([ProposalStage.DOC_REVIEW, ProposalStage.RISK_REVIEW]),
  decision: z.enum([DecisionType.APPROVE, DecisionType.REJECT]),
  reasons: z.array(z.string()),
  comment: z.string().optional(),
  userId: z.string(),
});

export type InsertDecision = z.infer<typeof insertDecisionSchema>;

// Proposal detail response
export interface ProposalDetail {
  proposalId: string;
  stage: ProposalStageType;
  submittedAt: string;
  payload: ProposalPayload;
  decisions: Decision[];
}

// Legacy user types (keeping for compatibility)
export interface User {
  id: string;
  username: string;
  password: string;
}

export interface InsertUser {
  username: string;
  password: string;
}
