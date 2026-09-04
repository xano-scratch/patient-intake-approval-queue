import { apiGroup } from "@xanots/sdk";

/**
 * The one API group. Its canonical slug is pinned so public paths are stable
 * (`/api:intake/...`) and `getPath()` resolves in the browser bundle from the
 * source alone, without waiting on a lock.
 */
export const intakeApi = apiGroup({ name: "intake", canonical: "intake" });
