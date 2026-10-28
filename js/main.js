// ---------------------------------------------------------------------
// main.js: the page's one entry point (loaded as <script type="module">
// from index.html, after vendor/aframe.min.js). Its only job is to pull
// in every module that needs to run before A-Frame attaches the
// <a-scene> markup's components -- registering an AFRAME component is
// a side effect of importing its file, so import order here doesn't
// need to match any particular dependency order, only "before the
// scene's own component-attach pass", which static ES imports guarantee
// (they all resolve and run before this file's own body continues).
//
// This file replaces what used to be one ~1700-line inline <script> in
// index.html; see js/config.js, js/i18n.js, js/core/, js/data/,
// js/registry/, and js/components/ for where everything moved to. No
// behavior changed in the move -- every function/method body is
// untouched, only relocated into smaller, single-purpose files.
// ---------------------------------------------------------------------
import './core/desktop-aim.js';

import './components/controller-aim.js';
import './components/mirror-tile.js';
import './components/snowball-thrower.js';
import './components/trajectory-preview.js';
import './components/wave-director.js';
import './components/wave-hud.js';
import './components/end-screen.js';
import './components/welcome-screen.js';
import './components/snowman/snowman-component.js';
