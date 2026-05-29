import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { 
  Search, 
  Thermometer, 
  Droplets, 
  Leaf, 
  Wind, 
  CloudRain, 
  Sun, 
  Upload, 
  Map as MapIcon,
  Info,
  Layers,
  Activity
} from 'lucide-react';

// Fix for default marker icon in Leaflet + React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to recenter map
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function App() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchLat, setSearchLat] = useState('36.1156');
  const [searchLon, setSearchLon] = useState('-97.0583');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([36.1156, -97.0583]);
  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
      let url = `${API_URL}/api/search?date=${date}`;
      if (searchLat && searchLon) {
        url += `&lat=${searchLat}&lon=${searchLon}`;
      }
      const response = await axios.get(url);
      if (response.data.length > 0) {
        setData(response.data[0]);
        setMapCenter([response.data[0].latitude, response.data[0].longitude]);
      } else {
        setData(null);
        setError("No records found. Try uploading a CSV or using different coordinates.");
      }
    } catch (err) {
      setError("Server connection failed. Please ensure the backend is running.");
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadMsg({ type: 'info', text: 'Processing and enriching data... This may take a moment.' });
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMsg({ type: 'success', text: response.data.message });
      setFile(null);
      e.target.reset();
      fetchData();
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.response?.data?.error || "Failed to upload file" });
    }
    setIsUploading(false);
  };

  const DataCard = ({ icon: Icon, label, value, color, unit }) => (
    <div className="glass-card hover-glow" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ 
        background: `${color}20`, 
        padding: '12px', 
        borderRadius: '16px', 
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
          {value}{unit}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '20px 40px' }}>
      {/* Navbar */}
      <nav style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '40px',
        padding: '20px 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #10b981)', 
            width: '40px', 
            height: '40px', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity color="white" size={24} />
          </div>
          <p style={{ color: '#64748b', fontSize: '1.1rem', marginTop: '8px', fontWeight: '500' }}>
            Soil Moisture Monitoring & Data Analytics Platform
          </p>
          <h1 style={{ 
            fontSize: '2.25rem', 
            fontWeight: '800', 
            color: '#1e293b', 
            margin: '0',
            letterSpacing: '-0.025em'
          }}>
            SoilMoisture <span style={{ color: '#3498db' }}>Analytics</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '8px 16px', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
            Live Monitoring System
          </div>
        </div>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px' }}>
        {/* Left Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Controls Panel */}
          <section className="glass-card animate-fade-in" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={20} color="var(--primary)" /> Analytics Filter
            </h2>
            <form onSubmit={handleSearch}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Observation Date</label>
                <input 
                  type="date" 
                  className="glass-card"
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    color: 'white', 
                    outline: 'none',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Latitude</label>
                  <input 
                    type="number" step="any"
                    className="glass-card"
                    value={searchLat} 
                    onChange={e => setSearchLat(e.target.value)} 
                    style={{ width: '100%', padding: '12px 16px', color: 'white', outline: 'none' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Longitude</label>
                  <input 
                    type="number" step="any"
                    className="glass-card"
                    value={searchLon} 
                    onChange={e => setSearchLon(e.target.value)} 
                    style={{ width: '100%', padding: '12px 16px', color: 'white', outline: 'none' }} 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  background: 'var(--primary)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '16px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 14px var(--primary-glow)'
                }}
              >
                {loading ? 'Analyzing...' : <><Search size={20} /> Analyze Site</>}
              </button>
            </form>
          </section>

          {/* Upload Section */}
          <section className="glass-card animate-fade-in" style={{ padding: '28px', border: '1px dashed var(--primary)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Upload size={18} color="var(--secondary)" /> Batch Processing
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
              Upload a CSV with <code>date</code>, <code>lat</code>, and <code>lon</code>. We'll automatically fetch rainfall, soil, and temp data.
            </p>
            <form onSubmit={handleFileUpload}>
              <input 
                type="file" accept=".csv" required 
                onChange={(e) => setFile(e.target.files[0])} 
                style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}
              />
              <button 
                disabled={isUploading}
                type="submit" 
                style={{ 
                  width: '100%', padding: '12px', 
                  background: isUploading ? 'var(--surface)' : 'var(--secondary)', 
                  color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {isUploading ? 'Processing...' : 'Enrich CSV Data'}
              </button>
            </form>
            {uploadMsg.text && (
              <div style={{ 
                marginTop: '16px', padding: '12px', borderRadius: '12px', fontSize: '0.85rem',
                background: uploadMsg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: uploadMsg.type === 'error' ? '#ef4444' : '#10b981',
                border: `1px solid ${uploadMsg.type === 'error' ? '#ef444433' : '#10b98133'}`
              }}>
                {uploadMsg.text}
              </div>
            )}
          </section>
        </aside>

        {/* Main Content Area */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Top Map View */}
          <div style={{ height: '450px', borderRadius: '32px', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              <ChangeView center={mapCenter} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {data && (
                <Marker position={[data.latitude, data.longitude]}>
                  <Popup>
                    <strong>Location Insight</strong><br />
                    Lat: {data.latitude.toFixed(4)}<br />
                    Lon: {data.longitude.toFixed(4)}
                  </Popup>
                </Marker>
              )}
            </MapContainer>
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }} className="glass-card">
               <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <MapIcon size={16} color="var(--primary)" /> Interactive Satellite View
               </div>
            </div>
          </div>

          {/* Data Grid */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Environmental Insights</h2>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Comprehensive data breakdown for {date}</p>
              </div>
              {data && data.source && (
                <div style={{ padding: '6px 12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                   Source: {data.source}
                </div>
              )}
            </div>

            {error && (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', border: '1px solid #ef444433' }}>
                <Info size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: 0 }}>{error}</h3>
              </div>
            )}

            {data ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                <DataCard 
                  icon={Droplets} 
                  label="Soil Moisture" 
                  value={(data.soil_moisture || data.smap || data.sm_ismn_daily || 0).toFixed(2)} 
                  unit="%" 
                  color="#3b82f6" 
                />
                <DataCard 
                  icon={Thermometer} 
                  label="Temperature" 
                  value={(data.temp_max || data.temp || data.t2m_era5_daily || 0).toFixed(1)} 
                  unit="°C" 
                  color="#ef4444" 
                />
                <DataCard 
                  icon={CloudRain} 
                  label="Precipitation" 
                  value={(data.precipitation || data.rain || data.p_era5_daily || 0).toFixed(2)} 
                  unit=" mm" 
                  color="#0ea5e9" 
                />
                <DataCard 
                  icon={Leaf} 
                  label="NDVI Index" 
                  value={(data.ndvi || data.ndvi_s2 || 0.65).toFixed(3)} 
                  unit="" 
                  color="#10b981" 
                />
                <DataCard 
                  icon={Sun} 
                  label="Solar Radiation" 
                  value={(data.radiation || data.shortwave_radiation_sum || 0).toFixed(0)} 
                  unit=" W/m²" 
                  color="#f59e0b" 
                />
                <DataCard 
                  icon={Wind} 
                  label="Evapotranspiration" 
                  value={(data.evapotranspiration || data.et0_fao_evapotranspiration || 0).toFixed(2)} 
                  unit=" mm/day" 
                  color="#8b5cf6" 
                />
              </div>
            ) : !loading && (
              <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                <Search size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-muted)' }}>Enter coordinates and select a date to see the analysis.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
