// One visible error and one short buzzer, shared by all three Sudoku modes.
const timers = new WeakMap();
export function clearSudokuError(node, root = globalThis) {
  if (!node) return;
  root.clearTimeout(timers.get(node));
  delete node.dataset.sudokuError;
  node.classList.remove('sudoku-error-pulse');
  node.setAttribute('aria-invalid', String(node.classList.contains('conflict')));
  timers.delete(node);
}
export function markSudokuError(node, root = globalThis) {
  if (node) {
    root.clearTimeout(timers.get(node));
    node.dataset.sudokuError = 'true';
    node.setAttribute('aria-invalid', 'true');
    node.classList.remove('sudoku-error-pulse');
    void node.offsetWidth;
    if (!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) node.classList.add('sudoku-error-pulse');
    timers.set(node, root.setTimeout(() => clearSudokuError(node, root), 1100));
  }
  root.BS_AUDIO?.play?.('buzzer');
  root.BS_AUDIO?.vibrate?.([45, 30, 65]);
}
