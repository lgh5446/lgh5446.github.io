(() => {
"use strict";
const { PLANETS } = window.PortfolioData;
const cv = document.getElementById("stage");
const ctx = cv.getContext("2d", {alpha:false});
if (!ctx) return;
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduce = motionQuery.matches;
let userPaused = reduce;
let inViewport = false;
const sceneElement = cv.parentElement;
const motionButton = document.getElementById("orbit-motion");
const shouldAnimate = () => inViewport && !userPaused && !document.hidden && !document.querySelector("dialog[open]");

let W=0,H=0,DPR=1,CX=0,CY=0;
const cam = {yaw:0.62, pitch:0.94, dist:640, fov:700, targetYaw:0.62, targetPitch:0.94, targetDist:640};

function resize(){
  DPR = Math.min(window.devicePixelRatio||1, window.innerWidth < 768 ? 1.5 : 2);
  W = sceneElement.clientWidth; H = sceneElement.clientHeight;
  cv.width = W*DPR; cv.height = H*DPR;
  cv.style.width = W+"px"; cv.style.height = H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
  CX = W*0.5; CY = H*0.5;
  const base = Math.min(W,H);
  cam.targetDist = W < 480 ? 1120 : 880;
  if(!started) cam.dist = cam.targetDist;
  cam.fov = W < 480 ? 560 : 680;
}
let started=false;

/* 3D → 2D */
function project(x,y,z){
  const cy=Math.cos(cam.yaw), sy=Math.sin(cam.yaw);
  let x1 = x*cy - z*sy;
  let z1 = x*sy + z*cy;
  const cp=Math.cos(cam.pitch), sp=Math.sin(cam.pitch);
  let y1 = y*cp - z1*sp;
  let z2 = y*sp + z1*cp;
  const den = z2 + cam.dist;
  if(den < 12) return null;
  const f = cam.fov/den;
  return {x:CX + x1*f, y:CY + y1*f, f:f, d:den};
}

/* orbit position → 3D */
function orbitPos(p, ang){
  let x = Math.cos(ang)*p.r, z = Math.sin(ang)*p.r, y = 0;
  const ci=Math.cos(p.inc), si=Math.sin(p.inc);
  let y2 = y*ci - z*si, z2 = y*si + z*ci;
  const cn=Math.cos(p.node), sn=Math.sin(p.node);
  let x3 = x*cn - z2*sn, z3 = x*sn + z2*cn;
  return {x:x3, y:y2, z:z3};
}

/* starfield */
const STARS=[];
for(let i=0;i<460;i++){
  const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), R=780+Math.random()*1500;
  STARS.push({x:R*Math.sin(ph)*Math.cos(th), y:R*Math.cos(ph)*0.6, z:R*Math.sin(ph)*Math.sin(th), m:Math.random()});
}
/* galactic disc particles (참조 이미지의 중심 나선) */
const DISC=[];
for(let i=0;i<1500;i++){
  const arm = i%2, t=Math.pow(Math.random(),0.62);
  const ang = t*4.4 + arm*Math.PI + (Math.random()-0.5)*0.46;
  const rad = 14 + t*118 + (Math.random()-0.5)*22;
  DISC.push({a:ang, r:rad, y:(Math.random()-0.5)*13*(1-t*0.62), m:Math.random(), t:t});
}
/* faint outer halo of the disc */
const HALO=[];
for(let i=0;i<420;i++){
  const t=Math.random();
  HALO.push({a:Math.random()*6.283, r:130+t*96, y:(Math.random()-0.5)*10, m:Math.random()});
}

let t0=performance.now(), tAcc=0;
let hover=null, active=null;
const screenPos = new Map();
let orbitFrame;

function draw(now){
  orbitFrame = null;
  const dt = Math.min(now-t0, 48); t0=now;
  if(shouldAnimate()) tAcc += dt;

  cam.yaw += (cam.targetYaw-cam.yaw)*(shouldAnimate()?0.075:1);
  cam.pitch += (cam.targetPitch-cam.pitch)*(shouldAnimate()?0.075:1);
  cam.dist += (cam.targetDist-cam.dist)*(shouldAnimate()?0.075:1);

  ctx.fillStyle="#080B14";
  ctx.fillRect(0,0,W,H);

  /* stars */
  for(const s of STARS){
    const p=project(s.x,s.y,s.z); if(!p) continue;
    const a=(0.16+s.m*0.5)*Math.min(1,p.f*2.4);
    ctx.fillStyle="rgba(200,214,236,"+a.toFixed(3)+")";
    ctx.fillRect(p.x, p.y, 1.15, 1.15);
  }

  /* galactic disc — additive spiral */
  const spin = tAcc*0.000045;
  ctx.globalCompositeOperation="lighter";
  for(const h of HALO){
    const a=h.a+spin*0.5;
    const p=project(Math.cos(a)*h.r, h.y, Math.sin(a)*h.r); if(!p) continue;
    const al=0.055*h.m*Math.min(1,p.f*2.2);
    ctx.fillStyle="rgba(214,124,58,"+al.toFixed(3)+")";
    ctx.fillRect(p.x,p.y,1.4,1.4);
  }
  for(const d of DISC){
    const a=d.a+spin*(1.55-d.t*0.72);
    const p=project(Math.cos(a)*d.r, d.y, Math.sin(a)*d.r); if(!p) continue;
    const core=1-d.t;
    const al=(0.055+core*0.30)*(0.35+d.m*0.65)*Math.min(1,p.f*2.4);
    const g=Math.round(146+core*74), b=Math.round(74+core*72);
    ctx.fillStyle="rgba(255,"+g+","+b+","+al.toFixed(3)+")";
    const s=1.1+core*1.05;
    ctx.fillRect(p.x,p.y,s,s);
  }
  ctx.globalCompositeOperation="source-over";

  /* core glow */
  const cp0=project(0,0,0);
  if(cp0){
    const gR=Math.max(46, 132*cp0.f);
    const g=ctx.createRadialGradient(cp0.x,cp0.y,0,cp0.x,cp0.y,gR);
    g.addColorStop(0,"rgba(255,206,133,.95)");
    g.addColorStop(.16,"rgba(255,178,96,.52)");
    g.addColorStop(.42,"rgba(224,132,60,.20)");
    g.addColorStop(1,"rgba(180,90,40,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cp0.x,cp0.y,gR,0,6.283); ctx.fill();
  }

  /* orbit rings */
  for(const p of PLANETS){
    const on = (active===p.key)||(hover===p.key);
    ctx.beginPath();
    let first=true, broke=false;
    for(let i=0;i<=96;i++){
      const a=(i/96)*6.283;
      const q=orbitPos(p,a); const pr=project(q.x,q.y,q.z);
      if(!pr){broke=true;continue;}
      if(first||broke){ctx.moveTo(pr.x,pr.y);first=false;broke=false;}
      else ctx.lineTo(pr.x,pr.y);
    }
    ctx.strokeStyle = on ? "rgba(255,196,107,.62)" : "rgba(232,148,74,.19)";
    ctx.lineWidth = on ? 1.3 : 0.85;
    ctx.stroke();
  }

  /* planets */
  screenPos.clear();
  /* 라벨 충돌 회피용 점유 박스 — 중심 라벨을 먼저 예약 */
  const boxes=[];
  if(cp0){
    const cr0=Math.max(7,20*cp0.f);
    boxes.push({x:cp0.x-52, y:cp0.y+cr0+7, w:104, h:17});
  }
  const items=[];
  for(const p of PLANETS){
    const ang = p.phase + tAcc*p.speed;
    const q = orbitPos(p, ang);
    const pr = project(q.x,q.y,q.z);
    if(!pr) continue;
    items.push({p,pr,q});
  }
  items.sort((a,b)=>b.pr.d-a.pr.d);

  /* connective lines core→planet */
  for(const it of items){
    if(!cp0) break;
    const on=(active===it.p.key)||(hover===it.p.key);
    ctx.beginPath();
    ctx.moveTo(cp0.x,cp0.y); ctx.lineTo(it.pr.x,it.pr.y);
    ctx.strokeStyle = on?"rgba(255,196,107,.34)":"rgba(232,148,74,.085)";
    ctx.lineWidth = on?1:0.6;
    ctx.stroke();
  }

  for(const it of items){
    const {p,pr}=it;
    const on=(active===p.key)||(hover===p.key);
    const rad=Math.max(3.2, p.size*pr.f*1.02)*(on?1.32:1);
    screenPos.set(p.key,{x:pr.x,y:pr.y,r:Math.max(rad,15)});

    const hg=ctx.createRadialGradient(pr.x,pr.y,0,pr.x,pr.y,rad*4.2);
    hg.addColorStop(0,p.hue+(on?"77":"44"));
    hg.addColorStop(1,p.hue+"00");
    ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(pr.x,pr.y,rad*4.2,0,6.283); ctx.fill();

    /* mini accretion rings — 참조 이미지의 노드 질감 */
    const flat=Math.abs(Math.cos(cam.pitch))*0.78+0.13;
    for(let ri=1;ri<=3;ri++){
      const rr=rad*(1.75+ri*0.92);
      ctx.beginPath();
      ctx.ellipse(pr.x,pr.y,rr,rr*flat,-cam.yaw*0.42,0,6.283);
      ctx.strokeStyle="rgba(232,148,74,"+((on?0.30:0.17)/ri).toFixed(3)+")";
      ctx.lineWidth=0.75; ctx.stroke();
    }

    const bg=ctx.createRadialGradient(pr.x-rad*.38,pr.y-rad*.38,rad*.1,pr.x,pr.y,rad);
    bg.addColorStop(0,"#FFE0B4"); bg.addColorStop(.42,p.hue); bg.addColorStop(1,"#3A1E10");
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(pr.x,pr.y,rad,0,6.283); ctx.fill();

    if(on){
      ctx.beginPath(); ctx.arc(pr.x,pr.y,rad+6,0,6.283);
      ctx.strokeStyle="rgba(255,206,133,.72)"; ctx.lineWidth=1.1; ctx.stroke();
    }

    /* 좁은 화면에서는 라벨이 뭉치므로 선택·호버된 것만 표시 */
    if(W<=860 && !on) continue;

    const lbl=p.label.toUpperCase();
    ctx.font = (on?"500 ":"400 ")+"10.5px 'IBM Plex Mono', monospace";
    ctx.textAlign="left"; ctx.textBaseline="middle";
    const tw=ctx.measureText(lbl).width;
    /* 우측 칩/여백에 부딪히면 라벨을 왼쪽으로 뒤집는다 */
    const guardR = 18;
    const flip = (pr.x + rad + 15 + tw) > (W - guardR);
    const tx = flip ? (pr.x - rad - 13 - tw) : (pr.x + rad + 13);

    /* 이미 그려진 라벨과 겹치면 세로로 밀어낸다 */
    let ty = pr.y;
    const hits = b => !(tx-4+tw+8 < b.x || tx-4 > b.x+b.w || ty-8+16 < b.y || ty-8 > b.y+b.h);
    for(let k=0;k<7;k++){
      if(!boxes.some(hits)) break;
      ty += (k%2===0 ? 1 : -1) * (18 + Math.floor(k/2)*4);
    }
    boxes.push({x:tx-4, y:ty-8, w:tw+8, h:16});

    ctx.fillStyle="rgba(8,11,20,.72)";
    ctx.fillRect(tx-4, ty-8, tw+8, 16);
    ctx.fillStyle= on?"#FFC46B":"rgba(216,224,238,.68)";
    ctx.fillText(lbl,tx,ty);
    /* 밀려난 라벨은 행성과 가는 선으로 잇는다 */
    if(Math.abs(ty-pr.y)>3){
      ctx.beginPath();
      ctx.moveTo(flip?tx+tw+4:tx-4, ty);
      ctx.lineTo(pr.x + (flip?-rad-3:rad+3), pr.y);
      ctx.strokeStyle="rgba(216,224,238,.22)"; ctx.lineWidth=.6; ctx.stroke();
    }
  }

  /* core body */
  if(cp0){
    const pulse = reduce?1:(1+Math.sin(tAcc*0.0016)*0.045);
    const cr=Math.max(7,20*cp0.f)*pulse;
    const cg=ctx.createRadialGradient(cp0.x,cp0.y,0,cp0.x,cp0.y,cr);
    cg.addColorStop(0,"#FFF4DE"); cg.addColorStop(.5,"#FFC46B"); cg.addColorStop(1,"#E07A2E");
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(cp0.x,cp0.y,cr,0,6.283); ctx.fill();
    screenPos.set("__core",{x:cp0.x,y:cp0.y,r:Math.max(cr,20)});

    ctx.font="700 10.5px 'IBM Plex Mono', monospace";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle="rgba(8,11,20,.68)";
    const cw=ctx.measureText("LEE GEONHO").width;
    ctx.fillRect(cp0.x-cw/2-5, cp0.y+cr+8, cw+10, 15);
    ctx.fillStyle="#FFC46B";
    ctx.fillText("LEE GEONHO", cp0.x, cp0.y+cr+15.5);
  }

  if(shouldAnimate()) orbitFrame=requestAnimationFrame(draw);
}


function syncOrbit() {
  if (orbitFrame) cancelAnimationFrame(orbitFrame);
  orbitFrame = null;
  cv.dataset.animationState = shouldAnimate() ? "running" : "paused";
  if (document.hidden) return;
  t0 = performance.now();
  orbitFrame = requestAnimationFrame(draw);
}
function syncMotionButton() {
  motionButton.setAttribute("aria-pressed", String(userPaused));
  motionButton.innerHTML = userPaused ? '<span aria-hidden="true">▶</span> 움직임 재생' : '<span aria-hidden="true">Ⅱ</span> 움직임 일시정지';
  syncOrbit();
}
function hit(mx, my) {
  let best = null, distance = Infinity;
  for (const [key, point] of screenPos) {
    const d = Math.hypot(mx - point.x, my - point.y);
    if (d < point.r + 13 && d < distance) { distance = d; best = key; }
  }
  return best;
}
function localPoint(event) {
  const box = cv.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}
let dragging = false, moved = 0, lx = 0, ly = 0;
cv.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" || event.button !== 0) return;
  dragging = true; moved = 0; lx = event.clientX; ly = event.clientY;
  cv.classList.add("dragging"); cv.setPointerCapture(event.pointerId);
});
cv.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  if (dragging) {
    const dx = event.clientX - lx, dy = event.clientY - ly;
    moved += Math.abs(dx) + Math.abs(dy);
    cam.targetYaw += dx * 0.0052;
    cam.targetPitch = Math.max(-1.42, Math.min(1.42, cam.targetPitch + dy * 0.0042));
    lx = event.clientX; ly = event.clientY;
  } else {
    const point = localPoint(event);
    hover = hit(point.x, point.y);
    cv.style.cursor = hover ? "pointer" : "grab";
  }
  if (!shouldAnimate()) syncOrbit();
});
cv.addEventListener("pointerup", (event) => {
  if (!dragging) return;
  dragging = false; cv.classList.remove("dragging");
  if (moved < 7) {
    const point = localPoint(event), key = hit(point.x, point.y);
    if (key) window.PortfolioUI.openDetail(key, document.querySelector('.domain-link[data-detail-key="' + key + '"]'));
  }
});
cv.addEventListener("pointercancel", () => { dragging = false; cv.classList.remove("dragging"); });
cv.addEventListener("pointerleave", () => { if (!dragging) { hover = null; if (!shouldAnimate()) syncOrbit(); } });
motionButton.addEventListener("click", () => { userPaused = !userPaused; syncMotionButton(); });
document.getElementById("orbit-zoom-in").addEventListener("click", () => { cam.targetDist = Math.max(560, cam.targetDist - 100); syncOrbit(); });
document.getElementById("orbit-zoom-out").addEventListener("click", () => { cam.targetDist = Math.min(1500, cam.targetDist + 100); syncOrbit(); });
document.getElementById("orbit-reset").addEventListener("click", () => { cam.targetYaw = 0.62; cam.targetPitch = 0.94; resize(); syncOrbit(); });
document.addEventListener("portfolio:domain-highlight", (event) => { active = event.detail.key; syncOrbit(); });
document.addEventListener("portfolio:domain-preview", (event) => { hover = event.detail.key; if (!shouldAnimate()) syncOrbit(); });
document.addEventListener("portfolio:modal-change", syncOrbit);
document.addEventListener("visibilitychange", syncOrbit);
motionQuery.addEventListener("change", () => { reduce = motionQuery.matches; userPaused = reduce; syncMotionButton(); });
new ResizeObserver(() => { resize(); syncOrbit(); }).observe(sceneElement);
new IntersectionObserver((entries) => { inViewport = entries[0].isIntersecting; syncOrbit(); }, { threshold: 0.05 }).observe(sceneElement);
resize(); started = true; syncMotionButton();

})();
