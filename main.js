/* Notchly marketing site.
 *
 * Plain JS, no build step. Lottie animations come from window.NOTCHLY_LOTTIE
 * (assets/lottie-data.js) so the page also works opened from Finder.
 */
(() => {
  "use strict";

  const LOTTIE = window.NOTCHLY_LOTTIE || {};
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLASS_STATES = new Set(["music-expanded", "permission", "done", "airdrop"]);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---------------------------------------------------------------- Lottie

  /** Creates (once) and returns the animation for a [data-lottie] element. */
  function mount(el) {
    if (el._anim) return el._anim;
    const data = LOTTIE[el.dataset.lottie];
    if (!data || !window.lottie) return null;
    el._anim = window.lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop: el.dataset.loop !== "false",
      autoplay: false,
      // lottie-web mutates animationData, and several elements share one file.
      animationData: JSON.parse(JSON.stringify(data)),
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    if (el.dataset.speed) el._anim.setSpeed(parseFloat(el.dataset.speed));
    return el._anim;
  }

  function play(el, fromStart = false) {
    const anim = mount(el);
    if (!anim) return;
    if (!motionOK) {
      anim.goToAndStop(Math.floor(anim.totalFrames * 0.6), true);
      return;
    }
    if (fromStart || el.dataset.loop === "false") anim.goToAndPlay(0, true);
    else anim.play();
  }

  function pause(el) {
    if (el._anim) el._anim.pause();
  }

  function onComplete(el) {
    return new Promise((resolve) => {
      const anim = mount(el);
      if (!anim || !motionOK) return resolve();
      const done = () => {
        anim.removeEventListener("complete", done);
        resolve();
      };
      anim.addEventListener("complete", done);
    });
  }

  // ----------------------------------------------------------------- Notch

  const template = document.getElementById("notch-panes");

  class Notch {
    constructor(el) {
      this.el = el;
      el.appendChild(template.content.cloneNode(true));
      this.state = null;
      this.set(el.dataset.state || "idle");
    }

    pane(name) {
      return this.el.querySelector(`[data-pane="${name}"]`);
    }

    set(state) {
      if (state === this.state) return;
      const previous = this.state && this.pane(this.state);
      this.state = state;
      this.el.dataset.state = state;
      this.el.classList.toggle("is-glass", GLASS_STATES.has(state));

      if (previous) previous.querySelectorAll("[data-lottie]").forEach(pause);
      const current = this.pane(state);
      if (current && state !== "hello") {
        current.querySelectorAll("[data-lottie]").forEach((el) => play(el, true));
      }
    }
  }

  const heroNotch = new Notch(document.getElementById("hero-notch"));
  const storyNotch = new Notch(document.getElementById("story-notch"));

  // Scale the notch with its screen so phones see the whole card.
  function fitNotches() {
    document.querySelectorAll(".screen").forEach((screen) => {
      const wrap = screen.querySelector(".notch-wrap");
      if (wrap) wrap.style.setProperty("--s", clamp(screen.clientWidth / 700, 0.55, 1.25).toFixed(3));
    });
  }
  fitNotches();
  window.addEventListener("resize", fitNotches);

  // ------------------------------------------------------------ Hero intro

  // Mirrors the app's launch: idle notch → "hello" → "welcome" → music pill.
  // After that, hovering the notch opens the full player, as it does on a Mac.
  const hint = document.getElementById("hover-hint");

  async function heroIntro() {
    if (!motionOK) {
      heroNotch.set("music-compact");
      return enableHeroHover();
    }
    await wait(1100);
    heroNotch.set("hello");
    const [helloEl, welcomeEl] = heroNotch.pane("hello").querySelectorAll("[data-lottie]");
    await wait(350);
    play(helloEl, true);
    await onComplete(helloEl);
    helloEl.classList.add("is-hidden");
    welcomeEl.classList.remove("is-hidden");
    play(welcomeEl, true);
    await onComplete(welcomeEl);
    await wait(400);
    heroNotch.set("music-compact");
    enableHeroHover();
  }

  function enableHeroHover() {
    const wrap = heroNotch.el.parentElement;
    wrap.addEventListener("mouseenter", () => heroNotch.set("music-expanded"));
    wrap.addEventListener("mouseleave", () => setTimeout(() => {
      if (!wrap.matches(":hover")) heroNotch.set("music-compact");
    }, 250));
    // Touch: tap toggles.
    wrap.addEventListener("click", () => {
      heroNotch.set(heroNotch.state === "music-expanded" ? "music-compact" : "music-expanded");
    });
    if (window.matchMedia("(hover: none)").matches) hint.textContent = "Tap the notch";
    hint.classList.add("is-visible");
    wrap.addEventListener("mouseenter", () => hint.classList.remove("is-visible"), { once: true });
  }

  heroIntro();

  // ---------------------------------------------------------- Scroll story

  const story = document.getElementById("story");
  const captions = [...story.querySelectorAll(".story-caption")];
  const dots = [...story.querySelectorAll(".story-progress span")];
  let storyIndex = -1;

  function updateStory() {
    const rect = story.getBoundingClientRect();
    const scrollable = story.offsetHeight - window.innerHeight;
    const progress = clamp(-rect.top / scrollable, 0, 0.9999);
    const index = Math.floor(progress * captions.length);
    if (index === storyIndex) return;
    storyIndex = index;
    storyNotch.set(captions[index].dataset.state);
    captions.forEach((c, i) => c.classList.toggle("is-active", i === index));
    dots.forEach((d, i) => d.classList.toggle("is-on", i === index));
  }

  // --------------------------------------------------- Hero scroll parallax

  const heroCopy = document.querySelector(".hero-copy");
  const heroDevice = document.getElementById("hero-device");
  const nav = document.getElementById("nav");

  function updateHero() {
    const p = clamp(window.scrollY / window.innerHeight, 0, 1);
    nav.classList.toggle("is-scrolled", window.scrollY > 10);
    if (!motionOK) return;
    heroCopy.style.transform = `translateY(${-p * 80}px)`;
    heroCopy.style.opacity = String(1 - p * 1.3);
    heroDevice.style.transform = `scale(${1 + p * 0.08})`;
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHero();
      updateStory();
      ticking = false;
    });
  }, { passive: true });
  updateHero();
  updateStory();

  // --------------------------------------------------------------- Reveal

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

  // ------------------------------------- Standalone Lotties (outside notches)

  // Play only while on screen. One-shots replay each time they come back
  // into view, and `data-replay` re-runs them on an interval while visible.
  const lottieObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      clearInterval(el._replay);
      if (!entry.isIntersecting) return pause(el);
      play(el, true);
      if (el.dataset.replay && motionOK) {
        el._replay = setInterval(() => play(el, true), parseInt(el.dataset.replay, 10));
      }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll("[data-lottie]").forEach((el) => {
    if (!el.closest(".notch")) lottieObserver.observe(el);
  });

  // Pause the hero notch's mascots while it's scrolled away.
  new IntersectionObserver(([entry]) => {
    const pane = heroNotch.pane(heroNotch.state);
    if (!pane || heroNotch.state === "hello") return;
    pane.querySelectorAll("[data-lottie]").forEach((el) => (entry.isIntersecting ? play(el) : pause(el)));
  }).observe(heroNotch.el);

  // ----------------------------------------------------- Clock + turn timer

  function tickClock() {
    const now = new Date();
    const text = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    document.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = text));
  }
  tickClock();
  setInterval(tickClock, 15000);

  let turnSeconds = 42;
  setInterval(() => {
    turnSeconds += 1;
    const text = `${Math.floor(turnSeconds / 60)}:${String(turnSeconds % 60).padStart(2, "0")}`;
    document.querySelectorAll("[data-timer]").forEach((el) => (el.textContent = text));
  }, 1000);

})();
