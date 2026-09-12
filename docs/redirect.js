/* TossInbox — old single-page anchors used to live on the landing page; send them to the right page. */
(function () {
  var map = {
    quickstart: "/quickstart",
    cli: "/cli",
    agents: "/agents",
    action: "/agents#action",
    faq: "/faq"
  };
  var h = location.hash.replace("#", "");
  if (map[h]) location.replace(map[h]);
})();
