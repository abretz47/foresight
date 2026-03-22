Problem Statement
Users want a faster way to review how each club performs, and a lightweight way to group shots into “practice sessions” without needing to navigate to an extra screen or make complex setup decisions. They also want a visual summary of shot dispersion per club that reflects the “typical” 80% of in-play outcomes, so they can quickly identify consistency patterns.

Solution
Add practice sessions as a lightweight tagging context:

Users can start/continue a practice session from the Home experience (and from the club’s Shot Details screen).
The session is implemented as an activeSessionId that tags subsequent recorded shots (for all clubs) until the session is stopped (stop control can be added later via the hamburger menu).
Upgrade Home into a club-driven overview:

Replace the current Home action buttons with a hamburger menu.
Show a grid/collection of cards—one per club—each displaying an image/preview of the club’s “shot dispersion” polygon.
The polygon represents the 80% of in-play outcomes (where in-play is offTarget === false).
Add a new Shot Details page per club:

Home club card tap opens “Shot Details”.
Shot Details includes:
Custom date-range filtering (start/end).
The dispersion polygon computed from the filtered range.
A “Start/Continue practice session” button that continues tagging (tagging scope confirmed: tag all subsequently recorded shots for all clubs, regardless of which club is currently selected).
User Stories
As a golfer, I want to start a practice session from the Home screen without navigating to a separate sessions page.
As a golfer, I want Home to show a card for each club with a visual “shot dispersion” polygon so I can quickly compare consistency.
As a golfer, when I tap a club card, I want to see a Shot Details screen with a date range filter to review dispersion over specific sessions/days.
As a golfer, I want the “Start/Continue practice session” action to tag shots I record afterward so future analytics can filter/group by session.
As a golfer, I want the dispersion polygon to reflect the most representative 80% of my in-play shots rather than being dominated by extreme outliers.
As a golfer, I want recording and analysis to remain familiar and not require extra configuration screens.
Implementation Decisions
Data model changes

Extend recorded shot datapoints to optionally include sessionId?: string.
Practice sessions persist locally (AsyncStorage) with an activeSessionId pointer per user.
Session tagging scope: when a session is started/continued from any screen, tag all subsequently recorded shots across all clubs until stopped.
Dispersion polygon definition (confirmed)

Use in-play only: include points where offTarget === false.
Use the closest 80% of points to center:
Compute distance to center using normalized coordinates (relX, relY).
Select the smallest set of points whose count reaches ceil(0.8 * n) (after sorting by distance to center).
Compute a convex hull of those selected points.
Render hull vertices as a polygon preview.
Rendering approach

Add a polygon renderer (SVG-based) to draw/fill/outline the computed convex hull for:
Home card previews (all-time shots for that club).
Shot Details (date-filtered shots for that club).
Performance guardrails:
Render cards using list virtualization (e.g., FlatList) so off-screen cards don’t compute immediately.
Cache polygon vertices per (user, clubId, dateRangeKey) to avoid recomputation when navigating back and forth.
UI navigation / layout

Home action buttons replaced with a hamburger menu.
Home main content becomes club cards with polygon previews.
Club card tap navigates to Shot Details (which also contains the practice-session start/continue control).
Date filtering

Shot Details uses custom date range input (native picker or equivalent) to filter datapoints by DataPoint.timestamp.
If timestamps are missing on legacy shots, treat them as excluded from date-range filtering (or define a consistent fallback policy—recommended: exclude by default).
Testing Decisions
Unit tests (pure math)

Convex hull computation returns expected vertices for:
Simple triangles/quads
Collinear points edge cases
Duplicate points
“Closest 80%” selection logic:
Correct point count for various N values
Deterministic hull output given deterministic input ordering
Unit tests (data normalization)

Ensure relX/relY usage matches current Record/Analyze behavior:
Prefer existing relX/relY
Fallback behavior for legacy datapoints (matching how Record currently computes rel coords)
Integration tests (storage)

When starting/continuing a session, subsequent saveDataPoint(...) calls persist the sessionId.
When a session is stopped (if implemented), subsequent shots no longer have sessionId.
UI/integration manual tests (high confidence)

Home club cards render correctly with dispersion polygons and do not freeze UI.
Tapping a club opens Shot Details and date filtering updates the polygon.
Record/Analyze flows remain functional and do not regress shot logging.
Out of Scope
Backend-generated images or server-side polygon rendering (keep everything client-side for the MVP).
Complex module/session scheduling workflows (future structured modules can build on top of tagging).
Concave/alpha-shape polygons (MVP uses convex hull for reliability and performance).
Further Notes
Legacy shots without sessionId:
For session-scoped filtering (future), decide whether they are treated as “no session” (recommended).
“In-play” definition is locked to existing app logic (offTarget === false) for consistency.
If polygon previews are visually too dense with many hull points, consider vertex downsampling as a later iteration (not required for correctness).
