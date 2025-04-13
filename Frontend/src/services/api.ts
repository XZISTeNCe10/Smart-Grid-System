import axios from 'axios';
import { CityStats, PeakPrediction } from '../types';

const API_BASE_URL = 'http://localhost:5002';

export const api = {
    getCityStats: async (city: string, hours: number = 24): Promise<CityStats> => {
        const response = await axios.get(`${API_BASE_URL}/city_stats/${city}`, {
            params: { hours }
        });
        return response.data;
    },

    getPeakPrediction: async (city: string): Promise<PeakPrediction> => {
        const response = await axios.get(`${API_BASE_URL}/peak_prediction/${city}`);
        return response.data;
    }
}; 