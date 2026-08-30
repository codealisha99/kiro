export interface DemoDocument {
  externalKey: string;
  title: string;
  content: string;
  classification: string;
  acl?: {
    principalType: string;
    principalId: string;
    permission?: string;
  }[];
}

const managerAcl: NonNullable<DemoDocument["acl"]> = [
  { principalType: "role", principalId: "MANAGER", permission: "read" },
  { principalType: "role", principalId: "ADMIN", permission: "read" },
];

export const DEMO_SOURCE_NAME = "Northwind handbook";

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    externalKey: "refund-policy",
    title: "Customer refund policy",
    classification: "public",
    content: `NORTHWIND TRADING — CUSTOMER REFUND POLICY
Effective: 1 March 2026
Owner: Customer Operations

Standard window
Customers may request a refund within 30 days of delivery for unused goods in original packaging. Digital products may be refunded within 14 days if less than 10% of the content has been accessed.

How to request
Email refunds@northwind.example with the order number, reason, and proof of purchase. Operations replies within two business days. Approved refunds are issued to the original payment method within 5–7 business days.

Exceptions
Custom-cut materials, perishable goods, and items marked final sale are not refundable. Shipping is refunded only when Northwind shipped the wrong item or the item arrived damaged.

Partial refunds
If only part of an order is returned, refund the line items plus proportional tax. Do not refund expedited shipping unless Northwind caused the return.

Chargebacks
If a customer opens a chargeback, pause the refund and notify Finance. Do not issue a second refund on the same order.`,
  },
  {
    externalKey: "supplier-onboarding",
    title: "Supplier onboarding guide",
    classification: "internal",
    content: `NORTHWIND TRADING — SUPPLIER ONBOARDING
Audience: Procurement and new vendors

Required documents
1. W-9 or equivalent tax form
2. Certificate of insurance (minimum $1M general liability)
3. Bank details for ACH on company letterhead
4. Signed Northwind Supplier Code of Conduct
5. Product spec sheet and lead-time calendar

Steps
Day 0 — Procurement creates a vendor record in the CRM and assigns an owner.
Day 2 — Vendor uploads documents to the shared intake folder.
Day 5 — Quality reviews spec sheets. Failures return to the vendor with a punch list.
Day 10 — Finance validates banking and tax forms.
Day 12 — Legal countersigns the MSA if the annual spend is expected over $50,000.
Day 15 — Vendor is marked Active and can receive POs.

Contacts
Procurement desk: procurement@northwind.example
Quality: qa@northwind.example
Do not share the supplier portal credentials in Slack.`,
  },
  {
    externalKey: "supplier-policy-2026",
    title: "Supplier policy 2026",
    classification: "internal",
    content: `NORTHWIND TRADING — SUPPLIER POLICY 2026
Replaces the 2024 supplier handbook.

Quality holds
Inbound lots that fail inspection are held for 10 business days, not 5 as in the 2024 policy. Vendors must collect or authorize disposal by day 10.

Payment terms
Standard terms are Net 45. Strategic vendors (annual spend over $250,000) may receive Net 30 after Finance approval.

Conflict with older memos
Any memo dated before January 2026 that promises Net 15 or a 5-day quality hold is superseded. Cite this 2026 policy.

On-time delivery
On-time is defined as delivery within the confirmed window, not the original quote. Two late deliveries in a quarter trigger a vendor review.

Returns to suppliers
Defective goods are returned at the vendor's expense. Northwind does not pay restocking fees.`,
  },
  {
    externalKey: "client-helios-brief",
    title: "Client Helios — account brief",
    classification: "internal",
    content: `CLIENT DOSSIER — HELIOS INDUSTRIAL
Account owner: Priya Raman
ARR: $420,000
Renewal: 18 November 2026
Health: Watch

What they buy
Helios buys stainless fittings and custom gaskets for food-grade lines. Their plants are in Milwaukee and Monterrey.

Open issues
In July 2026 a gasket lot (PO-8841) failed FDA swab tests at Milwaukee. We issued a credit of $18,400 and air-shipped a replacement lot. Helios asked for a written CAPA by 4 August. Quality delivered it on 2 August.

Decision log
12 August 2026 — Helios paused a $90,000 expansion SKU until we complete a second source for the gasket compound.
20 August 2026 — Priya offered a 4% concession on the renewal if the second source is qualified by October.

Stakeholders
Maya Chen, VP Ops (economic buyer)
Luis Ortega, Plant manager Milwaukee (champion)
Do not discuss the concession with anyone outside the account team.`,
  },
  {
    externalKey: "client-helios-incident",
    title: "Client Helios — quality incident log",
    classification: "internal",
    content: `INCIDENT LOG — HELIOS / PO-8841
Opened: 9 July 2026
Closed: 2 August 2026
Severity: High

Timeline
9 July — Milwaukee rejected lot G-229 after a failed swab.
10 July — QA quarantined remaining G-229 inventory (142 units).
11 July — Root cause: curing oven at vendor Apex Seals drifted 12°C overnight.
14 July — Credit memo CM-3318 issued for $18,400.
16 July — Replacement lot G-241 air-shipped.
2 August — CAPA accepted by Helios. Incident closed.

Current status
Helios is still a customer. Expansion SKU remains paused. Second-source qualification for the gasket compound is owned by QA and due 15 October 2026.

Related documents
See the Client Helios account brief for commercial context. Do not tell Helios about other customers who received lot G-229.`,
  },
  {
    externalKey: "comp-bands",
    title: "Compensation bands FY26",
    classification: "confidential",
    acl: managerAcl,
    content: `NORTHWIND TRADING — COMPENSATION BANDS FY26
Confidential — managers and administrators only.

Engineering
IC3: $128,000–$152,000
IC4: $155,000–$186,000
IC5: $188,000–$230,000
Staff: $235,000–$280,000

Sales
AE quota $1.2M. On-target earnings $160,000 (50/50).
Strategic AE OTE $210,000.

Notes
These bands are planning ranges, not offers. Offers above the 80th percentile need VP and People approval.
Do not share band numbers with candidates or individual contributors.`,
  },
  {
    externalKey: "board-cash",
    title: "Board note — cash position Q2",
    classification: "restricted",
    content: `BOARD NOTE — CASH POSITION Q2 2026
Restricted — prepared for the CEO briefing. Not for general distribution.

Cash on hand: $14.6M
Runway at current burn: 17 months
Revolver undrawn: $8M

The board asked management not to discuss runway figures outside the executive team. Revenue for 2035 is not forecast in this note — we do not have a 2035 plan.`,
  },
];
