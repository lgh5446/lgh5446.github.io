(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const { PLANETS, CORE } = window.PortfolioData;
  const domains = [{ key: "__core", label: "Profile", ...CORE }, ...PLANETS];
  const byKey = new Map(domains.map((domain) => [domain.key, domain]));
  const panel = document.getElementById("panel");
  const title = document.getElementById("pt");
  const subtitle = document.getElementById("ps");
  const body = document.getElementById("pb");
  const story = document.getElementById("portfolio-story");
  let panelOpener = null;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function announceModalChange() {
    document.body.classList.toggle("modal-open", panel.open || story.open);
    document.dispatchEvent(new Event("portfolio:modal-change"));
  }
  function highlightDomain(key) {
    document.querySelectorAll(".domain-link").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.detailKey === key)));
    document.dispatchEvent(new CustomEvent("portfolio:domain-highlight", { detail: { key } }));
  }
  function openDetail(key, trigger) {
    const domain = byKey.get(key);
    if (!domain) return;
    if (!panel.open) {
      panelOpener = trigger instanceof HTMLElement ? trigger : document.activeElement;
      if (!panelOpener || panelOpener === document.body || panelOpener.tagName === "CANVAS") panelOpener = document.querySelector(`.domain-link[data-detail-key="${key}"]`);
    }
    const position = domains.findIndex((item) => item.key === key);
    document.getElementById("pi").textContent = key === "__core" ? "Profile · Core" : `Orbit ${String(position).padStart(2, "0")} · ${domain.label}`;
    title.textContent = domain.title;
    subtitle.textContent = domain.sub || "";
    const facts = domain.facts.map(([value, label]) => `<div class="fact"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join("");
    const groups = domain.groups.map((group) => `<section class="grp"><h3>${escapeHtml(group.h)}</h3><ul>${group.items.map((item) => `<li>${item}</li>`).join("")}</ul></section>`).join("");
    const repository = domain.link ? `<section class="grp"><h3>공개 개발 기록</h3><a class="link" href="${escapeHtml(domain.link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(domain.link.text)} ↗</a></section>` : "";
    const skills = `<section class="grp"><h3>${key === "__core" ? "관련 실무·학습 영역 15가지" : "관련 실무·학습 영역"}</h3><div class="tags">${domain.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></section>`;
    const storyEntry = key === "__core" ? '<button class="story-entry" type="button" data-story-open aria-haspopup="dialog" aria-controls="portfolio-story">제가 일하는 방향 <span aria-hidden="true">↗</span></button>' : "";
    const next = domains[(position + 1) % domains.length];
    body.innerHTML = `${storyEntry}<p class="lede">${escapeHtml(domain.lede)}</p><div class="facts">${facts}</div>${groups}${repository}${skills}<button class="button panel-next" type="button" data-detail-key="${next.key}">다음 영역: ${escapeHtml(next.label)} <span aria-hidden="true">→</span></button>`;
    if (!panel.open) panel.showModal();
    panel.classList.add("open");
    panel.scrollTo({ top: 0, behavior: "instant" });
    title.focus({ preventScroll: true });
    highlightDomain(key);
    document.querySelectorAll("video").forEach((video) => video.pause());
    announceModalChange();
  }
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-detail-key]");
    if (trigger) openDetail(trigger.dataset.detailKey, trigger);
  });
  document.getElementById("pc").addEventListener("click", () => panel.close());
  panel.addEventListener("cancel", (event) => { if (story.open) event.preventDefault(); });
  panel.addEventListener("click", (event) => {
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) panel.close();
  });
  panel.addEventListener("close", () => {
    panel.classList.remove("open");
    highlightDomain(null);
    announceModalChange();
    if (panelOpener?.isConnected) panelOpener.focus({ preventScroll: true });
  });
  document.addEventListener("portfolio:story-change", announceModalChange);
  [panel, story].forEach((dialog) => {
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !dialog.open || (dialog === panel && story.open)) return;
      const controls = [...dialog.querySelectorAll('a[href], button, input, select, textarea, summary, video[controls], [tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.disabled && !element.closest('[hidden], [inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      const active = document.activeElement;
      if (!controls.includes(active) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
  });
  window.PortfolioUI = { openDetail, highlightDomain };

  // HTML fallbacks remain readable without scripts; panels and summaries share this data.
  document.querySelectorAll("[data-summary-key]").forEach((element) => {
    const domain = byKey.get(element.dataset.summaryKey);
    if (domain) element.textContent = domain.lede;
  });
  document.querySelectorAll(".domain-link").forEach((button) => {
    const preview = (key) => { if (!panel.open) document.dispatchEvent(new CustomEvent("portfolio:domain-preview", { detail: { key } })); };
    button.addEventListener("focus", () => preview(button.dataset.detailKey));
    button.addEventListener("pointerenter", () => preview(button.dataset.detailKey));
    button.addEventListener("blur", () => preview(null));
    button.addEventListener("pointerleave", () => preview(null));
  });

  const menu = document.querySelector(".menu-toggle");
  const navigation = document.getElementById("site-navigation");
  const mobile = window.matchMedia("(max-width: 767px)");
  function setMenu(open, returnFocus = false) {
    const expanded = mobile.matches && open;
    menu.setAttribute("aria-expanded", String(expanded));
    menu.setAttribute("aria-label", expanded ? "메뉴 닫기" : "메뉴 열기");
    navigation.hidden = mobile.matches && !expanded;
    if (returnFocus) menu.focus();
  }
  menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
  mobile.addEventListener("change", () => setMenu(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") setMenu(false, true);
  });
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    setMenu(false);
    const heading = document.querySelector(link.hash)?.querySelector("h2");
    if (heading) { heading.tabIndex = -1; requestAnimationFrame(() => heading.focus({ preventScroll: true })); }
  }));
  setMenu(false);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (!reducedMotion.matches) entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navigation.querySelectorAll("a").forEach((link) => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-10% 0px -65% 0px" });
    document.querySelectorAll("#practice, #career, #credentials, #person, #direction, #contact").forEach((section) => sectionObserver.observe(section));
  }
  const film = document.getElementById("direction-film");
  film.addEventListener("error", () => { document.getElementById("direction-film-error").hidden = false; });
  document.querySelectorAll("video").forEach((video) => {
    video.addEventListener("play", () => document.querySelectorAll("video").forEach((other) => { if (other !== video) other.pause(); }));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) document.querySelectorAll("video").forEach((video) => video.pause());
  });
})();
