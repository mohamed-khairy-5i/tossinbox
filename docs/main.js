/* TossInbox — one small job: copy buttons. Shared by every page. */
document.querySelectorAll(".copy-btn, .copy-chip").forEach(function (btn) {
  btn.setAttribute("aria-live", "polite");
  var label = btn.textContent;
  btn.addEventListener("click", function () {
    var text = btn.getAttribute("data-copy");
    if (!text) {
      /* no explicit payload: copy the nearest code sample (pre, then code) */
      var host = btn.closest(".codeblock") || btn.closest(".install-inline");
      var src = host && (host.querySelector("pre") || host.querySelector("code"));
      text = src ? src.textContent : "";
    }
    function show(msg) {
      btn.textContent = msg;
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { btn.textContent = label; }, 1400);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      show(ok ? "copied" : "failed");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { show("copied"); }, fallback);
    } else {
      fallback();
    }
  });
});
