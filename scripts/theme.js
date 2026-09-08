// theme.js

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const htmlElement = document.documentElement;

    // 1. Check for saved theme in localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // 2. Toggle on click
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.setAttribute('data-theme', 'dark');
            if (themeIcon) themeIcon.innerText = '🌙'; // Moon icon
        } else {
            htmlElement.removeAttribute('data-theme');
            if (themeIcon) themeIcon.innerText = '☼'; // Sun icon
        }
    }
});

window.addEventListener('load', () => {
    // Wait a tiny split-second to ensure the layout is settled
    setTimeout(() => {
        document.documentElement.classList.remove('preload');
    }, 100);
});