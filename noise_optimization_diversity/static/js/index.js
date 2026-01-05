// Image replacement slider functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing slider...');
  
  const slider = document.getElementById('image-slider');
  const mixedImages = document.getElementById('mixed-images');
  const oursCount = document.getElementById('ours-count');
  const exampleButtons = document.querySelectorAll('.example-btn');
  
  console.log('Elements found:', { slider: !!slider, mixedImages: !!mixedImages, oursCount: !!oursCount });
  
  let currentExample = 'cat';

  // Function to update images based on current example and replacement count
  function updateImages() {
    const count = slider.value;
    console.log('Updating images:', currentExample, count);
    oursCount.textContent = count;
    const newSrc = `./static/images/${currentExample}/grid_mixed_${count}.jpg`;
    console.log('New image src:', newSrc);
    mixedImages.src = newSrc;
  }

  // Slider event listeners - try multiple events for compatibility
  if (slider && mixedImages && oursCount) {
    slider.addEventListener('input', updateImages);
    slider.addEventListener('change', updateImages);
    slider.oninput = updateImages;
    console.log('Slider event listeners attached');
  } else {
    console.error('Missing elements!');
  }

  // Example button event listeners
  exampleButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      console.log('Button clicked:', this.dataset.example);
      // Update button styles
      exampleButtons.forEach(b => {
        b.classList.remove('is-selected');
        b.classList.add('is-outlined');
      });
      this.classList.add('is-selected');
      this.classList.remove('is-outlined');
      
      // Update current example
      currentExample = this.dataset.example;
      
      // Reset slider to 0 (i.i.d. position) when changing category
      slider.value = 0;
      
      // Update images with new category at i.i.d. position
      updateImages();
    });
  });

  // Bulma navbar burger functionality
  const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);
  if ($navbarBurgers.length > 0) {
    $navbarBurgers.forEach(el => {
      el.addEventListener('click', () => {
        const target = el.dataset.target;
        const $target = document.getElementById(target);
        el.classList.toggle('is-active');
        $target.classList.toggle('is-active');
      });
    });
  }
});
