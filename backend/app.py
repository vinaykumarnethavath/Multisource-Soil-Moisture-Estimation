from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import os
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'soil_moisture.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_weather_data(lat, lon, date_str):
    """
    Fetch historical weather and soil data from Open-Meteo API.
    """
    try:
        # Check if date is in the past or future to use appropriate API
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        today = datetime.now()
        
        if date_obj > today:
            # For future/current, use forecast API (though archive is usually better for specific past dates)
            base_url = "https://api.open-meteo.com/v1/forecast"
        else:
            base_url = "https://archive-api.open-meteo.com/v1/archive"

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": date_str,
            "end_date": date_str,
            "daily": [
                "temperature_2m_max", 
                "temperature_2m_min", 
                "precipitation_sum", 
                "rain_sum",
                "soil_moisture_0_to_7cm",
                "soil_temperature_0_to_7cm",
                "et0_fao_evapotranspiration",
                "shortwave_radiation_sum"
            ],
            "timezone": "auto"
        }
        
        response = requests.get(base_url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "daily" in data:
                d = data["daily"]
                return {
                    "temp_max": d["temperature_2m_max"][0],
                    "temp_min": d["temperature_2m_min"][0],
                    "precipitation": d["precipitation_sum"][0],
                    "rain": d["rain_sum"][0],
                    "soil_moisture": d["soil_moisture_0_to_7cm"][0],
                    "soil_temp": d["soil_temperature_0_to_7cm"][0],
                    "evapotranspiration": d["et0_fao_evapotranspiration"][0],
                    "radiation": d["shortwave_radiation_sum"][0]
                }
    except Exception as e:
        print(f"Error fetching from Open-Meteo: {e}")
    return None

@app.route('/api/search', methods=['GET'])
def search_data():
    date = request.args.get('date')
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if not date:
        return jsonify({"error": "Date is required"}), 400

    conn = get_db_connection()
    # Using a slightly broader tolerance for lat/lon search
    query = "SELECT * FROM soil_data WHERE date = ?"
    params = [date]
    
    if lat and lon:
        query += " AND ABS(latitude - ?) < 0.05 AND ABS(longitude - ?) < 0.05"
        params.extend([float(lat), float(lon)])
    
    row = conn.execute(query, params).fetchone()
    
    if row:
        row_dict = dict(row)
        # Check if we need to enrich this existing row with weather data
        needs_enrichment = any(row_dict.get(col) is None or pd.isna(row_dict.get(col)) 
                              for col in ['temp_max', 'precipitation', 'soil_moisture'])
        
        if needs_enrichment:
            print(f"Enriching existing record for {date} at {lat}, {lon}...")
            weather = fetch_weather_data(row_dict['latitude'], row_dict['longitude'], date)
            if weather:
                # Update the database with fetched values for future use
                update_query = """
                UPDATE soil_data SET 
                temp_max = ?, temp_min = ?, precipitation = ?, soil_moisture = ?, 
                evapotranspiration = ?, sm_ismn_daily = ?, t2m_era5_daily = ?, p_era5_daily = ?
                WHERE rowid = ?
                """
                conn.execute(update_query, [
                    weather['temp_max'], weather['temp_min'], weather['precipitation'], weather['soil_moisture'],
                    weather['evapotranspiration'], weather['soil_moisture'], weather['temp_max'], weather['precipitation'],
                    row['rowid'] if 'rowid' in row.keys() else row[0] # SQLite fallback
                ])
                conn.commit()
                # Refresh row_dict
                row_dict.update({
                    "temp_max": weather['temp_max'],
                    "precipitation": weather['precipitation'],
                    "soil_moisture": weather['soil_moisture'],
                    "evapotranspiration": weather['evapotranspiration'],
                    "sm_ismn_daily": weather['soil_moisture'],
                    "source": "Open-Meteo (Enriched)"
                })
        
        conn.close()
        return jsonify([row_dict])
    
    # If no record at all, fetch live (don't save yet to avoid polluting DB with random searches)
    if lat and lon:
        print(f"No record found. Fetching live data for {date}...")
        live_data = fetch_weather_data(float(lat), float(lon), date)
        if live_data:
            conn.close()
            return jsonify([{
                "date": date,
                "latitude": float(lat),
                "longitude": float(lon),
                "temp_max": live_data["temp_max"],
                "precipitation": live_data["precipitation"],
                "soil_moisture": live_data["soil_moisture"],
                "evapotranspiration": live_data["evapotranspiration"],
                "source": "Live API"
            }])

    conn.close()
    return jsonify([])

@app.route('/api/upload', methods=['POST'])
def upload_data():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    try:
        df = pd.read_csv(file)
        df.columns = [c.lower().strip() for c in df.columns]
        
        # Comprehensive Column Mapping
        mapping = {
            'lat': 'latitude',
            'lon': 'longitude',
            'long': 'longitude',
            'temp': 'temp_max',
            'temperature': 'temp_max',
            'rain': 'precipitation',
            'rainfall': 'precipitation',
            'precip': 'precipitation',
            'smap': 'soil_moisture',
            'sm': 'soil_moisture',
            'moisture': 'soil_moisture'
        }
        
        # Apply mapping
        for old_col, new_col in mapping.items():
            if old_col in df.columns and new_col not in df.columns:
                df = df.rename(columns={old_col: new_col})
        
        # Date column handling
        date_col = next((c for c in df.columns if 'date' in c), None)
        if date_col:
            df = df.rename(columns={date_col: 'date'})
            # Ensure date is in YYYY-MM-DD format
            try:
                df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
            except:
                # If it's something like 20220101
                df['date'] = pd.to_datetime(df['date'], format='%Y%m%d', errors='ignore')
                if df['date'].dtype == 'object': # If format failed
                    df['date'] = pd.to_datetime(df['date'], errors='coerce').dt.strftime('%Y-%m-%d')
                else:
                    df['date'] = df['date'].dt.strftime('%Y-%m-%d')
            
        required = {'date', 'latitude', 'longitude'}
        if not required.issubset(df.columns):
            return jsonify({"error": f"CSV needs columns for date, latitude, and longitude. Found: {list(df.columns)}"}), 400
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Ensure schema is ready
        cursor.execute(f"PRAGMA table_info(soil_data)")
        existing_cols = [r[1] for r in cursor.fetchall()]
        for col in df.columns:
            if col not in existing_cols:
                cursor.execute(f'ALTER TABLE soil_data ADD COLUMN "{col}" REAL')
        
        # Fast upload
        df.to_sql('soil_data', conn, if_exists='append', index=False)
        conn.commit()
        conn.close()
        
        return jsonify({"message": f"Successfully uploaded {len(df)} records. Data mapped to standard fields!"}), 201
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
