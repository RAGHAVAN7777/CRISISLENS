AI-Powered Multi-Channel Disaster Intelligence & Dynamic Routing

1. Project Overview

Problem Statement

During disasters, communication infrastructure and user capabilities vary significantly. Some citizens have smartphones and internet access, while others may only have access to a phone call or SMS. At the same time, disaster conditions change continuously, meaning a road that is safe at one moment may become flooded, blocked, or dangerous minutes later.

AI-Powered Multi-Channel Disaster Intelligence & Dynamic Routing provides a unified platform where citizens can report disasters through photographs, voice calls, or SMS. Artificial intelligence converts all three sources into structured disaster reports, combines reports from nearby citizens, verifies incidents, and continuously updates a live disaster map.

The system can then dynamically reroute citizens around newly detected hazards and guide them toward safer shelters.

Core Architecture

                         CITIZENS
                            │
             ┌──────────────┼──────────────┐
             │              │              │
            📷             📞             💬
          PHOTO           VOICE           SMS
             │              │              │
             ▼              ▼              ▼
          VISION           ASR            NLP
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                     🧠 AI REASONING
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             HAZARD      SEVERITY     EVIDENCE
                │           │           │
                └───────────┼───────────┘
                            ▼
                     📍 GEOLOCATION
                            │
                            ▼
                    🔗 INCIDENT FUSION
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
           CORROBORATION          VERIFICATION
                 │                     │
                 └──────────┬──────────┘
                            ▼
                    LIVE INCIDENT MAP
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          👨‍🚒 RESPONDERS          👤 CITIZENS
                 │                     │
                 ▼                     ▼
          VERIFY QUEUE           SAFE ROUTING
                                       │
                                       ▼
                                🛣️ DYNAMIC ROUTE
                                       │
                                       ▼
                                  🏫 SAFE SHELTER

⸻

2. Multi-Channel Disaster Reporting

2.1 Photo Reporting

Citizens with smartphones can submit a photograph through the web application.

The system captures:

* Photograph
* GPS coordinates
* Timestamp
* Optional description

The image is processed by a computer-vision model.

AI Output

Hazard: FLOOD
Severity: HIGH
Confidence: 94%
Evidence:
✓ Standing water
✓ Submerged road
✓ Vehicles surrounded by water

The system also generates an explainability heatmap using techniques such as Grad-CAM.

⸻

2.2 Voice Call Reporting

Citizens without internet access can call a dedicated emergency reporting number.

The call is handled using an IVR system.

Call Flow

Citizen calls dedicated number
            ↓
          IVR
            ↓
"What type of hazard?"
            ↓
"What is your location?"
            ↓
"Are people affected?"
            ↓
     Speech-to-Text
            ↓
       AI Reasoning
            ↓
    Structured Report

The system can use Twilio for telephony and call handling.

Example:

Citizen: “There is heavy flooding near Gandhi Road and cars are stuck.”

The speech is converted into text and passed to the same AI reasoning pipeline used by photo reports.

The resulting report becomes:

Hazard: Flood
Location: Gandhi Road
Severity: Critical
Source: Voice

⸻

2.3 SMS Reporting

Citizens without mobile data can send a simple SMS.

Examples:

FLOOD Gandhi Road

or:

FIRE near Central Station

or:

HELP people trapped near Market Road

Twilio receives the SMS and forwards it to the backend.

The NLP system extracts:

Hazard
Location
Severity indicators
People affected

Example:

SMS:
"FLOOD Gandhi Road cars stuck"
↓ NLP
Hazard: FLOOD
Location: Gandhi Road
Severity: HIGH
People/Vehicles affected: YES
Source: SMS

⸻

3. Unified AI Reasoning

All three input channels eventually reach the same reasoning layer.

PHOTO ──→ Computer Vision ──┐
                            │
VOICE ──→ Speech-to-Text ───┼──→ AI REASONING
                            │
SMS ────→ NLP ──────────────┘

The AI reasoning layer produces a common incident format:

{
  "hazard": "flood",
  "severity": "high",
  "confidence": 0.92,
  "location": "Gandhi Road",
  "people_affected": true,
  "source": "voice"
}

This allows reports from different communication channels to be treated uniformly.

⸻

4. Incident Fusion & Corroboration

A major feature of the system is incident fusion.

Multiple citizens may report the same disaster through different channels.

Example:

Citizen A → Photo → Flood
Citizen B → SMS   → Flood
Citizen C → Call  → Flood

If the reports are geographically close and describe the same hazard, the system groups them into a single incident.

        Photo
          │
        Flood
          │
          ├──────┐
          │      │
        SMS     Call
          │      │
          └──┬───┘
             ▼
      INCIDENT FUSION
             │
             ▼
       HIGH CONFIDENCE

Example

INCIDENT #1024
Hazard: Flood
Location: Gandhi Road
Reports:
📷 Photo   ✓
📞 Voice   ✓
💬 SMS     ✓
Corroborating reports: 3
Confidence: 97%
Severity: HIGH

This reduces the chance of relying on a single incorrect report.

⸻

5. Verification

Reports are placed into a responder verification queue.

Responders can see:

Incident #1024
Flood
High Severity
3 Corroborating Reports
[View Evidence]
[Verify]
[Reject]
[Mark Resolved]

Verification status:

PENDING
AI CLASSIFIED
CORROBORATED
VERIFIED
RESOLVED

AI predictions are never silently overwritten. Human verification is stored separately.

⸻

6. Live Disaster Map

All incidents are displayed on a live map.

Each marker contains:

* Hazard type
* Severity
* Confidence
* Location
* Number of corroborating reports
* Source channels
* Verification status

Example:

🌍 LIVE INCIDENT MAP
      🔴 FIRE
                🟠 FLOOD
                    📍
   🟣 DAMAGE
                      🔴 CRITICAL

The dashboard provides filters for:

Hazard
Severity
Status
Source
Time

⸻

7. Dynamic Rerouting

Disaster conditions are dynamic.

A road may change from safe to unsafe within minutes.

Example:

12:05
ROAD A ✅
ROAD B ✅
ROAD C ❌

Later:

12:20
ROAD A ❌
ROAD B ✅
ROAD C ❌

Therefore, the routing system must continuously consider new verified or high-confidence incidents.

Routing Flow

New Disaster Report
        ↓
Incident Fusion
        ↓
Confidence / Verification
        ↓
Affected Road Detection
        ↓
Update Road Network
        ↓
Recalculate Route
        ↓
Safest Available Route

Instead of simply finding the shortest route, the system should prioritize:

Safety
↓
Road availability
↓
Distance
↓
Travel time

⸻

8. Safe Shelter Routing

The system maintains a list of safe shelters.

Example:

🏫 Shelter A
Distance: 2.4 km
Status: OPEN
Capacity: 72%
🏫 Shelter B
Distance: 3.1 km
Status: OPEN
Capacity: 45%

The user can request:

"Find safest route to nearest shelter"

The system considers:

* Active disaster incidents
* Blocked roads
* Hazard severity
* Current location
* Shelter availability
* Road accessibility

Then generates:

CURRENT LOCATION
       ↓
   ROAD B
       ↓
   ROAD D
       ↓
SAFE SHELTER

⸻

9. Dynamic Route Updates

The route should not be considered permanent.

If a new incident appears on the current route:

Current Route
      ↓
🚨 New Flood Report
      ↓
Road becomes unsafe
      ↓
Routing Engine
      ↓
New Safe Route

The user receives:

⚠ ROUTE UPDATED
A flood was reported ahead.
Your route has been changed
to avoid the affected road.
New ETA: 14 minutes

This is a key distinction from conventional static navigation.

⸻

10. Technology Stack

Frontend

* Next.js
* TypeScript
* Tailwind CSS
* Leaflet
* OpenStreetMap

Backend

* Python
* FastAPI
* PostgreSQL
* PostGIS

AI

* PyTorch
* EfficientNet-B0 / MobileNetV3
* Grad-CAM
* NLP model
* Speech-to-Text

Communication

* Twilio — voice calls and SMS
* Groq — fast AI inference/reasoning

Routing

Use a routing engine such as:

* OSRM
* GraphHopper
* OpenRouteService

The routing layer should allow roads affected by disaster incidents to be assigned high costs or temporarily blocked.

⸻

11. Main Database Structure

reports
├── id
├── source
├── image_url
├── transcript
├── message
├── latitude
├── longitude
├── hazard_type
├── severity
├── confidence
├── evidence
├── status
└── created_at
incidents
├── id
├── hazard_type
├── severity
├── latitude
├── longitude
├── confidence
├── report_count
├── status
└── created_at
shelters
├── id
├── name
├── latitude
├── longitude
├── capacity
├── occupancy
└── status

⸻

12. End-to-End System Flow

                    CITIZEN
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
      PHOTO          CALL            SMS
        │              │              │
     Vision           ASR            NLP
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                 AI REASONING
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
          Hazard    Severity   Evidence
             │         │         │
             └─────────┼─────────┘
                       ▼
                  Geolocation
                       │
                       ▼
                Incident Fusion
                       │
                       ▼
              Corroboration Engine
                       │
                       ▼
               Verification Queue
                       │
                       ▼
               LIVE INCIDENT MAP
                       │
              ┌────────┴────────┐
              ▼                 ▼
          RESPONDERS         CITIZENS
              │                 │
              ▼                 ▼
         Verify Reports    Dynamic Routing
                                │
                                ▼
                         Safe Route Update
                                │
                                ▼
                           Safe Shelter

⸻

13. Implementation Plan

Phase 1 — Core Platform

Build:

* Next.js frontend
* FastAPI backend
* PostgreSQL/PostGIS
* Basic report API
* Live map

Phase 2 — Photo AI

Implement:

* Image upload
* Disaster classifier
* Four hazard categories
* Severity
* Confidence
* Grad-CAM

Phase 3 — SMS

Integrate Twilio SMS.

Flow:

SMS
 ↓
Twilio
 ↓
FastAPI Webhook
 ↓
NLP
 ↓
AI Reasoning
 ↓
Incident

Phase 4 — Voice

Integrate Twilio Voice + IVR.

Flow:

Phone Call
 ↓
Twilio
 ↓
IVR Questions
 ↓
Speech-to-Text
 ↓
AI Reasoning
 ↓
Incident

Phase 5 — Incident Fusion

Implement geographic and semantic matching.

Group nearby reports describing the same hazard.

Phase 6 — Verification

Create responder dashboard.

Add:

Verify
Reject
Resolve

Phase 7 — Dynamic Routing

Integrate routing engine.

Add disaster-aware road weights.

When incidents change, recalculate affected routes.

Phase 8 — Safe Shelters

Add shelter database.

Calculate safest accessible shelter.

Phase 9 — Judge Testing

Test:

* Five unseen disaster photographs
* Real/test SMS messages
* Voice call reporting
* Multiple reports for the same incident
* New hazard appearing on an existing route
* Dynamic rerouting

⸻

14. Final Demonstration

The strongest hackathon demonstration should show the complete chain.

Demo 1 — Photo

Upload a judge-provided image.

Flood
91%
High

Show the AI evidence and heatmap.

Demo 2 — SMS

Send:

FLOOD Gandhi Road cars stuck

Show the new incident on the map.

Demo 3 — Voice

Call the Twilio number.

Answer the IVR questions.

Show the resulting incident.

Demo 4 — Incident Fusion

Submit another report near the same location.

Show:

3 corroborating reports
Confidence increased

Demo 5 — Dynamic Rerouting

Start a route to a shelter.

Introduce a new high-confidence flood incident on the route.

The system should automatically:

Detect affected road
       ↓
Invalidate current route
       ↓
Calculate alternative
       ↓
Display new safe route

⸻

15. Final Objective

The completed platform should transform disaster communication from isolated reports into a continuously updated intelligence system:

📷 PHOTO
📞 CALL
💬 SMS
   ↓
AI UNDERSTANDS
   ↓
📍 LOCATES
   ↓
🔗 FUSES
   ↓
✅ VERIFIES
   ↓
🌍 MAPS
   ↓
🛣️ REROUTES
   ↓
🏫 GUIDES TO SAFETY

Core Innovation

A multi-channel disaster intelligence platform that converts citizen photos, voice calls, and SMS into verified geospatial incidents and continuously adapts safe routes as disaster conditions change.

The system is designed around the principle that the safest route is not fixed during a disaster — it must continuously respond to new information.