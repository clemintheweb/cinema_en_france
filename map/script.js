/* ========================================================
   0. DÉCLARATIONS GLOBALES
   ======================================================== */

// Sidebars
const header2 = document.getElementById("header_2");
const header1 = document.getElementById("header_1");

// Carte
const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([46.5, 2.5], 6.5);

// Variables pour les points et données
let pointsData = null;
let pointsLayer = null;
let selectedPointLayer = null;

// Menu de recherche
const spatialMenu = document.getElementById("spatial_menu");
const searchPlace = document.getElementById("search_place");
const suggestionsList = document.getElementById("suggestions");
const resetFilterBtn = document.querySelector("#spatial_menu #resetFilter");

// Panneau d'infos cinéma
const cinemaInfo = document.getElementById("cinemaInfo");

/* ========================================================
   1. INITIALISATION DE LA CARTE
   ======================================================== */
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; CartoDB',
  maxZoom: 19,
}).addTo(map);

const franceBounds = [[41.0, -5.5],[51.5, 10.0]];
map.setMaxBounds(franceBounds);
map.setMinZoom(5.5);

/* ========================================================
   2. MASQUE DE LA FRANCE
   ======================================================== */
fetch("france_territory.geojson")
  .then(r => r.json())
  .then(france => {
    const world = [[[-180,-90],[180,-90],[180,90],[-180,90]]];
    let franceRings = [];
    france.features.forEach(f => {
      const g = f.geometry;
      if (g.type === "Polygon") g.coordinates.forEach(r => franceRings.push(r));
      if (g.type === "MultiPolygon") g.coordinates.forEach(poly => poly.forEach(r => franceRings.push(r)));
    });
    const maskFeature = { type: "Feature", geometry: { type: "Polygon", coordinates: [world[0], ...franceRings] }};
    L.geoJSON(maskFeature, { style: { fillColor:"black", fillOpacity:0.7, color:"transparent" }}).addTo(map);
  });

/* ========================================================
   3. CHARGEMENT DES POINTS GEOJSON
   ======================================================== */
fetch('data_2024.geojson')
  .then(r => r.json())
  .then(data => pointsData = data)
  .catch(err => console.error('Erreur chargement points :', err));

/* ========================================================
   4. FONCTIONS POINTS
   ======================================================== */

const defaultPointStyle = {
  radius: 6,
  fillColor: "#2C2C26",
  color: "#2C2C26",
  weight: 1,
  opacity: 1,
  fillOpacity: 0.8
};

const selectedPointStyle = {
  radius: 7,
  fillColor: "#FFD700",   // jaune
  color: "#C9A400",
  weight: 2,
  opacity: 1,
  fillOpacity: 1
};

function showPoints(filteredData = null) {
  if (pointsData && !pointsLayer) {
    const dataToShow = filteredData || pointsData;

    pointsLayer = L.geoJSON(dataToShow, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, defaultPointStyle),

      onEachFeature: (feature, layer) => {

        layer.on("click", () => {

          const bothHeadersRight =
            header1.classList.contains("right") &&
            header2.classList.contains("right");
            //les deux headers à droite
          if (bothHeadersRight) {

            // reset ancien point sélectionné
            if (selectedPointLayer && selectedPointLayer !== layer) {
            selectedPointLayer.setStyle(defaultPointStyle);
            }

            layer.setStyle(selectedPointStyle);
            selectedPointLayer = layer;

            showCinemaInfo(feature.properties);
            return;
          }

          //  LOGIQUE INITIALE
          if (header1.classList.contains("right")) {
            showCinemaInfo(feature.properties);
          } else if (header2.classList.contains("right")) {
            map.setView(layer.getLatLng(), 13);
          }
        });

        // curseur 
        const updateCursor = () => {
          if (!layer._path) return;
          if (header1.classList.contains("right"))
            layer._path.style.cursor = "pointer";
          else if (header2.classList.contains("right"))
            layer._path.style.cursor = "crosshair";
          else
            layer._path.style.cursor = "default";
        };

        layer.on("add", updateCursor);
        header1.addEventListener("click", updateCursor);
        header2.addEventListener("click", updateCursor);
      }
    }).addTo(map);
  }
}

function resetSelectedPoint() {
  if (selectedPointLayer) {
    selectedPointLayer.setStyle(defaultPointStyle);
    selectedPointLayer = null;
  }
}

header1.addEventListener("click", resetSelectedPoint);
header2.addEventListener("click", resetSelectedPoint);


function hidePoints() {
  if (pointsLayer) {
    map.removeLayer(pointsLayer);
    pointsLayer = null;
  }
}

/* ========================================================
   5. FILTRAGE ET AUTOCOMPLÉTION
   ======================================================== */
function updateSuggestions() {
  const val = searchPlace.value.trim().toLowerCase();
  suggestionsList.innerHTML = "";
  if (!val || !pointsData) return;

  const uniqueOptions = new Set();
  pointsData.features.forEach(f => {
    const dept = f.properties.departement_admin || "";
    const uu = f.properties.unite_urbaine || "";
    if (dept.includes(val)) uniqueOptions.add(dept);
    if (uu.toLowerCase().includes(val)) uniqueOptions.add(uu);
  });

  uniqueOptions.forEach(opt => {
    const li = document.createElement("li");
    li.textContent = opt;
    li.addEventListener("click", () => {
      searchPlace.value = opt;
      suggestionsList.innerHTML = "";
      filterBySelection(opt);
    });
    suggestionsList.appendChild(li);
  });
}

function filterBySelection(value) {
  if (!pointsData) return;
  hidePoints();

  const filtered = {
    type: "FeatureCollection",
    features: pointsData.features.filter(f => {
      const dept = f.properties.departement_admin || "";
      const uu = f.properties.unite_urbaine || "";
      return dept === value || uu === value;
    })
  };

  showPoints(filtered);
}

searchPlace.addEventListener("input", updateSuggestions);
resetFilterBtn.addEventListener("click", () => {
  searchPlace.value = "";
  suggestionsList.innerHTML = "";
  hidePoints();
  if (header2.classList.contains("right")) showPoints();
});

/* ========================================================
   6. FENÊTRE D'INFOS CINÉMA
   ======================================================== */
// fonction général pour le pie chart
function generatePieChart(data, options = {}) {
  const size = options.size || 120;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${data
        .map(item => {
          const dash = item.value * circumference;
          const circle = `
            <circle
              r="${radius}"
              cx="${cx}"
              cy="${cy}"
              fill="transparent"
              stroke="${item.color}"
              stroke-width="${radius}"
              stroke-dasharray="${dash} ${circumference - dash}"
              stroke-dashoffset="${offset}"
            />
          `;
          offset -= dash;
          return circle;
        })
        .join("")}
    </svg>
  `;
}

function showCinemaInfo(properties) {
  let html = `<button class="close-btn">&times;</button>`; // bouton croix

  // titre
  html += `<h1>${properties.nom_etablissement} </h1>`;
    
// Adresse 
  html += `<p class="adresse">${properties.adresse} 
    <br> en zone urbaine de ${properties.unite_urbaine}</p>`;
    
// nb de séances 
  html += `<p class="nb_seances">${properties.nb_seance} séances en 2024 
    </p>`;

// nb de films AE et non AE 
const totalFilms = properties.nb_film;
const filmsAE = properties.nb_filmAE;
const filmsNonAE = totalFilms - filmsAE;

const pctAE = (filmsAE / totalFilms) * 100;
const pctNonAE = (filmsNonAE / totalFilms) * 100;

html += `
  <div class="films-bar-container">
    <div class="films-bar">
      <div class="films-bar-ae" style="width:${pctAE}%"></div>
      <div class="films-bar-non-ae" style="width:${pctNonAE}%"></div>
    </div>
    <div class="films-bar-legend">
      <span class="ae">films Art et Essai : ${filmsAE}</span>
      <span class="non-ae">films non AE : ${filmsNonAE}</span>
    </div>
  </div>
`;
    
// label
// Texte selon le label AE
if (properties.label_AE === "OUI") {
  html += `<p class="ae-title">Catégorie du label Art & Essai</p>`;
} else {
  html += `<p class="ae-none">Établissement non labellisé AE</p>`;
}

const aeCategories = ["A", "B", "C", "D", "E"];
const isLabelAE = properties.label_AE === "OUI";
const activeCategory = isLabelAE ? properties.categorie_AE : null;

html += `
  <div class="ae-histogram">
    ${aeCategories
      .map(cat => {
        const isActive = cat === activeCategory;
        return `
          <div class="ae-row">
            <span class="ae-label">${cat}</span>
            <div class="ae-bar-wrapper">
              <div class="ae-bar ${isActive ? "active" : "inactive"}"></div>
            </div>
          </div>
        `;
      })
      .join("")}
  </div>
`;
    
// pie chart des pdm
const pieData = [
  { label: "Films français", value: properties.pdm_filmFR, color: "#3498db" },
  { label: "Films américains", value: properties.pdm_filmUS, color: "#e74c3c" },
  { label: "Films européens", value: properties.pdm_filmEU, color: "#f1c40f" },
  { label: "Autres films", value: properties.pdm_filmMO, color: "#9b59b2" }
];

html += `
  <div class="pdm-chart">
    <p class="pdm-title">Part de marché des films</p>
    <div class="pdm-chart-wrapper">
      ${generatePieChart(pieData)}
      <ul class="pdm-legend">
        ${pieData
          .map(
            d => `
              <li>
                <span class="dot" style="background:${d.color}"></span>
                ${d.label} – ${(d.value * 100).toFixed(0)} %
              </li>
            `
          )
          .join("")}
      </ul>
    </div>
  </div>
`;

    
  html += "</ul>";
  cinemaInfo.innerHTML = html;
  cinemaInfo.classList.remove("hidden");

  // Ajouter l'événement pour fermer la fenêtre
  const closeBtn = cinemaInfo.querySelector(".close-btn");
  closeBtn.addEventListener("click", () => {
    cinemaInfo.classList.add("hidden");
  });
}

function updateCinemaInfoVisibility() {
  if (!header1.classList.contains("right")) cinemaInfo.classList.add("hidden");
}


/* ========================================================
   7. INTERACTION SIDEBARS
   ======================================================== */

// Header 2
header2.addEventListener("click", () => {
    // Si les deux sidebars sont à gauche → clic fait passer header2 à droite
    if (!header2.classList.contains("right") && !header1.classList.contains("right")) {
        header2.classList.add("right");
        showPoints();
        spatialMenu.classList.remove("hidden");
        return;
    }

    // Si les deux sidebars sont à droite → clic fait revenir header1 à gauche
    if (header2.classList.contains("right") && header1.classList.contains("right")) {
        header1.classList.remove("right");
        spatialMenu.classList.remove("hidden");
        updateCinemaInfoVisibility();
        return;
    }

    // Bloqué si header1 est à droite
    if (header1.classList.contains("right")) return;

    // Toggle header2 normalement
    header2.classList.toggle("right");
    if (header2.classList.contains("right")) {
        showPoints();
        spatialMenu.classList.remove("hidden");
    } else {
        hidePoints();
        spatialMenu.classList.add("hidden");
        searchPlace.value = "";
        suggestionsList.innerHTML = "";
        updateCinemaInfoVisibility();
    }
});

// Header 1
header1.addEventListener("click", () => {
    // Si les deux sidebars sont à gauche → clic fait passer header2 à droite
    if (!header2.classList.contains("right") && !header1.classList.contains("right")) {
        header2.classList.add("right");
        showPoints();
        spatialMenu.classList.remove("hidden");
        return;
    }

    // Ne peut s'ouvrir que si header2 est à droite
    if (!header2.classList.contains("right")) return;

    // Si les deux sidebars sont à droite → clic fait revenir header1 à gauche
    if (header2.classList.contains("right") && header1.classList.contains("right")) {
        header1.classList.remove("right");
        spatialMenu.classList.remove("hidden");
        updateCinemaInfoVisibility();
        return;
    }

    // Toggle header1
    header1.classList.toggle("right");

    if (header1.classList.contains("right")) {
        spatialMenu.classList.add("hidden");
    } else {
        if (header2.classList.contains("right")) spatialMenu.classList.remove("hidden");
        updateCinemaInfoVisibility();
    }
});


/* ========================================================
   8. TUTORIELS
   ======================================================== */

// Références DOM
const tutorial0 = document.getElementById("tutorial_phase0");
const tutorial1 = document.getElementById("tutorial_phase1");

// Flags de fermeture permanente
let t0Closed = false;
let t1Closed = false;

tutorial0.classList.add("hidden");
tutorial1.classList.add("hidden");

// Fonction centrale : gère l’état d’affichage
function updateTutorials() {

    const h1Right = header1.classList.contains("right");
    const h2Right = header2.classList.contains("right");

    const inPhase0 = !h1Right && !h2Right;   // rien ouvert
    const inPhase1 = h2Right && !h1Right;    // spatial (header2) ouvert, thematic (header1) fermé

    // ----- Phase 0 : tutoriel d’accueil -----
    if (inPhase0 && !t0Closed) {
        tutorial0.classList.remove("hidden");
    } else {
        tutorial0.classList.add("hidden");
    }

    // ----- Phase 1 : exploration thématique -----
    if (inPhase1 && !t1Closed) {
        tutorial1.classList.remove("hidden");
    } else {
        tutorial1.classList.add("hidden");
    }
}

// Gestion de clic sur bouton "×"
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("close-btn")) {
        const box = e.target.closest(".tutorial");
        if (!box) return;

        if (box.id === "tutorial_phase0") t0Closed = true;
        if (box.id === "tutorial_phase1") t1Closed = true;

        box.classList.add("hidden");
    }
});

// Recalcul à chaque interaction des sidebars
header1.addEventListener("click", updateTutorials);
header2.addEventListener("click", updateTutorials);

// Lancement initial
window.addEventListener("load", () => {
    updateTutorials(); 
});


