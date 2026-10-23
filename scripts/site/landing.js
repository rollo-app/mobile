// Scroll animations for the home. Without Motion or with Reduce Motion (no js-motion class) the page stays in its final state.
(function () {
  if (!window.Motion || !document.documentElement.classList.contains("js-motion")) return;
  var animate = Motion.animate;
  var scroll = Motion.scroll;
  var inView = Motion.inView;
  var stagger = Motion.stagger;

  document.querySelectorAll("[data-enter]").forEach(function (el) {
    inView(
      el,
      function () {
        animate(el, { opacity: 1, transform: "none" }, { duration: 0.6, ease: "easeOut" });
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
})();
