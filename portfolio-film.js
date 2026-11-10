(() => {
  "use strict";
  const captions = [
    {start:0,end:3,lines:["이건호","저는 이런 사람입니다"]},
    {start:3,end:8,lines:["혼자 떠난 배낭여행에서"]},
    {start:8,end:12,lines:["이동과 숙박을 함께 정했습니다."]},
    {start:12,end:19,lines:["저는 대체로 무던하고","상대의 사정을 먼저 들으려 합니다."]},
    {start:19,end:25.5,lines:["낯선 일에 먼저 나서거나,","제 기여를 설명할 때는 주저했습니다."]},
    {start:25.5,end:30,lines:["지금은 배울 내용과 기한을","먼저 말합니다."]},
    {start:30,end:37,lines:["공부를 이어가던 시간,","아버지의 농사일도 도왔습니다."]},
    {start:37,end:44,lines:["모내기와 농번기에 일손을 보태고","논에 물을 대는 일을 도왔습니다."]},
    {start:44,end:50.5,lines:["요즘은 AI 도구를","제 작업에 맞게 구성합니다."]},
    {start:50.5,end:57.5,lines:["제가 한 일은 근거와 함께 남기고","부족한 부분은 다시 살펴봅니다."]},
    {start:57.5,end:60.5,lines:["모르는 것은 배우고","맡은 일은 끝까지."]}
  ];
  const refresh = [];
  document.querySelectorAll("[data-portfolio-film]").forEach((video) => {
    const output = document.querySelector(`[data-film-caption-for="${video.id}"]`);
    const text = output?.querySelector(".film-current-text");
    if (!text) return;
    let activated = false;
    let current = -1;
    const update = () => {
      if (!activated) return;
      const time = Math.max(0, video.currentTime || 0);
      const index = time >= captions[captions.length - 1].end
        ? captions.length - 1
        : captions.findIndex((cue) => time >= cue.start && time < cue.end);
      if (index < 0) return;
      if (index !== current) {
        text.textContent = captions[index].lines.join("\n");
        current = index;
      }
      if (output.hidden) output.hidden = false;
    };
    const activate = () => { activated = true; update(); };
    video.addEventListener("play", activate);
    video.addEventListener("seeked", activate);
    ["timeupdate", "pause", "ended", "loadedmetadata"].forEach((event) => video.addEventListener(event, update));
    refresh.push(update);
  });
  window.addEventListener("resize", () => refresh.forEach((update) => update()));
})();
