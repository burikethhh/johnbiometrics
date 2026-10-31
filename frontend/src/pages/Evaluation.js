import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert
} from '@mui/material';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { evaluationAPI } from '../services/api';
import PageTransition from '../components/PageTransition';
import { StatCardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const Evaluation = () => {
  const [accuracy, setAccuracy] = useState(null);
  const [thresholdData, setThresholdData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const results = await Promise.allSettled([
      evaluationAPI.getAccuracy(),
      evaluationAPI.getByThreshold(),
      evaluationAPI.getByDevice(),
      evaluationAPI.getTimeline()
    ]);

    const [accuracyResult, thresholdResult, , timelineResult] = results;

    if (accuracyResult.status === 'fulfilled') {
      setAccuracy(accuracyResult.value.data);
    }
    if (thresholdResult.status === 'fulfilled') {
      setThresholdData(Array.isArray(thresholdResult.value.data) ? thresholdResult.value.data : []);
    }
    if (timelineResult.status === 'fulfilled') {
      setTimelineData(Array.isArray(timelineResult.value.data) ? timelineResult.value.data : []);
    }

    if (accuracyResult.status === 'rejected' || thresholdResult.status === 'rejected') {
      setError('Some evaluation metrics could not be loaded. Please refresh and try again.');
    }
    setLoading(false);
  };

  if (loading) return (
    <PageTransition>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>System Evaluation & Reports</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>FAR, FRR, accuracy metrics and performance analysis</Typography>
      </Box>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[1,2,3,4].map(i => <Grid item xs={6} md={3} key={i}><StatCardSkeleton /></Grid>)}
      </Grid>
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}><ChartSkeleton height={300} /></Grid>
        <Grid item xs={12} md={4}><ChartSkeleton height={300} /></Grid>
      </Grid>
    </PageTransition>
  );

  const farFrrChartData = {
    labels: thresholdData.map(d => `Threshold: ${d.threshold}`),
    datasets: [
      { label: 'FAR (%)', data: thresholdData.map(d => parseFloat(d.far)), backgroundColor: 'rgba(244, 67, 54, 0.6)', borderColor: 'rgba(244, 67, 54, 1)', borderWidth: 1, borderRadius: 6 },
      { label: 'FRR (%)', data: thresholdData.map(d => parseFloat(d.frr)), backgroundColor: 'rgba(33, 150, 243, 0.6)', borderColor: 'rgba(33, 150, 243, 1)', borderWidth: 1, borderRadius: 6 }
    ]
  };

  const accuracyChartData = {
    labels: thresholdData.map(d => `Threshold: ${d.threshold}`),
    datasets: [{ label: 'Accuracy (%)', data: thresholdData.map(d => parseFloat(d.accuracy)), fill: false, borderColor: 'rgba(76, 175, 80, 1)', backgroundColor: 'rgba(76, 175, 80, 0.6)', tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }]
  };

  const speedChartData = {
    labels: timelineData.map(d => d.date?.split('T')[0] || d.date),
    datasets: [{ label: 'Avg Speed (ms)', data: timelineData.map(d => d.avg_speed), fill: false, borderColor: 'rgba(255, 152, 0, 1)', backgroundColor: 'rgba(255, 152, 0, 0.6)', tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }]
  };

  const outcomePieData = accuracy ? {
    labels: ['True Positives', 'False Positives', 'True Negatives', 'False Negatives'],
    datasets: [{ data: [accuracy.truePositives, accuracy.falsePositives, accuracy.trueNegatives, accuracy.falseNegatives],
      backgroundColor: ['rgba(76, 175, 80, 0.8)', 'rgba(244, 67, 54, 0.8)', 'rgba(33, 150, 243, 0.8)', 'rgba(255, 152, 0, 0.8)'],
      borderWidth: 0, hoverOffset: 8 }]
  } : null;

  const metricCards = accuracy ? [
    { label: 'Accuracy', value: `${accuracy.accuracy}%`, color: '#2e7d32' },
    { label: 'False Acceptance Rate', value: `${accuracy.far}%`, color: '#d32f2f' },
    { label: 'False Rejection Rate', value: `${accuracy.frr}%`, color: '#f57c00' },
    { label: 'Avg Verification Speed', value: `${accuracy.avgSpeed || 0}ms`, color: '#1976d2' },
  ] : [];

  const detailCards = accuracy ? [
    { label: 'Min Speed', value: `${accuracy.minSpeed || 0}ms` },
    { label: 'Max Speed', value: `${accuracy.maxSpeed || 0}ms` },
    { label: 'Avg Confidence', value: accuracy.avgConfidence || 0 },
    { label: 'Total Scans', value: accuracy.total || 0 },
  ] : [];

  return (
    <PageTransition>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>
            System Evaluation & Reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            FAR, FRR, accuracy metrics and performance analysis
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {metricCards.map((m, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Box className="glass-stat animate-in stagger-1" sx={{ p: 2.5, '--accent-color': m.color }}>
                <Typography variant="caption" color="text.secondary" fontWeight="500">{m.label}</Typography>
                <Typography variant="h4" fontWeight="800" sx={{ color: m.color, letterSpacing: '-0.02em' }}>{m.value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {detailCards.map((d, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Box className="glass-card" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="500">{d.label}</Typography>
                <Typography variant="h6" fontWeight="700">{d.value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} md={8}>
            <Box className="glass-card" sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>FAR vs FRR by Threshold</Typography>
              <Box sx={{ height: 300 }}>
                <Bar data={farFrrChartData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } } },
                  scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } },
                }} />
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box className="glass-card" sx={{ p: 3, height: { md: 'calc(100% - 4px)' }, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>Verification Outcomes</Typography>
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                {outcomePieData && <Doughnut data={outcomePieData} options={{
                  responsive: true, maintainAspectRatio: false, cutout: '65%',
                  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } },
                }} />}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} md={6}>
            <Box className="glass-card" sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>Accuracy by Threshold</Typography>
              <Box sx={{ height: 250 }}>
                <Line data={accuracyChartData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } } },
                  scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } },
                }} />
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box className="glass-card" sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>Verification Speed Over Time</Typography>
              <Box sx={{ height: 250 }}>
                <Line data={speedChartData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } } },
                  scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } },
                }} />
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Box className="glass-card" sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 3, pb: 0 }}>
            <Typography variant="h6" fontWeight="700">Threshold Analysis Table</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Threshold</TableCell><TableCell>FAR (%)</TableCell><TableCell>FRR (%)</TableCell><TableCell>Accuracy (%)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {thresholdData.map((row) => (
                  <TableRow key={row.threshold} sx={{ '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.04)' } }}>
                    <TableCell><Typography fontWeight="600">{row.threshold}</Typography></TableCell>
                    <TableCell sx={{ color: parseFloat(row.far) > 5 ? 'error.main' : 'inherit', fontWeight: parseFloat(row.far) > 5 ? 600 : 400 }}>{row.far}%</TableCell>
                    <TableCell sx={{ color: parseFloat(row.frr) > 5 ? 'warning.main' : 'inherit', fontWeight: parseFloat(row.frr) > 5 ? 600 : 400 }}>{row.frr}%</TableCell>
                    <TableCell><Typography fontWeight="600">{row.accuracy}%</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </PageTransition>
  );
};

export default Evaluation;
