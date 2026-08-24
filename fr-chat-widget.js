/* FR-Logistics — Web chat widget
 * Canal 'web' del stack conversacional (LIAM). Sin dependencias.
 *
 * Instalacion en fr-logistics.net (antes de </body>):
 *   <script src="/fr-chat-widget.js"
 *           data-endpoint="https://apps.fr-logistics.net/.netlify/functions/web-chat"
 *           defer></script>
 *
 * Contrato con el backend:
 *   POST {endpoint}            {session_id, text, lang, page}      -> {ok, reply?}
 *   GET  {endpoint}?session_id=<id>&after=<iso>                    -> {ok, messages:[{id,direction,body,ts}]}
 *
 * El GET existe porque la respuesta no siempre es sincronica: cuando un humano
 * toma el hilo desde portal.html, el mensaje sale del inbox y el widget lo
 * recoge en el siguiente sondeo. Solo sondea con el panel abierto.
 */
(function () {
  "use strict";

  var script = document.currentScript ||
    document.querySelector('script[src*="fr-chat-widget"]');
  var ENDPOINT = (script && script.dataset.endpoint) ||
    "/.netlify/functions/web-chat";
  var POLL_MS = 4000;
  var STORE_KEY = "fr_chat_session";
  // data-launcher="false" => no dibuja boton propio; el sitio abre el panel
  // llamando FRChat.open() desde su propio boton (ej. el mascot de LIAM).
  var OWN_LAUNCHER = !(script && script.dataset.launcher === "false");

  var ES = /^es/i.test(document.documentElement.lang || navigator.language || "");
  var T = ES ? {
    launcher: "Escríbenos",
    title: "FR-Logistics",
    status: "Respondemos en horario de oficina (ET)",
    placeholder: "Escribe tu mensaje…",
    send: "Enviar",
    close: "Cerrar el chat",
    intro: "Hola. Cuéntanos qué necesitas mover y te decimos cómo lo manejamos.",
    failed: "No se pudo enviar. Revisa tu conexión e inténtalo otra vez.",
    retry: "Reintentar"
  } : {
    launcher: "Chat with us",
    title: "FR-Logistics",
    status: "We reply during office hours (ET)",
    placeholder: "Type your message…",
    send: "Send",
    close: "Close chat",
    intro: "Hi. Tell us what you need to move and we'll explain how we handle it.",
    failed: "That didn't send. Check your connection and try again.",
    retry: "Retry"
  };

  /* ---------- sesion ---------- */
  function sessionId() {
    var id;
    try { id = localStorage.getItem(STORE_KEY); } catch (e) { /* modo privado */ }
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "web-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(STORE_KEY, id); } catch (e) { /* volatil */ }
    }
    return id;
  }
  var SESSION = sessionId();
  var lastSeen = null;
  var pollTimer = null;
  var open = false;
  var seenIds = Object.create(null);

  /* ---------- shell ---------- */
  var host = document.createElement("div");
  host.setAttribute("data-fr-chat", "");
  host.style.cssText = "position:fixed;inset:auto 0 0 auto;z-index:2147483000";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var css = document.createElement("style");
  css.textContent = [
    ":host,*{box-sizing:border-box}",
    ".wrap{font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    "  color:#0B2545;position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;align-items:flex-end;gap:12px}",
    ".btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:9px;background:#0B2545;color:#fff;",
    "  padding:13px 20px;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 8px 24px rgba(11,37,69,.28);",
    "  transition:transform .18s ease,box-shadow .18s ease}",
    ".btn:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(11,37,69,.34)}",
    ".btn:focus-visible{outline:3px solid #F4A261;outline-offset:3px}",
    ".dot{width:8px;height:8px;border-radius:50%;background:#F4A261;flex:none}",
    ".panel{width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);",
    "  background:#fff;border-radius:16px;overflow:hidden;display:none;flex-direction:column;",
    "  box-shadow:0 24px 60px rgba(11,37,69,.28);border:1px solid #E2E8F0}",
    ".panel.on{display:flex}",
    ".hd{background:#0B2545;color:#fff;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;",
    "  border-bottom:3px solid #F4A261}",
    ".hd h3{margin:0;font-size:16px;font-weight:600;letter-spacing:.01em}",
    ".hd p{margin:3px 0 0;font-size:12px;color:#A8C0D6;line-height:1.35}",
    ".x{all:unset;cursor:pointer;margin-left:auto;color:#A8C0D6;font-size:20px;line-height:1;padding:2px 4px}",
    ".x:hover{color:#fff}.x:focus-visible{outline:2px solid #F4A261;outline-offset:2px}",
    ".log{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:10px;background:#F8FAFC;",
    "  overscroll-behavior:contain}",
    ".m{max-width:82%;padding:10px 13px;border-radius:14px;font-size:14.5px;white-space:pre-wrap;word-wrap:break-word}",
    ".m.in{align-self:flex-start;background:#fff;border:1px solid #E2E8F0;border-bottom-left-radius:4px}",
    ".m.out{align-self:flex-end;background:#1C7293;color:#fff;border-bottom-right-radius:4px}",
    ".m.err{align-self:center;background:#FEF3C7;border:1px solid #FCD34D;font-size:13px;text-align:center}",
    ".m.err button{all:unset;cursor:pointer;color:#92400E;font-weight:600;text-decoration:underline;margin-left:6px}",
    ".typing{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:#fff;border:1px solid #E2E8F0;border-radius:14px}",
    ".typing i{width:6px;height:6px;border-radius:50%;background:#94A3B8;animation:b 1.2s infinite}",
    ".typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}",
    ".ft{display:flex;gap:8px;padding:12px;border-top:1px solid #E2E8F0;background:#fff}",
    ".ft textarea{flex:1;resize:none;border:1px solid #CBD5E1;border-radius:10px;padding:10px 12px;",
    "  font:inherit;font-size:14.5px;max-height:96px;color:#0B2545}",
    ".ft textarea:focus{outline:none;border-color:#1C7293;box-shadow:0 0 0 3px rgba(28,114,147,.15)}",
    ".ft button{all:unset;cursor:pointer;background:#1C7293;color:#fff;padding:0 16px;border-radius:10px;",
    "  font-weight:600;font-size:14px;display:flex;align-items:center}",
    ".ft button[disabled]{background:#94A3B8;cursor:not-allowed}",
    ".ft button:focus-visible{outline:3px solid #F4A261;outline-offset:2px}",
    "@media (max-width:420px){.wrap{right:12px;bottom:12px}.panel{width:calc(100vw - 24px);height:calc(100vh - 96px)}}",
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}"
  ].join("");

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.innerHTML =
    '<div class="panel" role="dialog" aria-modal="false" aria-label="' + T.title + '">' +
      '<div class="hd"><div><h3>' + T.title + '</h3><p>' + T.status + '</p></div>' +
      '<button class="x" aria-label="' + T.close + '">&times;</button></div>' +
      '<div class="log" role="log" aria-live="polite"></div>' +
      '<div class="ft"><textarea rows="1" placeholder="' + T.placeholder + '" aria-label="' + T.placeholder + '"></textarea>' +
      '<button class="send">' + T.send + '</button></div>' +
    '</div>' +
    '<button class="btn"><span class="dot"></span>' + T.launcher + '</button>';

  root.appendChild(css);
  root.appendChild(wrap);
  document.body.appendChild(host);

  var panel = wrap.querySelector(".panel");
  var log = wrap.querySelector(".log");
  var ta = wrap.querySelector("textarea");
  var sendBtn = wrap.querySelector(".send");
  var launcher = wrap.querySelector(".btn");

  /* ---------- render ---------- */
  function bubble(dir, text) {
    var el = document.createElement("div");
    el.className = "m " + (dir === "out" ? "out" : "in");
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function typing(on) {
    var t = log.querySelector(".typing");
    if (on && !t) {
      t = document.createElement("div");
      t.className = "typing";
      t.innerHTML = "<i></i><i></i><i></i>";
      log.appendChild(t);
      log.scrollTop = log.scrollHeight;
    } else if (!on && t) { t.remove(); }
  }
  function failure(text) {
    var el = document.createElement("div");
    el.className = "m err";
    el.textContent = T.failed;
    var b = document.createElement("button");
    b.textContent = T.retry;
    b.onclick = function () { el.remove(); send(text); };
    el.appendChild(b);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  /* ---------- red ---------- */
  function send(text) {
    typing(true);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: SESSION,
        text: text,
        lang: ES ? "es" : "en",
        page: location.pathname + location.search
      })
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        typing(false);
        // Mismo formato que el sondeo: el POST devuelve lo que LIAM produjo
        // en esta vuelta. Puede ser mas de un mensaje (respuesta + menu).
        absorb(d && d.messages);
      })
      .catch(function () { typing(false); failure(text); });
  }

  // Pinta los mensajes que aun no se han visto. Compartido por el POST y el
  // sondeo, para que un mensaje que llega por ambos no salga dos veces.
  function absorb(list) {
    if (!list || !list.length) return;
    list.forEach(function (m) {
      if (seenIds[m.id]) return;
      seenIds[m.id] = 1;
      if (m.direction === "in") bubble("in", m.body);
      if (m.ts && (!lastSeen || m.ts > lastSeen)) lastSeen = m.ts;
    });
  }

  function poll() {
    var qs = "?session_id=" + encodeURIComponent(SESSION) +
      (lastSeen ? "&after=" + encodeURIComponent(lastSeen) : "");
    fetch(ENDPOINT + qs)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.messages) return;
        absorb(d.messages);
      })
      .catch(function () { /* silencio: el sondeo reintenta solo */ });
  }

  /* ---------- interaccion ---------- */
  function submit() {
    var text = ta.value.trim();
    if (!text) return;
    bubble("out", text);
    ta.value = "";
    ta.style.height = "auto";
    send(text);
  }

  function toggle(show) {
    open = show;
    panel.classList.toggle("on", show);
    launcher.style.display = (!OWN_LAUNCHER || show) ? "none" : "inline-flex";
    if (show) {
      if (!log.children.length) bubble("in", T.intro);
      ta.focus();
      poll();
      pollTimer = setInterval(poll, POLL_MS);
    } else {
      clearInterval(pollTimer);
      pollTimer = null;
      if (OWN_LAUNCHER) launcher.focus();
    }
  }

  if (!OWN_LAUNCHER) launcher.style.display = "none";
  launcher.onclick = function () { toggle(true); };
  wrap.querySelector(".x").onclick = function () { toggle(false); };
  sendBtn.onclick = submit;
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  ta.addEventListener("input", function () {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) toggle(false);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { clearInterval(pollTimer); pollTimer = null; }
    else if (open && !pollTimer) { poll(); pollTimer = setInterval(poll, POLL_MS); }
  });

  window.FRChat = { open: function () { toggle(true); }, session: SESSION };
})();
