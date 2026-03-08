<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Crisis Mode • CareNest</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <div class="container">
      <div class="topbar-left">
        <h1>CareNest</h1>
        <p>Crisis Mode</p>
      </div>

      <div class="topbar-right">
        <select id="childSwitcher" class="child-switcher"></select>
        <a class="btn btn-ghost" href="index.html">Back</a>
        <button id="logoutBtn" class="btn btn-ghost" type="button">Log out</button>
      </div>
    </div>
  </header>

  <main class="page">
    <section class="card">
      <div class="section-head">
        <div>
          <h1 style="margin:0;">Crisis Mode</h1>
          <p id="childSummary" class="muted" style="margin:6px 0 0;">No child selected</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="btnStartCrisis" class="btn" type="button">Start Crisis</button>
          <button id="btnEndCrisis" class="btn btn-ghost" type="button">End Crisis</button>
        </div>
      </div>
      <p id="crisisStatus" class="muted" style="margin-top:10px;">Crisis inactive</p>
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="section-head">
          <h2>Emergency Protocol</h2>
        </div>
        <div id="protocolBox" class="muted">No protocol loaded.</div>
      </section>

      <section class="card">
        <div class="section-head">
          <h2>Rescue Medication</h2>
        </div>
        <div id="rescueMedBox" class="muted">No rescue medication loaded.</div>
      </section>
    </div>

    <div class="grid-2">
      <section class="card">
        <div class="section-head">
          <h2>When to Call EMS</h2>
        </div>
        <div id="emsBox" class="muted">No EMS guidance loaded.</div>
      </section>

      <section class="card">
        <div class="section-head">
          <h2>Oxygen Guidance</h2>
        </div>
        <div id="oxygenBox" class="muted">No oxygen guidance loaded.</div>
      </section>
    </div>

    <section class="card">
      <div class="section-head">
        <h2>Quick Actions</h2>
      </div>

      <div class="quick-actions">
        <button id="btnLogSeizureStart" class="quick-btn" type="button">Seizure Started<span>Start the event timeline</span></button>
        <button id="btnLogSeizureEnd" class="quick-btn" type="button">Seizure Ended<span>Mark stop time</span></button>
        <button id="btnLogRescueMed" class="quick-btn" type="button">Rescue Med Given<span>Log medication timing</span></button>
        <button id="btnLogOxygen" class="quick-btn" type="button">Oxygen Started<span>Log oxygen support</span></button>
        <button id="btnLogCallEms" class="quick-btn" type="button">Called EMS<span>Mark emergency call time</span></button>
        <button id="btnAddNote" class="quick-btn" type="button">Add Note<span>Log a custom crisis note</span></button>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <h2>Emergency Contacts</h2>
      </div>
      <div id="contactsBox" class="muted">No contacts loaded.</div>
    </section>

    <section class="card">
      <div class="section-head">
        <h2>Crisis Timeline</h2>
        <button id="btnClearTimeline" class="btn btn-ghost" type="button">Clear</button>
      </div>
      <div id="timelineList" class="list"></div>
    </section>
  </main>

  <nav class="bottom-nav">
    <div class="bottom-nav-inner">
      <a class="nav-link" href="index.html">Home</a>
      <a class="nav-link" href="carelog.html">Care Log</a>
      <a class="nav-link" href="meds.html">Meds</a>
      <a class="nav-link" href="schedule.html">Schedule</a>
      <a class="nav-link active" href="more.html">More</a>
    </div>
  </nav>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase.js"></script>
  <script src="auth.js"></script>
  <script src="crisis.js"></script>
</body>
</html>
