from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Database setup
def init_db():
    # Delete the existing database file if it exists
    if os.path.exists('smart_grid.db'):
        os.remove('smart_grid.db')
        logger.info("Removed existing database")

    conn = sqlite3.connect('smart_grid.db')
    c = conn.cursor()
    
    # Create the table with all required columns
    c.execute('''
        CREATE TABLE IF NOT EXISTS power_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            voltage REAL NOT NULL,
            current REAL NOT NULL,
            power_consumption REAL NOT NULL,
            temperature REAL,
            humidity REAL,
            is_anomaly INTEGER,
            is_peak_hour INTEGER,
            zone_industrial REAL,
            zone_residential REAL,
            zone_commercial REAL,
            per_capita_consumption REAL,
            efficiency_score REAL
        )
    ''')
    conn.commit()
    conn.close()
    logger.info("Created new database with updated schema")

# Initialize database before first request
@app.before_first_request
def setup():
    init_db()

# Also initialize database when starting the server
init_db()

@app.route('/store_data', methods=['POST'])
def store_data():
    try:
        data = request.json
        logger.info(f"Received data: {data}")
        
        conn = sqlite3.connect('smart_grid.db')
        c = conn.cursor()
        
        # Extract zone distribution if it exists
        zone_dist = data.get('zone_distribution', {})
        
        # Convert boolean values to integers for SQLite
        is_anomaly = 1 if data.get('is_anomaly', False) else 0
        is_peak_hour = 1 if data.get('is_peak_hour', False) else 0
        
        c.execute('''
            INSERT INTO power_readings (
                city, timestamp, voltage, current, power_consumption,
                temperature, humidity, is_anomaly, is_peak_hour,
                zone_industrial, zone_residential, zone_commercial,
                per_capita_consumption, efficiency_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['city'],
            data['timestamp'],
            float(data['voltage']),
            float(data['current']),
            float(data['power_consumption']),
            float(data.get('temperature', 0)),
            float(data.get('humidity', 0)),
            is_anomaly,
            is_peak_hour,
            zone_dist.get('industrial', 0),
            zone_dist.get('residential', 0),
            zone_dist.get('commercial', 0),
            float(data.get('per_capita_consumption', 0)),
            float(data.get('efficiency_score', 0))
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"Successfully stored data for {data['city']}")
        
        return jsonify({"status": "success", "message": "Data stored successfully"}), 200
    except Exception as e:
        logger.error(f"Error storing data: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/city_stats/<city>', methods=['GET'])
def get_city_stats(city):
    try:
        hours = request.args.get('hours', default=24, type=int)
        conn = sqlite3.connect('smart_grid.db')
        c = conn.cursor()
        
        # Get current timestamp and calculate threshold
        current_time = datetime.now()
        time_threshold = (current_time - timedelta(hours=hours)).isoformat()
        
        logger.info(f"Fetching data for {city} from {time_threshold}")
        
        c.execute('''
            SELECT * FROM power_readings 
            WHERE city = ? AND timestamp > ?
            ORDER BY timestamp DESC
        ''', (city, time_threshold))
        
        columns = [description[0] for description in c.description]
        readings = []
        
        for row in c.fetchall():
            reading = dict(zip(columns, row))
            # Convert integer boolean fields back to Python booleans
            reading['is_anomaly'] = bool(reading['is_anomaly'])
            reading['is_peak_hour'] = bool(reading['is_peak_hour'])
            # Reconstruct zone_distribution object
            reading['zone_distribution'] = {
                'industrial': reading.pop('zone_industrial') or 0,
                'residential': reading.pop('zone_residential') or 0,
                'commercial': reading.pop('zone_commercial') or 0
            }
            readings.append(reading)
        
        conn.close()
        
        if not readings:
            # Return empty readings array instead of error if no data found
            return jsonify({
                "status": "success",
                "city": city,
                "readings": []
            }), 200
            
        logger.info(f"Found {len(readings)} readings for {city}")
        return jsonify({
            "status": "success",
            "city": city,
            "readings": readings
        }), 200
    except Exception as e:
        logger.error(f"Error fetching city stats: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    logger.info("Starting Central Server on port 5002...")
    app.run(host='0.0.0.0', port=5002)