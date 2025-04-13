import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Grid,
    Paper,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Card,
    CardContent,
} from '@mui/material';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';
import { api } from '../services/api';
import { CityStats, PeakPrediction, City } from '../types';

const cities: City[] = [
    { name: 'Mumbai', color: '#FF6B6B' },
    { name: 'Delhi', color: '#4ECDC4' },
    { name: 'Bengaluru', color: '#45B7D1' },
    { name: 'Hyderabad', color: '#96CEB4' },
    { name: 'Chennai', color: '#FFEEAD' },
];

const Dashboard: React.FC = () => {
    const [selectedCity, setSelectedCity] = useState<string>(cities[0].name);
    const [cityStats, setCityStats] = useState<CityStats | null>(null);
    const [peakPrediction, setPeakPrediction] = useState<PeakPrediction | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [stats, prediction] = await Promise.all([
                    api.getCityStats(selectedCity),
                    api.getPeakPrediction(selectedCity),
                ]);
                setCityStats(stats);
                setPeakPrediction(prediction);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [selectedCity]);

    const cityColor = cities.find(city => city.name === selectedCity)?.color || '#000000';

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                        <FormControl sx={{ minWidth: 200, mb: 2 }}>
                            <InputLabel>Select City</InputLabel>
                            <Select
                                value={selectedCity}
                                label="Select City"
                                onChange={(e) => setSelectedCity(e.target.value)}
                            >
                                {cities.map((city) => (
                                    <MenuItem key={city.name} value={city.name}>
                                        {city.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Paper>
                </Grid>

                {/* Key Metrics */}
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Consumption (24h)
                            </Typography>
                            <Typography variant="h4">
                                {cityStats ? `${(cityStats.total_consumption / 1000).toFixed(2)} kWh` : 'Loading...'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Average Power
                            </Typography>
                            <Typography variant="h4">
                                {cityStats ? `${cityStats.average_power.toFixed(2)} W` : 'Loading...'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Peak Power
                            </Typography>
                            <Typography variant="h4">
                                {cityStats ? `${cityStats.peak_power.toFixed(2)} W` : 'Loading...'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Power Consumption Chart */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" gutterBottom>
                            Power Consumption Over Time
                        </Typography>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={cityStats?.readings}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(value) => new Date(value).toLocaleString()}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="power_consumption"
                                    stroke={cityColor}
                                    name="Power Consumption (W)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Peak Hours Prediction */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" gutterBottom>
                            Peak Hours Prediction
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={peakPrediction?.peak_hours.map((hour, index) => ({
                                    hour: `${hour}:00`,
                                    consumption: peakPrediction?.peak_consumption[index],
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    dataKey="consumption"
                                    fill={cityColor}
                                    name="Predicted Consumption (W)"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default Dashboard; 