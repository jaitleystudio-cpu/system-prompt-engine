/* Remove the server-readable crawl block once JavaScript runs.
 * Non-JS clients keep the block. Same-origin only. No network. */
(function () {
  var node = document.getElementById("spe-crawl");
  if (node && node.parentNode) node.parentNode.removeChild(node);
})();
