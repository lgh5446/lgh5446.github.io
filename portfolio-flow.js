(() => {
  "use strict";
  const navigator = document.querySelector(".story-navigator");
  if (!navigator) return;
  const choices = [...navigator.querySelectorAll("[data-story-select]")];
  const panels = [...navigator.querySelectorAll("[data-story-preview]")];
  const list = navigator.querySelector(".story-choices");
  list.setAttribute("role", "tablist");
  choices.forEach((choice, index) => {
    choice.setAttribute("role", "tab");
    choice.setAttribute("aria-controls", panels[index].id);
    panels[index].setAttribute("role", "tabpanel");
    panels[index].setAttribute("aria-labelledby", choice.id);
  });
  function select(index, focus = false) {
    choices.forEach((choice, position) => {
      const selected = position === index;
      choice.setAttribute("aria-selected", String(selected));
      choice.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
    if (focus) choices[index].focus({ preventScroll: true });
  }
  function selectedFromHash() {
    const index = panels.findIndex((panel) => `#${panel.id}` === window.location.hash);
    if (index >= 0) select(index);
    return index;
  }
  choices.forEach((choice, index) => {
    choice.addEventListener("click", (event) => {
      event.preventDefault();
      select(index);
    });
    choice.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % choices.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + choices.length) % choices.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = choices.length - 1;
      else if (event.key === " ") next = index;
      else return;
      event.preventDefault();
      select(next, true);
    });
  });
  navigator.classList.add("enhanced");
  if (selectedFromHash() < 0) select(0);
  window.addEventListener("hashchange", selectedFromHash);
})();
