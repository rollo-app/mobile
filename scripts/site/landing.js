// Scroll animations for the home. Without Motion or with Reduce Motion (no js-motion class) the page stays in its final state.
(function () {
  var root = document.documentElement;
  // Reduced motion: the hero video goes back to its poster. Runs before the js-motion check (that class is never set then).
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var videos = document.querySelectorAll(".hero-video");
      for (var i = 0; i < videos.length; i++) {
        videos[i].removeAttribute("autoplay");
        videos[i].pause();
        videos[i].load();
      }
    }
  } catch (error) {
    // keep the video as is
  }
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
    var inView = window.Motion.inView;

    // inView stops watching an element after the first entrance (the callback returns no leave handler).
    // Keyframes go through `y`, not `transform: "none"`: Motion turns "none" into a zero-scale matrix and the section vanishes.
    document.querySelectorAll("[data-enter]").forEach(function (el) {
      inView(
        el,
        function () {
          animate(el, { opacity: [0, 1], y: [16, 0] }, { duration: 0.6, ease: "easeOut" });
        },
        // amount "some" (threshold 0), not a number: a numeric amount is a fraction of the element's own height, and a tall stacked
        // section on a short landscape phone never reaches it. The negative bottom margin still waits until it is a bit inside.
        { amount: "some", margin: "0px 0px -10% 0px" },
      );
    });
  }
})();
