// ---------------------------------------------------------------------
// DesktopAim: live mouse position in normalized device coordinates
// (-1 to 1), shared by snowball-thrower (desktop throw direction) and
// trajectory-preview (desktop arc). A plain object with one listener,
// not a component, since nothing here is tied to a specific entity.
// ---------------------------------------------------------------------
export var DesktopAim = { x: 0, y: 0 };
window.addEventListener('mousemove', function (evt) {
  DesktopAim.x = (evt.clientX / window.innerWidth) * 2 - 1;
  DesktopAim.y = -(evt.clientY / window.innerHeight) * 2 + 1;
});
