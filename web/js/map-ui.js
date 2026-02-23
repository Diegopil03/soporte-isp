// web/js/map-ui.js
import { getTickets, setTickets } from "./state.js";
import { fetchTickets } from "./tickets.api.js";

let map;
let markers = [];

// =========================
// RUTA (overlay)
// =========================
let routeLine = null;
let routeBadges = [];

// Animación de ruta
let routeAnimTimer = null;
let routeAnimDot = null;

// Helpers

function byId(id) {
  return document.getElementById(id);
}

// =========================
// Mobile: Tickets drawer (bottom sheet)
// =========================
function isMobileViewport() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

function openTicketsDrawer() {
  const panel = byId("ticketsPanel");
  if (!panel) return;

  panel.classList.add("is-open");
  document.body.classList.add("drawer-open");

  // 🔥 iPhone FIX: desactivar interacción del mapa mientras el drawer está abierto
  try {
    if (map) {
      map.dragging?.disable();
      map.touchZoom?.disable();
      map.doubleClickZoom?.disable();
      map.scrollWheelZoom?.disable();
      map.boxZoom?.disable();
      map.keyboard?.disable();
      if (map.tap) map.tap.disable();
    }
  } catch {}
}

function closeTicketsDrawer() {
  const panel = byId("ticketsPanel");
  if (!panel) return;

  panel.classList.remove("is-open");
  document.body.classList.remove("drawer-open");

  // 🔥 reactivar interacción del mapa
  try {
    if (map) {
      map.dragging?.enable();
      map.touchZoom?.enable();
      map.doubleClickZoom?.enable();
      map.scrollWheelZoom?.enable();
      map.boxZoom?.enable();
      map.keyboard?.enable();
      if (map.tap) map.tap.enable();
    }
  } catch {}
}

function toggleTicketsDrawer() {
  const panel = byId("ticketsPanel");
  if (!panel) return;
  if (panel.classList.contains("is-open")) closeTicketsDrawer();
  else openTicketsDrawer();
}

function wireTicketsDrawer() {
  const btn = byId("ticketsToggleBtn");
  if (!btn) return;

  // Estado limpio al cargar (evita drawer “pegado”)
  closeTicketsDrawer();

  // Toggle por botón
  btn.addEventListener("click", () => toggleTicketsDrawer());

  // Cerrar con ESC (desktop)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTicketsDrawer();
  });

  // Si salimos de mobile, cerramos
  window.addEventListener("resize", () => {
    if (!isMobileViewport()) closeTicketsDrawer();
  });
}

function setRouteStats(text) {
  const el = byId("routeStats");
  if (el) el.textContent = text || "";
}

function priorityBadge(pr) {
  if (pr === "alta") return { bg: "#ffe4e6", fg: "#be123c" };
  if (pr === "media") return { bg: "#fef3c7", fg: "#b45309" };
  if (pr === "baja") return { bg: "#d1fae5", fg: "#047857" };
  return { bg: "#e2e8f0", fg: "#334155" };
}

function markerColor(pr) {
  if (pr === "alta") return "#ef4444";   // rojo vivo
  if (pr === "media") return "#f59e0b";  // ámbar vivo
  if (pr === "baja") return "#22c55e";   // verde vivo
  return "#3b82f6"; // azul
}

function ensureMapVisualStyles() {
  if (document.getElementById("map-visual-styles")) return;

  const style = document.createElement("style");
  style.id = "map-visual-styles";
  style.textContent = `
    .lnd-pin { position: relative; width: 18px; height: 18px; }
    .lnd-pin__ring {
      position:absolute; inset:-8px;
      border-radius:9999px;
      border:2px solid rgba(255,255,255,.95);
      box-shadow: 0 10px 24px rgba(0,0,0,.18);
      opacity:.9;
    }
    .lnd-pin__dot {
      position:absolute; inset:0;
      border-radius:9999px;
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.92);
    }
    .lnd-pin__pulse {
      position:absolute; inset:-12px;
      border-radius:9999px;
      opacity:.25;
      animation: lndPulse 1.6s ease-out infinite;
    }
    @keyframes lndPulse {
      0% { transform: scale(.55); opacity:.32; }
      70% { transform: scale(1.15); opacity: 0; }
      100% { transform: scale(1.15); opacity: 0; }
    }

    .lnd-route-dot {
      width: 14px; height: 14px;
      border-radius: 9999px;
      background: #ffffff;
      border: 3px solid #2563eb;
      box-shadow: 0 10px 22px rgba(0,0,0,.22);
    }
  `;

  document.head.appendChild(style);
}

function statusLabel(st) {
  const m = {
    nuevo: "Nuevo",
    en_revision: "En revisión",
    asignado: "Asignado",
    en_visita: "En visita",
    en_espera: "En espera",
    resuelto: "Resuelto",
    cerrado: "Cerrado",
  };
  return m[st] || st || "—";
}

function getMapFilters() {
  const pr = byId("mapFilterPriority")?.value || "all";
  const zn = byId("mapFilterZone")?.value || "all";
  const st = byId("mapFilterStatus")?.value || "all";
  return { priority: pr, zone: zn, status: st };
}

function applyMapFilters(allTickets) {
  const { priority, zone, status } = getMapFilters();

  return (allTickets || []).filter((t) => {
    // ✅ Por defecto NO mostrar cerrados (a menos que el filtro sea "cerrado")
    if (status === "all" && t.estado === "cerrado") return false;

    const matchPriority = priority === "all" || t.prioridad === priority;
    const matchZone = zone === "all" || t.zona === zone;
    const matchStatus = status === "all" || t.estado === status;

    return matchPriority && matchZone && matchStatus;
  });
}

function clearMarkers() {
  markers.forEach((m) => {
    try { m.remove(); } catch {}
  });
  markers = [];
}

function renderSideList(tickets) {
  const wrap = byId("ticketsList");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!tickets?.length) {
    wrap.innerHTML = `<div class="text-sm text-slate-500">No hay tickets con esos filtros.</div>`;
    return;
  }

  tickets.forEach((t) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "w-full text-left border border-slate-200 rounded-2xl p-3 bg-white hover:bg-slate-50 transition";

    const pr = priorityBadge(t.prioridad);

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
          style="background:${pr.bg}; color:${pr.fg}">
          ${t.prioridad || "—"}
        </span>
        <span class="text-[10px] text-slate-400 font-mono">#${t.id}</span>
      </div>

      <div class="mt-2 font-bold text-slate-800">${t.cliente || "—"}</div>
      <div class="text-xs text-slate-500 mt-1">Zona ${t.zona || "Sin definir"}</div>
      <div class="text-xs text-slate-500 mt-1">Estado: ${statusLabel(t.estado)}</div>
      <div class="text-xs text-slate-500 mt-1">${t.bloque || ""}</div>

      <div class="mt-2 text-xs text-blue-600 font-bold">Ver detalle</div>
    `;

    card.addEventListener("click", () => {
      const lat = Number(t.lat);
      const lng = Number(t.lng);

      // si no hay ubicación -> abre detalle
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        if (isMobileViewport()) closeTicketsDrawer();
        window.location.href = `ticket_detail.html?id=${encodeURIComponent(t.id)}`;
        return;
      }

      if (isMobileViewport()) closeTicketsDrawer();
      map.setView([lat, lng], 16);

      // abre popup del marker si existe
      const mk = markers.find((mm) => mm?.__ticketId === t.id);
      if (mk) mk.openPopup();
    });

    wrap.appendChild(card);
  });
}

function renderMapPins(tickets) {
  if (!map) return;
  

  clearMarkers();

  tickets.forEach((t) => {
    const lat = Number(t.lat);
    const lng = Number(t.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    ensureMapVisualStyles();

    const c = markerColor(t.prioridad);

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="lnd-pin">
          <div class="lnd-pin__pulse" style="background:${c}"></div>
          <div class="lnd-pin__ring"></div>
          <div class="lnd-pin__dot" style="background:${c}"></div>
        </div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const marker = L.marker([lat, lng], { icon });

    marker.__ticketId = t.id;

    const popupHtml = `
      <div class="text-sm">
        <div class="font-bold text-slate-800">${t.cliente || "—"}</div>
        <div class="text-xs text-slate-500 mt-1">Zona: ${t.zona || "Sin definir"}</div>
        <div class="text-xs text-slate-500 mt-1">Estado: ${statusLabel(t.estado)}</div>
        <div class="text-xs text-slate-500 mt-1">Prioridad: ${t.prioridad || "—"}</div>
        <div class="text-xs text-slate-500 mt-1">Problema: ${t.issue_type || "otro"}</div>
        <div class="mt-2">
          <a class="text-xs text-blue-600 font-bold"
             href="ticket_detail.html?id=${encodeURIComponent(t.id)}">
            Abrir detalle
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, { closeButton: true });
    marker.addTo(map);

    markers.push(marker);
  });
}

function renderMapView() {
  const all = getTickets();
  const filtered = applyMapFilters(all);

  renderSideList(filtered);
  renderMapPins(filtered);

  const countEl = byId("mapCount");
  if (countEl) countEl.textContent = String(filtered.length);
}

async function loadTicketsAndRender() {
  const data = await fetchTickets();
  setTickets(data);
  renderMapView();
}

// =========================
// METAHEURÍSTICA DE RUTA
// Nearest Neighbor + 2-opt
// (Haversine km)
// =========================

function kmToTravelMinutes(km) {
  // Ajusta esto a tu realidad (2.2 min/km ≈ 27 km/h promedio)
  return km * 2.2;
}

function formatMinutes(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  return `${h}h ${r}m`;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

function priorityWeight(pr) {
  if (pr === "alta") return 1.8;
  if (pr === "media") return 1.2;
  return 1.0;
}

function estimateServiceMinutesByIssueType(issueType) {
  switch (issueType) {
    // Estándares (P75) derivados del histórico
    case "sin_potencia": return 150;
    case "intermitencia": return 130;
    case "corte_puerto": return 90;
    case "corte_fibra": return 60;
    case "instalacion": return 75;
    case "potencia_atenuada": return 80;
    case "corte_spliter": return 50;
    case "modem_desconfigurado": return 120;
    case "sin_internet": return 25;
    case "sin_navegacion": return 40;
    default: return 55;
  }
}

function estimateServiceMinutes(t) {
  return estimateServiceMinutesByIssueType(t.issue_type || "otro");
}

function edgeCost(a, b) {
  const dKm = haversineKm(a, b);

  // ✅ km → minutos (ajusta luego con históricos)
  const travelMin = dKm * 2.2; // ~27 km/h promedio

  // ✅ servicio estimado por tipo
  const serviceMin = estimateServiceMinutes(b);

  const base = travelMin + serviceMin;

  // ✅ costo = traslado + servicio (sin ponderación por prioridad)
  return base;
}

function nearestNeighborRoute(start, nodes) {
  const remaining = nodes.slice();
  const route = [];
  let current = start;

  while (remaining.length) {
    let bestIdx = 0;
    let bestCost = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = edgeCost(current, remaining[i]);
      if (c < bestCost) {
        bestCost = c;
        bestIdx = i;
      }
    }

    const next = remaining.splice(bestIdx, 1)[0];
    route.push(next);
    current = next;
  }

  return route;
}

function twoOpt(route, start, maxIters = 80) {
  if (route.length < 4) return route;

  const costOf = (arr) => {
    let total = 0;
    let prev = start;
    for (const n of arr) {
      total += edgeCost(prev, n);
      prev = n;
    }
    return total;
  };

  let best = route.slice();
  let bestCost = costOf(best);

  for (let iter = 0; iter < maxIters; iter++) {
    let improved = false;

    for (let i = 0; i < best.length - 2; i++) {
      for (let k = i + 1; k < best.length - 1; k++) {
        const candidate = best.slice();
        const reversed = candidate.slice(i, k + 1).reverse();
        candidate.splice(i, k - i + 1, ...reversed);

        const cCost = costOf(candidate);
        if (cCost + 1e-9 < bestCost) {
          best = candidate;
          bestCost = cCost;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

// bloques mañana/tarde/sin
function normalizeTimeBlock(tb) {
  const v = String(tb || "").toLowerCase();
  if (v.includes("mañ")) return "manana";
  if (v.includes("tard")) return "tarde";
  return "sin";
}

function orderByTimeBlockThenOptimize(start, tickets) {
  const nodes = tickets.map((t) => ({
    id: t.id,
    cliente: t.cliente,
    prioridad: t.prioridad,
    estado: t.estado,
    zona: t.zona,
    time_block: t.bloque || t.time_block || "",
    lat: Number(t.lat),
    lng: Number(t.lng),
    issue_type: t.issue_type || "otro",
  }));

  const manana = nodes.filter((n) => normalizeTimeBlock(n.time_block) === "manana");
  const tarde = nodes.filter((n) => normalizeTimeBlock(n.time_block) === "tarde");
  const sin = nodes.filter((n) => normalizeTimeBlock(n.time_block) === "sin");

  const solveBlock = (blockStart, blockNodes) => {
    if (!blockNodes.length) return [];
    const nn = nearestNeighborRoute(blockStart, blockNodes);
    return twoOpt(nn, blockStart, 70);
  };

  const r1 = solveBlock(start, manana);
  const last1 = r1.length ? r1[r1.length - 1] : start;

  const r2 = solveBlock(last1, tarde);
  const last2 = r2.length ? r2[r2.length - 1] : last1;

  const r3 = solveBlock(last2, sin);

  return [...r1, ...r2, ...r3];
}

function clearRouteOverlay() {
  // detener animación si existe
  if (routeAnimTimer) {
    clearInterval(routeAnimTimer);
    routeAnimTimer = null;
  }
  if (routeAnimDot) {
    try { routeAnimDot.remove(); } catch {}
    routeAnimDot = null;
  }

  if (routeLine) {
    try { routeLine.remove(); } catch {}
    routeLine = null;
  }

  routeBadges.forEach((m) => {
    try { m.remove(); } catch {}
  });
  routeBadges = [];

  setRouteStats("");
  
}

function debugRouteCostTable(start, orderedNodes) {
  try {
    const rows = [];

    let prev = start;
    let totalKm = 0;
    let totalTravelMin = 0;
    let totalServiceMin = 0;
    let totalMin = 0;

    for (let i = 0; i < orderedNodes.length; i++) {
      const n = orderedNodes[i];
      const km = haversineKm(prev, n);
      const travelMin = kmToTravelMinutes(km);
      const serviceMin = estimateServiceMinutes(n);
      const stepTotal = travelMin + serviceMin;

      totalKm += km;
      totalTravelMin += travelMin;
      totalServiceMin += serviceMin;
      totalMin += stepTotal;

      rows.push({
        stop: i + 1,
        ticket_id: n.id,
        cliente: n.cliente,
        bloque: n.time_block || "",
        issue_type: n.issue_type || "otro",
        km: Number(km.toFixed(2)),
        travelMin: Math.round(travelMin),
        serviceMin: Math.round(serviceMin),
        stepTotal: Math.round(stepTotal),
        cumTotal: Math.round(totalMin),
      });

      prev = n;
    }

    console.groupCollapsed(
      `[Ruta DEBUG] N=${orderedNodes.length} | km=${totalKm.toFixed(1)} | ` +
        `travel=${Math.round(totalTravelMin)}m | service=${Math.round(totalServiceMin)}m | total=${Math.round(totalMin)}m`
    );
    console.table(rows);
    console.groupEnd();
  } catch (e) {
    console.warn("[Ruta DEBUG] No se pudo generar tabla", e);
  }
}

function drawRouteOnMap(start, orderedNodes) {
  if (!map) return;

  clearRouteOverlay();

  const coords = [
    [start.lat, start.lng],
    ...orderedNodes.map((n) => [n.lat, n.lng]),
  ];

  routeLine = L.polyline(coords, {
    color: "#2563eb",
    weight: 6,
    opacity: 0.92,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(map);

  // numeritos 1..N
  orderedNodes.forEach((n, idx) => {
    const html = `
      <div style="
        width: 22px; height: 22px;
        border-radius: 9999px;
        background: white;
        border: 2px solid #2563eb;
        color: #2563eb;
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 11px;
        box-shadow: 0 4px 10px rgba(0,0,0,.12);
      ">${idx + 1}</div>
    `;

    const icon = L.divIcon({
      className: "",
      html,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const badge = L.marker([n.lat, n.lng], { icon, interactive: false }).addTo(map);
    routeBadges.push(badge);
  });

  // Distancia total (km) aproximada
  // ✅ Stats: km + traslado + servicio + total
  let totalKm = 0;
  let travelMin = 0;
  let serviceMin = 0;

  let prev = start;

  for (const n of orderedNodes) {
    const km = haversineKm(prev, n);
    totalKm += km;
    travelMin += kmToTravelMinutes(km);
    serviceMin += estimateServiceMinutes(n); // usa issue_type
    prev = n;
  }

  const totalMin = travelMin + serviceMin;

  setRouteStats(
    `Ruta: ${orderedNodes.length} tickets · ${totalKm.toFixed(1)} km · ` +
    `Traslado ${formatMinutes(travelMin)} · Servicio ${formatMinutes(serviceMin)} · ` +
    `Total ${formatMinutes(totalMin)}`
  );

  // encuadrar
  const bounds = L.latLngBounds(coords);
  map.fitBounds(bounds, { padding: [30, 30] });
}

function animateRouteOnMap(start, orderedNodes) {
  if (!map) return Promise.resolve(false);

  // ✅ Aquí va el Promise: queremos poder "await" a que termine la animación
  return new Promise((resolve) => {
    ensureMapVisualStyles();
    clearRouteOverlay();

    const coords = [
      [start.lat, start.lng],
      ...orderedNodes.map((n) => [n.lat, n.lng]),
    ];

    // crea polyline vacía (va creciendo)
    routeLine = L.polyline([coords[0]], {
      color: "#2563eb",
      weight: 6,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // dot que avanza por la ruta
    routeAnimDot = L.marker(coords[0], {
      interactive: false,
      icon: L.divIcon({
        className: "",
        html: `<div class="lnd-route-dot"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(map);

    // numeritos 1..N (se ven desde el inicio)
    orderedNodes.forEach((n, idx) => {
      const html = `
        <div style="
          width: 22px; height: 22px;
          border-radius: 9999px;
          background: white;
          border: 2px solid #2563eb;
          color: #2563eb;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 11px;
          box-shadow: 0 4px 10px rgba(0,0,0,.12);
        ">${idx + 1}</div>
      `;

      const icon = L.divIcon({
        className: "",
        html,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const badge = L.marker([n.lat, n.lng], { icon, interactive: false }).addTo(map);
      routeBadges.push(badge);
    });

    // Stats (igual que drawRouteOnMap)
    let totalKm = 0;
    let travelMin = 0;
    let serviceMin = 0;

    let prev = start;

    for (const n of orderedNodes) {
      const km = haversineKm(prev, n);
      totalKm += km;
      travelMin += kmToTravelMinutes(km);
      serviceMin += estimateServiceMinutes(n);
      prev = n;
    }

    const totalMin = travelMin + serviceMin;

    setRouteStats(
      `Ruta: ${orderedNodes.length} tickets · ${totalKm.toFixed(1)} km · ` +
      `Traslado ${formatMinutes(travelMin)} · Servicio ${formatMinutes(serviceMin)} · ` +
      `Total ${formatMinutes(totalMin)}`
    );

    debugRouteCostTable(start, orderedNodes);

    // encuadrar
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [30, 30] });

    // animación incremental
    let i = 1;
    const stepMs = 60; // rápido pero visible

    routeAnimTimer = setInterval(() => {
      if (!routeLine) return;

      if (i >= coords.length) {
        clearInterval(routeAnimTimer);
        routeAnimTimer = null;
        resolve(true);
        return;
      }

      const currentLatLngs = routeLine.getLatLngs();
      currentLatLngs.push(coords[i]);
      routeLine.setLatLngs(currentLatLngs);
      routeAnimDot.setLatLng(coords[i]);

      i += 1;
    }, stepMs);

  });
}

// MVP: start = centro del mapa
const TECH_LOCATION = { lat: 18.8813, lng: -99.0671 }; // Yautepec aprox
let techMarker;

function renderTechMarker() {
  if (!map) return;
  if (techMarker) {
    try { techMarker.remove(); } catch {}
  }

  techMarker = L.marker([TECH_LOCATION.lat, TECH_LOCATION.lng], {
    icon: L.divIcon({
      className: "",
      html: `
        <div style="
          background:#2563eb;
          width:18px; height:18px;
          border-radius:9999px;
          border:3px solid white;
          box-shadow:0 0 0 4px rgba(37,99,235,.25);
        "></div>
      `,
      iconSize: [18,18],
      iconAnchor: [9,9],
    }),
  })
    .addTo(map)
    .bindPopup("<b>Técnico</b><br>Punto de inicio");
}

function getStartPoint() {
  return {
    lat: TECH_LOCATION.lat,
    lng: TECH_LOCATION.lng,
    prioridad: "baja",
  };
}

async function optimizeRouteFromCurrentFilters(animate = true) {
  const all = getTickets();
  const filtered = applyMapFilters(all).filter((t) => {
    const lat = Number(t.lat);
    const lng = Number(t.lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });

  if (!filtered.length) {
    alert("No hay tickets con ubicación (lat/lng) para optimizar.");
    return;
  }

  const start = getStartPoint();
  const route = orderByTimeBlockThenOptimize(start, filtered);

  if (animate) {
    await animateRouteOnMap(start, route);
  } else {
    drawRouteOnMap(start, route);
  }
}

function wireRouteButtons() {
  const opt = byId("routeOptimizeBtn");
  const clr = byId("routeClearBtn");

  opt?.addEventListener("click", async () => {
    if (!opt) return;

    // evita spameo
    if (opt.dataset.loading === "1") return;
    opt.dataset.loading = "1";

    const prevText = opt.textContent;
    opt.textContent = "Optimizando…";
    opt.classList.add("opacity-80", "cursor-not-allowed");
    opt.disabled = true;

    try {
      setRouteStats("Construyendo ruta…");
      await optimizeRouteFromCurrentFilters(true);
    } catch (e) {
      console.error("[map-ui] optimizeRoute error", e);
    } finally {
      opt.dataset.loading = "0";
      opt.textContent = prevText;
      opt.classList.remove("opacity-80", "cursor-not-allowed");
      opt.disabled = false;
    }
  });

  clr?.addEventListener("click", () => {
    clearRouteOverlay();
  });
}

// =========================
// Wiring filtros + Leaflet
// =========================
function wireMapFilters() {
  const pr = byId("mapFilterPriority");
  const zn = byId("mapFilterZone");
  const st = byId("mapFilterStatus");
  const clearBtn = byId("mapClearFilters");

  pr?.addEventListener("change", renderMapView);
  zn?.addEventListener("change", renderMapView);
  st?.addEventListener("change", renderMapView);

  clearBtn?.addEventListener("click", () => {
    if (pr) pr.value = "all";
    if (zn) zn.value = "all";
    if (st) st.value = "all";
    renderMapView();
  });
}

function initLeaflet() {
  const el = byId("map");
  if (!el) return;

  // Centro Yautepec default (como lo traías)
  map = L.map("map", { zoomControl: true }).setView([18.896, -99.067], 13);

  ensureMapVisualStyles();

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
}

document.addEventListener("DOMContentLoaded", async () => {
  initLeaflet();
  renderTechMarker();
  wireMapFilters();
  wireRouteButtons(); // ✅ NUEVO
  wireTicketsDrawer();
  await loadTicketsAndRender();
});
