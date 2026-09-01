Implement a new flagship feature called:

🔥 DISASTER TIME MACHINE

in my existing Disaster Intelligence Network prototype.

IMPORTANT:
- Do NOT create a new application.
- Inspect the existing project first.
- Integrate with the current incident, Leaflet, routing, citizen report, volunteer verification, SMS, voice, and AI systems.
- DO NOT add a database.
- Use localStorage for prototype persistence.
- DO NOT train another ML model.
- DO NOT add AI image enhancement.
- Reuse the existing AI classification and incident data.
- Do NOT break any existing functionality.

==================================================
1. CORE IDEA
==================================================

The Disaster Time Machine should allow the user to see:

CURRENT
+15 MINUTES
+30 MINUTES
+60 MINUTES

of disaster risk on the map.

The feature should answer:

"Where is the disaster now?"

and more importantly:

"Where is the danger likely to expand next?"

and:

"Will my current evacuation route become unsafe?"

This is a PROTOTYPE prediction/forecasting system.

Do NOT claim that the system can scientifically predict the future.
Clearly label predictions as:

AI-ASSISTED RISK FORECAST

==================================================
2. NEW PAGE
==================================================

Create:

/forecast

Page title:

DISASTER TIME MACHINE

Subtitle:

"Explore how disaster risk could evolve over the next hour."

The page should contain:

------------------------------------------

🔮 DISASTER TIME MACHINE

LIVE DISASTER FORECAST

[ NOW ] [ +15 MIN ] [ +30 MIN ] [ +60 MIN ]

------------------------------------------

LEAFLET MAP

------------------------------------------

RISK FORECAST

Current Risk:
HIGH

Risk Trend:
↑ INCREASING

Forecast Confidence:
78%

------------------------------------------

==================================================
3. TIME CONTROLS
==================================================

Create four selectable time states:

NOW
+15 MIN
+30 MIN
+60 MIN

When the user clicks:

NOW

show current incidents.

When the user clicks:

+15 MIN

show predicted risk expansion.

When the user clicks:

+30 MIN

show the next predicted risk state.

When the user clicks:

+60 MIN

show the longer-term predicted risk.

The Leaflet map must update dynamically.

Do NOT reload the page.

==================================================
4. CURRENT INCIDENT DATA
==================================================

Use existing incidents from localStorage.

Each incident may contain:

id
latitude
longitude
disasterType
severity
confidence
blurScore
isBlurry
verificationRequired
status
source
timestamp

Do NOT create a separate incident system.

The Time Machine must consume the existing incident pipeline.

==================================================
5. RISK FORECAST ENGINE
==================================================

Create a lightweight client-side forecasting engine.

Do NOT use another ML model.

The engine should calculate a risk score using existing information.

Conceptually:

riskScore =
    severityWeight
    × confidence
    × verificationWeight
    × corroborationWeight
    × timeExpansionFactor

The implementation can use a normalized 0–100 score.

Create centralized configuration values.

Example:

severity weights:

LOW = 0.25
MEDIUM = 0.50
HIGH = 0.75
SEVERE = 1.00

Verification:

VERIFIED = 1.00
IN_PROGRESS = 0.80
FIELD_VERIFICATION_REQUIRED = 0.65
UNVERIFIED = 0.50
FALSE_REPORT = 0

Do not scatter these values throughout the code.

==================================================
6. TEMPORAL EXPANSION
==================================================

For prototype purposes, model the potential spread of risk over time.

Example:

NOW:
100m risk radius

+15 MIN:
250m

+30 MIN:
400m

+60 MIN:
650m

Do NOT use the exact same radius for every disaster.

Create configurable disaster-specific expansion factors.

Example:

FLOOD:
higher spatial expansion

FIRE:
moderate/high expansion

LANDSLIDE:
localized expansion

EARTHQUAKE:
initial impact zone remains relatively localized

Use the disaster type to influence the forecast.

IMPORTANT:

Clearly label this as:

SIMULATED RISK FORECAST

unless actual forecasting data is available.

==================================================
7. FORECAST ZONES ON LEAFLET
==================================================

Use Leaflet circles/polygons to visualize forecast zones.

NOW:

🔴 Current incident

+15 MIN:

🟠 Predicted risk zone

+30 MIN:

🟠 Larger predicted risk zone

+60 MIN:

🔴 Potential future risk zone

Use translucent areas so users can see the expansion.

Do not hide the actual incident marker.

The map should visually distinguish:

ACTUAL INCIDENT

from:

PREDICTED RISK

==================================================
8. MAP LEGEND
==================================================

Add:

MAP LEGEND

🔴 Actual Incident
🟠 Current/High Risk
🟡 Predicted Risk
🟢 Safe Area

Also show:

━━ Actual Incident

--- Predicted Risk

Make it obvious to judges that prediction is different from confirmed information.

==================================================
9. RISK TREND
==================================================

Calculate whether risk is:

↑ INCREASING

→ STABLE

↓ DECREASING

Use existing incident timestamps and nearby report counts.

Example:

1 report:
STABLE

3 reports within 10 minutes:
INCREASING

5 reports within 10 minutes:
STRONGLY INCREASING

If reports stop arriving:
STABLE/DECREASING depending on the existing data.

==================================================
10. CORROBORATION
==================================================

Use the existing PHOTO + SMS + VOICE incident fusion.

Example:

PHOTO:
FLOOD

SMS:
FLOOD

VOICE:
WATER RISING

Same area.

The Time Machine should show:

CORROBORATED REPORT

3 SOURCES

✓ PHOTO
✓ SMS
✓ VOICE

Increase the risk confidence when independent reports corroborate the same event.

Do NOT blindly increase confidence for duplicate reports.

==================================================
11. FORECAST CARD
==================================================

Create a right-side or bottom information panel:

🔮 RISK FORECAST

Disaster:
FLOOD

Current Risk:
HIGH

Risk Trend:
↑ INCREASING

Reports:
7

Sources:
PHOTO / SMS / VOICE

Verification:
2 VOLUNTEERS

Current Confidence:
91%

--------------------------------

FORECAST

NOW
🔴 HIGH

+15 MIN
🟠 HIGH

+30 MIN
🔴 VERY HIGH

+60 MIN
🔴 CRITICAL

--------------------------------

Forecast:

"Risk is projected to expand toward the eastern corridor."

==================================================
12. ROUTE INTERSECTION
==================================================

This is the MOST IMPORTANT part.

Connect Disaster Time Machine to the existing Safe Evacuation Routing system.

If the user's current evacuation route intersects a predicted future risk zone:

Show:

⚠️ ROUTE WARNING

"Your current evacuation route is projected to enter a high-risk zone in approximately 18 minutes."

Then:

CURRENT ROUTE
4.2 km

Risk:
HIGH

↓

SAFER ALTERNATIVE

5.1 km

Risk:
LOW

[ USE SAFER ROUTE ]

==================================================
13. PREDICTIVE REROUTING
==================================================

Do NOT wait until the road is already blocked.

If the current route intersects:

+15 MIN
+30 MIN
+60 MIN

predicted risk zones:

calculate an alternative route.

Priority:

SAFETY > DISTANCE

Example:

Route A:

3.5 km
Risk:
HIGH

Route B:

4.1 km
Risk:
LOW

Select:

Route B

Show:

✓ SAFER ROUTE SELECTED

Reason:

"Route avoids projected flood expansion."

==================================================
14. TIME MACHINE + LIVE INCIDENTS
==================================================

When a new citizen report arrives:

1. Add incident to localStorage.
2. Update Leaflet.
3. Recalculate current risk.
4. Recalculate forecast zones.
5. Recalculate risk trend.
6. Check current evacuation route.
7. If route becomes risky:
   trigger dynamic rerouting.
8. Update the Time Machine UI.

No page refresh.

==================================================
15. VOLUNTEER VERIFICATION EFFECT
==================================================

Volunteer verification must affect the forecast.

Example:

Initial:

FLOOD
UNVERIFIED

Risk:
MEDIUM

Volunteer confirms:

FLOOD
VERIFIED

Risk:
HIGH

Forecast expands accordingly.

If volunteer marks:

FALSE REPORT

Remove its contribution to the forecast.

This demonstrates:

Citizen reports
      ↓
AI assessment
      ↓
Volunteer verification
      ↓
Risk confidence changes
      ↓
Forecast changes
      ↓
Routing changes

==================================================
16. "WHY IS THE RISK INCREASING?"
==================================================

Add an explainability panel.

Example:

WHY IS RISK INCREASING?

✓ 5 citizen reports
✓ 3 reports within 800m
✓ 2 independent sources
✓ Volunteer confirmation received
✓ Reports increasing over the last 10 minutes

Therefore:

RISK TREND:
↑ INCREASING

This should be based on actual incident data.

Do NOT generate random explanations.

==================================================
17. "WHAT HAPPENS NEXT?"
==================================================

Add a prominent panel:

🔮 WHAT HAPPENS NEXT?

Example:

Current:
FLOOD detected

+15 MIN:
Risk expanding toward Road A

+30 MIN:
Road A projected high risk

+60 MIN:
Eastern corridor projected high risk

Recommended:

EVACUATE USING NORTHERN ROUTE

Nearest safer shelter:

Government Model School

==================================================
18. DEMO SIMULATION MODE
==================================================

Because this is a prototype, add:

[ START DISASTER SIMULATION ]

This should allow the team to demonstrate the Time Machine without waiting for real disaster reports.

When clicked:

SIMULATION STARTED

Then progressively create simulated reports:

T+0:
1 flood report

T+5:
2 additional nearby reports

T+10:
SMS corroboration

T+15:
Volunteer verification

The map and forecast should update.

Clearly label:

⚠ DEMO SIMULATION

Do not mix simulated reports with real reports without a clear label.

==================================================
19. JUDGE MODE
==================================================

Add a polished presentation mode.

Button:

[ ENTER TIME MACHINE ]

Show a large map.

Then allow:

NOW
↓
+15 MIN
↓
+30 MIN
↓
+60 MIN

As the judge clicks through the timeline, the risk zone visibly expands.

At the same time, show:

ROUTE STATUS

✓ SAFE

then:

⚠ AT RISK

then:

🔄 REROUTING

then:

✓ SAFER ROUTE FOUND

This should be visually impressive but technically simple.

==================================================
20. IMPORTANT SAFETY LABEL
==================================================

Because this is a prototype prediction system, show:

"Forecasts are AI-assisted risk projections based on current reports and should not replace official emergency guidance."

Do not claim guaranteed prediction.

==================================================
21. NO DATABASE
==================================================

Do not add:

PostgreSQL
MongoDB
Firebase
Supabase
SQLite
Prisma

Use:

localStorage

for prototype state.

==================================================
22. DO NOT CREATE FAKE ML
==================================================

Do NOT say:

"AI predicts exactly where the flood will go."

Instead say:

"AI-assisted risk projection based on spatial, temporal, severity, confidence, and corroboration signals."

==================================================
23. FINAL ARCHITECTURE
==================================================

              CITIZEN REPORT
                    ↓
              AI CLASSIFICATION
                    ↓
              INCIDENT CREATED
                    ↓
            ┌───────┴────────┐
            ↓                ↓
       LIVE MAP          VOLUNTEERS
            ↓                ↓
            └───────┬────────┘
                    ↓
             INCIDENT FUSION
                    ↓
             RISK FORECAST
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
       NOW        +15 MIN     +30/+60
        ↓           ↓           ↓
        └───────────┼───────────┘
                    ↓
             FUTURE RISK ZONE
                    ↓
          CURRENT ROUTE ANALYSIS
                    ↓
             ROUTE AT RISK?
                /       \
              NO         YES
              ↓           ↓
            SAFE      REROUTE
                          ↓
                    SAFER ROUTE
                          ↓
                      SHELTER

==================================================
24. FINAL DEMO SCENARIO
==================================================

Make this exact scenario work:

1. Citizen uploads a flood image.

2. GPS is automatically captured.

3. MEDIC identifies:

   FLOOD

4. Incident is created.

5. Leaflet shows:

   🔴 FLOOD

6. Volunteer SMS alerts are sent.

7. A second report appears nearby.

8. Incident fusion detects:

   2 SOURCES

9. Volunteer verifies the flood.

10. Risk increases.

11. Open:

   DISASTER TIME MACHINE

12. Click:

   NOW

   Show current flood zone.

13. Click:

   +15 MIN

   Show expanded predicted risk.

14. Click:

   +30 MIN

   Show larger predicted zone.

15. Click:

   +60 MIN

   Show future risk corridor.

16. Current evacuation route intersects the predicted zone.

17. Display:

   ⚠️ ROUTE PREDICTED UNSAFE

18. Calculate an alternative.

19. Display:

   ✓ SAFER ROUTE FOUND

20. Show the safer route on Leaflet.

21. Show:

   "Avoiding projected flood expansion."

==================================================
FINAL REQUIREMENT
==================================================

The feature must feel like a "time machine":

NOW
→
FUTURE RISK
→
FUTURE ROUTE
→
PROACTIVE EVACUATION

The judge should immediately understand:

"Our system doesn't just tell people where the disaster is.

It uses the incoming disaster reports to estimate how risk could evolve, checks whether the evacuation route will become dangerous, and proactively reroutes people toward a safer shelter."

Keep the implementation lightweight, reliable, visually impressive, and fully integrated with the existing Disaster Intelligence Network.