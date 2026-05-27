"use strict";

const {
  webviewAssetPatch,
} = require("../../../../descriptor.js");
const {
  applyAvatarOverlayTrayMinWidthPatch,
} = require("../../../../impl/avatar-overlay.js");

module.exports = [
  webviewAssetPatch({
    id: "avatar-overlay-tray-min-width",
    phase: "webview-asset",
    order: 1060,
    ciPolicy: "required-upstream",
    pattern: /^avatar-overlay-page-.*\.js$/,
    missingDescription: "avatar overlay page webview bundle",
    skipDescription: "avatar overlay tray min-width patch",
    apply: applyAvatarOverlayTrayMinWidthPatch,
  }),
];
