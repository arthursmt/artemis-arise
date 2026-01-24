import { z } from "zod";

// Proposal stages for workflow
export const ProposalStage = {
  DOC_REVIEW: "DOC_REVIEW",
  RISK_REVIEW: "RISK_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;

export type ProposalStageType = typeof ProposalStage[keyof typeof ProposalStage];

// Decision types
export const DecisionType = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REQUEST_CHANGES: "REQUEST_CHANGES",
} as const;

export type DecisionTypeType = typeof DecisionType[keyof typeof DecisionType];

// Flexible member schema - accepts both formats from Hunting app
export const memberSchema = z.object({
  memberId: z.string().optional(),
  // Support both name formats
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  // Support both amount formats
  loanAmount: z.number().optional(),
  requestedAmount: z.number().optional(),
  // Optional fields
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  evidencePhotos: z.array(z.string()).optional(),
  signature: z.string().optional(),
  isLeader: z.boolean().optional(),
}).refine(
  (data) => data.name || (data.firstName && data.lastName),
  { message: "Either 'name' or both 'firstName' and 'lastName' are required" }
).refine(
  (data) => data.loanAmount !== undefined || data.requestedAmount !== undefined,
  { message: "Either 'loanAmount' or 'requestedAmount' is required" }
);

export type Member = z.infer<typeof memberSchema>;

// Helper to normalize member data
export function normalizeMember(member: Member, index: number): NormalizedMember {
  const name = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim();
  const loanAmount = member.loanAmount ?? member.requestedAmount ?? 0;
  return {
    memberId: member.memberId || `M${index + 1}`,
    name,
    firstName: member.firstName,
    lastName: member.lastName,
    loanAmount,
    requestedAmount: member.requestedAmount,
    phone: member.phone,
    idNumber: member.idNumber,
    evidencePhotos: member.evidencePhotos,
    signature: member.signature,
    isLeader: member.isLeader,
  };
}

export interface NormalizedMember {
  memberId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  loanAmount: number;
  requestedAmount?: number;
  phone?: string;
  idNumber?: string;
  evidencePhotos?: string[];
  signature?: string;
  isLeader?: boolean;
}

// Flexible proposal payload from Hunting app
export const proposalPayloadSchema = z.object({
  groupId: z.string(),
  groupName: z.string().optional(),
  leaderName: z.string().optional(),
  leaderPhone: z.string().optional(),
  members: z.array(memberSchema).min(1, "At least one member is required"),
  totalAmount: z.number().optional(),
  contractText: z.string().optional(),
  evidencePhotos: z.array(z.string()).optional(),
  formData: z.record(z.any()).optional(),
});

export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;

// Normalized payload for storage
export interface NormalizedProposalPayload {
  groupId: string;
  groupName: string;
  leaderName: string;
  leaderPhone?: string;
  members: NormalizedMember[];
  totalAmount: number;
  contractText?: string;
  evidencePhotos?: string[];
  formData?: Record<string, unknown>;
}

// Helper to normalize proposal payload
export function normalizeProposalPayload(payload: ProposalPayload): NormalizedProposalPayload {
  const members = payload.members.map((m, i) => normalizeMember(m as Member, i));
  const leader = members.find(m => m.isLeader) || members[0];
  const totalAmount = payload.totalAmount ?? members.reduce((sum, m) => sum + m.loanAmount, 0);
  
  return {
    groupId: payload.groupId,
    groupName: payload.groupName || `Group ${payload.groupId}`,
    leaderName: payload.leaderName || leader?.name || 'Unknown',
    leaderPhone: payload.leaderPhone,
    members,
    totalAmount,
    contractText: payload.contractText,
    evidencePhotos: payload.evidencePhotos,
    formData: payload.formData,
  };
}

// Stored proposal
export interface Proposal {
  proposalId: string;
  stage: ProposalStageType;
  submittedAt: string;
  payload: NormalizedProposalPayload;
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
  decision: z.enum([DecisionType.APPROVE, DecisionType.REJECT, DecisionType.REQUEST_CHANGES]),
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
  payload: NormalizedProposalPayload;
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
