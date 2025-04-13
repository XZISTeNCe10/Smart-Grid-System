# Smart Grid System Simulation

A distributed smart grid simulation system that replicates real-world energy infrastructure through modular data flow, processing, and analytics. The system is designed to provide intelligent insights for administrators and real-time monitoring for consumers.

---

## Overview

This project simulates a smart grid system using distributed components for data generation, processing, visualization, and user-side tracking. It includes:

- A data generation server (smart meters)
- An edge server for preprocessing
- A central server with an admin dashboard
- An Android app for consumer-side usage tracking

---

## Key Features

- **Distributed Architecture** with separate modules for data generation, preprocessing, and analysis.
- **Admin Dashboard** showing:
  - Real-time electricity consumption
  - City-wise visualizations
  - Predictive analytics
- **Consumer-Side App** displaying:
  - Real-time household electricity usage
  - Appliance-wise consumption breakdown
- **No external databases used**, data is handled and transferred in-memory or via local files.

---

## Architecture
[ Smart Meters ] ↓ [ Edge Server (Preprocessing) ] ↓ [ Central Server (Flask Backend) ] ↓ [ Admin Dashboard (React) ] ↓ [ Consumer App (Android) ]


---

## Tech Stack

### Admin Dashboard

- **Backend**: Python (Flask)
- **Frontend**: React.js, Chart.js, Bootstrap
- **Other Tools**: File-based communication between servers (no database)
- **Functionality**:
  - Real-time city-wise electricity usage visualization
  - Insights and predictions using cleaned data

### Consumer Application

- **Platform**: Android Studio
- **Language**: Java
- **Functionality**:
  - Simulates electricity consumption data
  - Tracks usage per appliance and total household consumption


