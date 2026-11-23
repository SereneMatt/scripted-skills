(qa) => {
  const board = document.querySelector('[data-board]');
  const squares = [...board.querySelectorAll('[data-square]')];
  const color = (index) => squares[index].dataset.color;
  const initial = squares.map((square) => square.dataset.color);
  const changed = () => squares.filter((square, index) => square.dataset.color !== initial[index]).map((square) => `#${square.dataset.square}`);

  qa.onLoad('checkerboard', () => {
    const blacks = initial.filter((value) => value === 'black').length;
    const clashes = initial.filter(
      (value, index) => (index % 8 < 7 && value === initial[index + 1]) || (index < 56 && value === initial[index + 8])
    ).length;
    return { pass: blacks === 32 && clashes === 0, detail: `${blacks} black / ${64 - blacks} white, ${clashes} same-colour neighbours` };
  });
  qa.check('fits viewport', () => {
    const { right } = board.getBoundingClientRect();
    const pageWidth = document.documentElement.scrollWidth;
    return { pass: pageWidth <= innerWidth && right <= innerWidth, detail: `board right ${Math.round(right)}px, page ${pageWidth}px / ${innerWidth}px` };
  });

  return async () => {
    qa.step(`${qa.width}px · start`);
    await qa.sleep(1200);

    qa.step(`${qa.width}px · hover black square #0`);
    await qa.act('hover', '[data-square="0"]');
    await qa.logSettled('black→white', () => ({ pass: color(0) === 'white', detail: `#0 is ${color(0)}` }));
    await qa.sleep(1200);

    qa.step(`${qa.width}px · hover white square #1`);
    await qa.act('hover', '[data-square="1"]');
    await qa.logSettled('white→black', () => ({ pass: color(1) === 'black', detail: `#1 is ${color(1)}` }));
    await qa.sleep(1200);

    qa.step(`${qa.width}px · back onto #0`);
    await qa.act('hover', '[data-square="0"]');
    await qa.logSettled('re-hover flips', () => ({ pass: color(0) === 'black', detail: `#0 is ${color(0)} again` }));
    await qa.logSettled('others unchanged', () => {
      const flipped = changed();
      return { pass: flipped.length === 1 && flipped[0] === '#1', detail: `changed: ${flipped.join(', ') || 'none'}` };
    });
    await qa.sleep(1200);

    qa.step(`${qa.width}px · click Reset`);
    await qa.act('click', '[data-reset]');
    await qa.logSettled('reset', () => ({ pass: changed().length === 0, detail: `changed: ${changed().join(', ') || 'none'}` }));
    await qa.sleep(1200);
  };
}
