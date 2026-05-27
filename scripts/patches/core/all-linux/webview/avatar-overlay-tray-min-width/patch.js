"use strict";

const {
  applyAvatarOverlayTrayMinWidthPatch,
} = require("../../../../avatar-overlay.js");

module.exports = [
  {
    id: "avatar-overlay-tray-min-width",
    phase: "webview-asset",
    order: 1060,
    ciPolicy: "required-upstream",
    pattern: /^avatar-overlay-page-.*\.js$/,
    missingDescription: "avatar overlay page webview bundle",
    skipDescription: "avatar overlay tray min-width patch",
    apply: applyAvatarOverlayTrayMinWidthPatch,
  },
];
