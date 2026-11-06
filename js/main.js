// OG Events: animacje i interakcje (GSAP, ScrollTrigger, SplitText, Swiper)
document.documentElement.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGsap = typeof window.gsap !== "undefined";

if (hasGsap) {
	gsap.registerPlugin(ScrollTrigger);
	if (window.SplitText) gsap.registerPlugin(SplitText);
}

/* rok w stopce */
document.querySelectorAll("[data-year]").forEach((el) => {
	el.textContent = new Date().getFullYear();
});

/* nagłówek zwęża się po przewinięciu */
const header = document.querySelector(".site-header");
const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* aktywna pozycja menu */
const navLinks = [...document.querySelectorAll(".nav-links a[href^='#']")];
if (navLinks.length && "IntersectionObserver" in window) {
	const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id));
			});
		},
		{ rootMargin: "-45% 0px -50% 0px" }
	);
	sections.forEach((s) => io.observe(s));
}

/* polaroidy: przechylenie z atrybutu */
document.querySelectorAll(".polaroid[data-tilt]").forEach((p) => {
	p.style.setProperty("--tilt", p.dataset.tilt + "deg");
});

/* filmy: jeden gra naraz */
const videoCards = [...document.querySelectorAll(".polaroid-video")];
function pauseAll(except) {
	videoCards.forEach((card) => {
		const v = card.querySelector("video");
		if (v !== except && !v.paused) {
			v.pause();
			card.classList.remove("is-playing");
		}
	});
}
videoCards.forEach((card) => {
	const video = card.querySelector("video");
	const btn = card.querySelector(".play-btn");
	const toggle = () => {
		if (video.paused) {
			pauseAll(video);
			video.play().catch(() => {});
			card.classList.add("is-playing");
			btn.setAttribute("aria-label", "Zatrzymaj film");
		} else {
			video.pause();
			card.classList.remove("is-playing");
			btn.setAttribute("aria-label", "Odtwórz film");
		}
	};
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		toggle();
	});
	video.addEventListener("click", toggle);
});

/* galeria */
if (window.Swiper && document.querySelector(".gallery-swiper")) {
	new Swiper(".gallery-swiper", {
		effect: "cards",
		grabCursor: true,
		loop: true,
		cardsEffect: { perSlideOffset: 10, perSlideRotate: 4, slideShadows: false },
		navigation: { nextEl: ".gallery-next", prevEl: ".gallery-prev" },
		keyboard: { enabled: true },
		autoplay: reduceMotion ? false : { delay: 3800, disableOnInteraction: true }
	});
}

/* licznik w statystykach */
function runCounter(el) {
	const target = Number(el.dataset.count);
	const suffix = el.dataset.suffix || "";
	if (!hasGsap || reduceMotion) {
		el.textContent = target + suffix;
		return;
	}
	const obj = { v: 0 };
	gsap.to(obj, {
		v: target,
		duration: 1.8,
		ease: "power3.out",
		onUpdate: () => (el.textContent = Math.round(obj.v) + suffix)
	});
}

if (!hasGsap || reduceMotion) {
	document.querySelectorAll(".reveal").forEach((el) => el.classList.remove("reveal"));
} else {
	/* wejście hero */
	const title = document.querySelector(".hero-title");
	const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
	intro.from(".nav-pill", { y: -30, opacity: 0, duration: 0.9 });
	if (title && window.SplitText) {
		const split = new SplitText(title, { type: "lines,words", linesClass: "split-line" });
		intro.from(split.words, { yPercent: 110, opacity: 0, rotate: 3, duration: 1, stagger: 0.045 }, "-=0.5");
	}
	if (document.querySelector(".hero")) intro
		.from(".hero-eyebrow", { opacity: 0, x: -20, duration: 0.8 }, "<")
		.from(".hero-lead, .hero-actions", { opacity: 0, y: 20, duration: 0.8, stagger: 0.12 }, "-=0.6")
		.from(
			".hero .polaroid",
			{
				opacity: 0,
				y: 80,
				rotate: (i) => (i % 2 ? 18 : -18),
				scale: 0.85,
				duration: 1.1,
				stagger: 0.12,
				ease: "back.out(1.4)"
			},
			"-=1"
		);

	/* polaroidy delikatnie odpływają przy przewijaniu */
	gsap.utils.toArray(".hero .polaroid").forEach((p, i) => {
		gsap.to(p, {
			yPercent: i % 2 ? -10 : -22,
			ease: "none",
			scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
		});
	});

	/* tła hero oddychają */
	gsap.to(".blob-1", { x: -40, y: 30, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
	gsap.to(".blob-2", { x: 50, y: -30, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });
	gsap.to(".blob-3", { scale: 1.25, duration: 7, repeat: -1, yoyo: true, ease: "sine.inOut" });

	/* iskierki */
	const sparkleBox = document.querySelector(".sparkles");
	if (sparkleBox) {
		for (let i = 0; i < 18; i++) {
			const s = document.createElement("span");
			s.className = "sparkle";
			s.textContent = i % 3 ? "✦" : "♡";
			s.style.left = gsap.utils.random(2, 98) + "%";
			s.style.top = gsap.utils.random(10, 95) + "%";
			s.style.fontSize = gsap.utils.random(8, 18) + "px";
			if (i % 3 === 0) s.style.color = "#d897a9";
			sparkleBox.appendChild(s);
			gsap.to(s, {
				opacity: gsap.utils.random(0.35, 0.8),
				y: gsap.utils.random(-60, -140),
				rotate: gsap.utils.random(-40, 40),
				duration: gsap.utils.random(4, 8),
				delay: gsap.utils.random(0, 5),
				repeat: -1,
				yoyo: true,
				ease: "sine.inOut"
			});
		}
	}

	/* pasek z napisami: niekończący się przesuw */
	const track = document.querySelector(".marquee-track");
	if (track) {
		track.innerHTML += track.innerHTML;
		const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
		ScrollTrigger.create({
			onUpdate: (self) => gsap.to(loop, { timeScale: self.direction === 1 ? 1 : -1, duration: 0.4, overwrite: true })
		});
	}

	/* odsłanianie sekcji */
	gsap.utils.toArray(".reveal").forEach((el) => {
		gsap.to(el, {
			opacity: 1,
			y: 0,
			duration: 1,
			ease: "power3.out",
			scrollTrigger: { trigger: el, start: "top 85%" }
		});
	});

	/* nagłówki sekcji słowo po słowie */
	if (window.SplitText) {
		gsap.utils.toArray(".section-title, .footer-title").forEach((h) => {
			const split = new SplitText(h, { type: "words" });
			gsap.from(split.words, {
				yPercent: 60,
				opacity: 0,
				duration: 0.9,
				stagger: 0.06,
				ease: "power3.out",
				scrollTrigger: { trigger: h, start: "top 85%" }
			});
		});
	}

	/* karty oferty */
	gsap.from(".offer-card", {
		opacity: 0,
		y: 60,
		rotate: (i) => (i % 2 ? 2 : -2),
		duration: 1,
		stagger: 0.1,
		ease: "power3.out",
		scrollTrigger: { trigger: ".offer-grid", start: "top 80%" }
	});

	/* kroki */
	gsap.from(".step-num", {
		scale: 0.4,
		opacity: 0,
		duration: 0.8,
		stagger: 0.15,
		ease: "back.out(2)",
		scrollTrigger: { trigger: ".steps-list", start: "top 80%" }
	});

	/* liczniki */
	document.querySelectorAll(".stat-num[data-count]").forEach((el) => {
		ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: () => runCounter(el) });
	});

	/* telefon w stopce */
	gsap.from(".footer-phone", {
		scale: 0.8,
		opacity: 0,
		duration: 1,
		ease: "back.out(1.6)",
		scrollTrigger: { trigger: ".footer-phone", start: "top 90%" }
	});

	/* podstrony: zdjęcie i treść */
	if (document.querySelector(".subpage")) {
		gsap.from(".subpage h1, .subpage-lead, .breadcrumbs", { opacity: 0, y: 30, duration: 1, stagger: 0.12, ease: "power3.out" });
		gsap.from(".subpage-hero", { opacity: 0, y: 60, rotate: -8, duration: 1.2, delay: 0.3, ease: "back.out(1.3)" });
		gsap.utils.toArray(".subpage-content h2, .subpage-list li, .subpage-cta").forEach((el) => {
			gsap.from(el, { opacity: 0, y: 24, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
		});
	}
}

/* odpowiedzi FAQ rozwijają się płynnie */
document.querySelectorAll(".faq-item details, .subpage-content details").forEach((d) => {
	const summary = d.querySelector("summary");
	const body = summary.nextElementSibling;
	if (!body || !hasGsap || reduceMotion) return;
	summary.addEventListener("click", (e) => {
		e.preventDefault();
		if (d.open) {
			gsap.to(body, { height: 0, opacity: 0, duration: 0.35, ease: "power2.in", onComplete: () => (d.open = false) });
		} else {
			d.open = true;
			gsap.fromTo(body, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.5, ease: "power3.out" });
		}
	});
});
