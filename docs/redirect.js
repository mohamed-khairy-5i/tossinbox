/* TossInbox — old single-page anchors used to live on the landing page; send them to the right page. */
(function () {
  var map = {
    quickstart: "quickstart.html",
    cli: "cli.html",
    agents: "agents.html",
    action: "agents.html#action",
    faq: "faq.html"
  };
  var h = location.hash.replace("#", "");
  if (map[h]) location.replace(map[h]);
})();
