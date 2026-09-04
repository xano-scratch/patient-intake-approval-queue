import { table, f } from "@xanots/sdk";

/** The person an intake is about. Matched or created by MRN at submit time. */
export const patients = table({
  name: "patients",
  schema: {
    name: f.text({ required: true }),
    date_of_birth: f.date({ required: true }),
    // Medical record number. Unique so a repeat visit reuses the same patient.
    mrn: f.text({ required: true }),
    insurance_status: f.enum(
      ["insured", "self_pay", "medicaid", "unknown"],
      { required: true },
    ),
  },
  index: [{ type: "unique", fields: [{ name: "mrn" }] }],
});
