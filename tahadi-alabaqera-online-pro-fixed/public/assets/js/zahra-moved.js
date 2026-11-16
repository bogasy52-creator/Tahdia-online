/* Tahdia 33.10.6: الزهرة made way for لودو (the same game on the classic cross board). This page
   still opens a table someone already has (its room code); anything else goes to لودو. */
(function () {
  try {
    var query = new URLSearchParams(location.search);
    if (!query.get('room')) location.replace('/ludo' + location.hash);
  } catch (error) { /* an old browser stays on the page */ }
}());
