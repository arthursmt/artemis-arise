# ARTEMIS — API Contracts (Arise)

## Purpose

artemis-arise is the canonical backend for the ARTEMIS ecosystem. It is the single source of truth for proposals, proposal state, and backend validation rules.

All frontends (artemis-hunt, artemis-gate) and the integration layer (artemis-hub) must treat Arise as authoritative.

---

## Primary Endpoint

### POST /api/proposals/submit

This endpoint receives a proposal submission, normalizes the incoming request body, validates the canonical payload, persists the proposal, and returns a success response.

Design goal: tolerate upstream payload variations without weakening backend contracts.

---

## Accepted Request Formats

Arise accepts two input shapes.

### Format A — Direct payload (canonical after normalization)

    {
      "groupId": "string",
      "members": [
        {
          "memberId": "string",
          "name": "string"
        }
      ]
    }

### Format B — Envelope payload (legacy / upstream wrapper)

    {
      "proposalId": "string",
      "payload": {
        "groupId": "string",
        "members": [
          {
            "memberId": "string",
            "name": "string"
          }
        ]
      }
    }

---

## Normalization Rules (Implemented)

Normalization always happens before schema validation.

Rules:

- If body.payload exists:
  - body.payload is used as the canonical payload
- If body.payload does not exist:
  - body is treated as the canonical payload
- Envelope-level fields (e.g. proposalId) are:
  - preserved only for logging or debugging
  - not part of the validated schema

Validation and persistence always operate on the canonical payload.

---

## Validation (Implemented)

After normalization, the canonical payload is validated against the backend schema.

If validation fails:

- The request is rejected
- No data is persisted
- A client error response is returned (typically HTTP 400)

---

## Persistence (Implemented)

When validation succeeds:

- The proposal is persisted as the canonical record
- An initial proposal state is assigned
- A success response is returned (typically HTTP 201)

---

## Proposal State (Current)

### Initial State

Every newly submitted proposal starts in the following state:

    {
      "status": "submitted"
    }

Meaning:

- The proposal has been accepted and stored by Arise
- It is eligible to appear in Gate inbox workflows

---

## Proposal State Machine (Planned)

The following states are planned for future iterations and may not be implemented yet:

- under_review
- approved
- rejected
- changes_requested

Clients must never infer state transitions. State must always be read from Arise.

---

## Decisions (Forward-Looking Contract)

Future versions of Arise will record decisions as auditable events associated with a proposal.

Conceptual structure:

    {
      "decision": "approved | rejected | changes_requested",
      "reason": "string",
      "decidedBy": "user | system",
      "timestamp": "iso-8601"
    }

This structure is not necessarily implemented yet and serves as a forward contract.

---

## Error Handling

Expected error behavior:

- 400 Bad Request — invalid canonical payload
- 500 Internal Server Error — unexpected backend failure

Security rule:

- Stack traces or internal errors must never be exposed to clients

---

## Contract Guarantees

Arise guarantees:

1. Normalization happens before validation
2. Validation happens before persistence
3. Only canonical payloads are persisted
4. Upstream payload tolerance exists only at the submission boundary

---

## Scope of This Document

This document describes current backend behavior and explicitly marked forward-looking contracts.

It does not replace artemis-contracts and does not define frontend UX or workflow behavior.
