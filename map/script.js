/* ================= GLOBAL ================= */
const header1 = document.getElementById("header_1"),
      header2 = document.getElementById("header_2"),
      map = L.map("map", { zoomControl: false, attributionControl: false }).setView([46.5, 2.5], 6.5),
      spatialMenu = document.getElementById("spatial_menu"),
      searchPlace = document.getElementById("search_place"),
      suggestionsList = document.getElementById("suggestions"),
      resetFilterBtn = document.querySelector("#spatial_menu #resetFilter"),
      cinemaInfo = document.getElementById("cinemaInfo");

let pointsData = null, pointsLayer = null, selectedPointLayer = null;

/* ================= MAP INIT ================= */
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: "&copy; CartoDB", maxZoom: 19 }).addTo(map);
map.setMaxBounds([[41, -5.5], [51.5, 10]]);
map.setMinZoom(5.5);

/* ================= FRANCE MASK ================= */
fetch("france_territory.geojson").then(r=>r.json()).then(fr=>{
  const world=[[[-180,-90],[180,-90],[180,90],[-180,90]]], rings=[];
  fr.features.forEach(f=>{
    const g=f.geometry;
    if(g.type==="Polygon") g.coordinates.forEach(r=>rings.push(r));
    if(g.type==="MultiPolygon") g.coordinates.forEach(poly=>poly.forEach(r=>rings.push(r)));
  });
  L.geoJSON({type:"Feature",geometry:{type:"Polygon",coordinates:[world[0],...rings]}},
    {style:{fillColor:"black",fillOpacity:0.7,color:"transparent"}}).addTo(map);
});

/* ================= LOAD POINTS ================= */
fetch("data_2024.geojson").then(r=>r.json()).then(d=>pointsData=d).catch(e=>console.error("Load error:",e));

/* ================= POINTS ================= */
const defStyle={radius:6,fillColor:"#2C2C26",color:"#2C2C26",weight:1,opacity:1,fillOpacity:0.8},
      selStyle={radius:7,fillColor:"#FFD700",color:"#C9A400",weight:2,opacity:1,fillOpacity:1};

function showPoints(fData=null){
  if(pointsData && !pointsLayer){
    const data=fData||pointsData;
    pointsLayer=L.geoJSON(data,{
      pointToLayer:(f,ll)=>L.circleMarker(ll,defStyle),
      onEachFeature:(f,ly)=>{
        ly.on("click",()=>{
          const both=header1.classList.contains("right")&&header2.classList.contains("right");
          if(both){
            if(selectedPointLayer&&selectedPointLayer!==ly)selectedPointLayer.setStyle(defStyle);
            ly.setStyle(selStyle);selectedPointLayer=ly;showCinemaInfo(f.properties);return;
          }
          if(header1.classList.contains("right"))showCinemaInfo(f.properties);
          else if(header2.classList.contains("right"))map.setView(ly.getLatLng(),13);
        });
        const setCursor=()=>{
          if(!ly._path)return;
          ly._path.style.cursor=header1.classList.contains("right")?"pointer":
                                header2.classList.contains("right")?"crosshair":"default";
        };
        ly.on("add",setCursor);
        header1.addEventListener("click",setCursor);
        header2.addEventListener("click",setCursor);
      }
    }).addTo(map);
  }
}
function hidePoints(){ if(pointsLayer){ map.removeLayer(pointsLayer); pointsLayer=null; } }
function resetSelectedPoint(){ if(selectedPointLayer){ selectedPointLayer.setStyle(defStyle); selectedPointLayer=null; } }
header1.addEventListener("click",resetSelectedPoint);
header2.addEventListener("click",resetSelectedPoint);

/* ================= FILTER + AUTOCOMPLETE ================= */
function updateSuggestions(){
  const v=searchPlace.value.trim().toLowerCase();
  suggestionsList.innerHTML=""; if(!v||!pointsData)return;
  const opts=new Set();
  pointsData.features.forEach(f=>{
    const d=f.properties.departement_admin||"", u=f.properties.unite_urbaine||"";
    if(d.includes(v))opts.add(d); if(u.toLowerCase().includes(v))opts.add(u);
  });
  opts.forEach(o=>{
    const li=document.createElement("li");
    li.textContent=o;
    li.onclick=()=>{ searchPlace.value=o; suggestionsList.innerHTML=""; filterBySelection(o); };
    suggestionsList.appendChild(li);
  });
}
function filterBySelection(val){
  if(!pointsData)return; hidePoints();
  const filt={type:"FeatureCollection",features:pointsData.features.filter(f=>{
    const d=f.properties.departement_admin||"",u=f.properties.unite_urbaine||"";
    return d===val||u===val;
  })};
  showPoints(filt);
}
searchPlace.oninput=updateSuggestions;
resetFilterBtn.onclick=()=>{ searchPlace.value=""; suggestionsList.innerHTML=""; hidePoints(); if(header2.classList.contains("right"))showPoints(); };

/* ================= CINEMA INFO PANEL ================= */
function generatePieChart(data,{size=120}={}){
  const r=size/2,c=2*Math.PI*r;let off=0;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${data.map(it=>{const dash=it.value*c,el=`<circle r="${r}" cx="${r}" cy="${r}" fill="transparent" stroke="${it.color}" stroke-width="${r}" stroke-dasharray="${dash} ${c-dash}" stroke-dashoffset="${off}"/>`;off-=dash;return el;}).join("")}</svg>`;
}
function showCinemaInfo(p){
  const total=p.nb_film,ae=p.nb_filmAE,nonAE=total-ae,pAE=(ae/total)*100,pNon=(nonAE/total)*100;
  const aeCats=["A","B","C","D","E"],active=p.label_AE==="OUI"?p.categorie_AE:null;
  const pieData=[
    {label:"Films français",value:p.pdm_filmFR,color:"#3498db"},
    {label:"Films américains",value:p.pdm_filmUS,color:"#e74c3c"},
    {label:"Films européens",value:p.pdm_filmEU,color:"#f1c40f"},
    {label:"Autres films",value:p.pdm_filmMO,color:"#9b59b2"}
  ];
  let h=`<button class="close-btn">&times;</button>
  <h1>${p.nom_etablissement}</h1>
  <p class="adresse">${p.adresse}<br>Zone urbaine: ${p.unite_urbaine}</p>
  <p class="nb_seances">${p.nb_seance} séances en 2024</p>
  <div class="films-bar-container">
    <div class="films-bar"><div class="films-bar-ae" style="width:${pAE}%"></div><div class="films-bar-non-ae" style="width:${pNon}%"></div></div>
    <div class="films-bar-legend"><span class="ae">AE: ${ae}</span><span class="non-ae">non AE: ${nonAE}</span></div>
  </div>`;
  h+=p.label_AE==="OUI"?`<p class="ae-title">Label Art & Essai</p>`:`<p class="ae-none">Non labellisé AE</p>`;
  h+=`<div class="ae-histogram">${aeCats.map(c=>`<div class="ae-row"><span class="ae-label">${c}</span><div class="ae-bar-wrapper"><div class="ae-bar ${c===active?"active":"inactive"}"></div></div></div>`).join("")}</div>
  <div class="pdm-chart"><p>Part de marché</p><div class="pdm-chart-wrapper">${generatePieChart(pieData)}<ul class="pdm-legend">${pieData.map(d=>`<li><span class="dot" style="background:${d.color}"></span>${d.label} – ${(d.value*100).toFixed(0)}%</li>`).join("")}</ul></div></div>`;
  cinemaInfo.innerHTML=h; cinemaInfo.classList.remove("hidden");
  cinemaInfo.querySelector(".close-btn").onclick=()=>cinemaInfo.classList.add("hidden");
}
function updateCinemaInfoVisibility(){ if(!header1.classList.contains("right"))cinemaInfo.classList.add("hidden"); }

/* ================= SIDEBARS ================= */
header2.onclick=()=>{
  if(!header2.classList.contains("right")&&!header1.classList.contains("right")){
    header2.classList.add("right"); showPoints(); spatialMenu.classList.remove("hidden"); return;
  }
  if(header2.classList.contains("right")&&header1.classList.contains("right")){
    header1.classList.remove("right"); spatialMenu.classList.remove("hidden"); updateCinemaInfoVisibility(); return;
  }
  if(header1.classList.contains("right"))return;
  header2.classList.toggle("right");
  if(header2.classList.contains("right")){ showPoints(); spatialMenu.classList.remove("hidden"); }
  else{ hidePoints(); spatialMenu.classList.add("hidden"); searchPlace.value=""; suggestionsList.innerHTML=""; updateCinemaInfoVisibility(); }
};

header1.onclick=()=>{
  if(!header2.classList.contains("right")&&!header1.classList.contains("right")){
    header2.classList.add("right"); showPoints(); spatialMenu.classList.remove("hidden"); return;
  }
  if(!header2.classList.contains("right"))return;
  if(header2.classList.contains("right")&&header1.classList.contains("right")){
    header1.classList.remove("right"); spatialMenu.classList.remove("hidden"); updateCinemaInfoVisibility(); return;
  }
  header1.classList.toggle("right");
  if(header1.classList.contains("right"))spatialMenu.classList.add("hidden");
  else{ if(header2.classList.contains("right"))spatialMenu.classList.remove("hidden"); updateCinemaInfoVisibility(); }
};

/* ================= TUTORIAL ================= */
const tutorial0=document.getElementById("tutorial_phase0"),
      tutorial1=document.getElementById("tutorial_phase1");
let t0Closed=false,t1Closed=false;
tutorial0.classList.add("hidden"); tutorial1.classList.add("hidden");

function updateTutorials(){
  const h1=header1.classList.contains("right"),h2=header2.classList.contains("right"),
        phase0=!h1&&!h2,phase1=h2&&!h1;
  if(phase0&&!t0Closed)tutorial0.classList.remove("hidden"); else tutorial0.classList.add("hidden");
  if(phase1&&!t1Closed)tutorial1.classList.remove("hidden"); else tutorial1.classList.add("hidden");
}
document.addEventListener("click",e=>{
  if(e.target.classList.contains("close-btn")){
    const box=e.target.closest(".tutorial"); if(!box)return;
    if(box.id==="tutorial_phase0")t0Closed=true; if(box.id==="tutorial_phase1")t1Closed=true;
    box.classList.add("hidden");
  }
});
header1.addEventListener("click",updateTutorials);
header2.addEventListener("click",updateTutorials);
window.addEventListener("load",updateTutorials);
