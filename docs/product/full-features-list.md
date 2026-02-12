Perfect move.

Before we go into detailed specs, we need a clean, exhaustive feature inventory so:
• The agent understands the total product surface
• You see what’s MVP vs later
• Nothing gets “invented” mid-build
• Feature boundaries are clear

Below is a complete feature list, grouped by domain, aligned with your product vision and revised MVP logic.

You can later decide which ones become individual specs.

⸻

Complete Feature Inventory

⸻

A. Identity & Account Features

A1. User Registration
• Email + password signup

A2. User Login
• Email + password authentication

A3. Session Persistence
• Stay logged in

A4. Logout

A5. Account Dashboard
• View connected provider
• View events
• View shared playlists

⸻

B. Streaming Provider Integration

B1. Connect Spotify

B2. Connect Apple Music

B3. Disconnect Provider

B4. Reconnect Provider

B5. Provider Connection Status Indicator

⸻

C. Event Playlist System (Primary Product Pillar)

C1. Create Event Playlist
• Name event
• Create playlist in provider

C2. Generate Event Magic Link

C3. Revoke Event Link

C4. Close Event

C5. View Event Track List

C6. Remove Track from Event

C7. Prevent Duplicate Tracks

C8. Event Status Indicator (Open / Closed)

⸻

D. Guest Contribution System (Frictionless Mode)

D1. Magic Link Landing Page
• Event display
• Search field

D2. Search Host Provider Catalog

D3. Display Search Results
• Title
• Artist
• Album
• Artwork

D4. Add Track to Host Playlist

D5. Success Feedback (Toast / Confirmation)

D6. Error Handling (API failure, duplicate, closed event)

⸻

E. Guest Sync Mode (Optional Flow)

E1. “Import This Playlist” CTA

E2. Guest Account Creation (if not logged in)

E3. Guest Provider Connection

E4. One-Time Playlist Import

E5. Import Result Summary
• Matched
• Skipped

⸻

F. Cross-Provider Playlist Sync (Secondary Pillar)

F1. View User Playlists

F2. Select Playlist for Sync

F3. Generate Sync Magic Link

F4. Sync Link Landing Page

F5. Recipient Login

F6. Recipient Provider Connection

F7. Metadata Matching Engine (Basic)

F8. Create Mirrored Playlist

F9. Display Sync Result Summary

⸻

G. Magic Link Infrastructure

G1. Unique Event Links

G2. Unique Sync Links

G3. Link Revocation

G4. Link Validation

G5. Link Access Control

⸻

H. Track Matching Logic

H1. Same-Provider Direct Add

H2. Cross-Provider Metadata Match

H3. Skip Unmatched Tracks

H4. Prevent Duplicate Provider IDs

⸻

I. Playlist State & Status

I1. Event Open State

I2. Event Closed State

I3. Playlist Creation Status

I4. Sync Processing Status

⸻

J. Host Control Panel

J1. View All Events

J2. Open Event Detail View

J3. Remove Tracks

J4. Close Event

J5. Regenerate Link (Optional)

⸻

K. UX & Interaction Features

K1. Mobile-Optimized Event Page

K2. Copy-to-Clipboard Link

K3. Share Button (Native Share API)

K4. Loading States

K5. Clear Error Messaging

⸻

L. Operational / Behavioral Features (User-Facing Only)

L1. Rate Limit Guest Additions (basic abuse prevention)

L2. Track Addition Logging (for debugging)

L3. Basic Contribution Count (internal metric)

⸻

M. Explicitly NOT MVP (Future)

M1. Continuous Playlist Sync

M2. Multi-Provider per User

M3. Voting System

M4. Contribution Limits

M5. Playlist Version History

M6. Premium Subscription System

M7. Analytics Dashboard

M8. Event Expiration Settings

M9. Native Mobile Apps

M10. Social Profiles

M11. AI Track Suggestions

M12. Scheduled Sync

⸻

Structural Overview

Your product fundamentally consists of: 1. Identity Layer 2. Provider Connection Layer 3. Event Playlist Layer (Primary Monetization Feature) 4. Guest Contribution Layer (Frictionless Mode) 5. Sync Layer (Secondary Feature) 6. Magic Link System (Core Infrastructure)

⸻

Important Architectural Insight

From a build-order perspective, this reduces to:

Phase 1 Core Loop:
• A1 → B1 → C1 → C2 → D1 → D4 → C6 → C4

Secondary Loop:
• F1 → F3 → F7 → F8

If the Event loop works flawlessly, the product is validated.
