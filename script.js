function toggleMenu() {
    const menu = document.querySelector(".menu-links")
    const icon = document.querySelector(".hamburger-icon")
    menu.classList.toggle("open");
    icon.classList.toggle("open");

}
// Function to toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');

    // Save user's preference to localStorage
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// Event listener for the dark mode toggle button
document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

// Load the user's theme preference on page load
window.onload = function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
};

// Typing animation for the hero subtitle
const typingPhrases = [
    "Software Engineer",
    "Cloud Infrastructure",
    "Full-Stack Developer",
    "Backend Developer",
    "Frontend Developer",
    "Product Manager",
    "Web3 Developer"
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
