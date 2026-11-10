(() => {
  "use strict";
  const story = document.getElementById("portfolio-story");
  const title = document.getElementById("story-title");
  const film = document.getElementById("story-film");
  const video = story.querySelector("video");
  const filmError = story.querySelector(".story-video-error");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let opener = null;
  function goTo(section) {
    if (!section) return;
    section.querySelector("h3")?.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" });
  }
  document.addEventListener("click", (event) => {
    const entry = event.target.closest("[data-story-open]");
    if (!entry || story.open) return;
    opener = entry;
    document.querySelectorAll("video").forEach((item) => item.pause());
    story.showModal();
    story.scrollTo({ top: 0, behavior: "instant" });
    title.focus({ preventScroll: true });
    document.dispatchEvent(new Event("portfolio:story-change"));
    if (entry.dataset.storyTarget) goTo(document.getElementById(entry.dataset.storyTarget));
  });
  story.addEventListener("close", () => {
    video.pause();
    document.dispatchEvent(new Event("portfolio:story-change"));
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  story.addEventListener("cancel", () => video.pause());
  story.querySelectorAll("[data-story-close]").forEach((button) => button.addEventListener("click", () => { video.pause(); story.close(); }));
  story.querySelectorAll(".story-index a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      goTo(document.getElementById(link.hash.slice(1)));
    });
  });
  story.querySelector("[data-story-play]").addEventListener("click", () => {
    goTo(film);
    video.play().catch(() => {
      if (video.error) filmError.hidden = false;
      video.focus({ preventScroll: true });
    });
  });
  video.addEventListener("error", () => { filmError.hidden = false; });
})();
