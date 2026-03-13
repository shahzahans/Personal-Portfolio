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
