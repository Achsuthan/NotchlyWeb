/* Notchly marketing site.
 *
 * Plain JS, no build step. Lottie animations come from window.NOTCHLY_LOTTIE
 * (assets/lottie-data.js) so the page also works opened from Finder.
 */
(() => {
  "use strict";

  const LOTTIE = window.NOTCHLY_LOTTIE || {};
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLASS_STATES = new Set(["music-expanded", "permission", "done", "airdrop", "home", "transfers"]);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  // lottie-web mutates animationData, and several elements share one file.
  const cloneData = (name) => JSON.parse(JSON.stringify(LOTTIE[name]));

  // ---------------------------------------------------------------- Lottie

  /** Creates (once) and returns the animation for a [data-lottie] element. */
  function mount(el) {
    if (el._anim) return el._anim;
    if (!LOTTIE[el.dataset.lottie] || !window.lottie) return null;
    el._anim = window.lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop: el.dataset.loop !== "false",
      autoplay: false,
      animationData: cloneData(el.dataset.lottie),
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

  // ---------------------------------------------------------------- Sounds

  // The app's mascot sounds (assets/sounds, AAC). They only ever play in
  // response to a click, and the toggle is remembered per visitor.
  const Sound = {
    enabled: true,
    cache: {},
    init() {
      try { this.enabled = localStorage.getItem("notchly-sound") !== "off"; } catch (_) { /* private mode */ }
      const button = document.getElementById("sound-toggle");
      const sync = () => {
        button.setAttribute("aria-pressed", String(this.enabled));
        button.querySelector("span").textContent = this.enabled ? "Sound on" : "Sound off";
      };
      button.addEventListener("click", () => {
        this.enabled = !this.enabled;
        try { localStorage.setItem("notchly-sound", this.enabled ? "on" : "off"); } catch (_) { /* ignore */ }
        sync();
      });
      sync();
    },
    play(name) {
      if (!this.enabled) return;
      const audio = this.cache[name] || (this.cache[name] = new Audio(`assets/sounds/${name}.m4a`));
      audio.volume = 0.6;
      audio.currentTime = 0;
      audio.play().catch(() => { /* blocked or missing: stay silent */ });
    },
  };
  Sound.init();

  // ----------------------------------------------------------------- Notchy

  // A small take on the app's HomeMascot: a random activity (played once)
  // that hands over to a fidgety idle loop, with a new activity every ~10s;
  // asleep at night; pokes get a giggle, a spin or hearts. The site carries
  // a curated subset of the app's activities to keep the page light.
  const TAPS = ["notchy_home_tap_giggle", "notchy_home_tap_spin", "notchy_home_tap_hearts"];
  // Mostly the plain idle; sometimes a look around or a happy bounce.
  const IDLES = ["notchy_home_idle", "notchy_home_idle", "notchy_home_idle_look", "notchy_home_idle_bounce"];
  const ACTIVITIES = [
    "notchy_home_wave", "notchy_home_yawn", "notchy_home_peek", "notchy_home_juggle",
    "notchy_home_dance", "notchy_home_guitar", "notchy_home_kite", "notchy_home_magic",
    "notchy_home_paint", "notchy_home_read",
  ];
  const ACTIVITY_EVERY = 10000;

  function isNight(hour = new Date().getHours()) { return hour >= 22 || hour < 5; }

  /** Same time-of-day rules as the app: the greeting is the likeliest pick,
   *  coffee is morning-only and stargazing an after-dark one. */
  function activitiesForNow() {
    const hour = new Date().getHours();
    const pool = [...ACTIVITIES];
    if (hour >= 5 && hour < 11) pool.push("notchy_home_morning", "notchy_home_morning", "notchy_home_coffee");
    if (hour >= 17 && hour < 22) pool.push("notchy_home_evening", "notchy_home_evening");
    if (hour >= 19 || hour < 5) pool.push("notchy_home_stargaze");
    return pool;
  }

  class Buddy {
    constructor(el) {
      this.el = el;
      this.phase = "none";
      this.lastTap = null;
    }

    load(name, loop) {
      if (this.anim) this.anim.destroy();
      this.name = name;
      this.anim = window.lottie.loadAnimation({
        container: this.el,
        renderer: "svg",
        loop,
        autoplay: motionOK,
        animationData: cloneData(name),
      });
      if (!motionOK) this.anim.goToAndStop(Math.floor(this.anim.totalFrames * 0.5), true);
      return this.anim;
    }

    once(name, then) {
      const anim = this.load(name, false);
      if (!motionOK) return then();
      anim.addEventListener("complete", () => { if (this.name === name) then(); });
    }

    idle() {
      this.phase = "idle";
      this.idleSince = Date.now();
      this.load(pick(IDLES), true);
    }

    sleep() { this.phase = "sleep"; this.load("notchy_home_sleep", true); }

    hello() {
      if (isNight()) return this.sleep();
      this.activity();
    }

    activity() {
      this.phase = "activity";
      const options = activitiesForNow().filter((name) => name !== this.lastActivity);
      this.lastActivity = pick(options);
      this.once(this.lastActivity, () => this.idle());
    }

    /** Called on a timer while visible: a new activity after a calm spell. */
    tick() {
      if (this.phase === "idle" && motionOK && Date.now() - this.idleSince >= ACTIVITY_EVERY) this.activity();
    }

    poke() {
      if (this.phase === "tap") return;
      if (this.phase === "sleep") {
        this.phase = "tap";
        Sound.play("notchy_home_wake");
        return this.once("notchy_home_wake", () => this.idle());
      }
      this.phase = "tap";
      const tap = pick(TAPS.filter((t) => t !== this.lastTap));
      this.lastTap = tap;
      Sound.play(tap);
      this.once(tap, () => this.idle());
    }

    pause() { this.paused = true; if (this.anim) this.anim.pause(); }
    resume() { this.paused = false; if (this.anim && motionOK) this.anim.play(); }
  }

  const buddies = [];
  setInterval(() => buddies.forEach((b) => !b.paused && b.tick()), 1000);

  // ----------------------------------------------------------------- Notch

  const template = document.getElementById("notch-panes");

  class Notch {
    constructor(el) {
      this.el = el;
      el.appendChild(template.content.cloneNode(true));
      const buddyEl = el.querySelector("[data-buddy]");
      this.buddy = new Buddy(buddyEl);
      buddies.push(this.buddy);
      el.querySelector(".home-mascot").addEventListener("click", (event) => {
        event.stopPropagation(); // don't also toggle the notch on touch
        this.buddy.poke();
      });
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
      if (state === "home") { this.buddy.paused = false; this.buddy.hello(); }
      else this.buddy.pause();
      const current = this.pane(state);
      if (current && state !== "hello") {
        current.querySelectorAll("[data-lottie]").forEach((el) => play(el, true));
      }
    }
  }

  const heroNotch = new Notch(document.getElementById("hero-notch"));
  const storyNotch = new Notch(document.getElementById("story-notch"));

  // The screen's contents are laid out at 960px wide (see .screen-canvas) and
  // scaled to the actual screen, so phones see a true-to-life miniature.
  function fitScreens() {
    document.querySelectorAll(".screen").forEach((screen) => {
      const canvas = screen.querySelector(".screen-canvas");
      if (canvas) canvas.style.setProperty("--k", (screen.clientWidth / 960).toFixed(4));
    });
  }
  fitScreens();
  window.addEventListener("resize", fitScreens);

  // ------------------------------------------------------------ Hero intro

  // Mirrors the app's launch: idle notch → "hello" → "welcome" → the quiet
  // notch (clock + Notchy). Hovering opens the Home page, as on a Mac.
  const hint = document.getElementById("hover-hint");

  async function heroIntro() {
    if (!motionOK) {
      heroNotch.set("idle-home");
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
    heroNotch.set("idle-home");
    enableHeroHover();
  }

  function enableHeroHover() {
    const wrap = heroNotch.el.parentElement;
    wrap.addEventListener("mouseenter", () => heroNotch.set("home"));
    wrap.addEventListener("mouseleave", () => setTimeout(() => {
      if (!wrap.matches(":hover")) heroNotch.set("idle-home");
    }, 250));
    // Touch: tapping anywhere on the screen toggles — the life-size notch is
    // too small a target on a phone.
    wrap.closest(".screen").addEventListener("click", () => {
      heroNotch.set(heroNotch.state === "home" ? "idle-home" : "home");
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
    if (heroNotch.state === "home") entry.isIntersecting ? heroNotch.buddy.resume() : heroNotch.buddy.pause();
  }).observe(heroNotch.el);

  // ------------------------------------------------------- Meet Notchy section

  const bigBuddy = new Buddy(document.querySelector("#buddy [data-buddy]"));
  bigBuddy.paused = true;
  buddies.push(bigBuddy);
  document.getElementById("buddy").addEventListener("click", () => bigBuddy.poke());
  let bigBuddyStarted = false;
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return bigBuddy.pause();
    if (bigBuddyStarted) return bigBuddy.resume();
    bigBuddyStarted = true;
    bigBuddy.paused = false;
    bigBuddy.hello();
  }, { threshold: 0.3 }).observe(document.getElementById("buddy"));

  // Mood tiles: click to replay the moment with its sound.
  document.querySelectorAll(".mascot[data-sound]").forEach((tile) => {
    tile.addEventListener("click", () => {
      Sound.play(tile.dataset.sound);
      const art = tile.querySelector("[data-lottie]");
      if (art) play(art, true);
    });
  });

  // ------------------------------------------- Clocks, greeting, live demos

  const uses12h = new Intl.DateTimeFormat([], { hour: "numeric" }).resolvedOptions().hour12 === true;

  function greeting(hour) {
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 22) return "Good evening";
    return "Hello, night owl";
  }

  function tickClock() {
    const now = new Date();
    const menu = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    // Like the app: the hour and minutes, with AM/PM as a separate small label.
    const short = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: uses12h })
      .replace(/\s?[AP]\.?M\.?$/i, "");
    const ampm = uses12h ? (now.getHours() < 12 ? "AM" : "PM") : "";
    const date = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    const set = (selector, text) => document.querySelectorAll(selector).forEach((el) => (el.textContent = text));
    set("[data-clock]", menu);
    set("[data-clock-short], [data-clock-big]", short);
    set("[data-ampm]", ampm);
    set("[data-greeting]", greeting(now.getHours()));
    set("[data-date]", date);
  }
  tickClock();
  setInterval(tickClock, 15000);

  let turnSeconds = 42;
  setInterval(() => {
    turnSeconds += 1;
    const text = `${Math.floor(turnSeconds / 60)}:${String(turnSeconds % 60).padStart(2, "0")}`;
    document.querySelectorAll("[data-timer]").forEach((el) => (el.textContent = text));
  }, 1000);

  // Download rows in the Transfers pane fill up and start over.
  const TOTAL_MB = 3;
  setInterval(() => {
    document.querySelectorAll(".tr-bar i[data-progress]").forEach((bar) => {
      let value = parseFloat(bar.dataset.progress) + parseFloat(bar.dataset.rate || "0.03");
      if (value > 1.04) value = 0.04;
      bar.dataset.progress = String(value);
      bar.style.width = `${Math.min(value, 1) * 100}%`;
      const meta = bar.closest(".tr-info").querySelector("[data-progress-meta]");
      if (meta) {
        const done = Math.min(value, 1) * TOTAL_MB;
        meta.textContent = value >= 1
          ? "Done · Show in Finder"
          : `${done.toFixed(1)} MB of ${TOTAL_MB} MB · ${Math.max(1, Math.ceil((1 - value) / 0.06))} s left`;
      }
    });
  }, 500);
})();
