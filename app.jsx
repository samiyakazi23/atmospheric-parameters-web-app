import { useState, useEffect, useCallback, useRef } from "react";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL  = "https://api.open-meteo.com/v1/forecast";

async function geocodeSearch(query) {
  const res = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
  const d = await res.json();
  return d.results || [];
}

async function fetchAtmo(lat, lon) {
  const hourly = [
    "temperature_2m","relative_humidity_2m","surface_pressure",
    "windspeed_10m","wind_direction_10m","uv_index",
    "precipitation","visibility","dewpoint_2m","apparent_temperature",
    "cloudcover"
  ].join(",");
  const url = `${WX_URL}?latitude=${lat}&longitude=${lon}&hourly=${hourly}&current_weather=true&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API error");
  const d = await res.json();
  const h = d.hourly;
  const cw = d.current_weather;
  // Find the index closest to now in the hourly array
  const now = new Date();
  const hours = h.time.map(t => new Date(t));
  let idx = 0;
  let minDiff = Infinity;
  hours.forEach((t, i) => { const diff = Math.abs(t - now); if (diff < minDiff) { minDiff = diff; idx = i; } });
  return {
    temperature:   cw?.temperature   ?? h.temperature_2m?.[idx],
    windspeed:     cw?.windspeed      ?? h.windspeed_10m?.[idx],
    wind_dir:      cw?.winddirection  ?? h.wind_direction_10m?.[idx],
    humidity:      h.relative_humidity_2m?.[idx],
    pressure:      h.surface_pressure?.[idx],
    uv_index:      h.uv_index?.[idx],
    precipitation: h.precipitation?.[idx],
    visibility:    h.visibility?.[idx],
    dewpoint:      h.dewpoint_2m?.[idx],
    apparent:      h.apparent_temperature?.[idx],
    cloudcover:    h.cloudcover?.[idx],
    weathercode:   cw?.weathercode,
  };
}

function pad(n) { return String(n).padStart(2, "0"); }
function fmt_time(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function fmt_date(d) {
  return d.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}
function windLabel(deg) {
  if (deg == null) return "—";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}
function wxLabel(code) {
  if (code == null) return "—";
  if (code === 0) return "Clear Sky";
  if (code <= 3)  return "Partly Cloudy";
  if (code <= 9)  return "Foggy";
  if (code <= 29) return "Drizzle / Rain";
  if (code <= 39) return "Snow";
  if (code <= 59) return "Thunderstorm";
  if (code <= 79) return "Heavy Snow";
  return "Storm";
}
function uvLabel(uv) {
  if (uv == null) return { text:"—", color:"#94a3b8" };
  if (uv < 3)  return { text:"Low",       color:"#22c55e" };
  if (uv < 6)  return { text:"Moderate",  color:"#eab308" };
  if (uv < 8)  return { text:"High",      color:"#f97316" };
  if (uv < 11) return { text:"Very High", color:"#ef4444" };
  return           { text:"Extreme",   color:"#a855f7" };
}
function fmt_vis(m) {
  if (m == null) return "—";
  return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${m} m`;
}

function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function Ring({ pct, color, size = 52, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition:"stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

function StatCard({ label, value, unit, sub, pct, color, icon, delay = 0 }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      background:"#fff", borderRadius:20, padding:"22px 24px",
      display:"flex", flexDirection:"column", gap:14,
      boxShadow:"0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(14px)",
      transition:"opacity 0.5s ease, transform 0.5s ease",
      border:"1px solid #f1f5f9",
      position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color, opacity:0.8, borderRadius:"20px 20px 0 0" }} />
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:500, letterSpacing:2.5, textTransform:"uppercase", color:"#94a3b8" }}>
            {label}
          </div>
          <div style={{ marginTop:10, display:"flex", alignItems:"baseline", gap:5, flexWrap:"wrap" }}>
            <span style={{ fontSize:38, fontWeight:800, letterSpacing:-2, color:"#0f172a", fontFamily:"'Fraunces', serif", lineHeight:1 }}>
              {value ?? "—"}
            </span>
            {unit && <span style={{ fontSize:15, color:"#64748b", fontWeight:600, letterSpacing:-0.3 }}>{unit}</span>}
          </div>
          {sub && <div style={{ marginTop:5, fontSize:11, color:"#94a3b8", letterSpacing:0.3 }}>{sub}</div>}
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, paddingTop:2 }}>
          <Ring pct={pct ?? 0} color={color} />
          <span style={{ fontSize:20 }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function RowStat({ label, value, accent }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"10px 0", borderBottom:"1px solid #f8fafc",
    }}>
      <span style={{ fontSize:11, color:"#94a3b8", letterSpacing:1.5, textTransform:"uppercase" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color: accent || "#0f172a", fontFamily:"'Fraunces', serif" }}>{value ?? "—"}</span>
    </div>
  );
}

function Search({ onSelect, loading }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await geocodeSearch(q);
        setResults(r); setOpen(r.length > 0);
      } catch { setResults([]); }
    }, 380);
  }, [q]);

  useEffect(() => {
    const fn = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const pick = (item) => {
    setQ(`${item.name}${item.country ? ", " + item.country : ""}`);
    setOpen(false); setResults([]);
    onSelect({ name:item.name, country:item.country||"", admin1:item.admin1||"", lat:item.latitude, lon:item.longitude });
  };

  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%", maxWidth:420 }}>
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        background:"#fff", border:"1.5px solid #e2e8f0",
        borderRadius:14, padding:"11px 16px",
        boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search any city…"
          style={{
            flex:1, border:"none", outline:"none", background:"none",
            fontSize:13, color:"#0f172a", letterSpacing:0.3,
          }}
        />
        {loading && <div style={{ width:13, height:13, border:"2px solid #e2e8f0", borderTop:"2px solid #3b82f6", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />}
      </div>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, right:0,
          background:"#fff", borderRadius:14, overflow:"hidden",
          border:"1px solid #e2e8f0", boxShadow:"0 16px 40px rgba(0,0,0,0.1)", zIndex:999,
        }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => pick(r)}
              style={{
                display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
                cursor:"pointer", borderBottom: i < results.length-1 ? "1px solid #f8fafc" : "none",
                transition:"background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", fontFamily:"'Fraunces', serif" }}>{r.name}</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>{[r.admin1, r.country].filter(Boolean).join(", ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_LOC = { name:"Mumbai", country:"IN", admin1:"Maharashtra", lat:19.076, lon:72.877 };

export default function App() {
  const now = useClock();
  const [loc, setLoc] = useState(DEFAULT_LOC);
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async (l) => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAtmo(l.lat, l.lon);
      setWx(data); setLastUpdated(new Date());
    } catch { setError("Could not load atmospheric data. Check connection."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(DEFAULT_LOC); }, [load]);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => load(loc), 5 * 60 * 1000);
    return () => clearInterval(timerRef.current);
  }, [loc, load]);

  const handleSelect = useCallback((l) => { setLoc(l); load(l); }, [load]);
  const uv = uvLabel(wx?.uv_index);

  const cards = [
    {
      label:"Temperature", icon:"🌡",
      value: wx?.temperature != null ? wx.temperature.toFixed(1) : null, unit:"°C",
      sub: wx?.apparent != null ? `Feels like ${wx.apparent.toFixed(1)}°C` : null,
      pct: wx?.temperature != null ? (wx.temperature + 10) / 60 : 0, color:"#f97316",
    },
    {
      label:"Humidity", icon:"💧",
      value: wx?.humidity != null ? Math.round(wx.humidity) : null, unit:"%",
      sub: wx?.dewpoint != null ? `Dew point ${wx.dewpoint.toFixed(1)}°C` : null,
      pct: wx?.humidity != null ? wx.humidity / 100 : 0, color:"#3b82f6",
    },
    {
      label:"Wind Speed", icon:"💨",
      value: wx?.windspeed != null ? wx.windspeed.toFixed(1) : null, unit:"km/h",
      sub: wx?.wind_dir != null ? `${windLabel(wx.wind_dir)} · ${Math.round(wx.wind_dir)}°` : null,
      pct: wx?.windspeed != null ? wx.windspeed / 100 : 0, color:"#10b981",
    },
    {
      label:"Pressure", icon:"⏱",
      value: wx?.pressure != null ? Math.round(wx.pressure) : null, unit:"hPa",
      sub: wx?.pressure != null ? (wx.pressure > 1013 ? "High pressure" : "Low pressure") : null,
      pct: wx?.pressure != null ? (wx.pressure - 950) / 100 : 0, color:"#8b5cf6",
    },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,800;1,9..144,400&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{-webkit-font-smoothing:antialiased}
        input::placeholder{color:#cbd5e1}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Nav */}
      <nav style={{
        background:"#fff", borderBottom:"1px solid #f1f5f9",
        padding:"0 clamp(16px,4vw,40px)",
        position:"sticky", top:0, zIndex:50,
        boxShadow:"0 1px 0 #f1f5f9",
      }}>
        <div style={{ maxWidth:1060, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:34, height:34, borderRadius:10,
              background:"linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:17,
            }}>🌍</div>
            <span style={{ fontFamily:"'Fraunces', serif", fontWeight:800, fontSize:20, color:"#0f172a", letterSpacing:-0.5 }}>
              Atmo<span style={{ color:"#3b82f6" }}>Watch</span>
            </span>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{
                width:7, height:7, borderRadius:"50%", background:"#22c55e",
                boxShadow:"0 0 0 3px rgba(34,197,94,0.18)",
                animation:"blink 2.5s ease infinite",
              }} />
              <span style={{ fontSize:11, color:"#64748b", letterSpacing:1.5, fontWeight:500 }}>LIVE</span>
            </div>
            <div style={{ width:1, height:18, background:"#e2e8f0" }} />
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Fraunces', serif", fontSize:17, fontWeight:700, color:"#0f172a", letterSpacing:-0.5, lineHeight:1.1 }}>
                {fmt_time(now)}
              </div>
              <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>
                {now.toLocaleDateString("en-IN",{weekday:"short"})}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth:1060, margin:"0 auto", padding:"30px clamp(16px,4vw,40px) 60px" }}>

        {/* Header row */}
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", justifyContent:"space-between", gap:20, marginBottom:28, animation:"fadeUp 0.4s ease" }}>
          <div>
            <div style={{ fontSize:10, color:"#94a3b8", letterSpacing:2.5, textTransform:"uppercase", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Monitoring Location
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'Fraunces', serif", fontSize:clamp(28,5,40), fontWeight:800, color:"#0f172a", letterSpacing:-1.5, lineHeight:1 }}>
                {loc.name}
              </h1>
              <span style={{ fontFamily:"'Fraunces', serif", fontSize:18, color:"#94a3b8", fontWeight:300, fontStyle:"italic" }}>
                {[loc.admin1, loc.country].filter(Boolean).join(", ")}
              </span>
            </div>
            <div style={{ marginTop:6, fontSize:11, color:"#cbd5e1", letterSpacing:0.5 }}>
              {loc.lat?.toFixed(4)}°N · {loc.lon?.toFixed(4)}°E · {fmt_date(now)}
            </div>
          </div>
          <Search onSelect={handleSelect} loading={loading} />
        </div>

        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12, padding:"12px 18px", marginBottom:20, color:"#dc2626", fontSize:12 }}>
            ⚠ {error}
          </div>
        )}

        {/* Status pills */}
        {wx && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:8, marginBottom:24, animation:"fadeUp 0.5s ease" }}>
            <Pill icon="☁" text={wxLabel(wx.weathercode)} />
            <Pill icon="☀" text={`UV ${wx.uv_index?.toFixed(1)} — ${uv.text}`} color={uv.color} />
            <Pill icon="🌡" text={`${wx.apparent?.toFixed(1)}°C feels like`} color="#f97316" />
            {lastUpdated && (
              <div style={{ marginLeft:"auto", fontSize:11, color:"#cbd5e1", display:"flex", alignItems:"center", gap:5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Updated {fmt_time(lastUpdated)}
              </div>
            )}
          </div>
        )}

        {/* Spinner */}
        {loading && !wx && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, padding:"80px 0" }}>
            <div style={{ width:44, height:44, border:"3px solid #e2e8f0", borderTop:"3px solid #3b82f6", borderRadius:"50%", animation:"spin 0.9s linear infinite" }} />
            <div style={{ fontSize:11, color:"#94a3b8", letterSpacing:2.5 }}>FETCHING ATMOSPHERIC DATA</div>
          </div>
        )}

        {wx && (
          <>
            {/* 4 main gauges */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14, marginBottom:14 }}>
              {cards.map((c, i) => <StatCard key={c.label} {...c} delay={i * 70} />)}
            </div>

            {/* Secondary panels */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
              {/* Atmosphere */}
              <div style={{ background:"#fff", borderRadius:20, padding:"20px 22px", boxShadow:"0 1px 2px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.04)", border:"1px solid #f1f5f9", animation:"fadeUp 0.6s ease" }}>
                <SectionTitle>Atmosphere</SectionTitle>
                <RowStat label="Dew Point"     value={wx.dewpoint     != null ? `${wx.dewpoint.toFixed(1)} °C`    : null} />
                <RowStat label="Cloud Cover"   value={wx.cloudcover   != null ? `${Math.round(wx.cloudcover)} %`  : null} />
                <RowStat label="Precipitation" value={wx.precipitation!= null ? `${wx.precipitation.toFixed(1)} mm`: null} accent="#3b82f6" />
                <RowStat label="Visibility"    value={fmt_vis(wx.visibility)} />
                <RowStat label="Condition"     value={wxLabel(wx.weathercode)} />
              </div>

              {/* Wind & Solar */}
              <div style={{ background:"#fff", borderRadius:20, padding:"20px 22px", boxShadow:"0 1px 2px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.04)", border:"1px solid #f1f5f9", animation:"fadeUp 0.7s ease" }}>
                <SectionTitle>Wind & Solar</SectionTitle>
                <RowStat label="Wind Speed"  value={wx.windspeed != null ? `${wx.windspeed.toFixed(1)} km/h`              : null} accent="#10b981" />
                <RowStat label="Direction"   value={wx.wind_dir  != null ? `${windLabel(wx.wind_dir)} (${Math.round(wx.wind_dir)}°)` : null} />
                <RowStat label="UV Index"    value={wx.uv_index  != null ? wx.uv_index.toFixed(1)                          : null} accent={uv.color} />
                <RowStat label="UV Risk"     value={uv.text}                                                                         accent={uv.color} />
                <RowStat label="Feels Like"  value={wx.apparent  != null ? `${wx.apparent.toFixed(1)} °C`                  : null} accent="#f97316" />
              </div>

              {/* Location card */}
              <div style={{
                background:"linear-gradient(150deg,#0f172a 0%,#1e293b 100%)",
                borderRadius:20, padding:"20px 22px",
                boxShadow:"0 1px 2px rgba(0,0,0,0.1),0 8px 24px rgba(0,0,0,0.12)",
                display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:190,
                animation:"fadeUp 0.8s ease",
              }}>
                <div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", letterSpacing:2.5, textTransform:"uppercase", marginBottom:10 }}>Location</div>
                  <div style={{ fontFamily:"'Fraunces', serif", fontSize:26, fontWeight:800, color:"#fff", letterSpacing:-1, lineHeight:1.1 }}>
                    {loc.name}
                  </div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginTop:5, fontStyle:"italic", fontFamily:"'Fraunces', serif" }}>
                    {[loc.admin1, loc.country].filter(Boolean).join(", ")}
                  </div>
                </div>
                <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:14, display:"flex", justifyContent:"space-between" }}>
                  {[
                    ["Latitude", `${loc.lat?.toFixed(4)}°`],
                    ["Longitude", `${loc.lon?.toFixed(4)}°`],
                    ["Source", "Open-Meteo"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2, textTransform:"uppercase" }}>{k}</div>
                      <div style={{ fontSize:13, fontWeight:700, color: k==="Source" ? "#22c55e" : "#fff", marginTop:3 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer style={{
        borderTop:"1px solid #f1f5f9", background:"#fff",
        padding:"14px clamp(16px,4vw,40px)",
        display:"flex", justifyContent:"center", alignItems:"center",
        gap:5, fontSize:11, color:"#cbd5e1",
      }}>
        <span>AtmoWatch · Real-time data via</span>
        <span style={{ color:"#3b82f6", fontWeight:600 }}>Open-Meteo API</span>
        <span>· Auto-refreshes every 5 min</span>
      </footer>
    </div>
  );
}

function clamp(min, mid, max) { return `clamp(${min}px, ${mid}vw, ${max}px)`; }
function SectionTitle({ children }) {
  return <div style={{ fontSize:10, fontWeight:500, letterSpacing:2.5, textTransform:"uppercase", color:"#94a3b8", marginBottom:10 }}>{children}</div>;
}
function Pill({ icon, text, color }) {
  return (
    <div style={{
      background:"#fff", border:"1px solid #f1f5f9", borderRadius:100,
      padding:"5px 14px", fontSize:11, color: color || "#64748b", fontWeight:color ? 700 : 500,
      boxShadow:"0 1px 3px rgba(0,0,0,0.04)", display:"flex", alignItems:"center", gap:6,
    }}>
      <span style={{ fontSize:13 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
