// Stagger-in reveal on scroll using IntersectionObserver
const staggerTargets = document.querySelectorAll(
  '.stack-group, .experience-item, .project-card, .writing-item'
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Stagger based on index within parent
        const siblings = Array.from(entry.target.parentElement.children);
        const idx = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = `${idx * 55}ms`;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
);

staggerTargets.forEach((el) => observer.observe(el));
