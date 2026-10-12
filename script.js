function toggleMenu() {
    const menu = document.querySelector(".menu-links")
    const icon = document.querySelector(".hamburger-icon")
    const isOpen = menu.classList.toggle("open");
    icon.classList.toggle("open", isOpen);
    icon.setAttribute("aria-expanded", String(isOpen));
    icon.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

// Dark mode: the saved theme is applied by an inline script in <head> to avoid a flash
const darkModeToggle = document.getElementById('dark-mode-toggle');

function updateDarkModeLabel() {
    if (!darkModeToggle) return;
    const isDark = document.documentElement.classList.contains('dark-mode');
    darkModeToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    try {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch (e) {}
    updateDarkModeLabel();
}

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
    updateDarkModeLabel();
}

// Typing animation for the hero subtitle
const typingPhrases = [
    "Software Engineer",
    "Backend Developer",
    "Full-Stack Developer",
    "Cloud Infrastructure",
    "Frontend Developer"
];
const typingTarget = document.getElementById('typing-text');

function typeLoop(phraseIndex = 0, charIndex = 0, deleting = false) {
    const phrase = typingPhrases[phraseIndex];
    typingTarget.textContent = phrase.slice(0, charIndex);

    let delay = deleting ? 50 : 100;

    if (!deleting && charIndex === phrase.length) {
        delay = 1500;
        deleting = true;
    } else if (deleting && charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % typingPhrases.length;
    } else {
        charIndex += deleting ? -1 : 1;
    }

    setTimeout(() => typeLoop(phraseIndex, charIndex, deleting), delay);
}

if (typingTarget) {
    typeLoop();
}

// Lightbox for clickable photos
function openLightbox(imgEl) {
    const overlay = document.getElementById('lightbox-overlay');
    const lightboxImg = document.getElementById('lightbox-img');
    if (!overlay || !lightboxImg) return;
    lightboxImg.src = imgEl.src;
    lightboxImg.alt = imgEl.alt;
    overlay.classList.add('open');
}

function closeLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (overlay) overlay.classList.remove('open');
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
});

// Show the "Update resume" link only on devices that have passed the passkey check on update.html.
// This just keeps the link out of visitors' way; the passkey check on the server is what protects uploads.
try {
    if (localStorage.getItem('portfolioOwner') === '1') {
        document.querySelectorAll('.owner-link').forEach((el) => { el.hidden = false; });
    }
} catch (e) {}
