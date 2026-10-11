# 10. Ethical and legal notes (draft)

> **Draft for the team.** The Product Owner owns the ethical analysis. Align this with the principles taught in class and cite your references.

## Personal data handled

Names, student numbers, contact details, guardian contact, grades, balances and payment history, clearance status and academic requirements.

## Relevant law and principles

- **Data Privacy Act of 2012 (RA 10173), Philippines** — collect only what is needed, for a stated purpose, keep it secure, allow access to one's own data.
- **Transparency** — students should be told what is collected and why.
- **Confidentiality and least privilege** — each role sees only what it needs.
- **Integrity and accountability** — changes are traceable.

## How the system addresses them

| Concern | Measure in the system |
| --- | --- |
| Unauthorised access | Role-based access; department staff see only their own department; staff cannot see other roles' pages |
| Password safety | Hashed (scrypt); lockout; one-time temporary passwords |
| Accountability | Audit log of sensitive actions, including every time department staff view grades |
| Accuracy | Records verified by the Registrar before enrollment approval; payments validated; receipts voided with a reason, never deleted |
| Fairness | The queue is first come, first served; staff cannot reorder tickets |
| Data minimisation | Only fields needed for the services are stored |

## Gaps and risks to discuss

- Demo passwords are public — change before real use.
- HTTPS and backups depend on the hosting set-up ([`11-deployment.md`](11-deployment.md)).
- No self-service password reset yet (PL-03) and no data-retention policy.
- Real student data must not be loaded into the demo; use fictional data for the live URL.
- Consent notice and privacy statement on the login page are not yet written.
