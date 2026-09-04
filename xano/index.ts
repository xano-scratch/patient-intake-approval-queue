import { workspace } from "@xanots/sdk";

import { users } from "./tables/users.js";
import { patients } from "./tables/patients.js";
import { triageRules } from "./tables/triage_rules.js";
import { intakes } from "./tables/intakes.js";
import { reviewQueue } from "./tables/review_queue.js";
import { reviewActions } from "./tables/review_actions.js";

import { intakeApi } from "./api/intake.js";
import { loginQuery } from "./api/auth.js";
import { submitQuery, evaluateQuery, detailQuery } from "./api/intakes.js";
import { queueQuery, claimQuery, approveQuery, denyQuery } from "./api/queue.js";
import { rulesListQuery, activateRulesQuery } from "./api/rules.js";
import { seedQuery } from "./api/seed.js";

/**
 * Patient Intake Approval Queue — a governed backend for a patient intake and
 * clinician review queue. A versioned triage rule set decides priority, every
 * write is checked against the caller's role at the API layer, and an
 * append-only audit trail records who did what. The business logic lives in one
 * readable, typed API layer, which is the point: it makes a plausibly AI-built
 * intake frontend safe to run in production.
 */
export default workspace("patient-intake-approval-queue")
  .registerTables([users, patients, triageRules, intakes, reviewQueue, reviewActions])
  .registerApiGroups([intakeApi])
  .registerQueries([
    loginQuery,
    submitQuery,
    evaluateQuery,
    detailQuery,
    queueQuery,
    claimQuery,
    approveQuery,
    denyQuery,
    rulesListQuery,
    activateRulesQuery,
    seedQuery,
  ]);
