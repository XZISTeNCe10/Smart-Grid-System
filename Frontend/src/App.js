import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  Box,
  IconButton,
  useTheme,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Fade,
  Zoom,
  useMediaQuery,
  Button
} from '@mui/material';
import { Brightness4, Brightness7, Warning, Dashboard, Timeline, PieChart as PieChartIcon, TrendingUp, Refresh } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

const COLORS = {
  Mumbai: '#8884d8',
  Delhi: '#82ca9d',
  Bangalore: '#ffc658',
  Chennai: '#ff7300',
  Kolkata: '#00C49F',
  industrial: '#0088FE',
  residential: '#00C49F',
  commercial: '#FFBB28'
};

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const theme = darkMode ? darkTheme : lightTheme;
  const [cityData, setCityData] = useState({});
  const [cardData, setCardData] = useState({}); // Separate state for card data
  const [selectedCity, setSelectedCity] = useState('Mumbai');
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState({});
  const [lastGraphUpdate, setLastGraphUpdate] = useState(Date.now());
  const [dataCache, setDataCache] = useState({}); // Cache for fetched data
  const [error, setError] = useState(null); // Add error state
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata'];

  // Function to generate realistic fluctuations
  const generateFluctuation = (baseValue, type) => {
    const now = Date.now();
    const timeOfDay = new Date().getHours();
    let fluctuation = 0;

    // Add time-based variations
    if (type === 'power') {
      // Higher fluctuations during peak hours (9-11 AM and 6-8 PM)
      const isPeakHour = (timeOfDay >= 9 && timeOfDay <= 11) || (timeOfDay >= 18 && timeOfDay <= 20);
      fluctuation = isPeakHour ? (Math.random() - 0.5) * 50 : (Math.random() - 0.5) * 20;
    } else if (type === 'temperature') {
      // Temperature varies more during day (10 AM - 4 PM)
      const isDaytime = timeOfDay >= 10 && timeOfDay <= 16;
      fluctuation = isDaytime ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 0.5;
    } else if (type === 'humidity') {
      // Humidity varies more during night
      const isNighttime = timeOfDay >= 22 || timeOfDay <= 6;
      fluctuation = isNighttime ? (Math.random() - 0.5) * 5 : (Math.random() - 0.5) * 2;
    }

    // Add some randomness
    fluctuation += (Math.random() - 0.5) * 10;

    // Ensure the fluctuation doesn't make values unrealistic
    const newValue = baseValue + fluctuation;
    if (type === 'power') {
      return Math.max(0, Math.min(2000, newValue));
    } else if (type === 'temperature') {
      return Math.max(15, Math.min(45, newValue));
    } else if (type === 'humidity') {
      return Math.max(20, Math.min(100, newValue));
    }
    return newValue;
  };

  // State for live power consumption
  const [livePowerConsumption, setLivePowerConsumption] = useState({});
  
  // State for static chart data
  const [staticChartData, setStaticChartData] = useState({});
  
  // State to track if data has been loaded
  const [dataLoaded, setDataLoaded] = useState(false);

  // State for refresh interval
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [nextRefreshTime, setNextRefreshTime] = useState(null);
  const [countdown, setCountdown] = useState(60);

  // Separate CountdownTimer component to prevent re-renders of the main component
  const CountdownTimer = React.memo(() => {
    const [secondsLeft, setSecondsLeft] = useState(countdown);
    
    useEffect(() => {
      const timer = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }, []);
    
    return (
      <Typography variant="body2" sx={{ mr: 2, color: 'text.secondary' }}>
        {secondsLeft}s until next refresh
      </Typography>
    );
  });

  // Function to fetch data for a single city
  const fetchCityData = async (city) => {
    // Check if we have cached data that's less than 5 minutes old
    const now = Date.now();
    const lastFetch = lastFetchTime[city] || 0;
    const cacheKey = `${city}_${Math.floor(now / 300000)}`; // 5-minute cache key
    
    if (dataCache[cacheKey]) {
      // Use cached data
      setCityData(prev => ({ ...prev, [city]: dataCache[cacheKey] }));
      setCardData(prev => ({ ...prev, [city]: dataCache[cacheKey] }));
      return dataCache[cacheKey];
    }
    
    // Set loading state for this city
    setLoadingCities(prev => [...new Set([...prev, city])]);
    
    try {
      const response = await fetch(`http://localhost:5002/city_stats/${city}?hours=24`);
      const data = await response.json();
      
      if (data && data.readings) {
        // Update data for this city
        setCityData(prev => ({ ...prev, [city]: data.readings }));
        setCardData(prev => ({ ...prev, [city]: data.readings }));
        
        // Update cache
        setDataCache(prev => ({ ...prev, [cacheKey]: data.readings }));
        
        // Update last fetch time
        setLastFetchTime(prev => ({ ...prev, [city]: now }));
        return data.readings;
      }
    } catch (error) {
      console.error(`Error fetching data for ${city}:`, error);
    } finally {
      // Remove city from loading state
      setLoadingCities(prev => prev.filter(c => c !== city));
    }
  };

  // Function to fetch data for a specific city
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetchCityData(selectedCity);
      if (response) {
        // Only update static chart data when explicitly requested
        setStaticChartData(prevData => ({
          ...prevData,
          [selectedCity]: response
        }));
        setLastGraphUpdate(Date.now());
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again.');
    }
    setIsLoading(false);
  };

  // Function to handle city selection
  const handleCitySelect = (city) => {
    setSelectedCity(city);
    if (!staticChartData[city]) {
      fetchData();
    }
  };

  // Initial data load - only run once
  useEffect(() => {
    const loadInitialData = async () => {
      // Load Mumbai first
      const response = await fetchCityData('Mumbai');
      if (response) {
        setStaticChartData(prev => ({
          ...prev,
          'Mumbai': response
        }));
      }
      setSelectedCity('Mumbai');

      // Load other cities after a short delay
      const otherCities = cities.filter(city => city !== 'Mumbai');
      for (const city of otherCities) {
        const cityResponse = await fetchCityData(city);
        if (cityResponse) {
          setStaticChartData(prev => ({
            ...prev,
            [city]: cityResponse
          }));
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setDataLoaded(true);
    };

    loadInitialData();
  }, []); // Empty dependency array to run only once on mount

  // Function to refresh all data
  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      // Fetch data for all cities
      const promises = cities.map(city => fetchCityData(city));
      await Promise.all(promises);
      
      // Update static chart data
      setStaticChartData(prevData => {
        const newData = { ...prevData };
        cities.forEach(city => {
          if (cityData[city]) {
            newData[city] = cityData[city];
          }
        });
        return newData;
      });
      
      const now = Date.now();
      setLastRefreshTime(now);
      setNextRefreshTime(now + 60000); // Set next refresh time to exactly 1 minute from now
      setCountdown(60);
      setError(null);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
    }
    setIsLoading(false);
  };

  // Effect for refresh interval
  useEffect(() => {
    // Initial refresh
    refreshAllData();

    // Set up refresh interval
    const interval = setInterval(refreshAllData, 60000); // Exactly 1 minute
    setRefreshInterval(interval);

    // Cleanup
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []); // Empty dependency array to run only once on mount

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get chart data
  const getChartData = (data, type) => {
    if (!data || data.length === 0) return [];
    
    return data.map(reading => {
      const baseData = {
        timestamp: formatTimestamp(reading.timestamp),
      };
      
      switch (type) {
        case 'power':
          return {
            ...baseData,
            power: reading.power_consumption,
            voltage: reading.voltage,
            current: reading.current
          };
        case 'weather':
          return {
            ...baseData,
            temperature: reading.temperature,
            humidity: reading.humidity,
            power: reading.power_consumption,
          };
        case 'efficiency':
          return {
            ...baseData,
            efficiency: reading.efficiency_score * 100,
            perCapita: reading.per_capita_consumption,
          };
        default:
          return baseData;
      }
    });
  };

  // Memoized City Card Component
  const CityCard = React.memo(({ city }) => {
    const data = cardData[city] || cityData[city]; // Use cardData if available, fallback to cityData
    const isLoading = loadingCities.includes(city);
    
    if (isLoading || !data || data.length === 0) {
      return (
        <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Card>
      );
    }

    const latest = data[data.length - 1];
    const trend = data.length > 1 
      ? latest.power_consumption - data[data.length - 2].power_consumption 
      : 0;

    // Calculate percentage change
    const percentageChange = data.length > 1 
      ? (trend / data[data.length - 2].power_consumption) * 100 
      : 0;

    // Get status color based on power consumption
    const getStatusColor = (power) => {
      if (power > 1000) return 'error.main';
      if (power > 800) return 'warning.main';
      return 'success.main';
    };

    return (
      <Card 
        sx={{ 
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: theme.shadows[8],
          },
          bgcolor: selectedCity === city ? 'action.selected' : 'background.paper',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: COLORS[city],
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, ${COLORS[city]} 0%, transparent 100%)`,
            opacity: 0.5,
          },
        }}
        onClick={() => handleCitySelect(city)}
      >
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'relative',
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: COLORS[city],
                  textShadow: `0 0 10px ${COLORS[city]}33`,
                }}
              >
                {city}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  bgcolor: 'background.default',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.75rem',
                }}
              >
                {formatTimestamp(latest.timestamp)}
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              py: 1,
            }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 600,
                  color: getStatusColor(latest.power_consumption),
                  textShadow: `0 0 10px ${getStatusColor(latest.power_consumption)}33`,
                  transition: 'color 0.5s ease-in-out',
                }}
              >
                {Math.round(latest.power_consumption)}
              </Typography>
              <Typography 
                variant="subtitle2" 
                color="text.secondary"
                sx={{ mt: -0.5 }}
              >
                kW
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              bgcolor: 'background.default',
              p: 1,
              borderRadius: 1,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography 
                  variant="body2" 
                  color={trend > 0 ? 'error.main' : 'success.main'}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    fontWeight: 500,
                    transition: 'color 0.5s ease-in-out',
                  }}
                >
                  {trend > 0 ? '↑' : '↓'} {Math.abs(percentageChange).toFixed(1)}%
                </Typography>
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{
                    transition: 'color 0.5s ease-in-out',
                  }}
                >
                  {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(2)} kW
                </Typography>
              </Box>
              
              <Stack 
                direction="row" 
                spacing={1.5}
                sx={{ 
                  '& > *': {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    transition: 'color 0.5s ease-in-out',
                  }
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.mode === 'dark' ? '#ff9800' : '#f57c00',
                  }}
                >
                  🌡️ {latest.temperature.toFixed(1)}°C
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.mode === 'dark' ? '#4fc3f7' : '#0288d1',
                  }}
                >
                  💧 {latest.humidity.toFixed(1)}%
                </Typography>
              </Stack>
            </Box>

            {latest.is_anomaly && (
              <Alert 
                severity="warning" 
                icon={<Warning />}
                sx={{ 
                  mt: 1,
                  '& .MuiAlert-icon': {
                    color: 'warning.main',
                  },
                  bgcolor: theme.palette.mode === 'dark' ? 'warning.dark' : 'warning.light',
                  color: theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark',
                }}
              >
                Anomaly Detected
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    // Only re-render if the city prop changes or if the live power consumption for this city changes
    return prevProps.city === nextProps.city && 
           livePowerConsumption[prevProps.city] === livePowerConsumption[nextProps.city];
  });

  // Memoized Power Consumption Chart Component
  const PowerConsumptionChart = React.memo(({ data }) => {
    if (!data || data.length === 0) {
      return (
        <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">Power Consumption</Typography>
            <CircularProgress />
          </Stack>
        </Card>
      );
    }

    // Format the data for the chart
    const chartData = data.map(reading => ({
      timestamp: formatTimestamp(reading.timestamp),
      power: reading.power_consumption,
      voltage: reading.voltage
    }));

    return (
      <Card sx={{ height: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Dashboard sx={{ color: 'primary.main' }} />
          Power Consumption
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorVoltage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis 
              dataKey="timestamp" 
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
            />
            <YAxis 
              yAxisId="left"
              stroke={theme.palette.primary.main}
              tick={{ fill: theme.palette.primary.main }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              stroke={theme.palette.secondary.main}
              tick={{ fill: theme.palette.secondary.main }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: 'none',
                borderRadius: 8,
                boxShadow: theme.shadows[4],
              }}
            />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="power"
              stroke={theme.palette.primary.main}
              fillOpacity={1}
              fill="url(#colorPower)"
              name="Power (kW)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="voltage"
              stroke={theme.palette.secondary.main}
              fillOpacity={1}
              fill="url(#colorVoltage)"
              name="Voltage (V)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    );
  }, () => true); // Never re-render this component

  // Memoized Zone Distribution Chart Component
  const ZoneDistributionChart = React.memo(({ data }) => {
    if (!data || data.length === 0) {
      return (
        <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">Zone Distribution</Typography>
            <CircularProgress />
          </Stack>
        </Card>
      );
    }

    const latest = data[data.length - 1];
    if (!latest.zone_distribution) {
      return (
        <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="error">No zone data available</Typography>
        </Card>
      );
    }

    const pieData = [
      { name: 'Industrial', value: latest.zone_distribution.industrial },
      { name: 'Residential', value: latest.zone_distribution.residential },
      { name: 'Commercial', value: latest.zone_distribution.commercial },
    ];

    const total = pieData.reduce((sum, item) => sum + item.value, 0);
    const formattedPieData = pieData.map(item => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1)
    }));

    return (
      <Card sx={{ height: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PieChartIcon sx={{ color: 'primary.main' }} />
          Zone Distribution
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <RechartsPieChart>
            <Pie
              data={formattedPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percentage }) => `${name} (${percentage}%)`}
              animationDuration={1000}
            >
              {formattedPieData.map((entry, index) => (
                <Cell key={index} fill={COLORS[entry.name.toLowerCase()]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => `${value.toFixed(2)} kW`}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: 'none',
                borderRadius: 8,
                boxShadow: theme.shadows[4],
              }}
            />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      </Card>
    );
  }, () => true); // Never re-render this component

  // Memoized Weather Impact Chart Component
  const WeatherImpactChart = React.memo(({ data }) => {
    if (!data || data.length === 0) {
      return (
        <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">Weather Impact</Typography>
            <CircularProgress />
          </Stack>
        </Card>
      );
    }

    // Format the data for the chart
    const chartData = data.map(reading => ({
      timestamp: formatTimestamp(reading.timestamp),
      temperature: reading.temperature,
      humidity: reading.humidity,
      power: reading.power_consumption
    }));

    return (
      <Card sx={{ height: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline sx={{ color: 'primary.main' }} />
          Weather Impact
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis 
              dataKey="timestamp" 
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
            />
            <YAxis 
              yAxisId="left"
              stroke={theme.palette.primary.main}
              tick={{ fill: theme.palette.primary.main }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              stroke={theme.palette.secondary.main}
              tick={{ fill: theme.palette.secondary.main }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: 'none',
                borderRadius: 8,
                boxShadow: theme.shadows[4],
              }}
            />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="power"
              stroke={theme.palette.primary.main}
              fillOpacity={1}
              fill="url(#colorPower)"
              name="Power (kW)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="temperature"
              stroke={theme.palette.secondary.main}
              fillOpacity={1}
              fill="url(#colorTemp)"
              name="Temperature (°C)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    );
  }, () => true); // Never re-render this component

  // Memoized Efficiency Chart Component
  const EfficiencyChart = React.memo(({ data }) => {
    if (!data || data.length === 0) {
      return (
        <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">Efficiency Metrics</Typography>
            <CircularProgress />
          </Stack>
        </Card>
      );
    }

    // Format the data for the chart
    const chartData = data.map(reading => ({
      timestamp: formatTimestamp(reading.timestamp),
      efficiency: reading.efficiency_score * 100,
      perCapita: reading.per_capita_consumption
    }));

    return (
      <Card sx={{ height: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp sx={{ color: 'primary.main' }} />
          Efficiency Metrics
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis 
              dataKey="timestamp" 
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
            />
            <YAxis 
              yAxisId="left"
              stroke={theme.palette.primary.main}
              tick={{ fill: theme.palette.primary.main }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              stroke={theme.palette.secondary.main}
              tick={{ fill: theme.palette.secondary.main }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: 'none',
                borderRadius: 8,
                boxShadow: theme.shadows[4],
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="efficiency"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={false}
              name="Efficiency Score (%)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="perCapita"
              stroke={theme.palette.secondary.main}
              strokeWidth={2}
              dot={false}
              name="Per Capita (kW)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }, () => true); // Never re-render this component

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Dashboard sx={{ color: 'primary.main' }} />
              Smart Grid Dashboard
            </Typography>
            <CountdownTimer />
            <Button
              startIcon={<Refresh />}
              onClick={refreshAllData}
              disabled={isLoading}
              sx={{ mr: 2 }}
            >
              Refresh Now
            </Button>
            <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Grid container spacing={3}>
            {cities.map(city => (
              <Grid item xs={12} sm={6} md={4} lg={2.4} key={city}>
                <CityCard city={city} />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 4 }}>
            <Paper sx={{ mb: 2 }}>
              <Tabs
                value={tabValue}
                onChange={(e, newValue) => setTabValue(newValue)}
                variant={isMobile ? "fullWidth" : "standard"}
                centered={!isMobile}
                sx={{
                  '& .MuiTab-root': {
                    minHeight: 48,
                    textTransform: 'none',
                    fontWeight: 500,
                  },
                }}
              >
                <Tab icon={<Dashboard />} label="Power Consumption" />
                <Tab icon={<PieChartIcon />} label="Zone Distribution" />
                <Tab icon={<Timeline />} label="Weather Impact" />
                <Tab icon={<TrendingUp />} label="Efficiency Metrics" />
              </Tabs>
            </Paper>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                {isLoading ? (
                  <Card sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress />
                  </Card>
                ) : (
                  <>
                    {tabValue === 0 && <PowerConsumptionChart data={staticChartData[selectedCity] || []} />}
                    {tabValue === 1 && <ZoneDistributionChart data={staticChartData[selectedCity] || []} />}
                    {tabValue === 2 && <WeatherImpactChart data={staticChartData[selectedCity] || []} />}
                    {tabValue === 3 && <EfficiencyChart data={staticChartData[selectedCity] || []} />}
                  </>
                )}
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App; 