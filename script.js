/* app.js — zoptymalizowana i zorganizowana wersja
   Zachowuje wszystkie oryginalne funkcje (BEZ ZMIANY UI/UX).
   Sekcje:
   1) IIFE + inicjalizacja
   2) Loader
   3) Analytics CTA
   4) Gallery / Carousel (incl. autoplay, touch, keyboard)
   5) Lightbox
   6) Scroll / GSAP animations / ScrollTrigger setup
   7) Video controls (single play/pause logic, start times)
   8) Misc: overlays, hover fallback, intersection pause, rAF gate
   Eksport do window: nextImage, prevImage, showLocationsOverlay, hideLocationsOverlay,
                     closeLightbox, nextLightboxImage, prevLightboxImage
*/

(function (window, document) {
	"use strict";

	// ---------------------------
	//  Utilities
	// ---------------------------
	const $ = (sel, parent = document) => parent.querySelector(sel);
	const $$ = (sel, parent = document) =>
		Array.prototype.slice.call(parent.querySelectorAll(sel));
	const noop = () => {};
	const safeCall = (fn) => {
		try {
			return fn();
		} catch (e) {
			// swallow — keep site alive
			console.warn("safeCall error", e);
		}
	};

	// ---------------------------
	//  SECTION: LOADER
	// ---------------------------
	(function initLoader() {
		const loader = $("#page-loader");
		if (!loader) return;

		let timeout = null;
		const hideLoader = () => {
			if (!loader) return;
			loader.classList.add("hidden");
			// remove from flow after transition (keeps original behavior)
			setTimeout(() => {
				loader.style.display = "none";
			}, 500);
		};

		// hide after 2s unless window.load arrives first
		timeout = setTimeout(hideLoader, 2000);
		window.addEventListener(
			"load",
			() => {
				clearTimeout(timeout);
				hideLoader();
			},
			{ passive: true }
		);
	})();

	// ---------------------------
	//  SECTION: Analytics CTA
	// ---------------------------
	(function trackCTA() {
		const ctalink = document.querySelectorAll('a[href="#contact"]');
		if (!ctalink || !ctalink.length) return;
		ctalink.forEach((el) =>
			el.addEventListener("click", () => {
				// safe gtag call
				try {
					if (typeof gtag === "function")
						gtag("event", "contact_click");
				} catch (e) {
					// ignore if analytics not present
				}
			})
		);
	})();

	// ---------------------------
	//  SECTION: GALLERY / CAROUSEL
	// ---------------------------
	const Gallery = (function () {
		let galleryImages = [];
		let currentIndex = 1;
		let isAnimating = false;
		let autoPlayInterval = null;
		let isAutoPlayActive = false;

		// touch tracking
		let touchStartX = 0,
			touchEndX = 0,
			touchStartY = 0,
			touchEndY = 0;

		function collectImages() {
			const slideImages = $$(".image-slide img");
			galleryImages = [];
			slideImages.forEach((img, idx) => {
				const src = img.dataset.src || img.src;
				if (src) {
					galleryImages.push({
						src,
						alt: img.alt || `Gallery image ${idx + 1}`,
					});
				}
			});
			// ensure at least 3 images for carousel visual
			const original = galleryImages.length;
			while (galleryImages.length < 3 && original > 0) {
				galleryImages = galleryImages.concat(
					galleryImages.slice(
						0,
						Math.min(original, 3 - galleryImages.length)
					)
				);
			}
			currentIndex = galleryImages.length > 1 ? 1 : 0;
		}

		function preloadImages() {
			if (!galleryImages.length) return;
			if (typeof window.requestIdleCallback === "function") {
				window.requestIdleCallback(() => {
					galleryImages.forEach((img) => {
						const link = document.createElement("link");
						link.rel = "preload";
						link.as = "image";
						link.href = img.src;
						document.head.appendChild(link);
					});
				});
			} else {
				setTimeout(() => {
					galleryImages.forEach((img) => {
						const i = new Image();
						i.src = img.src;
					});
				}, 100);
			}
		}

		// Simple lazy loading without WebP conversion
		function loadMediaSafely(media) {
			if (!media.dataset.src) return;

			media.onload = function () {
				media.classList.add("loaded");
			};

			media.onerror = function () {
				console.warn("Failed to load media:", media.dataset.src);
				// Fallback placeholder (dla wideo możesz dodać poster lub komunikat)
				if (media.tagName === "VIDEO") {
					media.poster =
						"data:image/svg+xml;base64," +
						btoa(
							'<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">Wideo niedostępne</text></svg>'
						);
				} else {
					media.src =
						"data:image/svg+xml;base64," +
						btoa(
							'<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">Obraz niedostępny</text></svg>'
						);
				}
				media.classList.add("loaded", "error");
			};

			media.src = media.dataset.src;
			if (media.tagName === "VIDEO") {
				media.load(); // Wymuś załadowanie dla wideo
			}
		}

		// Intersection Observer for lazy loading
		if ("IntersectionObserver" in window) {
			const mediaObserver = new IntersectionObserver(
				(entries, observer) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							const media = entry.target;
							loadMediaSafely(media);
							observer.unobserve(media);
						}
					});
				},
				{
					rootMargin: "50px 0px",
					threshold: 0.1,
				}
			);

			document.addEventListener("DOMContentLoaded", function () {
				document
					.querySelectorAll("img[data-src], video[data-src]")
					.forEach((media) => {
						// Add loading class for CSS styling
						media.classList.add("lazy-loading");
						mediaObserver.observe(media);
					});
			});
		} else {
			// Fallback for older browsers
			document.addEventListener("DOMContentLoaded", function () {
				document
					.querySelectorAll("img[data-src], video[data-src]")
					.forEach(loadMediaSafely);
			});
		}

		function loadImageSafely(img, src, alt) {
			if (!img) return;
			img.src = src;
			if (alt) img.alt = alt;
			img.onerror = function () {
				console.warn("Failed to swap gallery image:", src);
				this.src =
					"data:image/svg+xml;base64," +
					btoa(
						'<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">Brak obrazu</text></svg>'
					);
			};
		}

		function updateCarousel() {
			if (isAnimating || galleryImages.length === 0) return;
			isAnimating = true;

			const leftSlide = $(".image-slide-left img");
			const centerSlide = $(".image-slide-center img");
			const rightSlide = $(".image-slide-right img");

			if (!leftSlide || !centerSlide || !rightSlide) {
				isAnimating = false;
				return;
			}

			const leftIndex =
				(currentIndex - 1 + galleryImages.length) %
				galleryImages.length;
			const rightIndex = (currentIndex + 1) % galleryImages.length;

			const tl = gsap.timeline({
				onComplete: () => {
					isAnimating = false;
				},
			});

			tl.to([leftSlide, centerSlide, rightSlide], {
				opacity: 0,
				scale: 0.9,
				rotateY: 15,
				duration: 0.3,
				ease: "power2.inOut",
			})
				.call(() => {
					loadImageSafely(
						leftSlide,
						galleryImages[leftIndex].src,
						galleryImages[leftIndex].alt
					);
					loadImageSafely(
						centerSlide,
						galleryImages[currentIndex].src,
						galleryImages[currentIndex].alt
					);
					loadImageSafely(
						rightSlide,
						galleryImages[rightIndex].src,
						galleryImages[rightIndex].alt
					);
				})
				.to(
					[leftSlide, rightSlide],
					{
						opacity: 0.6,
						scale: 1,
						rotateY: 0,
						duration: 0.4,
						ease: "power2.out",
					},
					"+=0.1"
				)
				.to(
					centerSlide,
					{
						opacity: 1,
						scale: 1,
						rotateY: 0,
						duration: 0.4,
						ease: "power2.out",
					},
					"-=0.3"
				)
				.to(
					centerSlide,
					{
						scale: 1.02,
						duration: 0.2,
						ease: "power2.inOut",
						yoyo: true,
						repeat: 1,
					},
					"-=0.2"
				);
		}

		function nextImage() {
			if (isAnimating || galleryImages.length === 0) return;
			currentIndex = (currentIndex + 1) % galleryImages.length;
			const rightButton = $(".carousel-arrow-right");
			if (rightButton) {
				gsap.to(rightButton, {
					scale: 0.9,
					rotation: 5,
					duration: 0.1,
					ease: "power2.inOut",
					yoyo: true,
					repeat: 1,
				});
			}
			updateCarousel();
		}

		function prevImage() {
			if (isAnimating || galleryImages.length === 0) return;
			currentIndex =
				(currentIndex - 1 + galleryImages.length) %
				galleryImages.length;
			const leftButton = $(".carousel-arrow-left");
			if (leftButton) {
				gsap.to(leftButton, {
					scale: 0.9,
					rotation: -5,
					duration: 0.1,
					ease: "power2.inOut",
					yoyo: true,
					repeat: 1,
				});
			}
			updateCarousel();
		}

		function startAutoPlay(interval = 5000) {
			if (galleryImages.length <= 1) return;
			stopAutoPlay();
			isAutoPlayActive = true;
			autoPlayInterval = setInterval(() => {
				if (!isAnimating && isAutoPlayActive) nextImage();
			}, interval);
		}
		function stopAutoPlay() {
			if (autoPlayInterval) {
				clearInterval(autoPlayInterval);
				autoPlayInterval = null;
			}
			isAutoPlayActive = false;
		}
		function pauseAutoPlay() {
			isAutoPlayActive = false;
		}
		function resumeAutoPlay() {
			isAutoPlayActive = true;
		}

		function handleTouchStart(e) {
			touchStartX = e.changedTouches[0].screenX;
			touchStartY = e.changedTouches[0].screenY;
			pauseAutoPlay();
		}
		function handleTouchEnd(e) {
			touchEndX = e.changedTouches[0].screenX;
			touchEndY = e.changedTouches[0].screenY;
			handleGesture();
			// resume after a bit if autoplay was active
			setTimeout(() => {
				if (isAutoPlayActive) resumeAutoPlay();
			}, 3000);
		}
		function handleGesture() {
			const threshold = 50;
			const restraint = 100;
			const diffX = touchStartX - touchEndX;
			const diffY = Math.abs(touchStartY - touchEndY);
			if (Math.abs(diffX) > threshold && diffY < restraint) {
				if (diffX > 0) nextImage();
				else prevImage();
			}
		}

		// Public init
		function init() {
			collectImages();
			preloadImages();
			updateCarousel();
			// attach carousel gestures & hover
			const carousel = $(".image-carousel");
			if (carousel) {
				carousel.addEventListener("touchstart", handleTouchStart, {
					passive: true,
				});
				carousel.addEventListener("touchend", handleTouchEnd, {
					passive: true,
				});
				carousel.addEventListener("mouseenter", pauseAutoPlay);
				carousel.addEventListener("mouseleave", resumeAutoPlay);
				setTimeout(() => startAutoPlay(6000), 2000);
			}
			// keyboard nav
			document.addEventListener("keydown", (e) => {
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					prevImage();
				} else if (e.key === "ArrowRight") {
					e.preventDefault();
					nextImage();
				} else if (e.key === " ") {
					e.preventDefault();
					if (isAutoPlayActive) stopAutoPlay();
					else startAutoPlay();
				}
			});
		}

		// Expose minimal API
		return {
			init,
			nextImage,
			prevImage,
			startAutoPlay,
			stopAutoPlay,
			pauseAutoPlay,
			resumeAutoPlay,
		};
	})();

	// Expose global functions required by HTML onclick attributes
	window.nextImage = Gallery.nextImage;
	window.prevImage = Gallery.prevImage;
	window.startAutoPlay = Gallery.startAutoPlay;
	window.stopAutoPlay = Gallery.stopAutoPlay;

	// ---------------------------
	//  SECTION: LIGHTBOX
	// ---------------------------
	const Lightbox = (function () {
		let lightboxImages = [];
		let currentLightboxIndex = 0;
		let isLightboxOpen = false;

		function collectLightboxImages() {
			const gallerySlides = $$(".image-slide img");
			lightboxImages = [];
			gallerySlides.forEach((img, index) => {
				const src = img.dataset.src || img.src;
				if (src && !src.includes("data:image/svg+xml")) {
					lightboxImages.push({
						src,
						alt: img.alt || `Gallery image ${index + 1}`,
						index,
					});
				}
				// click listeners added later to avoid duplicates
			});
		}

		function createLightboxHTML() {
			if ($("#lightboxOverlay")) return;
			const html = `
				<div id="lightboxOverlay" class="lightbox-overlay" aria-hidden="true">
					<div class="lightbox-container">
						<button class="lightbox-close" onclick="closeLightbox()" aria-label="Zamknij galerię">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
						</button>
						<button class="lightbox-arrow lightbox-arrow-left" onclick="prevLightboxImage()" aria-label="Poprzedni obraz">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</button>
						<button class="lightbox-arrow lightbox-arrow-right" onclick="nextLightboxImage()" aria-label="Następny obraz">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</button>
						<div class="lightbox-image-container">
							<img id="lightboxImage" src="" alt="" />
							<div class="lightbox-loading"><div class="loading-spinner"></div></div>
						</div>
						<div class="lightbox-counter"><span id="lightboxCurrentNumber">1</span> / <span id="lightboxTotalNumber">1</span></div>
						<div class="lightbox-thumbnails" id="lightboxThumbnails"></div>
					</div>
				</div>`;
			document.body.insertAdjacentHTML("beforeend", html);
		}

		function openLightboxAt(index) {
			if (!lightboxImages.length) return;
			currentLightboxIndex = index;
			isLightboxOpen = true;
			const overlay = $("#lightboxOverlay");
			const body = document.body;
			if (!overlay) return;
			body.style.overflow = "hidden";
			overlay.classList.add("active");
			pauseIfCarousel(); // stop carousel autoplay
			updateLightboxContent();
			generateThumbnails();
			document.addEventListener("keydown", handleLightboxKeyboard);
			// attach touch gestures to image container
			const container = $(".lightbox-image-container");
			if (container) {
				container.addEventListener(
					"touchstart",
					handleLightboxTouchStart,
					{ passive: true }
				);
				container.addEventListener("touchend", handleLightboxTouchEnd, {
					passive: true,
				});
			}
		}

		function closeLightbox() {
			const overlay = $("#lightboxOverlay");
			if (!overlay) return;
			overlay.classList.remove("active");
			isLightboxOpen = false;
			document.body.style.overflow = "";
			// resume carousel after a short delay (keeps UX)
			setTimeout(() => {
				Gallery.resumeAutoPlay && Gallery.resumeAutoPlay();
			}, 500);
			document.removeEventListener("keydown", handleLightboxKeyboard);
		}

		function updateLightboxContent() {
			if (!lightboxImages.length) return;
			const lightboxImage = $("#lightboxImage");
			const currentNumberEl = $("#lightboxCurrentNumber");
			const totalNumberEl = $("#lightboxTotalNumber");
			const loadingEl = document.querySelector(".lightbox-loading");

			const currentImage = lightboxImages[currentLightboxIndex];
			if (currentNumberEl)
				currentNumberEl.textContent = currentLightboxIndex + 1;
			if (totalNumberEl)
				totalNumberEl.textContent = lightboxImages.length;
			if (loadingEl) loadingEl.style.display = "flex";
			if (!lightboxImage) return;
			lightboxImage.style.opacity = "0";

			lightboxImage.onload = function () {
				if (loadingEl) loadingEl.style.display = "none";
				gsap.to(lightboxImage, {
					opacity: 1,
					scale: 1,
					x: 0,
					duration: 0.4,
					ease: "power2.out",
				});
			};
			lightboxImage.onerror = function () {
				if (loadingEl) loadingEl.style.display = "none";
				console.warn(
					"Failed to load lightbox image:",
					currentImage.src
				);
				this.src =
					"data:image/svg+xml;base64," +
					btoa(
						'<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="#999" text-anchor="middle" dy=".3em">Nie można załadować obrazu</text></svg>'
					);
				gsap.to(lightboxImage, { opacity: 1, duration: 0.3 });
			};
			lightboxImage.src = currentImage.src;
			lightboxImage.alt = currentImage.alt;
			updateThumbnailHighlight();
		}

		function generateThumbnails() {
			const container = $("#lightboxThumbnails");
			if (!container || lightboxImages.length <= 1) return;
			container.innerHTML = "";
			lightboxImages.forEach((img, idx) => {
				const div = document.createElement("div");
				div.className =
					"lightbox-thumbnail" +
					(idx === currentLightboxIndex ? " active" : "");
				const i = document.createElement("img");
				i.src = img.src;
				i.alt = img.alt;
				div.appendChild(i);
				div.addEventListener("click", () => {
					if (idx !== currentLightboxIndex) {
						currentLightboxIndex = idx;
						updateLightboxContent();
					}
				});
				container.appendChild(div);
			});
		}

		function updateThumbnailHighlight() {
			const thumbs = $$(".lightbox-thumbnail");
			thumbs.forEach((t, idx) =>
				t.classList.toggle("active", idx === currentLightboxIndex)
			);
		}

		function nextLightboxImage() {
			if (lightboxImages.length <= 1) return;
			currentLightboxIndex =
				(currentLightboxIndex + 1) % lightboxImages.length;
			const lightboxImage = $("#lightboxImage");
			if (!lightboxImage) return;
			gsap.to(lightboxImage, {
				x: -30,
				opacity: 0,
				duration: 0.2,
				ease: "power2.in",
				onComplete: () => {
					updateLightboxContent();
					gsap.set(lightboxImage, { x: 30 });
				},
			});
		}

		function prevLightboxImage() {
			if (lightboxImages.length <= 1) return;
			currentLightboxIndex =
				(currentLightboxIndex - 1 + lightboxImages.length) %
				lightboxImages.length;
			const lightboxImage = $("#lightboxImage");
			if (!lightboxImage) return;
			gsap.to(lightboxImage, {
				x: 30,
				opacity: 0,
				duration: 0.2,
				ease: "power2.in",
				onComplete: () => {
					updateLightboxContent();
					gsap.set(lightboxImage, { x: -30 });
				},
			});
		}

		function handleLightboxKeyboard(e) {
			if (!isLightboxOpen) return;
			switch (e.key) {
				case "Escape":
					e.preventDefault();
					closeLightbox();
					break;
				case "ArrowRight":
					e.preventDefault();
					nextLightboxImage();
					break;
				case "ArrowLeft":
					e.preventDefault();
					prevLightboxImage();
					break;
				default:
					break;
			}
		}

		let tStartX = 0,
			tEndX = 0,
			tStartY = 0,
			tEndY = 0;
		function handleLightboxTouchStart(e) {
			tStartX = e.changedTouches[0].screenX;
			tStartY = e.changedTouches[0].screenY;
		}
		function handleLightboxTouchEnd(e) {
			tEndX = e.changedTouches[0].screenX;
			tEndY = e.changedTouches[0].screenY;
			handleLightboxGesture();
		}
		function handleLightboxGesture() {
			const threshold = 50;
			const restraint = 100;
			const diffX = tStartX - tEndX;
			const diffY = Math.abs(tStartY - tEndY);
			if (Math.abs(diffX) > threshold && diffY < restraint) {
				if (diffX > 0) nextLightboxImage();
				else prevLightboxImage();
			}
		}

		function pauseIfCarousel() {
			Gallery.stopAutoPlay && Gallery.stopAutoPlay();
		}

		function init() {
			collectLightboxImages();
			createLightboxHTML();
			// add click listeners to gallery images for opening lightbox
			$$(".image-slide img").forEach((img) => {
				img.style.cursor = "pointer";
				img.addEventListener("click", () => {
					const src = img.dataset.src || img.src;
					if (!src || src.includes("data:image/svg+xml")) return;
					const idx = lightboxImages.findIndex(
						(it) => it.src === src
					);
					if (idx >= 0) openLightboxAt(idx);
				});
			});
			// overlay click to close if clicked outside
			const overlay = $("#lightboxOverlay");
			if (overlay) {
				overlay.addEventListener("click", (e) => {
					if (e.target === overlay) closeLightbox();
				});
			}
		}

		// expose
		return {
			init,
			openAt: openLightboxAt,
			close: closeLightbox,
			next: nextLightboxImage,
			prev: prevLightboxImage,
		};
	})();

	// Expose lightbox globals used by onclick attrs
	window.closeLightbox = Lightbox.close;
	window.nextLightboxImage = Lightbox.next;
	window.prevLightboxImage = Lightbox.prev;

	// ---------------------------
	//  SECTION: VIDEO CONTROLS
	// ---------------------------
	(function initVideoControls() {
		let currentPlayingVideo = null;
		const playIcon = `
<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>`;
		const pauseIcon = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4H10V20H6V4Z" fill="white"/><path d="M14 4H18V20H14V4Z" fill="white"/></svg>`;

		$$(".video-container").forEach((container) => {
			const video = container.querySelector("video");
			const btn = container.querySelector(".play-pause-btn");
			if (!video || !btn) return;
			btn.innerHTML = playIcon;

			const stopOtherVideos = () => {
				if (currentPlayingVideo && currentPlayingVideo !== video) {
					currentPlayingVideo.pause();
					currentPlayingVideo.currentTime =
						currentPlayingVideo.dataset.startTime || 0;
					const otherBtn = currentPlayingVideo
						.closest(".video-container")
						?.querySelector(".play-pause-btn");
					if (otherBtn) otherBtn.innerHTML = playIcon;
				}
			};

			btn.addEventListener("click", (ev) => {
				ev.stopPropagation();
				if (video.paused) {
					stopOtherVideos();
					video.play().catch((err) => {
						console.warn("Błąd odtwarzania:", err);
						btn.innerHTML = playIcon;
					});
					btn.innerHTML = pauseIcon;
					currentPlayingVideo = video;
				} else {
					video.pause();
					btn.innerHTML = playIcon;
					currentPlayingVideo = null;
				}
			});

			video.addEventListener("play", () => {
				btn.innerHTML = pauseIcon;
				currentPlayingVideo = video;
			});
			video.addEventListener("pause", () => {
				btn.innerHTML = playIcon;
				if (currentPlayingVideo === video) currentPlayingVideo = null;
			});
			video.addEventListener("ended", () => {
				btn.innerHTML = playIcon;
				video.currentTime = video.dataset.startTime || 0;
				currentPlayingVideo = null;
			});

			const startTime = parseFloat(video.dataset.startTime) || 0;
			if (startTime > 0) {
				video.addEventListener(
					"loadedmetadata",
					() => {
						try {
							video.currentTime = startTime;
						} catch (e) {
							/* ignore */
						}
					},
					{ once: true }
				);
			}
		});

		// Additional: set start times for .photo-frame videos (loop behavior)
		$$(".photo-frame video[data-start-time]").forEach((video) => {
			const startTime =
				parseFloat(video.getAttribute("data-start-time")) || 0;
			video.addEventListener("loadedmetadata", function () {
				this.currentTime = startTime;
			});
			video.addEventListener("ended", function () {
				this.currentTime = startTime;
				this.play();
			});
			video.addEventListener("seeked", function () {
				if (!this.seeking && this.currentTime < startTime)
					this.currentTime = startTime;
			});
		});
	})();

	// ---------------------------
	//  SECTION: GSAP / SCROLLTRIGGER ANIMATIONS
	// ---------------------------
	(function initAnimations() {
		// Register plugin if available
		safeCall(() => {
			if (
				typeof gsap !== "undefined" &&
				typeof ScrollTrigger !== "undefined"
			) {
				gsap.registerPlugin(ScrollTrigger);
			}
		});

		// Setup initial GSAP states (only if gsap exists)
		if (typeof gsap === "undefined") return;

		gsap.set(".nav-menu li", { opacity: 0, y: -20 });
		gsap.set(".social-icons a", { opacity: 0, y: -20, rotation: -180 });
		gsap.set(".photo-frame", { opacity: 0, scale: 0.8, rotation: 0 });
		gsap.set(".contact-item", { opacity: 0, x: -50 });
		gsap.set(".offer-card", { opacity: 0, y: 100, rotateX: -30 });
		gsap.set(".stat-card", { opacity: 0, y: -30 });
		gsap.set(".welcome-header h2", { opacity: 0, y: 50 });
		gsap.set(".welcome-header p", { opacity: 0, y: 30 });

		// Header entrance
		const headerTimeline = gsap.timeline();
		headerTimeline
			.to(".nav-menu li", {
				opacity: 1,
				y: 0,
				duration: 0.6,
				stagger: 0.1,
				ease: "back.out(1.7)",
			})
			.to(
				".social-icons a",
				{
					opacity: 1,
					y: 0,
					rotation: 0,
					duration: 0.6,
					stagger: 0.15,
					ease: "back.out(1.7)",
				},
				"-=0.4"
			);

		// Photo frames animation
		const framesTimeline = gsap.timeline({
			scrollTrigger: {
				trigger: ".photo-gallery",
				start: "top center+=100",
				toggleActions: "play none none reverse",
			},
		});
		const isMobile = window.innerWidth <= 768;
		if (isMobile) {
			framesTimeline
				.to(".photo-frame:nth-child(1)", {
					opacity: 1,
					scale: 1,
					rotation: -5,
					duration: 0.8,
					ease: "power2.out",
				})
				.to(
					".photo-frame:nth-child(2)",
					{
						opacity: 1,
						scale: 1,
						rotation: 4,
						duration: 0.8,
						ease: "power2.out",
					},
					"-=0.65"
				)
				.to(
					".photo-frame:nth-child(3)",
					{
						opacity: 1,
						scale: 1,
						rotation: -6,
						duration: 0.8,
						ease: "power2.out",
					},
					"-=0.65"
				)
				.to(
					".photo-frame:nth-child(4)",
					{
						opacity: 1,
						scale: 1,
						rotation: 5,
						duration: 0.8,
						ease: "power2.out",
					},
					"-=0.65"
				);
		} else {
			framesTimeline.to(".photo-frame", {
				opacity: 1,
				scale: 1,
				duration: 0.8,
				stagger: 0.15,
				ease: "power2.out",
			});
		}

		// Welcome section
		gsap.timeline({
			scrollTrigger: {
				trigger: ".welcome-section",
				start: "top center+=200",
				toggleActions: "play none none reverse",
			},
		})
			.to(".welcome-header h2", {
				opacity: 1,
				y: 0,
				duration: 0.8,
				ease: "power3.out",
			})
			.to(
				".welcome-header p",
				{ opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
				"-=0.4"
			);

		// Offer cards batch
		ScrollTrigger.batch(".offer-card", {
			onEnter: (elements) => {
				gsap.to(elements, {
					opacity: 1,
					y: 0,
					rotateX: 0,
					duration: 1,
					stagger: 0.2,
					ease: "back.out(1.4)",
					transformOrigin: "center bottom",
				});
			},
			onLeave: (elements) => {
				gsap.to(elements, {
					opacity: 0.3,
					y: 50,
					duration: 0.5,
					stagger: 0.1,
					ease: "power2.inOut",
				});
			},
			onEnterBack: (elements) => {
				gsap.to(elements, {
					opacity: 1,
					y: 0,
					duration: 0.8,
					stagger: 0.1,
					ease: "power2.out",
				});
			},
			start: "top bottom-=100",
			end: "bottom top+=100",
		});

		// Stats section with counter
		const statCards = $$(".stat-card");
		// initialize stat numbers to avoid jump
		$$(".stat-number").forEach((el) => {
			const finalText = el.textContent;
			el.setAttribute("data-final-value", finalText);
			if (finalText.includes("+")) el.textContent = "0+";
			else if (finalText.includes("lat")) el.textContent = "0 lat";
			else if (/\d/.test(finalText)) el.textContent = "0";
		});

		gsap.timeline({
			scrollTrigger: {
				trigger: ".stats-section",
				start: "top center+=100",
				toggleActions: "play none none reverse",
			},
		}).to(".stat-card", {
			opacity: 1,
			scale: 1,
			rotation: 0,
			duration: 1.2,
			stagger: 0.1,
			ease: "power2.out",
			onComplete: () => {
				statCards.forEach((card) => {
					const numberElement = card.querySelector(".stat-number");
					if (!numberElement) return;
					const finalText =
						numberElement.getAttribute("data-final-value") ||
						numberElement.textContent;
					if (finalText.includes("+")) {
						const number =
							parseInt(finalText.replace("+", ""), 10) || 0;
						gsap.to(
							{ value: 0 },
							{
								value: number,
								duration: 2,
								ease: "power2.out",
								onUpdate: function () {
									numberElement.textContent =
										Math.round(this.targets()[0].value) +
										"+";
								},
							}
						);
					} else if (finalText.includes("lat")) {
						const number =
							parseInt(finalText.replace(" lat", ""), 10) || 0;
						gsap.to(
							{ value: 0 },
							{
								value: number,
								duration: 2,
								ease: "power2.out",
								onUpdate: function () {
									numberElement.textContent =
										Math.round(this.targets()[0].value) +
										" lat";
								},
							}
						);
					} else {
						const hasNumbers = /\d/.test(finalText);
						if (!hasNumbers) numberElement.textContent = finalText;
					}
				});
			},
		});

		// Footer contact animation
		gsap.timeline({
			scrollTrigger: {
				trigger: "#contact",
				start: "top center+=200",
				toggleActions: "play none none reverse",
			},
		})
			.to(".contact-item", {
				opacity: 1,
				x: 0,
				duration: 0.8,
				stagger: 0.2,
				ease: "back.out(1.4)",
			})
			.from(
				".contact-item img",
				{
					rotation: 360,
					scale: 0,
					duration: 0.6,
					stagger: 0.15,
					ease: "back.out(1.7)",
				},
				"-=0.6"
			);

		// Hover effects for offer cards
		$$(".offer-card").forEach((card) => {
			card.addEventListener("mouseenter", () => {
				gsap.to(card, {
					scale: 1.03,
					y: -10,
					duration: 0.4,
					ease: "power2.out",
				});
			});
			card.addEventListener("mouseleave", () => {
				gsap.to(card, {
					scale: 1,
					y: 0,
					duration: 0.4,
					ease: "power2.out",
				});
			});
		});

		// Mouse parallax on desktop
		const photoGallery = $(".photo-gallery");
		if (photoGallery && !isMobile) {
			photoGallery.addEventListener("mousemove", (e) => {
				const rect = photoGallery.getBoundingClientRect();
				const x = (e.clientX - rect.left) / rect.width - 0.5;
				const y = (e.clientY - rect.top) / rect.height - 0.5;
				gsap.to(".photo-frame", {
					x: x * 20,
					y: y * 20,
					duration: 0.3,
					ease: "power2.out",
					stagger: 0.05,
				});
			});
			photoGallery.addEventListener("mouseleave", () => {
				gsap.to(".photo-frame", {
					x: 0,
					y: 0,
					duration: 0.5,
					ease: "power2.out",
					stagger: 0.05,
				});
			});
		}

		// Text reveal for H3 (batch)
		ScrollTrigger.batch("h3", {
			onEnter: (elements) => {
				elements.forEach((el) => {
					const text = el.textContent;
					el.innerHTML = text
						.split("")
						.map((char) =>
							char === " "
								? " "
								: `<span style="display:inline-block;">${char}</span>`
						)
						.join("");
					gsap.from(el.querySelectorAll("span"), {
						y: 50,
						opacity: 0,
						duration: 0.8,
						stagger: 0.02,
						ease: "back.out(1.7)",
					});
				});
			},
		});

		// Nav highlight on scroll (cached elements)
		(function navOnScroll() {
			const header = $(".header");
			const navLinks = $$(".nav-menu a");
			const mainContent = $("main");
			const sections = mainContent
				? [mainContent, ...$$("section")]
				: $$("section");
			const footer = $("footer");
			if (footer) sections.push(footer);

			function highlightNavOnScroll() {
				const currentScroll = window.scrollY;
				const documentHeight = document.documentElement.scrollHeight;
				const windowHeight = window.innerHeight;

				if (!header) return;

				// Header appearance (unchanged)
				if (currentScroll > 0) {
					if (!header.classList.contains("scrolled")) {
						header.classList.add("scrolled");
						gsap.to(header, {
							backdropFilter: "blur(10px)",
							background: "rgba(238, 201, 210, 0.95)",
							duration: 0.3,
							ease: "power2.out",
						});
					}
				} else {
					if (header.classList.contains("scrolled")) {
						header.classList.remove("scrolled");
						gsap.to(header, {
							backdropFilter: "none",
							background: "#eec9d2",
							duration: 0.3,
							ease: "power2.out",
						});
					}
				}

				// Determine active section based on simplified "Zones"
				// Zone 3: Contact (Bottom)
				// Zone 2: About / Welcome (Middle - covers everything from #welcome to #contact)
				// Zone 1: Home (Top - everything before #welcome)

				const welcomeSection = $("#welcome");
				const contactSection = $("#contact");
				
				let targetHref = "#"; // Default to Home

				if (contactSection) {
					const contactTop = contactSection.offsetTop - 150;
					// If we are near bottom or past contact section top
					if (currentScroll + windowHeight >= documentHeight - 50 || currentScroll >= contactTop) {
						targetHref = "#contact";
					} else if (welcomeSection) {
						const welcomeTop = welcomeSection.offsetTop - 150;
						if (currentScroll >= welcomeTop) {
							targetHref = "#welcome";
						}
					}
				}

				navLinks.forEach((link) => {
					const wasActive = link.classList.contains("active");
					link.classList.remove("active");
					
					if (link.getAttribute("href") === targetHref) {
						link.classList.add("active");
						if (!wasActive) {
							gsap.fromTo(
								link,
								{ scale: 1 },
								{
									scale: 1.05,
									duration: 0.2,
									yoyo: true,
									repeat: 1,
									ease: "power2.inOut",
								}
							);
						}
					}
				});
			}

			window.addEventListener("scroll", highlightNavOnScroll, {
				passive: true,
			});
			highlightNavOnScroll();

			// Smooth scrolling for nav links (uses gsap scrollTo plugin)
			$$(".nav-menu a").forEach((link) => {
				link.addEventListener("click", function (e) {
					e.preventDefault();
					const targetId = this.getAttribute("href");
					if (targetId === "#") {
						gsap.to(window, {
							duration: 1.2,
							scrollTo: 0,
							ease: "power2.inOut",
						});
					} else {
						const targetElement = document.querySelector(targetId);
						if (targetElement) {
							gsap.to(window, {
								duration: 1.2,
								scrollTo: { y: targetElement, offsetY: 80 },
								ease: "power2.inOut",
							});
						}
					}
				});
			});
		})();
	})();

	// ---------------------------
	//  SECTION: OVERLAYS, UI CONTROLS
	// ---------------------------
	(function overlaysAndUI() {
		window.showLocationsOverlay = function () {
			const overlay = $("#locationsOverlay");
			if (!overlay) return;
			Gallery.pauseAutoPlay && Gallery.pauseAutoPlay();
			overlay.classList.add("active");
			document.body.style.overflow = "hidden";
			const title = overlay.querySelector(".overlay-title");
			const columns = overlay.querySelectorAll(".cities-column");
			if (title) {
				title.style.animation = "none";
				title.offsetHeight;
				title.style.animation = "fadeInUp 0.6s ease 0.2s forwards";
			}
			columns.forEach((col, i) => {
				col.style.animation = "none";
				col.offsetHeight;
				col.style.animation = `fadeInUp 0.6s ease ${
					0.4 + i * 0.2
				}s forwards`;
			});
		};

		window.hideLocationsOverlay = function () {
			const overlay = $("#locationsOverlay");
			if (!overlay || !overlay.classList.contains("active")) return;
			overlay.classList.remove("active");
			document.body.style.overflow = "";
			setTimeout(
				() => Gallery.resumeAutoPlay && Gallery.resumeAutoPlay(),
				500
			);
		};

		const overlay = $("#locationsOverlay");
		if (overlay) {
			overlay.addEventListener("click", (e) => {
				if (e.target === overlay) window.hideLocationsOverlay();
			});
		}
	})();

	// ---------------------------
	//  SECTION: Hover stability fallback for offer cards
	// ---------------------------
	(function hoverStability() {
		const cards = $$(".offer-card");
		if (!cards.length) return;
		cards.forEach((card) => {
			let t = null;
			card.addEventListener(
				"pointerenter",
				() => {
					if (t) {
						clearTimeout(t);
						t = null;
					}
					card.classList.add("is-hover");
				},
				{ passive: true }
			);
			card.addEventListener(
				"pointerleave",
				() => {
					t = setTimeout(() => card.classList.remove("is-hover"), 80);
				},
				{ passive: true }
			);
		});
	})();

	// ---------------------------
	//  SECTION: Pause offscreen videos via IntersectionObserver
	// ---------------------------
	(function pauseOffscreenVideos() {
		const vids = $$(".photo-frame video, video.autoplay, video[autoplay]");
		if (!("IntersectionObserver" in window) || !vids.length) return;
		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const v = entry.target;
					if (entry.isIntersecting) {
						if (
							v.paused &&
							(v.getAttribute("autoplay") !== null ||
								v.classList.contains("autoplay"))
						) {
							const playPromise = v.play();
							if (playPromise && playPromise.catch)
								playPromise.catch(() => {});
						}
					} else {
						if (!v.paused) v.pause();
					}
				});
			},
			{ threshold: 0.01 }
		);
		vids.forEach((v) => io.observe(v));
	})();

	// ---------------------------
	//  SECTION: Lightweight rAF gate for scroll (minimal)
	// ---------------------------
	(function rAFGate() {
		let ticking = false;
		function onTick() {
			ticking = false;
		}
		window.addEventListener(
			"scroll",
			function () {
				if (!ticking) {
					requestAnimationFrame(onTick);
					ticking = true;
				}
			},
			{ passive: true }
		);
	})();

	// ---------------------------
	//  INIT: DOMContentLoaded single hook
	// ---------------------------
	document.addEventListener("DOMContentLoaded", function () {
		// initialize parts that require DOM ready
		Gallery.init();
		Lightbox.init();
		// Note: video controls and animations were self-initializing above
	});

	document.addEventListener("DOMContentLoaded", function () {
		const videos = document.querySelectorAll(".video-container video");

		videos.forEach((video) => {
			const btn = video.nextElementSibling;

			// Obsługa przycisku play/pause
			btn.addEventListener("click", () => {
				if (video.paused) {
					video.play();
					btn.textContent = "⏸";
				} else {
					video.pause();
					btn.textContent = "▶";
				}
			});

			// Fallback jeśli video się nie załaduje
			video.onerror = () => {
				const posterSrc = video.getAttribute("poster");
				const img = document.createElement("img");
				img.src = posterSrc;
				img.alt = video.getAttribute("alt") || "Event video";
				video.parentNode.replaceChild(img, video);
			};
		});
	});

	// Obsługa przycisków play/pause dla wszystkich wideo
	document.addEventListener("DOMContentLoaded", function () {
		const videoContainers = document.querySelectorAll(".video-container");

		videoContainers.forEach((container) => {
			const video = container.querySelector("video");
			const btn = container.querySelector(".play-pause-btn");

			// Czekaj aż wideo będzie gotowe do play (zapobiega jednej klatce)
			video.addEventListener("canplay", () => {
				btn.disabled = false; // Aktywuj przycisk gdy gotowe
				btn.style.opacity = 1; // Pokaż przycisk w pełni
			});

			// Manualny loop: Jeśli wideo skończy, rewind i play again
			video.addEventListener("ended", () => {
				video.currentTime = 0; // Przewiń do początku
				video.play(); // Odtwórz ponownie
			});

			// Obsługa kliknięcia przycisku
			btn.addEventListener("click", () => {
				if (video.paused || video.ended) {
					video
						.play()
						.then(() => {
							btn.textContent = "❚❚"; // Symbol pause
							btn.classList.add("playing");
						})
						.catch((error) => {
							console.error("Błąd odtwarzania:", error);
							// Fallback: Reload i play
							video.load();
							video.play();
						});
				} else {
					video.pause();
					btn.textContent = "▶"; // Symbol play
					btn.classList.remove("playing");
				}
			});

			// Opcjonalnie: Ukryj przycisk po starcie (jeśli chcesz auto-hide)
			video.addEventListener("play", () => {
				setTimeout(() => {
					btn.style.opacity = 0;
				}, 2000); // Ukryj po 2s
			});
			video.addEventListener("pause", () => {
				btn.style.opacity = 1;
			});
		});
	});

	// expose safe API for external usage if needed
	window.__App = {
		Gallery,
		Lightbox,
	};
})(window, document);
