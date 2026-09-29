# Gilden operations

Local operations language for maintenance, search review, research queue, social drafts, growth notes, reporting, and controls. This context is not a live agency.

## Language

**Operations document**:
One local request that names work items to record or refuse.
_Avoid_: Campaign, job, deployment

**Work item**:
One maintenance note, search review, research queue entry, social draft, growth note, report, or controls check.
_Avoid_: Ticket, task runner, post

**Maintenance**:
A local note about upkeep.
_Avoid_: Release, deploy, ship

**Search review**:
A review of search material the operator already supplied.
_Avoid_: Live search, crawl, query job

**Research queue**:
A list of research topics retained locally.
_Avoid_: Fetch, scrape, search job

**Social draft**:
Text prepared for a social channel that remains unsent.
_Avoid_: Post, tweet, sent message

**Growth note**:
A local note about growth.
_Avoid_: Campaign, pixel, funnel

**Report**:
A statement about operations that is UNKNOWN until accepted local evidence is bound to it.
_Avoid_: Dashboard, metric export, scorecard

**Controls**:
The standing register of external-action dispositions.
_Avoid_: Admin panel, remote config, merge button

**Controls register**:
The list of external actions and the disposition NOT_AUTHORIZED on each of them.
_Avoid_: Allow-list, grant table

**External action**:
An action that would leave the operator's machine: posting, sending, hosting, deploying, emitting an analytics beacon, automatic merge, live search, or publishing.
_Avoid_: Side effect, integration

**Disposition**:
The standing permission for an external action. Every external action in this context is NOT_AUTHORIZED.
_Avoid_: Approval, grant, allow

**Local record**:
A retained note, queue entry, unsent draft, report shell, or controls snapshot that stays on the machine.
_Avoid_: Post, shipment, deployment

**Evidence**:
A local summary bound to its digest, supplied by the operator from a local fixture, an operator note, or a prior local record.
_Avoid_: Live fetch, analytics hit, remote proof

**Report status**:
UNKNOWN when accepted evidence is absent. Evidence attached means local evidence is bound to the report. Evidence attached is not permission to send the report.
_Avoid_: Pass, verified, true

**UNKNOWN**:
The report status used when accepted evidence is absent.
_Avoid_: Empty success, pending pass, failed delivery

**Live agency**:
An operation that performs external actions. Gilden operations is not a live agency.
_Avoid_: Bot, automation platform, publisher

**Local runner**:
The boundary that evaluates an operations document on the machine where it is invoked.
_Avoid_: Agent, worker, hosted service
