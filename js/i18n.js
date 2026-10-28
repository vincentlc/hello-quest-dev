// ---------------------------------------------------------------------
// I18N: every piece of visible text, Spanish first (default language).
// LANG picks which one is live -- no language switcher yet (step 7's
// job), so this is the one place to change it by hand for now.
// ---------------------------------------------------------------------
export var I18N = {
  es: {
    instructionVR: '¡Apunta y aprieta el gatillo para lanzar bolas de nieve!',
    instructionDesktop: 'Haz clic para lanzar',
    hits: 'Golpes',
    destroyed: 'Muñecos destruidos',
    wave: 'Oleada',
    score: 'Puntos',
    welcomeTitle: '¡Bienvenido!',
    gameComplete: '¡Juego completado!',
    finalScore: 'Puntuación final',
    createdBy: 'Creado por Vincentlc',
    restartHint: 'Lanza una bola de nieve para volver a jugar'
  },
  en: {
    instructionVR: 'Aim and pull the trigger to throw snowballs!',
    instructionDesktop: 'Click to throw',
    hits: 'Hits',
    destroyed: 'Snowmen destroyed',
    wave: 'Wave',
    score: 'Score',
    welcomeTitle: 'Welcome!',
    gameComplete: 'Game complete!',
    finalScore: 'Final score',
    createdBy: 'Created by Vincentlc',
    restartHint: 'Throw a snowball to play again'
  }
};
export var LANG = 'es';

// Attribution text (step 7): required by the snowman model's CC-BY-4.0
// license (see ASSETS.md for the full legal text, also shown in the
// 2D-page #credit div). Names/titles/license names aren't translated --
// one shared string for both languages, shown on the in-VR end screen
// (end-screen.js) so the credit is visible inside the headset too, not
// just on the page outside it.
export var MODEL_CREDIT = '"Snowman" by alixor22 (Sketchfab), CC BY 4.0';
