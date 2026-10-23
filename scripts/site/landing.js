// Scroll animations for the home. Without Motion or with Reduce Motion (no js-motion class) the page stays in its final state.
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("js-motion")) return;
  // If Motion is missing or init throws, drop the class so sections and photos show in their final state.
  if (!window.Motion) {
    root.classList.remove("js-motion");
    return;
  }
  try {
    init();
    root.dataset.motion = "on";
  } catch (error) {
    root.classList.remove("js-motion");
  }

  function init() {
    var animate = window.Motion.animate;
    var scroll = window.Motion.scroll;
    var inView = window.Motion.inView;
    var stagger = window.Motion.stagger;

    // inView stops watching an element after the first entrance (the callback returns no leave handler).
    // Keyframes go through `y`, not `transform: "none"`: Motion turns "none" into a zero-scale matrix and the section vanishes.
    document.querySelectorAll("[data-enter]").forEach(function (el) {
      inView(
        el,
        function () {
          animate(el, { opacity: [0, 1], y: [16, 0] }, { duration: 0.6, ease: "easeOut" });
        },
        { amount: 0.2 },
      );
    });

    var section = document.getElementById("revelado");
    var photos = section ? section.querySelectorAll(".photo[data-reveal]") : [];
    if (section && photos.length) {
      scroll(
        animate(
          photos,
          { filter: ["blur(10px) sepia(.8)", "blur(0px) sepia(0)"] },
          { duration: 1, ease: "linear", delay: stagger(0.5 / photos.length) },
        ),
        { target: section, offset: ["start end", "center center"] },
      );
    }
  }
})();
