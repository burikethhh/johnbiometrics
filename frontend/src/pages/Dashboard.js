import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Tooltip
} from '@mui/material';
import PageTransition from '../components/PageTransition';
import { StatCardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import {
  People as PeopleIcon,
  Fingerprint as FingerprintIcon,
  Security as SecurityIcon,
  Today as TodayIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Login as EntryIcon,
  Logout as ExitIcon,
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { dashboardAPI } from '../services/api';
import sseService from '../services/sseService';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, ChartTooltip, Legend, ArcElement
);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [realtimeLog, setRealtimeLog] = useState(null);
  const sseRef = useRef(null);

  useEffect(() => {
    fetchDashboard();

    sseService.connect();
    sseRef.current = sseService.on('new-verification', (result) => {
      setRealtimeLog(result);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          todayAccess: prev.todayAccess + 1,
          recentLogs: [result, ...prev.recentLogs.slice(0, 9)]
        };
      });
    });

    return () => {
      if (sseRef.current) sseRef.current();
      sseService.disconnect();
    };
  }, []);

  const fetchDashboard = async () => {
    try {
      const [overviewRes, hourlyRes] = await Promise.all([
        dashboardAPI.getOverview(), dashboardAPI.getHourly()
      ]);
      setData(overviewRes.data);
      setHourlyData(hourlyRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <PageTransition>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Real-time access control overview</Typography>
      </Box>
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[1,2,3,4].map(i => <Grid item xs={12} sm={6} md={3} key={i}><StatCardSkeleton /></Grid>)}
      </Grid>
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}><ChartSkeleton height={260} /></Grid>
        <Grid item xs={12} md={4}><ChartSkeleton height={260} /></Grid>
      </Grid>
    </PageTransition>
  );

  if (error) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
      <Typography color="error">{error}</Typography>
    </Box>
  );

  const stats = [
    { title: 'Total Residents', value: data?.residents?.total || 0, icon: <PeopleIcon />, color: '#2e7d32', gradient: 'linear-gradient(135deg, rgba(46,125,50,0.1), rgba(46,125,50,0.02))' },
    { title: 'Active Residents', value: data?.residents?.active || 0, icon: <SecurityIcon />, color: '#00897b', gradient: 'linear-gradient(135deg, rgba(0,137,123,0.1), rgba(0,137,123,0.02))' },
    { title: 'Fingerprints', value: data?.fingerprints || 0, icon: <FingerprintIcon />, color: '#7b1fa2', gradient: 'linear-gradient(135deg, rgba(123,31,162,0.1), rgba(123,31,162,0.02))' },
    { title: "Today's Access", value: data?.todayAccess || 0, icon: <TodayIcon />, color: '#f57c00', gradient: 'linear-gradient(135deg, rgba(245,124,0,0.1), rgba(245,124,0,0.02))' },
  ];

  const hourlyChartData = {
    labels: hourlyData.map(d => `${d.hour}:00`),
    datasets: [
      { label: 'Granted', data: hourlyData.map(d => d.granted), backgroundColor: 'rgba(76, 175, 80, 0.6)', borderColor: 'rgba(76, 175, 80, 1)', borderWidth: 1, borderRadius: 6 },
      { label: 'Denied', data: hourlyData.map(d => d.denied), backgroundColor: 'rgba(244, 67, 54, 0.6)', borderColor: 'rgba(244, 67, 54, 1)', borderWidth: 1, borderRadius: 6 }
    ]
  };

  const recentLogsWithType = data?.recentLogs?.map(log => ({ ...log, type: log.status === 'Granted' ? 'granted' : 'denied' })) || [];
  const grantedCount = recentLogsWithType.filter(l => l.type === 'granted').length;
  const deniedCount = recentLogsWithType.filter(l => l.type === 'denied').length;

  const outcomePieData = {
    labels: ['Granted', 'Denied'],
    datasets: [{ data: [grantedCount || 1, deniedCount || 1], backgroundColor: ['rgba(76, 175, 80, 0.8)', 'rgba(244, 67, 54, 0.8)'], borderWidth: 0, hoverOffset: 8 }]
  };

  return (
    <PageTransition>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Real-time access control overview
            </Typography>
          </Box>
          {realtimeLog && (
            <Tooltip title={`${realtimeLog.resident?.name || 'Unknown'} - ${new Date(realtimeLog.log_time).toLocaleTimeString()}`} arrow>
              <Chip
                icon={realtimeLog.status === 'Granted' ? <CheckCircleIcon /> : <CancelIcon />}
                label={`${realtimeLog.status} - ${realtimeLog.resident?.name || 'Unknown'}`}
                color={realtimeLog.status === 'Granted' ? 'success' : 'error'}
                sx={{ animation: 'pulse-ring 1s ease-out', cursor: 'pointer' }}
              />
            </Tooltip>
          )}
        </Box>

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {stats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Box className={`glass-stat animate-in stagger-${index + 1}`} sx={{ '--accent-color': stat.color, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                      {stat.title}
                    </Typography>
                    <Typography variant="h3" fontWeight="800" sx={{ color: stat.color, letterSpacing: '-0.02em' }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '14px',
                    background: stat.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: stat.color,
                  }}>
                    {stat.icon}
                  </Box>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Box className="glass-card animate-in stagger-2" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
              Hourly Access Distribution
            </Typography>
            <Box sx={{ height: 260 }}>
              <Bar data={hourlyChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } } },
                scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } },
              }} />
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box className="glass-card animate-in stagger-3" sx={{ p: 3, height: { md: 'calc(100% - 4px)' }, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
              Recent Outcomes
            </Typography>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <Doughnut data={outcomePieData} options={{
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } } },
              }} />
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Box className="glass-card animate-in stagger-4" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
              Recent Access Logs
            </Typography>
            <List sx={{ p: 0 }}>
              {data?.recentLogs?.length > 0 ? (
                data.recentLogs.map((log, index) => (
                  <React.Fragment key={log.log_id || index}>
                    <ListItem sx={{ px: 1, py: 1, borderRadius: '12px', mb: 0.5, '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.04)' } }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {log.status === 'Granted' ? (
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 22 }} />
                        ) : (
                          <CancelIcon sx={{ color: 'error.main', fontSize: 22 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight="600">{log.full_name || 'Unknown'}</Typography>}
                        secondary={new Date(log.log_time).toLocaleString()}
                      />
                      <Chip
                        label={log.status}
                        color={log.status === 'Granted' ? 'success' : 'error'}
                        size="small"
                        sx={{ height: 24, fontSize: '0.7rem' }}
                      />
                    </ListItem>
                    {index < data.recentLogs.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="No recent access logs" />
                </ListItem>
              )}
            </List>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box className="glass-card animate-in stagger-5" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2.5 }}>
              System Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, p: 2, borderRadius: '12px', bgcolor: 'rgba(46, 125, 50, 0.04)' }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(46,125,50,0.1), rgba(46,125,50,0.02))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2e7d32',
              }}>
                <DeviceIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Active Devices</Typography>
                <Typography variant="h5" fontWeight="700">{data?.devices || 0}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, p: 2, borderRadius: '12px', bgcolor: 'rgba(46, 125, 50, 0.04)' }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0,137,123,0.1), rgba(0,137,123,0.02))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00897b',
              }}>
                <EntryIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Entries Today</Typography>
                <Typography variant="h5" fontWeight="700">{data?.todayEntries || 0}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: '12px', bgcolor: 'rgba(46, 125, 50, 0.04)' }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245,124,0,0.1), rgba(245,124,0,0.02))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f57c00',
              }}>
                <ExitIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Exits Today</Typography>
                <Typography variant="h5" fontWeight="700">{data?.todayExits || 0}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Chip
              label="System Online"
              color="success"
              size="small"
              sx={{ width: '100%', height: 32, fontWeight: 600 }}
            />
          </Box>
        </Grid>
      </Grid>
      </Box>
    </PageTransition>
  );
};

const DeviceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

export default Dashboard;
