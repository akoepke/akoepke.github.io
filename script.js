const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
const links = navLinks.querySelectorAll('a'); // Select all links in the nav

hamburger.addEventListener('click', function() {
    navLinks.classList.toggle('active'); // Toggle active class
});

// Collapse the nav when a link is clicked
links.forEach(link => {
    link.addEventListener('click', function() {
        navLinks.classList.remove('active'); // Remove active class
    });
});


document.querySelectorAll('a[href^="#"], a[href="index.html"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');

        // Prevent default behavior for links
        e.preventDefault();

        if (targetId === "index.html") {
            // Scroll to the top smoothly
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else if (targetId.startsWith("#")) {
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navbarHeight = 70; // Adjust to your navbar height
                const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

