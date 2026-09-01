# Database schema and authority map

This map describes logical ownership, not every supporting collection.

| Aggregate | Authoritative collections | Derived/compatibility collections | Correction model |
| --- | --- | --- | --- |
| Academic scope | organizations, branches, academicsessions, academicsubjects, academicchapters, academictopics | legacy subject/chapter/class strings | versioned migration and reviewed alias adapters |
| Membership | batches, batchenrollments, coachingbatchsubjects, coachingenrollmentsubjects | `User.studentClass` display compatibility | effective-dated enrollment records |
| Teacher access | teacherassignments | `User.teacherDomain` (deprecated authority) | end assignment and create a new assignment |
| Routine/attendance | routineslots, classsessions, attendancesheets, attendancerecords | legacy routine participant snapshots | attendancecorrections and audit/outbox records |
| Assessment content | assessments, assessmentversions, questions, questionversions | mcqexams, mcqquestions, practicequestions | publish a new version; published content is immutable |
| Assessment results | assessmentattempts | attempt sessions and legacy MCQ/practice result projections | void/correction workflow; never rewrite a submitted canonical attempt |
| Written results | writtenexamresultpublications, writtenexamresults, writtenexamresultcorrections | legacy embedded question bytes | append-only correction event |
| Finance | financeinvoices, ledgeradjustments, cashtransactions, paymentallocations, cashreceipts, ledgerexpenses | monthlypayments/monthlyexpenses/paymentprofiles during rollback | adjustment or reversal transaction |
| Reporting | source aggregates above | reportingprojections | discard and rebuild |

Canonical foreign keys are ObjectIds and operational records carry organization/branch scope. Currency is integer Bangladeshi taka. Published academic, assessment, written-result, attendance-correction, finance, audit, and migration evidence is retained according to the approved policy; projections and idempotency/TTL records are operational data with separate lifetimes.

Step 10 does not authorize dropping a field or collection. Contract only after `check:legacy-contraction --strict` is eligible on the exact release commit and the runbook approvals are complete.
