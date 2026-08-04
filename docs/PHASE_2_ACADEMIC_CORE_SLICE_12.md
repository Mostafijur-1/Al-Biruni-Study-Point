# Phase 2 — Manual workflow validation repair

## Objective

Restore the manual-only academic database validation workflow after verifying GitHub rejected its job-level context expression.

## Confirmed incident

The public GitHub Actions API showed four completed failure records for `.github/workflows/phase2-academic-db.yml`, each associated with a repository push and containing zero jobs. The workflow metadata used the file path instead of its declared name, indicating validation failure rather than an executed database test.

GitHub's run annotation identified the exact error at line 26: `runner.temp` was referenced from job-level `env`, where the `runner` context was unavailable. Consequently, none of the dependency, test, replica-set, or upload steps ran. These failures are not Phase 2 database evidence.

## Changes completed

- Removed `MONGOMS_DOWNLOAD_DIR` from job-level environment configuration.
- Added the same runner-temporary cache path to the replica-set integration step's environment, where runner context is available.
- Preserved the matching cache action path, MongoDB version input, read-only repository permission, absence of secrets, manual dispatch trigger, and review-log upload.
- Added a regression assertion rejecting `runner` expressions in job-level `MONGOMS_DOWNLOAD_DIR` while requiring the expression on the integration step.

## Safety boundary

This repair does not dispatch the workflow, download MongoDB, connect to a database, enable academic or attendance writes, or create rollout evidence. A successful future manual run must still be reviewed and recorded through the Phase 2 evidence gate.

## Remote verification requirement

After this repair is pushed, the workflow metadata must show `Phase 2 Academic DB Validation`, and the push must not create another run for this manual-only workflow. A separate authorized operator may then dispatch it deliberately.
