# User Flow Mapping Reference

## Problem

Individual pages don't tell the full story. Real app features are **multi-step flows**:
- Click calendar slot → modal opens → fill form → submit → event appears on calendar
- Click "New Client" → form page → fill details → save → redirect to client profile
- Click appointment → detail panel → "Reschedule" → date picker → confirm → calendar updates

These flows involve state transitions, API call sequences, conditional paths, and cross-component updates. If you clone pages individually without understanding flows, the clone will "look right" but "feel broken."

## Step 1: Identify All User Flows

After the deep interaction crawl, look for patterns of sequential actions:

```
Common flow types to look for:

CREATE flows:
  "New X" button → form (modal or page) → fill → validate → submit → success state
  Examples: new appointment, new client, new service, new team member

READ/DETAIL flows:
  List item click → detail view (page, panel, or modal) → tabs for sub-info
  Examples: click client → profile with tabs (info, history, notes)

UPDATE flows:
  Detail view → "Edit" button → form pre-filled → modify → save → updated view
  Examples: edit appointment time, update client info, change service price

DELETE flows:
  Item → actions menu → "Delete" → confirmation dialog → confirm → item removed
  Examples: cancel appointment, remove client, delete service

MULTI-STEP flows:
  Step 1 → Step 2 → Step 3 → ... → Complete
  Examples: booking wizard (service → staff → time → details → confirm)

NAVIGATION flows:
  Trigger → transition → destination with context
  Examples: notification click → appointment detail, calendar event → edit form

CROSS-ROLE flows:
  Client action → Pro sees result → Team admin sees analytics
  Examples: client books → pro gets notification → event on pro's calendar
```

## Step 2: Flow Recording Protocol

For each identified flow, the agent follows this exact protocol:

```
FOR each flow:

  1. IDENTIFY the entry point (button, link, calendar slot, etc.)

  2. START recording:
     - Inject network capture
     - Note starting URL and page state
     - Take screenshot: "flow-{name}-step-0.png"

  3. EXECUTE step 1:
     - Click the trigger
     - Wait for response (animation, modal, navigation, API call)
     - Take screenshot: "flow-{name}-step-1.png"
     - Record:
       {
         step: 1,
         action: "click 'New Appointment' button",
         trigger: { selector: "button.new-apt", text: "New Appointment" },
         result: {
           type: "modal-open",
           modal: { title: "Create Appointment", hasForm: true },
           urlChanged: false,
           apiCalls: [],
           screenshot: "flow-create-apt-step-1.png"
         }
       }

  4. EXECUTE step 2:
     - Interact with the new UI (fill form field, select option, etc.)
     - Record what happens after each sub-action
     - Take screenshot after significant changes

  5. CONTINUE until the flow completes (success state reached)

  6. RECORD the complete flow:
     {
       name: "create-appointment",
       role: "solo_pro",
       entryPoint: "/dashboard (calendar view)",
       steps: [...all steps...],
       totalApiCalls: [...],
       endState: "appointment appears on calendar, toast shows 'Appointment created'",
       duration: "~30 seconds for real user"
     }

  7. VERIFY the flow is reversible:
     - Can you undo/delete what was created?
     - Record the undo flow too
```

## Step 3: Conditional Flow Mapping

Many flows have branches based on user input:

```
Flow: Create Appointment

Step 1: Click empty calendar slot
  → IF slot is in the past: show error toast "Cannot book in the past"
  → IF slot conflicts with break: show warning "This is during a break"
  → IF slot is available: open CreateAppointmentModal

Step 2: Select service
  → IF service has variants: show variant picker sub-step
  → IF service requires specific staff: auto-select staff, skip Step 3
  → IF multiple staff can do this service: proceed to Step 3

Step 3: Select staff (conditional)
  → Show only staff qualified for selected service
  → IF only one staff member: auto-select, skip to Step 4

Step 4: Select time (may be pre-filled from calendar click)
  → Show available slots based on staff + service duration
  → IF no slots today: show next available date

Step 5: Client details
  → IF existing client selected: auto-fill details
  → IF new client: show inline form for name, phone, email
  → IF walk-in: just name required

Step 6: Confirm
  → Show summary: service, staff, time, client, price
  → Submit: POST /api/appointments
  → ON SUCCESS: close modal, refresh calendar, show toast
  → ON ERROR: show error message, stay on form
```

Record these branches! They are critical for making the clone feel real.

## Step 4: API Call Sequence per Flow

For each flow, document the exact sequence of API calls:

```markdown
## Flow: Create Appointment

### API Sequence:
1. `GET /api/services` — load service list (on modal open)
2. `GET /api/staff?service_id=123` — load staff for selected service (after service selection)
3. `GET /api/availability?staff_id=456&date=2024-01-15` — load time slots (after staff selection)
4. `GET /api/clients?search=john` — search clients (as user types in client field)
5. `POST /api/appointments` — create appointment (on form submit)
   Request: { service_id, staff_id, start_time, end_time, client_id, notes }
   Response: { id, status: "confirmed", ... }
6. `GET /api/appointments?date=2024-01-15` — refresh calendar (auto after create)

### Error scenarios:
- 409 Conflict: "Time slot no longer available" → show error, re-fetch availability
- 422 Validation: { errors: { client_id: "Required" } } → show field errors
- 401 Unauthorized: → redirect to login
```

## Step 5: State Transition Diagram

For complex features, map the state machine:

```
APPOINTMENT STATES:
  [empty slot] --click--> [create modal]
  [create modal] --fill+submit--> [pending] --auto-confirm--> [confirmed]
  [confirmed] --click--> [detail panel]
  [detail panel] --"reschedule"--> [reschedule picker] --confirm--> [confirmed (new time)]
  [detail panel] --"cancel"--> [cancel dialog] --confirm--> [cancelled]
  [detail panel] --"no-show"--> [no-show dialog] --confirm--> [no-show]
  [confirmed] --time passes--> [completed]
  [completed] --click--> [detail panel (read-only, + "rebook" button)]

CALENDAR VIEW STATES:
  [day view] --"3-Day"--> [3-day view]
  [day view] --"Week"--> [week view]
  [day view] --"Month"--> [month view]
  [any view] --"Today"--> [today in current view]
  [any view] --prev/next--> [adjacent period in current view]
  [any view] --date picker--> [selected date in current view]
  [any view] --staff filter--> [filtered view]
```

## Step 6: Flow Spec Output

Save to `docs/clone-research/USER_FLOWS.md`:

```markdown
# User Flows

## Flows by Role

### Solo Pro Flows (12 flows)
1. **Create Appointment** — calendar slot click → modal → form → submit [5 steps, 6 API calls]
2. **Reschedule Appointment** — event click → panel → reschedule → picker → confirm [4 steps, 3 API calls]
3. **Cancel Appointment** — event click → panel → cancel → confirm dialog [3 steps, 2 API calls]
4. **Add New Client** — clients page → "Add" button → form → save [3 steps, 1 API call]
5. **Create Service** — services page → "Add" button → form → save [3 steps, 1 API call]
...

### Client Flows (6 flows)
1. **Book Appointment** — provider page → service → time → details → confirm [5 steps, 4 API calls]
2. **Cancel Booking** — my bookings → booking → "Cancel" → confirm [3 steps, 1 API call]
...

### Team Flows (8 additional flows beyond Solo Pro)
1. **Add Team Member** — staff page → "Invite" → form → send invite [3 steps, 1 API call]
2. **Set Permissions** — staff page → member → permissions panel → toggle → save [3 steps, 1 API call]
...

## Cross-Role Flows
1. **End-to-End Booking:**
   Client: browse → select service → select time → book
   Pro: notification → calendar shows new event → click to view details
   Team Admin: analytics dashboard updates booking count

## Flow Dependencies (build order)
1. Auth flows (login/signup per role) — prerequisite for everything
2. CRUD: Services — needed before appointments
3. CRUD: Clients — needed before appointments
4. CRUD: Staff/Team — needed for team role
5. Calendar + Appointments — depends on services, clients, staff
6. Booking flow (client-side) — depends on services, availability API
7. Analytics — depends on appointment data existing
```

## Implementation Notes

When building from flow specs:

1. **Build API routes in dependency order** — services before appointments, clients before bookings
2. **Build flows end-to-end, not page-by-page** — the "create appointment" flow involves calendar page + modal component + API route + calendar refresh. Build all of those together, test the flow, then move on.
3. **Test the FLOW, not the page** — "does clicking an empty slot, filling the form, and submitting create an appointment that appears on the calendar?" This is the acceptance criteria, not "does the page render."
4. **Handle every branch** — the conditional paths (error, validation, edge cases) are what make a clone feel real vs. feel like a demo.
