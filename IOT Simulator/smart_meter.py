import random
import time
import json
from datetime import datetime
import requests
import numpy as np
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Set up logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure retry strategy
retry_strategy = Retry(
    total=3,  # number of retries
    backoff_factor=1,  # wait 1, 2, 4 seconds between retries
    status_forcelist=[500, 502, 503, 504]  # HTTP status codes to retry on
)

# Create a session with the retry strategy
session = requests.Session()
session.mount("http://", HTTPAdapter(max_retries=retry_strategy))

class SmartMeter:
    def __init__(self, city):
        self.city = city
        self.base_voltage = 230  # Standard voltage in India
        self.base_current = 10   # Base current in amperes
        self.base_power = self.base_voltage * self.base_current
        logger.info(f"Initialized smart meter for {city}")
        
    def generate_reading(self):
        try:
            # Generate random variations
            voltage_variation = random.uniform(-5, 5)
            current_variation = random.uniform(-2, 2)
            
            # Calculate readings with some randomness
            voltage = self.base_voltage + voltage_variation
            current = self.base_current + current_variation
            power = voltage * current
            
            # Create reading data
            reading = {
                'city': self.city,
                'timestamp': datetime.now().isoformat(),
                'voltage': round(voltage, 2),
                'current': round(current, 2),
                'power_consumption': round(power, 2)
            }
            
            return reading
        except Exception as e:
            logger.error(f"Error generating reading for {self.city}: {str(e)}")
            return None

def check_edge_server(edge_server_url):
    """Check if edge server is available"""
    try:
        response = session.get(f"{edge_server_url}/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def simulate_city_data(city, edge_server_url):
    meter = SmartMeter(city)
    consecutive_failures = 0
    max_consecutive_failures = 5
    
    while True:
        try:
            # Check edge server health before sending data
            if not check_edge_server(edge_server_url):
                logger.error(f"Edge server not responding. Waiting before retry...")
                time.sleep(5)
                continue

            # Generate reading
            reading = meter.generate_reading()
            if not reading:
                continue
            
            # Send to edge server
            response = session.post(
                f"{edge_server_url}/receive_data",
                json=reading,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully sent reading from {city}: {reading}")
                consecutive_failures = 0  # Reset failure counter
            else:
                logger.warning(f"Failed to send reading from {city}. Status code: {response.status_code}")
                consecutive_failures += 1
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error for {city}: {str(e)}")
            consecutive_failures += 1
        except Exception as e:
            logger.error(f"Unexpected error for {city}: {str(e)}")
            consecutive_failures += 1
        
        # If too many consecutive failures, wait longer
        if consecutive_failures >= max_consecutive_failures:
            logger.error(f"Too many consecutive failures for {city}. Waiting 30 seconds before retry...")
            time.sleep(30)
            consecutive_failures = 0
        else:
            # Random delay between 1-5 seconds
            time.sleep(random.uniform(1, 5))

if __name__ == "__main__":
    # List of cities to simulate
    cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai']
    edge_server_url = "http://localhost:5001"
    
    logger.info("Starting Smart Grid IoT Simulator...")
    logger.info(f"Edge Server URL: {edge_server_url}")
    
    # Start simulation for each city
    for city in cities:
        simulate_city_data(city, edge_server_url)