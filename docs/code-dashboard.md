# Code records in the local dashboard

Version 0.10.0 adds repository snapshots and engineering source notes to Reviews. Create these records through the terminal. Opening a card starts no capture, code execution, test, or model request.

## Read the record labels

A catalog row is unverified. Opening it checks current directory access and saved evidence hashes through the protected detail API.

Repository detail shows the collection interval, target, policy bounds, exclusions, incomplete coverage, paths, and hashes. It contains no copied source text or source download control. A sequence of file observations does not establish an atomic revision or working build.

Engineering detail shows operator-supplied requirements, document references, notes, and file/range hashes. Requirement provenance remains supplied and unverified. Notes remain unreviewed. Execution is not performed and defects are not assessed. An absent requirement leaves the expected result unknown. Matching a citation does not confirm a note's meaning.

Supplied text is displayed as text. HTML-like content cannot grant tools or become markup through this view. Copied source remains outside these responses. A supplied note can itself contain private data, which the explicit detail view displays under the current grant.

## Access and refresh behavior

The dashboard refreshes current workspace and code catalog metadata. An open code record also receives a fresh detail integrity check during refresh. A missing entry, changed grant, failed integrity check, or unavailable access closes and clears the code detail. A failed metadata refresh clears code rows rather than retaining old private metadata.

Idle polls are ten seconds apart; active browser reviews use a shorter interval. Requests have a five-second client timeout. Known grant expiry has its own local timer. Focus and visibility changes trigger refresh and an expiry recheck. Browser scheduling, local clock changes, and unresponsive services can affect detection time. These controls do not promise instantaneous remote revocation.

Request ownership changes when a different detail opens, the dialog closes, or navigation/access invalidates it. Old requests are aborted where possible. An old successful detail or catalog response cannot restore a newer cleared view.

Managed state retains current catalog metadata and open-record identity. Full engineering reports are not saved in browser storage or a persistent detail cache. Closing detail clears its DOM and releases managed image URLs. The controls cannot erase responses already delivered, developer-tool history, unmanaged screenshots, operating-system caches, or backups.

The service still assumes one trusted local operator. These controls do not provide hosted tenant authentication, production worker isolation, independent research approval, semantic engineering verification, or predictive stakeholder behavior.
