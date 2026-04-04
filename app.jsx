import { useState, useEffect, useCallback, useRef } from "react";

const API_GEO = "https://geocoding-api.open-meteo.com/v1/search";
const API_WX  = "https://api.open-meteo.com/v1/forecast";

const AQI_API = "https://air-quality-api.open-meteo.com/v1/air-quality";

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function pad(n) { return String(n).padStart(2, "0"); }

function fmtTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

const PARAM_META = {
  temperature:     { label: "Temperature",     unit: "°C",   icon: "🌡", range: [-40, 60],  color: "#ff6b35" },
  humidity:        { label: "Humidity",         unit: "%",    icon: "💧", range: [0, 100],   color: "#38bdf8" },
  windspeed:       { label: "Wind Speed",       unit: "km/h", icon: "💨", range: [0, 150],   color: "#a3e635" },
  pressure:        { label: "Pressure",         unit: "hPa",  icon: "⏱", range: [960, 1040], color: "#c084fc" },
  uv_index:        { label: "UV Index",         unit: "",     icon: "☀", range: [0, 11],    color: "#fbbf24" },
  precipitation:   { label: "Precipitation",   unit: "mm",   icon: "🌧", range: [0, 50],    color: "#60a5fa" },
};

const DISPLAY_PARAMS = ["temperature", "humidity", "windspeed", "pressure"];

function ArcGauge({ value, min, max, color, size = 120 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 44, cx = 60, cy = 60;
  const startAngle = -210, sweep = 240;
  const toRad = deg => (deg * Math.PI) / 180;
  const arc = (angle) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });
  const s = arc(startAngle);
  const e = arc(startAngle + sweep * pct);
  const large = sweep * pct > 180 ? 1 : 0;
  const track = arc(startAngle + sweep);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs>
        <filter id={`glow-${color.replace("#","")}`}>
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* track */}
      <path
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${track.x} ${track.y}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" strokeLinecap="round"
      />
      {/* fill */}
      {pct > 0.01 && (
        <path
          d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          filter={`url(#glow-${color.replace("#","")})`}
          style={{ transition: "all 1s cubic-bezier(.4,0,.2,1)" }}
        />
      )}
    </svg>
  );
}

function ParamCard({ paramKey, value, loading }) {
  const m = PARAM_META[paramKey];
  const display = value !== null && value !== undefined ? Number(value).toFixed(paramKey === "pressure" ? 0 : 1) : "--";

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: "24px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(12px)",
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 16px 40px ${m.color}22`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* accent line top */}
      <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2, background: m.color, borderRadius: 2, opacity: 0.7 }} />

      <div style={{ position: "relative" }}>
        <ArcGauge value={value ?? m.range[0]} min={m.range[0]} max={m.range[1]} color={m.color} size={110} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 0,
        }}>
          <span style={{ fontSize: 22 }}>{m.icon}</span>
          {loading ? (
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>…</span>
          ) : (
            <span style={{ color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
              {display}
              <span style={{ fontSize: 10, color: m.color, marginLeft: 2 }}>{m.unit}</span>
            </span>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ color: m.color, fontFamily: "'Syne', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          {m.label}
        </div>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 2 }}>
          {m.range[0]} — {m.range[1]} {m.unit}
        </div>
      </div>
    </div>
  );
}

function PulseDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", background: color,
        animation: "pulse 2s infinite",
      }} />
      <span style={{ position: "absolute", inset: 2, borderRadius: "50%", background: color }} />
    </span>
  );
}

function SearchBar({ onSearch, searching }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const fetchSuggestions = useCallback(async (val) => {
    if (val.length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const r = await fetch(`${API_GEO}?name=${encodeURIComponent(val)}&count=6&language=en&format=json`);
      const d = await r.json();
      if (d.results) { setSuggestions(d.results); setOpen(true); }
      else { setSuggestions([]); setOpen(false); }
    } catch { setSuggestions([]); }
  }, []);

  const handleChange = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchSuggestions(v), 350);
  };

  const pick = (item) => {
    setQ(item.name + (item.country ? `, ${item.country}` : ""));
    setOpen(false);
    onSearch({ name: item.name, country: item.country, admin1: item.admin1, lat: item.latitude, lon: item.longitude });
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 480 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14, padding: "10px 16px",
        backdropFilter: "blur(12px)",
      }}>
        <span style={{ fontSize: 16, opacity: 0.5 }}>🔍</span>
        <input
          value={q}
          onChange={e => handleChange(e.target.value)}
          placeholder="Search any city, place…"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#fff", fontFamily: "'Syne', sans-serif", fontSize: 14,
            letterSpacing: 0.5,
          }}
        />
        {searching && <span style={{ color: "#a3e635", fontSize: 12, fontFamily: "monospace" }}>LOADING…</span>}
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
          background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14, overflow: "hidden", zIndex: 100,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}>
          {suggestions.map((s, i) => (
            <div key={i}
              onClick={() => pick(s)}
              style={{
                padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(163,230,53,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 14 }}>📍</span>
              <div>
                <div style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>
                  {s.name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                  {[s.admin1, s.country].filter(Boolean).join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, unit, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Syne', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: color || "#fff", fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700 }}>
        {value !== null && value !== undefined ? `${value}${unit ? " " + unit : ""}` : "—"}
      </span>
    </div>
  );
}

async function fetchWeather(lat, lon) {
  const params = [
    "temperature_2m", "relative_humidity_2m", "windspeed_10m",
    "surface_pressure", "uv_index", "precipitation",
    "weathercode", "apparent_temperature", "visibility",
    "wind_direction_10m", "dewpoint_2m",
  ].join(",");

  const url = `${API_WX}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=${params}&timezone=auto&forecast_days=1`;
  const r = await fetch(url);
  const d = await r.json();

  const idx = 0;
  const h = d.hourly;
  return {
    temperature:   h.temperature_2m?.[idx],
    humidity:      h.relative_humidity_2m?.[idx],
    windspeed:     h.windspeed_10m?.[idx],
    pressure:      h.surface_pressure?.[idx],
    uv_index:      h.uv_index?.[idx],
    precipitation: h.precipitation?.[idx],
    apparent:      h.apparent_temperature?.[idx],
    visibility:    h.visibility?.[idx],
    wind_dir:      h.wind_direction_10m?.[idx],
    dewpoint:      h.dewpoint_2m?.[idx],
    weathercode:   d.current_weather?.weathercode,
    windspeed_cw:  d.current_weather?.windspeed,
    temp_cw:       d.current_weather?.temperature,
  };
}

function wxCodeToLabel(code) {
  if (code === undefined || code === null) return "—";
  if (code === 0) return "Clear Sky";
  if (code <= 3) return "Partly Cloudy";
  if (code <= 9) return "Foggy";
  if (code <= 19) return "Drizzle";
  if (code <= 29) return "Rain";
  if (code <= 39) return "Snow";
  if (code <= 49) return "Sleet";
  if (code <= 59) return "Thunderstorm";
  if (code <= 69) return "Heavy Rain";
  if (code <= 79) return "Heavy Snow";
  if (code <= 89) return "Hail";
  return "Thunderstorm";
}

function windDir(deg) {
  if (deg === undefined || deg === null) return "—";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function App() {
  const now = useNow();
  const [location, setLocation] = useState(null);
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const refreshRef = useRef(null);

  const loadWeather = useCallback(async (loc) => {
    setLoading(true); setError(null);
    try {
      const data = await fetchWeather(loc.lat, loc.lon);
      setWx(data);
    } catch (e) {
      setError("Failed to fetch atmospheric data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-detect location on mount
  useEffect(() => {
    setGeoLoading(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const d = await r.json();
          const loc = {
            name: d.address?.city || d.address?.town || d.address?.village || "Your Location",
            country: d.address?.country_code?.toUpperCase() || "",
            admin1: d.address?.state || "",
            lat, lon,
          };
          setLocation(loc);
          await loadWeather(loc);
        } catch {
          const loc = { name: "Mumbai", country: "IN", admin1: "Maharashtra", lat: 19.076, lon: 72.877 };
          setLocation(loc);
          await loadWeather(loc);
        }
        setGeoLoading(false);
      },
      async () => {
        const loc = { name: "Mumbai", country: "IN", admin1: "Maharashtra", lat: 19.076, lon: 72.877 };
        setLocation(loc);
        await loadWeather(loc);
        setGeoLoading(false);
      },
      { timeout: 6000 }
    );
  }, [loadWeather]);

  // Auto-refresh every 5 min
  useEffect(() => {
    if (!location) return;
    clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => loadWeather(location), 5 * 60 * 1000);
    return () => clearInterval(refreshRef.current);
  }, [location, loadWeather]);

  const handleSearch = useCallback(async (loc) => {
    setLocation(loc);
    await loadWeather(loc);
  }, [loadWeather]);

  const uvLevel = (uv) => {
    if (uv === null || uv === undefined) return { label: "—", color: "#fff" };
    if (uv < 3) return { label: "Low", color: "#a3e635" };
    if (uv < 6) return { label: "Moderate", color: "#fbbf24" };
    if (uv < 8) return { label: "High", color: "#fb923c" };
    if (uv < 11) return { label: "Very High", color: "#f43f5e" };
    return { label: "Extreme", color: "#c026d3" };
  };

  const uv = uvLevel(wx?.uv_index);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b10",
      color: "#fff",
      fontFamily: "'Syne', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #a3e635; border-radius: 4px; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(2.2);opacity:0} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(163,230,53,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(163,230,53,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* Scanline effect */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: "30%",
          background: "linear-gradient(transparent, rgba(163,230,53,0.02), transparent)",
          animation: "scanline 8s linear infinite",
        }} />
      </div>

      {/* Radial glow */}
      <div style={{
        position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: "80vw", height: "60vh",
        background: "radial-gradient(ellipse, rgba(163,230,53,0.05) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 24px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 20px", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "linear-gradient(135deg, #a3e635, #16a34a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, boxShadow: "0 0 20px rgba(163,230,53,0.4)",
            }}>🌍</div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
                ATMO<span style={{ color: "#a3e635" }}>WATCH</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" }}>
                Atmospheric Monitor
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <PulseDot color="#a3e635" />
            <span style={{ color: "#a3e635", fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2 }}>
              LIVE
            </span>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
              <div style={{ animation: "blink 1s infinite" }}>{fmtTime(now)}</div>
              <div style={{ fontSize: 9, opacity: 0.6 }}>UTC+{-(now.getTimezoneOffset()/60) >= 0 ? "+" : ""}{-(now.getTimezoneOffset()/60)}</div>
            </div>
          </div>
        </div>

        {/* Date & Location Banner */}
        <div style={{
          background: "rgba(163,230,53,0.04)",
          border: "1px solid rgba(163,230,53,0.12)",
          borderRadius: 16, padding: "16px 24px",
          marginBottom: 24, animation: "fadeUp 0.6s ease",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Current Location</div>
            {geoLoading ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Space Mono", fontSize: 13 }}>Detecting location…</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📍</span>
                <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>
                  {location?.name}
                </span>
                {location?.admin1 && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{location.admin1}</span>}
                {location?.country && (
                  <span style={{
                    background: "rgba(163,230,53,0.15)", color: "#a3e635",
                    padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  }}>{location.country}</span>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Local Date</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#fff" }}>{fmtDate(now)}</div>
            {location && (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>
                {location.lat?.toFixed(4)}°N, {location.lon?.toFixed(4)}°E
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 32, animation: "fadeUp 0.7s ease" }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Search Another Location
          </div>
          <SearchBar onSearch={handleSearch} searching={loading} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
            borderRadius: 12, padding: "12px 18px", marginBottom: 20, color: "#f43f5e",
            fontFamily: "Space Mono", fontSize: 12,
          }}>⚠ {error}</div>
        )}

        {/* Current Conditions Banner */}
        {wx && !loading && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, padding: "14px 24px", marginBottom: 28,
            display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
            animation: "fadeUp 0.5s ease",
          }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Condition</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{wxCodeToLabel(wx.weathercode)}</div>
            </div>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Feels Like</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 15, color: "#ff6b35", marginTop: 2 }}>{wx.apparent?.toFixed(1)}°C</div>
            </div>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Wind</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 15, color: "#a3e635", marginTop: 2 }}>
                {wx.windspeed_cw?.toFixed(0)} km/h {windDir(wx.wind_dir)}
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>UV Index</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 15, color: uv.color, marginTop: 2 }}>
                {wx.uv_index?.toFixed(1)} <span style={{ fontSize: 10 }}>({uv.label})</span>
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Visibility</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 15, color: "#60a5fa", marginTop: 2 }}>
                {wx.visibility ? `${(wx.visibility / 1000).toFixed(1)} km` : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Main Gauges */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            Primary Parameters
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            animation: "fadeUp 0.8s ease",
          }}>
            {DISPLAY_PARAMS.map(p => (
              <ParamCard key={p} paramKey={p} value={wx?.[p === "windspeed" ? "windspeed_cw" : p === "temperature" ? "temp_cw" : p] ?? wx?.[p]} loading={loading} />
            ))}
          </div>
        </div>

        {/* Extras row */}
        {wx && !loading && (
          <div style={{
            marginTop: 24, display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16, animation: "fadeUp 0.9s ease",
          }}>
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18, padding: "20px 22px",
            }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
                Additional Parameters
              </div>
              <StatRow label="Dew Point" value={wx.dewpoint?.toFixed(1)} unit="°C" color="#38bdf8" />
              <StatRow label="Precipitation" value={wx.precipitation?.toFixed(1)} unit="mm" color="#60a5fa" />
              <StatRow label="UV Index" value={wx.uv_index?.toFixed(1)} unit="" color={uv.color} />
              <StatRow label="Wind Direction" value={windDir(wx.wind_dir)} unit="" color="#a3e635" />
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18, padding: "20px 22px",
            }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
                Atmospheric Details
              </div>
              <StatRow label="Surface Pressure" value={wx.pressure?.toFixed(0)} unit="hPa" color="#c084fc" />
              <StatRow label="Visibility" value={wx.visibility ? (wx.visibility/1000).toFixed(1) : null} unit="km" color="#60a5fa" />
              <StatRow label="Humidity" value={wx.humidity?.toFixed(0)} unit="%" color="#38bdf8" />
              <StatRow label="Feels Like" value={wx.apparent?.toFixed(1)} unit="°C" color="#ff6b35" />
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18, padding: "20px 22px",
            }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
                Data Source
              </div>
              <StatRow label="Provider" value="Open-Meteo" unit="" color="#a3e635" />
              <StatRow label="Resolution" value="1 km" unit="" color="#fff" />
              <StatRow label="Refresh" value="Every 5 min" unit="" color="#fff" />
              <StatRow label="Lat / Lon" value={`${location?.lat?.toFixed(2)}, ${location?.lon?.toFixed(2)}`} unit="" color="rgba(255,255,255,0.5)" />
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {(loading || geoLoading) && !wx && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 20 }}>
            <div style={{
              width: 60, height: 60, border: "3px solid rgba(163,230,53,0.1)",
              borderTop: "3px solid #a3e635", borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Space Mono", fontSize: 12, letterSpacing: 2 }}>
              FETCHING ATMOSPHERIC DATA…
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 48, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: 1.5 }}>
            ATMOWATCH © 2026 · REAL-TIME ATMOSPHERIC MONITOR
          </span>
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 10 }}>
            Powered by Open-Meteo · No API key required
          </span>
        </div>
      </div>
    </div>
  );
}
