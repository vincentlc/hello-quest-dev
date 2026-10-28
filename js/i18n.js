// ---------------------------------------------------------------------
// I18N: every piece of visible text, Spanish first (default language).
// LANG picks which one is live -- no language switcher yet (step 7's
// job), so this is the one place to change it by hand for now.
// ---------------------------------------------------------------------
export var I18N = {
  es: {
    instructionVR: 'Aprieta 3 veces para comenzar',
    instructionDesktop: 'Haz clic 3 veces para comenzar',
    shotsProgress: 'Lanzamientos',
    restartProgress: 'Lanzamientos para reiniciar',
    hits: 'Golpes',
    destroyed: 'Muñecos destruidos',
    wave: 'Oleada',
    score: 'Puntos',
    // "Te damos la bienvenida" instead of "¡Bienvenido!" -- gender-neutral
    // phrasing (no -o/-a ending to agree with the player's gender), per
    // the user's request. Subtitle no longer repeats "bienvenido" for the
    // same reason (and to avoid saying it twice) -- the title already
    // covers the welcome, the subtitle is pure tagline/branding now.
    welcomeTitle: 'Te damos la bienvenida',
    welcomeSubtitle: 'Snoworld Copito: el juego que desafía a los monos de nieve',
    gameComplete: '¡Juego completado!',
    finalScore: 'Puntuación final',
    bestScore: 'Mejor puntaje',
    newRecord: '¡Nuevo récord!',
    createdBy: 'Creado por Vincentlc',
    restartHint: 'Lanza 5 bolas de nieve para volver a jugar'
  },
  en: {
    instructionVR: 'Pull trigger 3 times to start',
    instructionDesktop: 'Click 3 times to start',
    shotsProgress: 'Throws',
    restartProgress: 'Throws to restart',
    hits: 'Hits',
    destroyed: 'Snowmen destroyed',
    wave: 'Wave',
    score: 'Score',
    welcomeTitle: 'Welcome!',
    welcomeSubtitle: 'Snoworld Copito: the game that takes on the snowmen',
    gameComplete: 'Game complete!',
    finalScore: 'Final score',
    bestScore: 'Best score',
    newRecord: 'New record!',
    createdBy: 'Created by Vincentlc',
    restartHint: 'Throw 5 snowballs to play again'
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
