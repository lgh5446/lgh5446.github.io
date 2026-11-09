(() => {
  "use strict";

  const story = document.getElementById("portfolio-story");
  const title = document.getElementById("story-title");
  const film = document.getElementById("story-film");
  const video = story.querySelector("video");
  const filmError = story.querySelector(".story-video-error");
  let opener;

  function goTo(section) {
    section.querySelector("h3").focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  }

  document.addEventListener("click", (event) => {
    const entry = event.target.closest("[data-story-open]");
    if (!entry || story.open) return;

    opener = entry;
    story.showModal();
    story.scrollTo({ top: 0, behavior: "instant" });
    title.focus({ preventScroll: true });
    video.poster = "assets/story/tools.webp";
    document.dispatchEvent(new Event("portfolio:story-change"));
  });

  story.addEventListener("close", () => {
    if (story.open) return;
    video.pause();
    opener?.focus({ preventScroll: true });
    document.dispatchEvent(new Event("portfolio:story-change"));
  });

  story.querySelectorAll("[data-story-close]").forEach((button) => {
    button.addEventListener("click", () => story.close());
  });

  story.querySelectorAll(".story-index a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      goTo(document.getElementById(link.hash.slice(1)));
    });
  });

  story.querySelector("[data-story-play]").addEventListener("click", () => {
    goTo(film);
    video.play().catch(() => {
      if (story.open) video.focus({ preventScroll: true });
    });
  });

  video.addEventListener("error", () => { filmError.hidden = false; });
})();
