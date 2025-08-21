document.addEventListener('DOMContentLoaded', () => {
const btn = document.querySelector('.af-header__hamburger');
const nav = document.querySelector('.af-header .navbar');
const icons = document.querySelector('.af-header .icons');
if (!btn || !nav) return;
btn.addEventListener('click', () => {
const open = nav.classList.toggle('is-open');
icons && icons.classList.toggle('is-open');
btn.setAttribute('aria-expanded', open ? 'true' : 'false');
});
});