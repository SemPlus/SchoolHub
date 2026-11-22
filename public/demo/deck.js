// Slides of the demo presentations: arrows, space, click or swipe; F for full screen.
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var i = Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));

  var tag = document.createElement('div');
  tag.className = 'tag';
  tag.textContent = 'Esempio · Liceo Demo';
  document.body.appendChild(tag);

  var bar = document.createElement('div');
  bar.className = 'bar';
  bar.innerHTML = '<button aria-label="Indietro">←</button><span></span><button aria-label="Avanti">→</button><button aria-label="Schermo intero">⛶</button>';
  document.body.appendChild(bar);
  var counter = bar.querySelector('span');
  var buttons = bar.querySelectorAll('button');

  function show(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    counter.textContent = (i + 1) + ' / ' + slides.length;
    history.replaceState(null, '', '#' + (i + 1));
  }
  function full() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  buttons[0].onclick = function (e) { e.stopPropagation(); show(i - 1); };
  buttons[1].onclick = function (e) { e.stopPropagation(); show(i + 1); };
  buttons[2].onclick = function (e) { e.stopPropagation(); full(); };
  document.addEventListener('keydown', function (e) {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].indexOf(e.key) >= 0) { e.preventDefault(); show(i + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) { e.preventDefault(); show(i - 1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') full();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('.bar, a')) return;
    show(e.clientX > window.innerWidth / 3 ? i + 1 : i - 1);
  });
  var startX = null;
  document.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1);
    startX = null;
  });
  show(i);
})();
