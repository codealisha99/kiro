# Company brain implementation plan

## Goal

Make connected work and company documents searchable in Kiro while preserving the narrowest access model Kiro can currently prove. Keep provider content versioned, show sync coverage and freshness, and make disconnect and deletion remove it from answers.

## Delivered in this increment

1. **Search synced records.** GitHub, Linear, Slack, and Google Drive records become approved document versions, chunks, and embeddings in the existing retrieval index. Retrieval applies the regular document ACL inside semantic and keyword SQL, plus a provider-connection freshness check.
2. **Capture useful context and changes.** GitHub imports issue/PR bodies and available comments; Linear imports descriptions and comments; Slack imports thread replies. Every content change creates a new document version, retaining prior versions for review while searching only the latest approved version.
3. **Add company-document coverage.** Google Drive supports OAuth and imports Google Docs, Sheets, Slides, plain text, and text-based PDFs from the selected folder and nested folders. Existing manual document entry and upload remain available for company documents.
4. **Show coverage and freshness.** Connection rows report current searchable record counts by record type, the last complete sync, and the latest run result. The inspection view shows the latest 30 runs. Sync errors and authorization loss remain visible.
5. **Withdraw content with its source.** Reconciliation withdraws missing records. Disconnect and authentication loss hide indexed documents. Permanent connection-data deletion removes provider documents, versions, and chunks as well as provider records.

## Access model

Provider documents use `RESTRICTED` classification and the connection creator as owner. Search also requires the connection to be `READY` with a successful sync less than 24 hours old. This keeps imported material private to the person whose provider identity authorized the connection. It is intentionally narrower than the source account's access and does not claim per-member permission parity.

## Follow-up phases

1. Keep owner-only provider visibility until provider identity mapping can prove repository, channel, folder, and issue visibility for each Kiro user. Sharing imported records with project work remains an explicit separate action.
2. Extend history where providers expose it reliably: GitHub review threads, commits and releases; Linear activity events; Slack edited/deleted message and thread history. Preserve provider timestamps and deletion state.
3. Add bounded per-connection storage and retention controls. Drive nested folders and Docs, Sheets, Slides, plain text, and text-based PDF imports are implemented; PDF extraction is limited to 100 pages per file and provider snapshots to 200,000 characters.
4. Configure the Google Drive OAuth client and redirect URI in the deployment, apply Flyway migrations, then verify OAuth, a real folder sync, owner-only retrieval, freshness expiry, disconnect, and permanent deletion against an authorized test account.

## Current setup requirements and limits

- Apply Flyway migrations `V22` through `V24` before deploying the API.
- Keep `INTEGRATION_ENCRYPTION_KEY` configured and stable.
- Set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REDIRECT_URI`; enable the Drive API and register `/integrations/googledrive/callback` with Google. The OAuth grant is `drive.readonly`, while imported files are limited to the selected folder.
- Google Drive imports supported files recursively from the selected folder. It skips items the authorized user cannot download or export. PDF extraction is text-only and limited to 100 pages; indexed snapshots are capped at 200,000 characters per provider record.
- Live Google credentials are not present in this workspace. Maven is also unavailable in the current environment, so backend compilation, database migration, and live-provider acceptance remain outstanding.
