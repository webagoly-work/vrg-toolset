// 07b-phone-camera.js — Varler Planner
// Wireless phone-gyro + touch camera control.
//
// WHERE THIS GOES: src/07b-phone-camera.js. Sorts after 07a-link.js and
// before 08-interaction.js — build.js accepts NNx-style names, so no
// renumbering is needed.
//
// ── CHANGED 2.0-a ───────────────────────────────────────────────────────
// This module no longer owns a WebSocket. 07a-link.js owns the transport,
// the envelope, the hello handshake and command routing; this module is one
// consumer of it, subscribing to the two message kinds it cares about.
//
// Why: with two sockets open to the same relay, the phone receives two
// planner hellos and cannot tell which one to answer.
//
// undo / redo / tool selection arrive as SEMANTIC COMMANDS ('edit.undo',
// 'edit.redo', 'tool.select') which 07a-link.js routes straight to
// PLANNER_CAM — that is the 2.0 path.
//
// ── LEGACY CONTROL BRIDGE ───────────────────────────────────────────────
// The shipped mobile/phone-sender.html predates the 2.0 protocol. It sends
// bare {type:'undo'}, {type:'redo'}, {type:'tool',index,key} with no
// envelope. 07a-link delivers those to subscribers by type, so the bridge
// below is three subscriptions rather than a second dispatcher — the
// commands still end at the same PLANNER_CAM methods.
//
// DELETE THIS BLOCK when phone-sender.html is rewritten for 2.0-b and sends
// {type:'cmd', payload:{id:'edit.undo'}} instead. Until then, removing it
// silently kills the phone's undo/redo buttons and the tool wheel.
//
// ── REQUIRED ADAPTER ────────────────────────────────────────────────────
// This module talks ONLY to window.PLANNER_CAM — it never reaches into
// 08-interaction.js's internals directly, so there's no risk of the name
// collisions that bit the UNDO_SCOPE/SC work. That adapter lives at the
// bottom of src/08-interaction.js and provides:
//
//   getPitch/setPitch · getYaw/setYaw · zoomBy · panBy · pivotAt ·
//   pivotCenter · isOverUI · resetView · undo · redo · selectTool · read
//
// Until PLANNER_CAM exists, this module shows status but is otherwise inert
// (every handler checks for it first and no-ops if absent). A console
// warning fires once after 3s if it's still missing, so a broken wire-up is
// visible instead of silently doing nothing.

(function(){
  'use strict';

  let lastMouseX = window.innerWidth/2, lastMouseY = window.innerHeight/2;
  let lastPitch = null, lastYaw = null;
  const SMOOTH = 0.35;       // extra planner-side smoothing on top of the phone's own EMA
  const DEAD_ZONE_DEG = 0.05; // ignore sub-noise deltas

  document.addEventListener('mousemove', (e) => { lastMouseX = e.clientX; lastMouseY = e.clientY; });

  function cam(){ return window.PLANNER_CAM || null; }

  function angleDelta(from, to){ return ((to - from + 540) % 360) - 180; }
  function norm360(a){ return ((a % 360) + 360) % 360; }

  function applyPivot(C){
    if (C.isOverUI(lastMouseX, lastMouseY)) C.pivotCenter();
    else C.pivotAt(lastMouseX, lastMouseY);
  }

  function handleOrientation(msg){
    const C = cam(); if (!C || !msg) return;

    if (msg.pitchEnabled){
      const target = msg.pitch;
      const p = (lastPitch == null) ? target : lastPitch + SMOOTH * (target - lastPitch);
      if (lastPitch == null || Math.abs(p - lastPitch) > DEAD_ZONE_DEG){
        applyPivot(C);
        C.setPitch(p);
        lastPitch = p;
      }
    }

    if (msg.yawEnabled){
      const target = msg.yaw;
      const y = (lastYaw == null) ? target : norm360(lastYaw + SMOOTH * angleDelta(lastYaw, target));
      if (lastYaw == null || Math.abs(angleDelta(lastYaw, y)) > DEAD_ZONE_DEG){
        applyPivot(C);
        C.setYaw(y);
        lastYaw = y;
      }
    }

  }

  function handleGesture(msg){
    const C = cam(); if (!C || !msg) return;
    if (msg.kind === 'zoompan'){
      applyPivot(C);
      if (msg.scale && msg.scale !== 1) C.zoomBy(msg.scale);
      if (msg.dx || msg.dy) C.panBy(msg.dx, msg.dy);
    } else if (msg.kind === 'reset'){
      if (typeof C.resetView === 'function') C.resetView();
    }
  }

  // ── NO UI HERE ──────────────────────────────────────────────────────────
  // The connect widget moved to 07d-linkpanel.js. It was a dot, a text box and
  // a button: you read the IP off the relay console, retyped it here, and had
  // to get the ws:// prefix right. Three chances to fail silently, and the
  // failure looked like a broken phone.
  //
  // This module is now purely the camera consumer: two subscriptions and the
  // smoothing maths. It builds nothing and owns no DOM.

  function init(){
    if (window.PLANNER_LINK){
      const L = window.PLANNER_LINK;
      L.on('orientation', handleOrientation);
      L.on('gesture',     handleGesture);

      // legacy control bridge — see the header note
      L.on('undo', function(){ const C = cam(); if (C && typeof C.undo === 'function') C.undo(); });
      L.on('redo', function(){ const C = cam(); if (C && typeof C.redo === 'function') C.redo(); });
      L.on('tool', function(msg){
        const C = cam();
        if (C && msg && typeof C.selectTool === 'function') C.selectTool(msg.index, msg.key);
      });

    }

    setTimeout(() => {
      if (!cam()) console.warn('[phone-camera] window.PLANNER_CAM adapter not found — see the comment header in 07b-phone-camera.js for what to add to 08-interaction.js');
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
