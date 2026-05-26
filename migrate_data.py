import pandas as pd
import sqlite3
import os

# Configuration
CSV_FILE = 'fusion_training_table_2021_2024_normalized.csv'
DB_FILE = 'backend/soil_moisture.db'
LAT = 36.1156071
LON = -97.0583681

def migrate_data():
    if not os.path.exists(CSV_FILE):
        print(f"Error: {CSV_FILE} not found.")
        return

    # Read CSV
    df = pd.read_csv(CSV_FILE)
    
    # Normalize columns to lowercase
    df.columns = [c.lower() for c in df.columns]
    
    # Add coordinates only if they don't already exist
    if 'latitude' not in df.columns and 'lat' not in df.columns:
        df['latitude'] = LAT
    if 'longitude' not in df.columns and 'lon' not in df.columns:
        df['longitude'] = LON
    
    # Handle lat/lon column name variations
    if 'lat' in df.columns and 'latitude' not in df.columns:
        df = df.rename(columns={'lat': 'latitude'})
    if 'lon' in df.columns and 'longitude' not in df.columns:
        df = df.rename(columns={'lon': 'longitude'})
    
    # Connect to SQLite
    conn = sqlite3.connect(DB_FILE)
    
    # Write to SQL
    # We use 'append' so future global data can be added to the same table
    df.to_sql('soil_data', conn, if_exists='replace', index=False)
    
    # Create an index for faster searching
    cursor = conn.cursor()
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_date_lat_lon ON soil_data (date, latitude, longitude)')
    
    conn.commit()
    conn.close()
    print(f"Successfully migrated {len(df)} records to {DB_FILE}")

if __name__ == "__main__":
    migrate_data()
