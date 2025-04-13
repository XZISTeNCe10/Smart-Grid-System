export interface PowerReading {
    timestamp: string;
    power_consumption: number;
    voltage: number;
    current: number;
}

export interface CityStats {
    total_consumption: number;
    average_power: number;
    peak_power: number;
    peak_time: string;
    readings: PowerReading[];
}

export interface PeakPrediction {
    peak_hours: number[];
    peak_consumption: number[];
}

export interface City {
    name: string;
    color: string;
} 