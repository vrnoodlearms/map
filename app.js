const dataset = window.WORLD_PARKS || { parks: [], source: "No local dataset found." };

const searchInput = document.querySelector("#searchInput");
const continentFilter = document.querySelector("#continentFilter");
const countryFilter = document.querySelector("#countryFilter");
const resetButton = document.querySelector("#resetButton");
const pointLayer = document.querySelector("#pointLayer");
const gridLayer = document.querySelector("#gridLayer");
const parkList = document.querySelector("#parkList");
const detailCard = document.querySelector("#detailCard");
const visibleCount = document.querySelector("#visibleCount");
const countryCount = document.querySelector("#countryCount");
const continentCount = document.querySelector("#continentCount");
const listCount = document.querySelector("#listCount");
const sourceLabel = document.querySelector("#sourceLabel");

const parks = dataset.parks.map((park, index) => ({
  id: index,
  ...park,
}));

let state = {
  search: "",
  continent: "all",
  country: "all",
  selectedId: null,
};

function projectPoint(lat, lng) {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x, y };
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function populateFilters() {
  const continents = [...new Set(parks.map((park) => park.continent))].sort();
  const countries = [...new Set(parks.map((park) => park.country))].sort();

  continents.forEach((continent) => {
    continentFilter.appendChild(createOption(continent, continent));
  });

  countries.forEach((country) => {
    countryFilter.appendChild(createOption(country, country));
  });
}

function drawGrid() {
  for (let lng = -180; lng <= 180; lng += 30) {
    const { x } = projectPoint(0, lng);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x);
    line.setAttribute("x2", x);
    line.setAttribute("y1", 0);
    line.setAttribute("y2", 500);
    line.setAttribute("class", "grid-line");
    gridLayer.appendChild(line);
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    const { y } = projectPoint(lat, 0);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 0);
    line.setAttribute("x2", 1000);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("class", "grid-line");
    gridLayer.appendChild(line);
  }
}

function getFilteredParks() {
  const query = state.search.trim().toLowerCase();

  return parks.filter((park) => {
    const matchesSearch =
      !query ||
      [park.name, park.country, park.locality, park.featureClass]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));

    const matchesContinent =
      state.continent === "all" || park.continent === state.continent;
    const matchesCountry = state.country === "all" || park.country === state.country;

    return matchesSearch && matchesContinent && matchesCountry;
  });
}

function renderMarkers(filteredParks) {
  pointLayer.innerHTML = "";

  filteredParks.forEach((park) => {
    const { x, y } = projectPoint(park.lat, park.lng);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", state.selectedId === park.id ? 6 : 4);
    circle.setAttribute("class", state.selectedId === park.id ? "marker active" : "marker");
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("role", "button");
    circle.setAttribute("aria-label", `${park.name}, ${park.country}`);
    circle.addEventListener("click", () => selectPark(park.id));
    circle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPark(park.id);
      }
    });
    pointLayer.appendChild(circle);
  });
}

function renderDetails(park) {
  if (!park) {
    detailCard.innerHTML = `
      <p class="mono">Selection</p>
      <h2>Select a park</h2>
      <p>Click a marker or a park from the list to inspect its name, country, region, and coordinates.</p>
    `;
    return;
  }

  detailCard.innerHTML = `
    <p class="mono">Selection</p>
    <h2>${park.name}</h2>
    <p>${park.country}${park.locality ? `, ${park.locality}` : ""}</p>
    <div class="detail-grid">
      <div>
        <strong>Region</strong>
        <span>${park.continent}</span>
      </div>
      <div>
        <strong>Feature class</strong>
        <span>${park.featureClass}</span>
      </div>
      <div>
        <strong>Coordinates</strong>
        <span>${park.lat.toFixed(4)}, ${park.lng.toFixed(4)}</span>
      </div>
    </div>
  `;
}

function renderList(filteredParks) {
  parkList.innerHTML = "";
  listCount.textContent = filteredParks.length.toLocaleString();

  filteredParks.slice(0, 250).forEach((park) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.selectedId === park.id ? "is-active" : "";
    button.innerHTML = `
      <strong>${park.name}</strong>
      <span>${park.country}${park.locality ? ` - ${park.locality}` : ""}</span>
    `;
    button.addEventListener("click", () => selectPark(park.id));
    item.appendChild(button);
    parkList.appendChild(item);
  });
}

function updateSummary(filteredParks) {
  visibleCount.textContent = filteredParks.length.toLocaleString();
  countryCount.textContent = new Set(filteredParks.map((park) => park.country)).size.toLocaleString();
  continentCount.textContent = new Set(filteredParks.map((park) => park.continent)).size.toLocaleString();
}

function selectPark(id) {
  state.selectedId = id;
  render();
}

function render() {
  const filteredParks = getFilteredParks();
  const selectedPark = filteredParks.find((park) => park.id === state.selectedId) || null;

  if (!selectedPark && filteredParks.length && state.selectedId === null) {
    state.selectedId = filteredParks[0].id;
  } else if (!selectedPark && filteredParks.length) {
    state.selectedId = filteredParks[0].id;
  } else if (!filteredParks.length) {
    state.selectedId = null;
  }

  const nextSelected = filteredParks.find((park) => park.id === state.selectedId) || null;

  renderMarkers(filteredParks);
  renderList(filteredParks);
  renderDetails(nextSelected);
  updateSummary(filteredParks);
}

function wireEvents() {
  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  continentFilter.addEventListener("change", (event) => {
    state.continent = event.target.value;
    render();
  });

  countryFilter.addEventListener("change", (event) => {
    state.country = event.target.value;
    render();
  });

  resetButton.addEventListener("click", () => {
    state = {
      search: "",
      continent: "all",
      country: "all",
      selectedId: null,
    };
    searchInput.value = "";
    continentFilter.value = "all";
    countryFilter.value = "all";
    render();
  });
}

function init() {
  sourceLabel.textContent = `${dataset.source} - ${parks.length.toLocaleString()} saved locally`;
  populateFilters();
  drawGrid();
  wireEvents();
  render();
}

init();
