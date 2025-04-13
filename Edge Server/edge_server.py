from flask import Flask, request, jsonify
import numpy as np
from scipy import stats
import requests
import json
from datetime import datetime, timedelta
import pandas as pd
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
import threading
import random

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
CENTRAL_SERVER_URL = "http://localhost:5002"
WINDOW_SIZE = 10  # Number of readings to consider for moving average
VOLTAGE_THRESHOLD = (220, 240)  # Acceptable voltage range
CURRENT_THRESHOLD = (5, 15)     # Acceptable current range

# Cities configuration with extended parameters
CITIES = {
    'Mumbai': {
        'base_load': 1000,
        'peak_variation': 300,
        'peak_hours': [9, 13, 18, 22],
        'temperature_range': (25, 35),
        'humidity_range': (65, 85),
        'population': 20.4,
        'industrial_zones': 12,
        'residential_zones': 24,
        'commercial_zones': 18
    },
    'Delhi': {
        'base_load': 1200,
        'peak_variation': 400,
        'peak_hours': [10, 14, 19, 23],
        'temperature_range': (20, 45),
        'humidity_range': (40, 60),
        'population': 19.1,
        'industrial_zones': 15,
        'residential_zones': 30,
        'commercial_zones': 20
    },
    'Bangalore': {
        'base_load': 800,
        'peak_variation': 250,
        'peak_hours': [8, 12, 17, 21],
        'temperature_range': (20, 30),
        'humidity_range': (50, 70),
        'population': 12.3,
        'industrial_zones': 10,
        'residential_zones': 22,
        'commercial_zones': 16
    },
    'Chennai': {
        'base_load': 900,
        'peak_variation': 280,
        'peak_hours': [9, 13, 18, 22],
        'temperature_range': (28, 38),
        'humidity_range': (70, 90),
        'population': 10.9,
        'industrial_zones': 8,
        'residential_zones': 20,
        'commercial_zones': 14
    },
    'Kolkata': {
        'base_load': 950,
        'peak_variation': 320,
        'peak_hours': [8, 12, 17, 21],
        'temperature_range': (25, 35),
        'humidity_range': (70, 85),
        'population': 14.8,
        'industrial_zones': 9,
        'residential_zones': 25,
        'commercial_zones': 15
    }
}

# Configure retry strategy
retry_strategy = Retry(
    total=3,
    backoff_factor=0.5,
    status_forcelist=[500, 502, 503, 504]
)
http_adapter = HTTPAdapter(max_retries=retry_strategy)
session = requests.Session()
session.mount("http://", http_adapter)
session.mount("https://", http_adapter)

class DataPreprocessor:
    def __init__(self):
        self.readings_buffer = {}
        
    def clean_data(self, reading):
        """Clean and validate the incoming reading"""
        try:
            # Extract and convert values to correct types
            voltage = float(reading['voltage'])
            current = float(reading['current'])
            power = float(reading['power_consumption'])
            
            # Ensure timestamp is in ISO format
            if isinstance(reading['timestamp'], str):
                timestamp = datetime.fromisoformat(reading['timestamp'].replace('Z', '+00:00'))
            else:
                timestamp = reading['timestamp']
            
            # Format the reading with correct types
            formatted_reading = {
                'voltage': voltage,
                'current': current,
                'power_consumption': power,
                'city': str(reading['city']),
                'timestamp': timestamp.isoformat()
            }
            
            # Check if values are within acceptable ranges
            is_valid = (
                VOLTAGE_THRESHOLD[0] <= voltage <= VOLTAGE_THRESHOLD[1] and
                CURRENT_THRESHOLD[0] <= current <= CURRENT_THRESHOLD[1]
            )
            
            # Add metadata
            formatted_reading['status'] = 'valid' if is_valid else 'invalid'
            formatted_reading['flagged'] = not is_valid
            formatted_reading['anomaly'] = False  # Default value
            
            logger.info(f"Processed reading from {formatted_reading['city']}: Status={formatted_reading['status']}")
            return formatted_reading
        except Exception as e:
            logger.error(f"Error in clean_data: {str(e)}")
            raise
    
    def detect_anomalies(self, city, reading):
        """Detect anomalies using moving average"""
        try:
            if city not in self.readings_buffer:
                self.readings_buffer[city] = []
            
            self.readings_buffer[city].append(reading)
            
            # Keep only recent readings
            if len(self.readings_buffer[city]) > WINDOW_SIZE:
                self.readings_buffer[city].pop(0)
            
            # Calculate moving average if we have enough readings
            if len(self.readings_buffer[city]) >= WINDOW_SIZE:
                power_values = [r['power_consumption'] for r in self.readings_buffer[city]]
                mean_power = np.mean(power_values)
                std_power = np.std(power_values)
                
                # Flag if current reading deviates significantly
                current_power = reading['power_consumption']
                z_score = abs((current_power - mean_power) / std_power) if std_power > 0 else 0
                
                reading['anomaly'] = z_score > 3  # Flag if more than 3 standard deviations
            else:
                reading['anomaly'] = False
                
            return reading
        except Exception as e:
            logger.error(f"Error in detect_anomalies: {str(e)}")
            raise

class DataSimulator:
    def __init__(self):
        self.running = False
        self.thread = None
        self.anomaly_probability = 0.05
        self.weather_impact = {
            'temperature': 0.4,  # 40% impact on consumption
            'humidity': 0.3      # 30% impact on consumption
        }
        self.last_readings = {}  # Store last readings for smoother transitions
    
    def generate_weather_data(self, city):
        """Generate realistic weather data for a city"""
        config = CITIES[city]
        temp_min, temp_max = config['temperature_range']
        hum_min, hum_max = config['humidity_range']
        
        # Get current hour and create a more realistic daily pattern
        hour = datetime.now().hour
        
        # Temperature follows a bell curve throughout the day
        # Peak at 2 PM (14:00), lowest at 4 AM (04:00)
        temp_curve = -np.cos(2 * np.pi * (hour - 4) / 24)
        base_temp = (temp_max + temp_min) / 2
        temp_amplitude = (temp_max - temp_min) / 2
        temperature = base_temp + temp_amplitude * temp_curve
        
        # Add small random variations while maintaining smooth transitions
        if city in self.last_readings:
            last_temp = self.last_readings[city].get('temperature', temperature)
            # Limit temperature change to 0.5°C per reading
            temp_change = random.uniform(-0.5, 0.5)
            temperature = max(min(last_temp + temp_change, temp_max), temp_min)
        
        # Humidity typically inverse to temperature with some lag
        # Peak humidity in early morning, lowest in afternoon
        hum_curve = np.cos(2 * np.pi * (hour - 6) / 24)
        base_humidity = (hum_max + hum_min) / 2
        hum_amplitude = (hum_max - hum_min) / 2
        humidity = base_humidity + hum_amplitude * hum_curve
        
        # Add small random variations while maintaining smooth transitions
        if city in self.last_readings:
            last_hum = self.last_readings[city].get('humidity', humidity)
            # Limit humidity change to 1% per reading
            hum_change = random.uniform(-1, 1)
            humidity = max(min(last_hum + hum_change, hum_max), hum_min)
        
        # Store current readings for next iteration
        self.last_readings[city] = {
            'temperature': temperature,
            'humidity': humidity
        }
        
        return {
            'temperature': round(temperature, 1),
            'humidity': round(humidity, 1)
        }

    def calculate_zone_distribution(self, city, total_power):
        """Calculate power distribution across different zones"""
        config = CITIES[city]
        total_zones = config['industrial_zones'] + config['residential_zones'] + config['commercial_zones']
        
        # Base distribution percentages
        industrial_pct = config['industrial_zones'] / total_zones * 100
        residential_pct = config['residential_zones'] / total_zones * 100
        commercial_pct = config['commercial_zones'] / total_zones * 100
        
        # Get current hour for time-based variations
        hour = datetime.now().hour
        
        # More realistic time-based variations
        if 6 <= hour < 9:  # Early morning
            industrial_pct *= 0.7
            commercial_pct *= 0.5
            residential_pct *= 1.4
        elif 9 <= hour < 17:  # Business hours
            industrial_pct *= 1.4
            commercial_pct *= 1.3
            residential_pct *= 0.6
        elif 17 <= hour < 22:  # Evening hours
            industrial_pct *= 0.5
            commercial_pct *= 0.8
            residential_pct *= 1.5
        else:  # Night hours
            industrial_pct *= 0.3
            commercial_pct *= 0.2
            residential_pct *= 1.2
        
        # Add weather impact on zone distribution
        weather = self.last_readings.get(city, {})
        if weather:
            temp = weather.get('temperature', 25)
            temp_factor = (temp - sum(config['temperature_range'])/2) / 10
            industrial_pct *= (1 + temp_factor * 0.2)  # Industrial more affected by heat
            residential_pct *= (1 - temp_factor * 0.1)  # Residential less affected
        
        # Normalize percentages
        total_pct = industrial_pct + residential_pct + commercial_pct
        industrial_pct = (industrial_pct / total_pct) * 100
        residential_pct = (residential_pct / total_pct) * 100
        commercial_pct = (commercial_pct / total_pct) * 100
        
        # Calculate actual power values with some randomness
        industrial_power = total_power * (industrial_pct / 100) * random.uniform(0.95, 1.05)
        residential_power = total_power * (residential_pct / 100) * random.uniform(0.95, 1.05)
        commercial_power = total_power * (commercial_pct / 100) * random.uniform(0.95, 1.05)
        
        return {
            'industrial': round(industrial_power, 2),
            'residential': round(residential_power, 2),
            'commercial': round(commercial_power, 2)
        }

    def generate_reading(self, city):
        """Generate realistic power consumption data for a city"""
        config = CITIES[city]
        current_hour = datetime.now().hour
        
        # Generate base power with controlled random variation
        base_variation = random.uniform(-30, 30)  # Reduced variation for more stability
        power = config['base_load'] + base_variation
        
        # Add peak load during peak hours with smooth transitions
        if current_hour in config['peak_hours']:
            # Calculate how close we are to the peak hour
            time_to_peak = min(abs(current_hour - peak) for peak in config['peak_hours'])
            peak_factor = 1 - (time_to_peak * 0.1)  # Gradual increase/decrease
            peak_factor = max(0.7, min(1.0, peak_factor))  # Keep within bounds
            power += config['peak_variation'] * peak_factor
        
        # Generate weather data and apply impact
        weather = self.generate_weather_data(city)
        temp_impact = (weather['temperature'] - sum(config['temperature_range'])/2) * self.weather_impact['temperature']
        humidity_impact = (weather['humidity'] - sum(config['humidity_range'])/2) * self.weather_impact['humidity']
        
        # Apply weather impacts with diminishing returns
        power += temp_impact * (1 - abs(temp_impact)/power)  # Less impact at extreme values
        power += humidity_impact * (1 - abs(humidity_impact)/power)
        
        # Calculate voltage and current with realistic variations
        base_voltage = 230  # Standard voltage
        voltage_variation = random.uniform(-5, 5)  # ±5V variation
        voltage = base_voltage + voltage_variation
        
        # Current calculation with power factor consideration
        power_factor = random.uniform(0.95, 0.99)  # Realistic power factor
        current = (power / voltage) / power_factor
        
        # Determine if this reading is an anomaly
        is_anomaly = random.random() < self.anomaly_probability
        if is_anomaly:
            # More realistic anomaly: sudden spike or drop
            anomaly_factor = random.choice([0.5, 2.0])  # Either 50% drop or 100% increase
            power *= anomaly_factor
            current *= anomaly_factor
        
        # Calculate zone distribution
        zone_distribution = self.calculate_zone_distribution(city, power)
        
        # Calculate efficiency score with multiple factors
        base_efficiency = random.uniform(0.85, 0.95)  # Base efficiency range
        
        # Time-based efficiency
        if current_hour in config['peak_hours']:
            base_efficiency *= 0.9  # Reduced efficiency during peak hours
        
        # Temperature impact on efficiency
        temp_efficiency = 1 - abs(weather['temperature'] - sum(config['temperature_range'])/2) / 50
        base_efficiency *= max(0.7, temp_efficiency)
        
        # Load-based efficiency
        load_factor = power / (config['base_load'] + config['peak_variation'])
        load_efficiency = 1 - abs(load_factor - 1) * 0.2  # Penalty for being far from optimal load
        base_efficiency *= max(0.7, load_efficiency)
        
        # Per capita calculations with population density consideration
        population_density = config['population'] / (config['industrial_zones'] + config['residential_zones'] + config['commercial_zones'])
        per_capita = power / (config['population'] * (1 + population_density/100))
        
        reading = {
            'city': city,
            'timestamp': datetime.now().isoformat(),
            'voltage': round(voltage, 2),
            'current': round(current, 2),
            'power_consumption': round(power, 2),
            'temperature': weather['temperature'],
            'humidity': weather['humidity'],
            'is_anomaly': is_anomaly,
            'is_peak_hour': current_hour in config['peak_hours'],
            'zone_distribution': zone_distribution,
            'per_capita_consumption': round(per_capita, 2),
            'efficiency_score': round(base_efficiency, 2)
        }
        
        logger.info(f"Generated reading for {city}: {reading}")
        return reading
    
    def simulate_and_send(self):
        """Continuously generate and send readings for all cities"""
        while self.running:
            for city in CITIES.keys():
                try:
                    reading = self.generate_reading(city)
                    response = requests.post(
                        'http://localhost:5001/receive_data',
                        json=reading,
                        headers={'Content-Type': 'application/json'}
                    )
                    if response.status_code == 200:
                        logger.info(f"Successfully sent reading for {city}")
                    else:
                        logger.warning(f"Failed to send reading for {city}")
                except Exception as e:
                    logger.error(f"Error sending reading for {city}: {str(e)}")
                
                # Add random delay between readings (2-4 seconds)
                time.sleep(random.uniform(2, 4))
    
    def start(self):
        """Start the simulation"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self.simulate_and_send)
            self.thread.start()
            logger.info("Started data simulation for all cities")
    
    def stop(self):
        """Stop the simulation"""
        self.running = False
        if self.thread:
            self.thread.join()
            logger.info("Stopped data simulation")

preprocessor = DataPreprocessor()
simulator = DataSimulator()

@app.route('/receive_data', methods=['POST'])
def receive_data():
    try:
        # Get the reading from the request
        reading = request.json
        logger.info(f"Received reading from {reading['city']}")
        
        # Clean and preprocess the data
        cleaned_reading = preprocessor.clean_data(reading)
        
        # Detect anomalies
        processed_reading = preprocessor.detect_anomalies(reading['city'], cleaned_reading)
        
        # Ensure all required fields are present and properly typed
        required_fields = {
            'city': str(processed_reading['city']),
            'timestamp': processed_reading['timestamp'],
            'voltage': float(processed_reading['voltage']),
            'current': float(processed_reading['current']),
            'power_consumption': float(processed_reading['power_consumption']),
            'status': str(processed_reading['status']),
            'flagged': bool(processed_reading['flagged']),
            'anomaly': bool(processed_reading['anomaly']),
            'temperature': float(reading['temperature']),
            'humidity': float(reading['humidity']),
            'zone_distribution': reading['zone_distribution'],
            'is_peak_hour': bool(reading['is_peak_hour']),
            'per_capita_consumption': float(reading['per_capita_consumption']),
            'efficiency_score': float(reading['efficiency_score'])
        }
        
        # Forward to central server with retry logic
        max_retries = 3
        retry_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                response = session.post(
                    f"{CENTRAL_SERVER_URL}/store_data",
                    json=required_fields,
                    headers={'Content-Type': 'application/json'},
                    timeout=5
                )
                
                if response.status_code == 200:
                    logger.info(f"Successfully forwarded data from {reading['city']}")
                    return jsonify({"status": "success", "message": "Data processed and forwarded"})
                else:
                    error_msg = response.json().get('message', 'Unknown error')
                    logger.warning(f"Attempt {attempt + 1} failed. Status code: {response.status_code}, Error: {error_msg}")
                    
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
                    else:
                        return jsonify({"status": "error", "message": f"Failed to forward data after {max_retries} attempts: {error_msg}"}), 500
                        
            except requests.exceptions.RequestException as e:
                logger.warning(f"Attempt {attempt + 1} failed with network error: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                else:
                    return jsonify({"status": "error", "message": "Network error after multiple retries"}), 500
                    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/start_simulation', methods=['GET', 'POST'])
def start_simulation():
    try:
        simulator.start()
        return jsonify({"status": "success", "message": "Started data simulation"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/stop_simulation', methods=['GET', 'POST'])
def stop_simulation():
    try:
        simulator.stop()
        return jsonify({"status": "success", "message": "Stopped data simulation"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Edge Server on port 5001...")
    app.run(host='0.0.0.0', port=5001) 