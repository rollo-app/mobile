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
        // amount "some" (threshold 0), not a number: a numeric amount is a fraction of the element's own height, and a tall stacked
        // section on a short landscape phone never reaches it. The negative bottom margin still waits until it is a bit inside.
        { amount: "some", margin: "0px 0px -10% 0px" },
      );
    });

    initMoment(inView);

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

  // Plays the daily-moment Lottie once when its section comes into view, then holds. The static SVG in the markup is the
  // fallback: it is only hidden once the animation's DOM exists, and any failure leaves it visible.
  function initMoment(inView) {
    var section = document.getElementById("momento");
    if (!section || !window.lottie || !window.matchMedia) return;
    inView(
      section,
      function () {
        try {
          var mark = section.querySelector(".moment-mark");
          var container = section.querySelector(".moment-anim");
          if (!mark || !container) return;
          var scheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          var anim = window.lottie.loadAnimation({
            container: container,
            renderer: "svg",
            loop: false,
            autoplay: true,
            path: "/moment-intro-" + scheme + ".json",
          });
          anim.addEventListener("DOMLoaded", function () {
            mark.classList.add("playing");
          });
        } catch (error) {
          // keep the static SVG
        }
      },
      { amount: 0.5 },
    );
  }
})();
