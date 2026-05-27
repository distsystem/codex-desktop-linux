"use strict";

const {
  findMatchingBrace,
  requireName,
} = require("./shared.js");

function findAvatarMethod(source, signatureRegex) {
  const match = source.match(signatureRegex);
  if (match == null) {
    return null;
  }
  const openIndex = match.index + match[0].length - 1;
  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex === -1) {
    return null;
  }
  return {
    match,
    start: match.index,
    end: closeIndex + 1,
    text: source.slice(match.index, closeIndex + 1),
  };
}

function applyLinuxAvatarOverlayMousePassthroughPatch(currentSource) {
  let patchedSource = currentSource;
  const childProcessVar = requireName(currentSource, "node:child_process");
  const i3SessionMethod =
    "codexLinuxIsI3Session(){let e=[process.env.XDG_CURRENT_DESKTOP,process.env.DESKTOP_SESSION,process.env.I3SOCK].filter(Boolean).join(`:`).toLowerCase();return/(^|[:;/])i3([:;/.-]|$)/.test(e)}";
  const compositorHintsMethod =
    childProcessVar == null
      ? "codexLinuxApplyAvatarCompositorHints(e){}"
      : `codexLinuxApplyAvatarCompositorHints(e){if(process.platform!==\`linux\`||!this.codexLinuxIsI3Session()||this.codexLinuxAvatarCompositorHintsApplied||this.codexLinuxAvatarCompositorHintsApplying||e==null||e.isDestroyed()||!process.env.DISPLAY)return;let t;try{t=e.getBounds?.()??e.getContentBounds?.()}catch{}if(t==null||!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.width)||!Number.isFinite(t.height))return;let n=[];try{let r=e.getNativeWindowHandle?.();r!=null&&r.length>=4&&n.push(String(r.readUInt32LE(0)))}catch{}this.codexLinuxAvatarCompositorHintsApplying=!0;let r=e=>{let r=[...new Set(e)].filter(e=>/^[0-9]+$/.test(e)&&e!==\`0\`);if(r.length===0){this.codexLinuxAvatarCompositorHintsApplying=!1;return}let i=r.length,a=!1,o=()=>{i--,i===0&&(this.codexLinuxAvatarCompositorHintsApplying=!1,a&&(this.codexLinuxAvatarCompositorHintsApplied=!0))},s=e=>{try{${childProcessVar}.execFile(\`xwininfo\`,[\`-id\`,e],{timeout:1e3},(r,i)=>{if(r){o();return}let s=String(i??\`\`),c=s.match(/Absolute upper-left X:\\s+(-?\\d+)[\\s\\S]*Absolute upper-left Y:\\s+(-?\\d+)[\\s\\S]*Width:\\s+(\\d+)[\\s\\S]*Height:\\s+(\\d+)/);if(c==null||!/Override Redirect State:\\s+yes/.test(s)){o();return}let[,l,h,d,f]=c;if(Number(l)!==t.x||Number(h)!==t.y||Number(d)!==t.width||Number(f)!==t.height){o();return}try{${childProcessVar}.execFile(\`xprop\`,[\`-id\`,e,\`-f\`,\`_GTK_FRAME_EXTENTS\`,\`32c\`,\`-set\`,\`_GTK_FRAME_EXTENTS\`,\`0, 0, 0, 0\`],{timeout:1e3},e=>{e||(a=!0),o()})}catch{o()}})}catch{o()}};for(let t of r)s(t)};try{${childProcessVar}.execFile(\`xdotool\`,[\`search\`,\`--pid\`,String(process.pid)],{timeout:1e3},(e,t)=>{r([...n,...String(t??\`\`).trim().split(/\\s+/).filter(Boolean)])})}catch{r(n)}}`;

  const interactivityNeedle =
    "applyPointerInteractivityPolicy(){let e=this.window;if(e==null||e.isDestroyed()){this.mousePassthroughEnabled=!1;return}let t=!this.pointerInteractive;if(this.mousePassthroughEnabled!==t){if(this.mousePassthroughEnabled=t,t){e.setIgnoreMouseEvents(!0,{forward:!0});return}e.setIgnoreMouseEvents(!1),this.refreshCursorAtCurrentMousePosition(e)}}refreshCursorAtCurrentMousePosition(e){";
  const previousInteractivityNeedle =
    "applyPointerInteractivityPolicy(){let e=this.window;if(e==null||e.isDestroyed()){this.mousePassthroughEnabled=!1,this.codexLinuxStopAvatarPassthroughRecovery();return}let t=!this.pointerInteractive;if(this.mousePassthroughEnabled!==t){if(this.mousePassthroughEnabled=t,t){e.setIgnoreMouseEvents(!0,{forward:!0}),this.codexLinuxStartAvatarPassthroughRecovery();return}this.codexLinuxStopAvatarPassthroughRecovery(),e.setIgnoreMouseEvents(!1),this.refreshCursorAtCurrentMousePosition(e)}else t&&this.codexLinuxStartAvatarPassthroughRecovery()}codexLinuxStopAvatarPassthroughRecovery(){this.codexLinuxAvatarPassthroughRecoveryTimer!=null&&(clearInterval(this.codexLinuxAvatarPassthroughRecoveryTimer),this.codexLinuxAvatarPassthroughRecoveryTimer=null)}codexLinuxRecoverAvatarPointerInteractivity(){this.pointerInteractive=!0,this.applyPointerInteractivityPolicy()}codexLinuxStartAvatarPassthroughRecovery(){if(process.platform!==`linux`||this.codexLinuxAvatarPassthroughRecoveryTimer!=null)return;this.codexLinuxAvatarPassthroughRecoveryTimer=setInterval(()=>{let e=this.window;if(e==null||e.isDestroyed()||!this.mousePassthroughEnabled){this.codexLinuxStopAvatarPassthroughRecovery();return}let t;try{t=this.codexLinuxIsCursorInAvatarInteractiveRegion(e)}catch{this.codexLinuxRecoverAvatarPointerInteractivity();return}t&&this.codexLinuxRecoverAvatarPointerInteractivity()},80),this.codexLinuxAvatarPassthroughRecoveryTimer.unref?.()}codexLinuxIsCursorInAvatarInteractiveRegion(e){let t=this.layout;if(t==null)return!1;let r=n.screen.getCursorScreenPoint(),i=e.getContentBounds(),a=r.x-i.x,o=r.y-i.y,s=e=>e!=null&&a>=e.left&&a<=e.left+e.width&&o>=e.top&&o<=e.top+e.height;return s(t.mascot)||s(t.tray)}refreshCursorAtCurrentMousePosition(e){";
  const previousSyncInteractivityNeedle =
    "applyPointerInteractivityPolicy(){let e=this.window;if(e==null||e.isDestroyed()){this.mousePassthroughEnabled=!1,this.codexLinuxStopAvatarPassthroughRecovery();return}process.platform===`linux`&&(this.codexLinuxStartAvatarPassthroughRecovery(),this.codexLinuxSyncAvatarPointerInteractivity(e));let t=!this.pointerInteractive;this.dragState!=null&&(t=!1);if(this.mousePassthroughEnabled!==t){if(this.mousePassthroughEnabled=t,t){e.setIgnoreMouseEvents(!0,{forward:!0});return}e.setIgnoreMouseEvents(!1),this.refreshCursorAtCurrentMousePosition(e)}}codexLinuxStopAvatarPassthroughRecovery(){this.codexLinuxAvatarPassthroughRecoveryTimer!=null&&(clearInterval(this.codexLinuxAvatarPassthroughRecoveryTimer),this.codexLinuxAvatarPassthroughRecoveryTimer=null)}codexLinuxStartAvatarPassthroughRecovery(){if(process.platform!==`linux`||this.codexLinuxAvatarPassthroughRecoveryTimer!=null)return;this.codexLinuxAvatarPassthroughRecoveryTimer=setInterval(()=>{let e=this.window;if(e==null||e.isDestroyed()||!e.isVisible()){this.codexLinuxStopAvatarPassthroughRecovery();return}this.codexLinuxSyncAvatarPointerInteractivity(e)&&this.applyPointerInteractivityPolicy()},32),this.codexLinuxAvatarPassthroughRecoveryTimer.unref?.()}codexLinuxSyncAvatarPointerInteractivity(e){if(process.platform!==`linux`||e==null||e.isDestroyed())return!1;if(this.dragState!=null){if(this.pointerInteractive)return!1;return this.pointerInteractive=!0,!0}let t;try{t=this.codexLinuxIsCursorInAvatarInteractiveRegion(e)}catch{t=!0}return this.pointerInteractive===t?!1:(this.pointerInteractive=t,!0)}codexLinuxIsCursorInAvatarInteractiveRegion(e){let t=this.layout;if(t==null)return!1;let r=n.screen.getCursorScreenPoint(),i=e.getContentBounds(),a=r.x-i.x,o=r.y-i.y;if(a<0||o<0||a>i.width||o>i.height)return!1;let s=e=>e!=null&&a>=e.left&&a<=e.left+e.width&&o>=e.top&&o<=e.top+e.height;return s(t.mascot)||s(t.tray)}refreshCursorAtCurrentMousePosition(e){";
  const previousShapeInteractivityNeedle =
    "applyPointerInteractivityPolicy(){let e=this.window;if(e==null||e.isDestroyed()){this.mousePassthroughEnabled=!1,this.codexLinuxStopAvatarPassthroughRecovery();return}if(process.platform===`linux`&&typeof e.setShape==`function`){this.codexLinuxStopAvatarPassthroughRecovery(),this.mousePassthroughEnabled&&(this.mousePassthroughEnabled=!1,e.setIgnoreMouseEvents(!1));if(this.codexLinuxApplyAvatarInputShape(e))return}process.platform===`linux`&&(this.codexLinuxStartAvatarPassthroughRecovery(),this.codexLinuxSyncAvatarPointerInteractivity(e));let t=!this.pointerInteractive;this.dragState!=null&&(t=!1);if(this.mousePassthroughEnabled!==t){if(this.mousePassthroughEnabled=t,t){e.setIgnoreMouseEvents(!0,{forward:!0});return}e.setIgnoreMouseEvents(!1),this.refreshCursorAtCurrentMousePosition(e)}}codexLinuxStopAvatarPassthroughRecovery(){this.codexLinuxAvatarPassthroughRecoveryTimer!=null&&(clearInterval(this.codexLinuxAvatarPassthroughRecoveryTimer),this.codexLinuxAvatarPassthroughRecoveryTimer=null)}codexLinuxBuildAvatarInputShape(e){let t=this.layout;if(t==null)return null;if(this.dragState!=null){let t=e.getContentBounds();return[{x:0,y:0,width:t.width,height:t.height}]}let r=e.getContentBounds(),i=e=>{if(e==null)return null;let t=Math.max(0,e.left),n=Math.max(0,e.top),i=Math.min(r.width,e.left+e.width)-t,a=Math.min(r.height,e.top+e.height)-n;return i<=0||a<=0?null:{x:t,y:n,width:i,height:a}};return[i(t.mascot),i(t.tray)].filter(Boolean)}codexLinuxApplyAvatarInputShape(e){if(process.platform!==`linux`||e==null||e.isDestroyed()||typeof e.setShape!=`function`)return!1;let t=this.codexLinuxBuildAvatarInputShape(e);if(t==null)return!1;let n=JSON.stringify(t);if(this.codexLinuxAvatarInputShapeKey===n)return!0;try{e.setShape(t),this.codexLinuxAvatarInputShapeKey=n;return!0}catch{this.codexLinuxAvatarInputShapeKey=null;return!1}}codexLinuxStartAvatarPassthroughRecovery(){if(process.platform!==`linux`||this.codexLinuxAvatarPassthroughRecoveryTimer!=null)return;this.codexLinuxAvatarPassthroughRecoveryTimer=setInterval(()=>{let e=this.window;if(e==null||e.isDestroyed()||!e.isVisible()){this.codexLinuxStopAvatarPassthroughRecovery();return}this.codexLinuxSyncAvatarPointerInteractivity(e)&&this.applyPointerInteractivityPolicy()},32),this.codexLinuxAvatarPassthroughRecoveryTimer.unref?.()}codexLinuxSyncAvatarPointerInteractivity(e){if(process.platform!==`linux`||e==null||e.isDestroyed())return!1;if(this.dragState!=null){if(this.pointerInteractive)return!1;return this.pointerInteractive=!0,!0}let t;try{t=this.codexLinuxIsCursorInAvatarInteractiveRegion(e)}catch{t=!0}return this.pointerInteractive===t?!1:(this.pointerInteractive=t,!0)}codexLinuxIsCursorInAvatarInteractiveRegion(e){let t=this.layout;if(t==null)return!1;let r=n.screen.getCursorScreenPoint(),i=e.getContentBounds(),a=r.x-i.x,o=r.y-i.y;if(a<0||o<0||a>i.width||o>i.height)return!1;let s=e=>e!=null&&a>=e.left&&a<=e.left+e.width&&o>=e.top&&o<=e.top+e.height;return s(t.mascot)||s(t.tray)}refreshCursorAtCurrentMousePosition(e){";
  const interactivityPatch = previousShapeInteractivityNeedle
    .replace(
      "codexLinuxStopAvatarPassthroughRecovery(){",
      `${i3SessionMethod}${compositorHintsMethod}codexLinuxStopAvatarPassthroughRecovery(){`,
    );
  const previousI3AlwaysInteractivePatch =
    "if(process.platform===`linux`&&this.codexLinuxIsI3Session()){this.codexLinuxStopAvatarPassthroughRecovery(),this.codexLinuxAvatarInputShapeKey=null,this.pointerInteractive=!0,this.mousePassthroughEnabled&&(this.mousePassthroughEnabled=!1),e.setIgnoreMouseEvents(!1);return}";
  const previousI3SetShapeGuardPatch =
    "if(process.platform===`linux`&&typeof e.setShape==`function`&&!this.codexLinuxIsI3Session()){";

  if (!patchedSource.includes("codexLinuxIsI3Session")) {
    if (patchedSource.includes(interactivityNeedle)) {
      patchedSource = patchedSource.replace(interactivityNeedle, interactivityPatch);
    } else if (patchedSource.includes(previousInteractivityNeedle)) {
      patchedSource = patchedSource.replace(previousInteractivityNeedle, interactivityPatch);
    } else if (patchedSource.includes(previousSyncInteractivityNeedle)) {
      patchedSource = patchedSource.replace(previousSyncInteractivityNeedle, interactivityPatch);
    } else if (patchedSource.includes(previousShapeInteractivityNeedle)) {
      patchedSource = patchedSource.replace(previousShapeInteractivityNeedle, interactivityPatch);
    } else if (
      patchedSource.includes("avatar-overlay") &&
      patchedSource.includes("applyPointerInteractivityPolicy(){let e=this.window")
    ) {
      console.warn(
        "WARN: Could not find avatar overlay mouse passthrough policy — skipping Linux avatar overlay passthrough recovery patch",
      );
      return currentSource;
    }
  }
  if (
    patchedSource.includes("codexLinuxIsI3Session") &&
    !patchedSource.includes("codexLinuxApplyAvatarCompositorHints")
  ) {
    patchedSource = patchedSource.replace(
      `${i3SessionMethod}codexLinuxStopAvatarPassthroughRecovery(){`,
      `${i3SessionMethod}${compositorHintsMethod}codexLinuxStopAvatarPassthroughRecovery(){`,
    );
  }
  if (patchedSource.includes(previousI3AlwaysInteractivePatch)) {
    patchedSource = patchedSource.replace(previousI3AlwaysInteractivePatch, "");
  }
  if (patchedSource.includes(previousI3SetShapeGuardPatch)) {
    patchedSource = patchedSource.replace(
      previousI3SetShapeGuardPatch,
      "if(process.platform===`linux`&&typeof e.setShape==`function`){",
    );
  }

  const previousStartDragPatch =
    "startDrag(e,{pointerWindowX:t,pointerWindowY:r}){let i=this.window;if(i==null||i.isDestroyed()||i.webContents.id!==e)return;this.pointerInteractive=!0,this.applyPointerInteractivityPolicy(),this.cancelMomentum();";
  const originalStartDragPrefix =
    "startDrag(e,{pointerWindowX:t,pointerWindowY:r}){let i=this.window;if(i==null||i.isDestroyed()||i.webContents.id!==e)return;this.cancelMomentum();";
  const startDragNeedle =
    "displayBounds:n.screen.getDisplayNearestPoint(n.screen.getCursorScreenPoint()).bounds}}moveDrag(e){";
  const startDragPatch =
    "displayBounds:n.screen.getDisplayNearestPoint(n.screen.getCursorScreenPoint()).bounds},process.platform===`linux`&&(this.pointerInteractive=!0,this.applyPointerInteractivityPolicy())}moveDrag(e){";
  const previousStartDragAfterStatePatch =
    "displayBounds:n.screen.getDisplayNearestPoint(n.screen.getCursorScreenPoint()).bounds},this.pointerInteractive=!0,this.applyPointerInteractivityPolicy()}moveDrag(e){";
  if (patchedSource.includes(previousStartDragPatch)) {
    patchedSource = patchedSource.replace(previousStartDragPatch, originalStartDragPrefix);
  }
  if (patchedSource.includes(previousStartDragAfterStatePatch)) {
    patchedSource = patchedSource.replace(previousStartDragAfterStatePatch, startDragPatch);
  } else if (patchedSource.includes(startDragNeedle)) {
    patchedSource = patchedSource.replace(startDragNeedle, startDragPatch);
  } else if (
    patchedSource.includes("avatar-overlay") &&
    !patchedSource.includes(startDragPatch)
  ) {
    console.warn(
      "WARN: Could not find avatar overlay drag start — skipping Linux avatar overlay drag interactivity patch",
    );
  }

  const endDragNeedle =
    "endDrag(e){let t=this.window;t==null||t.isDestroyed()||t.webContents.id!==e||(this.dragState?.hasMoved&&this.moveDragToCurrentCursor(t),this.dragState=null,this.reclampWindowToVisibleDisplay({shouldPersist:!0}))}";
  const endDragPatch =
    "endDrag(e){let t=this.window;t==null||t.isDestroyed()||t.webContents.id!==e||(this.dragState?.hasMoved&&this.moveDragToCurrentCursor(t),this.dragState=null,this.reclampWindowToVisibleDisplay({shouldPersist:!0}),process.platform===`linux`&&this.applyPointerInteractivityPolicy())}";
  const previousEndDragPatch =
    "endDrag(e){let t=this.window;t==null||t.isDestroyed()||t.webContents.id!==e||(this.dragState?.hasMoved&&this.moveDragToCurrentCursor(t),this.dragState=null,this.reclampWindowToVisibleDisplay({shouldPersist:!0}),this.codexLinuxSyncAvatarPointerInteractivity(t)&&this.applyPointerInteractivityPolicy())}";
  if (patchedSource.includes(previousEndDragPatch)) {
    patchedSource = patchedSource.replace(previousEndDragPatch, endDragPatch);
  } else if (patchedSource.includes(endDragNeedle)) {
    patchedSource = patchedSource.replace(endDragNeedle, endDragPatch);
  } else if (
    patchedSource.includes("avatar-overlay") &&
    !patchedSource.includes(endDragPatch)
  ) {
    console.warn(
      "WARN: Could not find avatar overlay drag end — skipping Linux avatar overlay drag cleanup patch",
    );
  }

  const setElementSizeMethod = findAvatarMethod(
    patchedSource,
    /setElementSize\([A-Za-z_$][\w$]*,\{mascot:[A-Za-z_$][\w$]*,tray:[A-Za-z_$][\w$]*\}\)\{/,
  );
  if (
    setElementSizeMethod != null &&
    !/this\.applyLayout\([A-Za-z_$][\w$]*\),process\.platform===`linux`&&this\.applyPointerInteractivityPolicy\(\)/.test(setElementSizeMethod.text)
  ) {
    const patchedMethod = setElementSizeMethod.text.replace(
      /this\.applyLayout\(([A-Za-z_$][\w$]*)\)(?!,process\.platform===`linux`&&this\.applyPointerInteractivityPolicy\(\))/g,
      "this.applyLayout($1),process.platform===`linux`&&this.applyPointerInteractivityPolicy()",
    );
    if (patchedMethod !== setElementSizeMethod.text) {
      patchedSource =
        patchedSource.slice(0, setElementSizeMethod.start) +
        patchedMethod +
        patchedSource.slice(setElementSizeMethod.end);
    }
  } else if (
    patchedSource.includes("avatar-overlay") &&
    !/setElementSize\([^{}]+\)\{[^]*?this\.applyLayout\([A-Za-z_$][\w$]*\),process\.platform===`linux`&&this\.applyPointerInteractivityPolicy\(\)/.test(patchedSource)
  ) {
    console.warn(
      "WARN: Could not find avatar overlay element size update — skipping Linux avatar overlay layout interactivity patch",
    );
  }

  if (
    !patchedSource.includes("this.codexLinuxAvatarCompositorHintsApplied=!1,this.codexLinuxAvatarCompositorHintsApplying=!1,this.rendererReady")
  ) {
    patchedSource = patchedSource.replace(
      /return this\.window=([A-Za-z_$][\w$]*),this\.rendererReady=this\.windowManager\.isWebContentsReady\(\1\.webContents\.id\),/,
      "return this.window=$1,this.codexLinuxAvatarCompositorHintsApplied=!1,this.codexLinuxAvatarCompositorHintsApplying=!1,this.rendererReady=this.windowManager.isWebContentsReady($1.webContents.id),",
    );
  }

  const i3TrayFallbackRegex =
    /traySize:this\.traySize\?\?([A-Za-z_$][\w$]*)\}\);this\.anchor=/;
  const i3TrayFallbackPatch =
    "traySize:process.platform===`linux`&&typeof this.codexLinuxIsI3Session==`function`&&this.codexLinuxIsI3Session()?this.traySize:this.traySize??$1});this.anchor=";
  if (
    !patchedSource.includes(
      "traySize:process.platform===`linux`&&typeof this.codexLinuxIsI3Session==`function`&&this.codexLinuxIsI3Session()",
    )
  ) {
    if (i3TrayFallbackRegex.test(patchedSource)) {
      patchedSource = patchedSource.replace(i3TrayFallbackRegex, i3TrayFallbackPatch);
    } else if (patchedSource.includes("avatar-overlay")) {
      console.warn(
        "WARN: Could not find avatar overlay default tray layout — skipping Linux i3 hidden tray layout patch",
      );
    }
  }

  const currentApplyLayoutPatchRegex =
    /this\.setWindowBounds\(e,([A-Za-z_$][\w$]*)\.windowBounds\),this\.sendLayoutToRenderer\(e\),process\.platform===`linux`&&this\.applyPointerInteractivityPolicy\(\)\}getLayout\(e\)\{/;
  const previousApplyLayoutPatchRegex =
    /this\.setWindowBounds\(e,([A-Za-z_$][\w$]*)\.windowBounds\),this\.sendLayoutToRenderer\(e\),this\.codexLinuxSyncAvatarPointerInteractivity\(e\)&&this\.applyPointerInteractivityPolicy\(\)\}getLayout\(e\)\{/;
  const applyLayoutRegex =
    /this\.setWindowBounds\(e,([A-Za-z_$][\w$]*)\.windowBounds\),this\.sendLayoutToRenderer\(e\)\}getLayout\(e\)\{/;
  if (currentApplyLayoutPatchRegex.test(patchedSource)) {
    // Already patched.
  } else if (previousApplyLayoutPatchRegex.test(patchedSource)) {
    patchedSource = patchedSource.replace(
      previousApplyLayoutPatchRegex,
      "this.setWindowBounds(e,$1.windowBounds),this.sendLayoutToRenderer(e),process.platform===`linux`&&this.applyPointerInteractivityPolicy()}getLayout(e){",
    );
  } else if (applyLayoutRegex.test(patchedSource)) {
    patchedSource = patchedSource.replace(
      applyLayoutRegex,
      "this.setWindowBounds(e,$1.windowBounds),this.sendLayoutToRenderer(e),process.platform===`linux`&&this.applyPointerInteractivityPolicy()}getLayout(e){",
    );
  } else if (
    patchedSource.includes("avatar-overlay") &&
    !currentApplyLayoutPatchRegex.test(patchedSource)
  ) {
    console.warn(
      "WARN: Could not find avatar overlay layout application — skipping Linux avatar overlay layout sync patch",
    );
  }

  const showWindowNeedle =
    "e.moveTop(),e.showInactive(),!t&&this.isOpen()&&this.broadcastOpenState()}broadcastOpenState(){";
  const showWindowPatch =
    "e.moveTop(),e.showInactive(),process.platform===`linux`&&this.codexLinuxApplyAvatarCompositorHints(e),process.platform===`linux`&&this.applyPointerInteractivityPolicy(),!t&&this.isOpen()&&this.broadcastOpenState()}broadcastOpenState(){";
  const previousShowWindowCompositorPatch =
    "e.moveTop(),process.platform===`linux`&&this.codexLinuxApplyAvatarCompositorHints(e),e.showInactive(),process.platform===`linux`&&this.applyPointerInteractivityPolicy(),!t&&this.isOpen()&&this.broadcastOpenState()}broadcastOpenState(){";
  const previousShowWindowI3Patch =
    "e.moveTop(),e.showInactive(),process.platform===`linux`&&this.applyPointerInteractivityPolicy(),!t&&this.isOpen()&&this.broadcastOpenState()}broadcastOpenState(){";
  const previousShowWindowPatch =
    "e.moveTop(),e.showInactive(),process.platform===`linux`&&this.codexLinuxStartAvatarPassthroughRecovery(),this.codexLinuxSyncAvatarPointerInteractivity(e)&&this.applyPointerInteractivityPolicy(),!t&&this.isOpen()&&this.broadcastOpenState()}broadcastOpenState(){";
  if (patchedSource.includes(previousShowWindowCompositorPatch)) {
    patchedSource = patchedSource.replace(previousShowWindowCompositorPatch, showWindowPatch);
  } else if (patchedSource.includes(previousShowWindowPatch)) {
    patchedSource = patchedSource.replace(previousShowWindowPatch, showWindowPatch);
  } else if (patchedSource.includes(previousShowWindowI3Patch)) {
    patchedSource = patchedSource.replace(previousShowWindowI3Patch, showWindowPatch);
  } else if (patchedSource.includes(showWindowNeedle)) {
    patchedSource = patchedSource.replace(showWindowNeedle, showWindowPatch);
  } else if (
    patchedSource.includes("avatar-overlay") &&
    !patchedSource.includes(showWindowPatch)
  ) {
    console.warn(
      "WARN: Could not find avatar overlay show window — skipping Linux avatar overlay show sync patch",
    );
  }

  const closedPatchRegex =
    /this\.window===[A-Za-z_$][\w$]*&&\(this\.codexLinuxStopAvatarPassthroughRecovery\(\),this\.codexLinuxAvatarInputShapeKey=null,this\.codexLinuxAvatarCompositorHintsApplied=!1,this\.codexLinuxAvatarCompositorHintsApplying=!1,this\.cancelMomentum\(\),this\.window=null,/;
  if (closedPatchRegex.test(patchedSource)) {
    // Already patched.
  } else if (/this\.window===([A-Za-z_$][\w$]*)&&\(this\.cancelMomentum\(\),this\.window=null,/.test(patchedSource)) {
    patchedSource = patchedSource.replace(
      /this\.window===([A-Za-z_$][\w$]*)&&\(this\.cancelMomentum\(\),this\.window=null,/,
      "this.window===$1&&(this.codexLinuxStopAvatarPassthroughRecovery(),this.codexLinuxAvatarInputShapeKey=null,this.codexLinuxAvatarCompositorHintsApplied=!1,this.codexLinuxAvatarCompositorHintsApplying=!1,this.cancelMomentum(),this.window=null,",
    );
  } else if (
    patchedSource.includes("avatar-overlay") &&
    patchedSource.includes("codexLinuxStartAvatarPassthroughRecovery") &&
    !closedPatchRegex.test(patchedSource)
  ) {
    console.warn(
      "WARN: Could not find avatar overlay close cleanup — skipping Linux avatar overlay passthrough cleanup patch",
    );
  }

  return patchedSource;
}

// Mirror mascot + tray horizontally within the overlay window so the mascot
// always renders on the right edge regardless of which placement codex's
// solver picks. The mirror happens at the source of truth (the layout return
// in `aU`), so renderer visuals AND hit-region tracking stay in sync — both
// read `layout.mascot.left` / `layout.tray.left`.
function applyMascotRightAlignPatch(currentSource) {
  const sentinel = "/*mascot-right-align*/";
  if (currentSource.includes(sentinel)) {
    return currentSource;
  }
  // Match the layout return regardless of minified identifier rotation
  // (`hU` in one bundle → `DG` in the next). The bounds helper name is a
  // capture group, used in the rewrite so we keep calling whatever upstream
  // is calling.
  const layoutReturnRegex =
    /return\{anchor:([A-Za-z_$][\w$]*),mascot:([A-Za-z_$][\w$]*)\(\1,([A-Za-z_$][\w$]*)\),placement:([A-Za-z_$][\w$]*),tray:([A-Za-z_$][\w$]*)==null\?null:\2\(\5,\3\),viewport:([A-Za-z_$][\w$]*),windowBounds:\3\}/;
  const match = currentSource.match(layoutReturnRegex);
  if (match == null) {
    if (
      /return\{anchor:[A-Za-z_$][\w$]*,mascot:/.test(currentSource) &&
      currentSource.includes("avatar-overlay")
    ) {
      console.warn(
        "WARN: Could not find avatar overlay layout return — skipping mascot right-align patch",
      );
    }
    return currentSource;
  }
  const [, anchorVar, boundsFn, windowVar, placementVar, trayVar, viewportVar] = match;
  const replacement =
    `return ${sentinel}(()=>{` +
    `let __cdl_m=${boundsFn}(${anchorVar},${windowVar}),` +
    `__cdl_t=${trayVar}==null?null:${boundsFn}(${trayVar},${windowVar}),` +
    `__cdl_mir=e=>({...e,left:Math.max(0,${windowVar}.width-e.left-e.width)});` +
    `return{anchor:${anchorVar},mascot:__cdl_mir(__cdl_m),placement:${placementVar},tray:__cdl_t==null?null:__cdl_mir(__cdl_t),viewport:${viewportVar},windowBounds:${windowVar}}` +
    `})()`;
  return currentSource.replace(layoutReturnRegex, replacement);
}

// Make the overlay BrowserWindow track the actual mascot+tray content
// instead of the upstream constant `viewport` (356×320). Upstream sizes the
// window to `viewport.width/height` and only uses `contentBounds` for
// positioning, which means the window keeps a 356×320 transparent footprint
// even when the tray is empty. We swap that so width/height follow
// contentBounds; the renderer continues to read layout.mascot.left/top to
// place the mascot relative to the (now-tighter) window.
function applyAvatarOverlayContentSizedWindowPatch(currentSource) {
  const sentinel = "/*overlay-content-sized*/";
  if (currentSource.includes(sentinel)) {
    return currentSource;
  }
  const fUReturnRegex =
    /function ([A-Za-z_$][\w$]*)\(\{contentBounds:([A-Za-z_$][\w$]*),displayBounds:([A-Za-z_$][\w$]*),viewport:([A-Za-z_$][\w$]*)\}\)\{return\{x:([A-Za-z_$][\w$]*)\(\2\.x\+\2\.width-\4\.width,\3\.x,\3\.x\+\3\.width-\4\.width\),y:\5\(\2\.y\+\2\.height-\4\.height,\3\.y,\3\.y\+\3\.height-\4\.height\),width:\4\.width,height:\4\.height\}/;
  const match = currentSource.match(fUReturnRegex);
  if (match == null) {
    if (currentSource.includes("avatar-overlay")) {
      console.warn(
        "WARN: Could not find avatar overlay window-bounds helper — skipping content-sized window patch",
      );
    }
    return currentSource;
  }
  const [, fnName, contentVar, displayVar, viewportVar, clampFn] = match;
  // Width/height now follow contentBounds. x/y still clamp the window to the
  // display so the overlay can't slide off-screen, but the upper clamp uses
  // contentBounds.width/height (the new window size) instead of viewport.
  const replacement =
    `function ${fnName}({contentBounds:${contentVar},displayBounds:${displayVar},viewport:${viewportVar}})` +
    `{${sentinel}return{` +
    `x:${clampFn}(${contentVar}.x,${displayVar}.x,${displayVar}.x+${displayVar}.width-${contentVar}.width),` +
    `y:${clampFn}(${contentVar}.y,${displayVar}.y,${displayVar}.y+${displayVar}.height-${contentVar}.height),` +
    `width:${contentVar}.width,height:${contentVar}.height}`;
  return currentSource.replace(fUReturnRegex, replacement);
}

// Floor the measured tray width at the upstream design width (276 px) so the
// content-sized window patch above doesn't get trapped in a bootstrap loop:
// when no notifications are present, the window shrinks to mascot width
// (~112), which would clip the tray DOM next frame and lock the window in
// the narrow state forever. Floor at 276 → main grows the window to 276+;
// next render the tray has room to lay out naturally and stays stable.
function applyAvatarOverlayTrayMinWidthPatch(currentSource) {
  const sentinel = "/*tray-min-width*/";
  if (currentSource.includes(sentinel)) {
    return currentSource;
  }
  const measureRegex =
    /let ([A-Za-z_$][\w$]*)=Math\.ceil\(([A-Za-z_$][\w$]*)\.offsetWidth>0\?\2\.offsetWidth:([A-Za-z_$][\w$]*)\.width\)/;
  const match = currentSource.match(measureRegex);
  if (match == null) {
    if (
      currentSource.includes("notification-tray") &&
      currentSource.includes("offsetWidth")
    ) {
      console.warn(
        "WARN: Could not find avatar overlay tray width measurement — skipping tray min-width patch",
      );
    }
    return currentSource;
  }
  const [, widthVar, elemVar, rectVar] = match;
  const replacement =
    `let ${widthVar}=${sentinel}Math.max(276,Math.ceil(${elemVar}.offsetWidth>0?${elemVar}.offsetWidth:${rectVar}.width))`;
  return currentSource.replace(measureRegex, replacement);
}

module.exports = {
  applyLinuxAvatarOverlayMousePassthroughPatch,
  applyMascotRightAlignPatch,
  applyAvatarOverlayContentSizedWindowPatch,
  applyAvatarOverlayTrayMinWidthPatch,
};
