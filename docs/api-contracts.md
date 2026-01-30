# Artemis Arise — API Contracts

Arise is the source of truth. It validates and persists proposals, stages, and decisions.

## Proposal submission

### POST /api/proposals/submit

Implementation:
- server/routes.ts (handler starts around line ~104)

Purpose:
- Accept proposal submissions forwarded by the Hub.
- Validate request body using proposalPayloadSchema.
- Normalize the validated payload using normalizeProposalPayload.
- Persist the proposal using storage.createProposal.
- Return 201 with proposalId, stage, submittedAt.

Validation:
- proposalPayloadSchema.safeParse(req.body)
- On failure: returns 400 with { error: bad_request, details: flattened errors }

Normalization and persistence:
- normalizedPayload = normalizeProposalPayload(parseResult.data)
- proposal = storage.createProposal(normalizedPayload)

Success response (201):
{
  "success": true,
  "proposalId": "string",
  "stage": "string",
  "submittedAt": "string"
}

Errors:
- 400 bad_request (schema validation failed)
- 500 internal_error (unexpected server error)

Logging:
- logs contentLength, bodyKeys, membersCount, groupId on receipt
- logs validation failed on schema error
- logs proposalId and stage on success

## Hunting polling endpoints (demo/E2E support)

### GET /api/hunt/proposals?status=CHANGES_REQUESTED

- If status == CHANGES_REQUESTED: returns proposals in stage ProposalStage.CHANGES_REQUESTED
- Else: returns { status, count: 0, proposals: [] }

### GET /api/hunt/proposals/:proposalId

- Returns proposal detail if found
- Returns 404 if not found

## Proposal list and detail endpoints

- List:
  - GET /api/proposals
  - GET /proposals

- Detail:
  - GET /api/proposals/:proposalId
  - GET /proposals/:proposalId
