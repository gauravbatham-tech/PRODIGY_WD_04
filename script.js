/* ========= Data sources (no API key) =========
   Geocoding: https://geocoding-api.open-meteo.com/v1/search?name={query}
   Reverse:   https://geocoding-api.open-meteo.com/v1/reverse?latitude=..&longitude=..
   Weather:   https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&...
================================================ */

const els = {
  place: document.getElementById("place"),
  updated: document.getElementById("updated"),
  temp: document.getElementById("temp"),
  condition: document.getElementById("condition"),
  tmin: document.getElementById("tmin"),
  tmax: document.getElementById("tmax"),
  bigIcon: document.getElementById("bigIcon"),
  feels: document.getElementById("feels"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  precip: document.getElementById("precip"),
  cloud: document.getElementById("cloud"),
  sunrise: document.getElementById("sunrise"),
  sunset: document.getElementById("sunset"),
  days: document.getElementById("days"),
  advice: document.getElementById("advice"),
  hourlyChart: document.getElementById("hourlyChart"),
  hourlyChips: document.getElementById("hourlyChips"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  locateBtn: document.getElementById("locateBtn"),
  unitToggle: document.getElementById("unitToggle"),
  toast: document.getElementById("toast"),
  clock: document.getElementById("clock"),
};

let state = {
  unit: "C",           // "C" or "F"
  coords: null,        // {lat, lon}
  placeLabel: "",
  weather: null,       // cached last response
  chart: null,
};

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2500);
}

function toF(c){ return (c * 9/5) + 32; }
function fmtTemp(c){ return (state.unit === "C" ? Math.round(c) : Math.round(toF(c))) + "°" + state.unit; }
function msToKmh(ms){ return Math.round(ms * 3.6); }

function mapWmo(code, isDay=true){
  // WMO codes → {text, emoji}
  const m = {
    0:["Clear","☀️"], 1:["Mainly clear","🌤️"], 2:["Partly cloudy","⛅"], 3:["Cloudy","☁️"],
    45:["Fog","🌫️"], 48:["Depositing rime fog","🌫️"],
    51:["Light drizzle","🌦️"], 53:["Drizzle","🌦️"], 55:["Heavy drizzle","🌧️"],
    56:["Freezing drizzle","🌧️"], 57:["Freezing drizzle","🌧️"],
    61:["Light rain","🌧️"], 63:["Rain","🌧️"], 65:["Heavy rain","🌧️"],
    66:["Freezing rain","🌧️"], 67:["Freezing rain","🌧️"],
    71:["Light snow","🌨️"], 73:["Snow","🌨️"], 75:["Heavy snow","❄️"],
    77:["Snow grains","🌨️"],
    80:["Rain showers","🌦️"], 81:["Rain showers","🌦️"], 82:["Violent rain showers","⛈️"],
    85:["Snow showers","🌨️"], 86:["Snow showers","❄️"],
    95:["Thunderstorm","⛈️"], 96:["Thunderstorm + hail","⛈️"], 99:["Thunderstorm + hail","⛈️"],
  };
  if(!m[code]) return {text:"—", emoji:isDay?"☀️":"🌙"};
  const [text, emoji] = m[code];
  return {text, emoji};
}

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Network error ${res.status}`);
  return res.json();
}

async function geocodeCity(name){
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(name)}`;
  const data = await fetchJSON(url);
  if(!data.results || !data.results.length) throw new Error("City not found");
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, label: `${r.name}${r.admin1 ? ", "+r.admin1 : ""}, ${r.country}` };
}

async function reverseGeocode(lat, lon){
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
  const data = await fetchJSON(url);
  if(data.results && data.results[0]){
    const r = data.results[0];
    return `${r.name}${r.admin1 ? ", "+r.admin1 : ""}, ${r.country}`;
  }
  return `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
}

async function getWeather(lat, lon){
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    current: [
      'temperature_2m','relative_humidity_2m','apparent_temperature','is_day',
      'precipitation','weather_code','wind_speed_10m','wind_direction_10m','cloud_cover'
    ].join(','),
    hourly: [
      'temperature_2m','apparent_temperature','precipitation_probability','precipitation',
      'cloud_cover','wind_speed_10m'
    ].join(','),
    daily: [
      'weather_code','temperature_2m_max','temperature_2m_min','precipitation_sum',
      'precipitation_probability_max','wind_speed_10m_max','sunrise','sunset','uv_index_max'
    ].join(',')
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  return fetchJSON(url);
}

function renderCurrent(data){
  const { current, daily } = data;
  const isDay = !!current.is_day;
  const w = mapWmo(current.weather_code, isDay);

  els.temp.textContent = fmtTemp(current.temperature_2m);
  els.condition.textContent = w.text;
  els.bigIcon.textContent = w.emoji;
  els.feels.textContent = fmtTemp(current.apparent_temperature);
  els.humidity.textContent = `${current.relative_humidity_2m}%`;
  els.wind.textContent = `${msToKmh(current.wind_speed_10m)} km/h`;
  els.precip.textContent = `${current.precipitation ?? 0} mm`;
  els.cloud.textContent = `${current.cloud_cover ?? 0}%`;

  // Day 0 min/max + sunrise/sunset
  els.tmin.textContent = `Min ${fmtTemp(daily.temperature_2m_min[0])}`;
  els.tmax.textContent = `Max ${fmtTemp(daily.temperature_2m_max[0])}`;
  els.sunrise.textContent = new Date(daily.sunrise[0]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  els.sunset.textContent = new Date(daily.sunset[0]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  els.updated.textContent = `Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
}

function renderDaily(data){
  const { daily } = data;
  const frag = document.createDocumentFragment();
  for(let i=0; i<daily.time.length; i++){
    const dt = new Date(daily.time[i]);
    const w = mapWmo(daily.weather_code[i], 1);
    const d = document.createElement('div');
    d.className = 'day';
    d.innerHTML = `
      <div class="dt">${dt.toLocaleDateString(undefined, { weekday:'short', day:'numeric'})}</div>
      <div class="di">${w.emoji}</div>
      <div class="dd">${w.text}</div>
      <div class="tx"><strong>${fmtTemp(daily.temperature_2m_max[i])}</strong> / ${fmtTemp(daily.temperature_2m_min[i])}</div>
      <div class="dd">Rain: ${Math.round(daily.precipitation_probability_max?.[i] ?? 0)}% · Wind: ${Math.round(daily.wind_speed_10m_max?.[i] ?? 0)} km/h</div>
    `;
    frag.appendChild(d);
  }
  els.days.replaceChildren(frag);
}

function renderHourly(data){
  const h = data.hourly;
  const labels = h.time.slice(0, 24).map(t => new Date(t).toLocaleTimeString([], {hour:'2-digit'}));
  const temps = h.temperature_2m.slice(0, 24);
  const feels = h.apparent_temperature.slice(0, 24);
  const pop = h.precipitation_probability.slice(0, 24);

  // chips (quick glance)
  const chipFrag = document.createDocumentFragment();
  for(let i=0;i<24;i++){
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = `${labels[i]} · ${fmtTemp(temps[i])} · ${pop[i] ?? 0}%`;
    chipFrag.appendChild(chip);
  }
  els.hourlyChips.replaceChildren(chipFrag);

  // chart
  if(state.chart){ state.chart.destroy(); }
  state.chart = new Chart(els.hourlyChart.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Temperature', data: temps, yAxisID:'y' },
        { label: 'Feels like', data: feels, yAxisID:'y' },
        { label: 'Rain %', data: pop, yAxisID:'y1' },
      ]
    },
    options: {
      animation: { duration: 600 },
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#cbd5e1' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if(ctx.dataset.label === 'Rain %') return `Rain: ${ctx.parsed.y}%`;
              const v = state.unit === 'C' ? ctx.parsed.y : toF(ctx.parsed.y);
              return `${ctx.dataset.label}: ${Math.round(v)}°${state.unit}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid:{ color:'#1f2a4433' } },
        y: { ticks: { color: '#94a3b8',
              callback: v => state.unit === 'C' ? `${Math.round(v)}°C` : `${Math.round(toF(v))}°F`
            }, grid:{ color:'#1f2a4433' } },
        y1:{ position:'right', ticks:{ color:'#94a3b8', callback:v=>`${v}%` }, grid:{ drawOnChartArea:false } }
      }
    }
  });
}

function genAdvice(data){
  const out = [];
  const d = data.daily;
  const today = {
    tmax: d.temperature_2m_max[0],
    tmin: d.temperature_2m_min[0],
    rainP: d.precipitation_probability_max?.[0] ?? 0,
    wind: d.wind_speed_10m_max?.[0] ?? 0,
    uv: d.uv_index_max?.[0] ?? 0,
    code: d.weather_code[0]
  };

  // Simple AI-style suggestions based on thresholds
  if(today.rainP >= 60) out.push({t:"Likely rain today. Carry an umbrella and waterproof your bag.", c:"warn"});
  else if(today.rainP >= 30) out.push({t:"Chance of showers. A compact umbrella could help.", c:"ok"});

  if(today.tmax >= 35) out.push({t:"Extreme heat expected. Hydrate, avoid direct sun 12–4 pm, and wear light clothing.", c:"bad"});
  else if(today.tmax >= 30) out.push({t:"Warm day. Drink water and plan outdoor tasks for morning or evening.", c:"warn"});

  if(today.wind >= 40) out.push({t:"It will be windy. Secure loose items and be careful on two-wheelers.", c:"warn"});

  if(today.uv >= 7) out.push({t:"High UV around midday. Use sunscreen and sunglasses.", c:"warn"});

  // Best outdoor window from hourly temps and rain %
  const h = data.hourly;
  let bestIdx = 8, bestScore = -1, bestHour = '—';
  for(let i=6;i<19;i++){ // 6:00–18:00
    const score = (40 - Math.abs(24 - (h.temperature_2m[i] ?? 24))) // closer to 24°C is better
                + (100 - (h.precipitation_probability[i] ?? 100)) * 0.4
                + (100 - (h.cloud_cover[i] ?? 100)) * 0.1;
    if(score > bestScore){ bestScore = score; bestIdx = i; }
  }
  if(Number.isFinite(bestIdx)){
    bestHour = new Date(h.time[bestIdx]).toLocaleTimeString([], {hour:'2-digit'});
    out.push({t:`Best time for a walk: ~${bestHour}`, c:"ok"});
  }

  // Tomorrow heads-up
  if(d.temperature_2m_max[1] - today.tmax >= 4)
    out.push({t:`Tomorrow will be hotter by ~${Math.round(d.temperature_2m_max[1]-today.tmax)}°C. Plan accordingly.`, c:"warn"});
  if((d.precipitation_probability_max?.[1] ?? 0) >= 60)
    out.push({t:"High chance of rain tomorrow. Schedule errands in the morning.", c:"warn"});

  // Clear night stargazing
  if(mapWmo(today.code, true).text.includes("Clear"))
    out.push({t:"Clear skies tonight. Good conditions for stargazing after sunset.", c:"ok"});

  els.advice.replaceChildren(...out.map(a=>{
    const li = document.createElement('li'); li.textContent = a.t; li.className = a.c; return li;
  }));
}

function renderAll(label, data){
  els.place.textContent = label;
  renderCurrent(data);
  renderHourly(data);
  renderDaily(data);
  genAdvice(data);
}

async function runForCoords(lat, lon){
  els.updated.textContent = "Loading…";
  const [label, weather] = await Promise.all([
    reverseGeocode(lat, lon),
    getWeather(lat, lon)
  ]);
  state.coords = {lat, lon};
  state.placeLabel = label;
  state.weather = weather;
  renderAll(label, weather);
}

// UI handlers
els.searchBtn.addEventListener('click', async ()=>{
  const q = els.searchInput.value.trim();
  if(!q) return toast("Type a city name");
  try{
    const g = await geocodeCity(q);
    await runForCoords(g.lat, g.lon);
  }catch(e){ toast(e.message || "Search failed"); }
});

els.searchInput.addEventListener('keydown', e=>{
  if(e.key === 'Enter') els.searchBtn.click();
});

els.locateBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){
    toast("Geolocation not supported");
    return;
  }
  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude:lat, longitude:lon} = pos.coords;
    try{ await runForCoords(lat, lon); }
    catch(e){ toast("Could not fetch weather for your location"); }
  }, err=>{
    toast("Location permission denied");
  }, {enableHighAccuracy:true, timeout:10000, maximumAge:60000});
});

els.unitToggle.addEventListener('change', ()=>{
  state.unit = els.unitToggle.checked ? "F" : "C";
  if(state.weather){
    // Re-render everything with the new unit
    renderAll(state.placeLabel, state.weather);
  }
});

// Live clock + periodic refresh
setInterval(()=>{
  els.clock.textContent = new Date().toLocaleString();
}, 1000);

// Refresh current data every 5 minutes (if we already have coords)
setInterval(async ()=>{
  if(state.coords){
    try{
      const w = await getWeather(state.coords.lat, state.coords.lon);
      state.weather = w;
      renderAll(state.placeLabel, w);
      toast("Weather updated");
    }catch(e){ /* silent */ }
  }
}, 5*60*1000);

// Initial boot: try geolocation, else default to Mumbai
(async function boot(){
  try{
    await new Promise((resolve, reject)=>{
      if(!navigator.geolocation) return reject();
      navigator.geolocation.getCurrentPosition(p=>resolve(p), ()=>reject(), {timeout:8000});
    }).then(async p=>{
      await runForCoords(p.coords.latitude, p.coords.longitude);
    });
  }catch{
    // Fallback: Mumbai
    const g = await geocodeCity("Mumbai");
    await runForCoords(g.lat, g.lon);
    toast("Using Mumbai as default. Click 'Use My Location' to switch.");
  }
})();

