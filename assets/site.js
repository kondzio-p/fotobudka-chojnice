// Filmy z wesel: poster, który rusza dopiero po kliknięciu. Gra tylko jeden naraz.
(function () {
	const films = [...document.querySelectorAll("[data-film]")];
	const stop = (film) => {
		film.querySelector("video").pause();
		film.classList.remove("is-playing");
		film.querySelector(".film__play").setAttribute("aria-label", "Odtwórz film");
	};
	films.forEach((film) => {
		const video = film.querySelector("video");
		const button = film.querySelector(".film__play");
		const toggle = () => {
			if (!video.paused) return stop(film);
			films.filter((f) => f !== film).forEach(stop);
			video.play().catch(() => {});
			film.classList.add("is-playing");
			button.setAttribute("aria-label", "Zatrzymaj film");
		};
		button.addEventListener("click", toggle);
		video.addEventListener("click", toggle);
	});
	document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
