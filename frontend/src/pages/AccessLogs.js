import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, MenuItem, Grid, Chip, Button, InputAdornment, TablePagination
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon, Cancel as CancelIcon,
  Download as DownloadIcon, Search as SearchIcon,
  Login as EntryIcon, Logout as ExitIcon
} from '@mui/icons-material';
import { accessLogAPI } from '../services/api';
import PageTransition from '../components/PageTransition';

const AccessLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', status: '', limit: 500 });

  useEffect(() => { fetchLogs(); fetchStats(); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFilteredLogs(logs.filter(log => log.full_name?.toLowerCase().includes(searchQuery.toLowerCase())));
    setPage(0);
  }, [searchQuery, logs]);

  const fetchLogs = async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.status) params.status = filters.status;
      params.limit = filters.limit;
      const response = await accessLogAPI.getAll(params);
      setLogs(response.data);
      setFilteredLogs(response.data);
    } catch (error) { console.error('Failed to fetch logs:', error); }
  };

  const fetchStats = async () => {
    try { const response = await accessLogAPI.getStats(); setStats(response.data); }
    catch (error) { console.error('Failed to fetch stats:', error); }
  };

  const exportToCSV = () => {
    const headers = ['Log ID', 'Resident', 'Direction', 'Time', 'Status', 'Confidence', 'Speed (ms)'];
    const rows = filteredLogs.map(log => [log.log_id, log.full_name || 'Unknown', log.direction || 'Entry', new Date(log.log_time).toLocaleString(), log.status, `${(log.confidence_score * 100).toFixed(1)}%`, log.verification_duration_ms || 0]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `access-logs-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const paginatedLogs = filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const statCards = stats ? [
    { label: 'Total Entries', value: stats.total, color: '#2e7d32' },
    { label: 'Granted', value: stats.granted, color: '#2e7d32' },
    { label: 'Denied', value: stats.denied, color: '#d32f2f' },
    { label: 'Avg Speed', value: `${stats.avgSpeed || 0}ms`, color: '#f57c00' },
  ] : [];

  return (
    <PageTransition>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>Access Logs</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Track all access attempts</Typography>
          </Box>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportToCSV} className="glass-btn-outlined">
            Export CSV
          </Button>
        </Box>

        {stats && (
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {statCards.map((s, i) => (
              <Grid item xs={6} md={3} key={i}>
                <Box className="glass-stat animate-in stagger-1" sx={{ p: 2.5, '--accent-color': s.color }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="500">{s.label}</Typography>
                  <Typography variant="h4" fontWeight="800" sx={{ color: s.color }}>{s.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        <Box className="glass-card" sx={{ p: 2.5, mb: 2.5 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth type="date" label="Start Date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} InputLabelProps={{ shrink: true }} size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth type="date" label="End Date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} InputLabelProps={{ shrink: true }} size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} size="small">
                <MenuItem value="">All</MenuItem><MenuItem value="Granted">Granted</MenuItem><MenuItem value="Denied">Denied</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} size="small"
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            </Grid>
          </Grid>
        </Box>

        <Box className="glass-card" sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell><TableCell>Resident</TableCell><TableCell>Direction</TableCell>
                  <TableCell>Time</TableCell><TableCell>Status</TableCell><TableCell>Confidence</TableCell><TableCell>Speed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.log_id} sx={{ '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.04)' } }}>
                    <TableCell><Typography variant="body2" fontWeight="600">#{log.log_id}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight="500">{log.full_name || 'Unknown'}</Typography></TableCell>
                    <TableCell>
                      <Chip icon={log.direction === 'Exit' ? <ExitIcon /> : <EntryIcon />} label={log.direction || 'Entry'}
                        size="small" color={log.direction === 'Exit' ? 'warning' : 'primary'} variant="outlined"
                        sx={{ height: 26, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell><Typography variant="caption">{new Date(log.log_time).toLocaleString()}</Typography></TableCell>
                    <TableCell>
                      <Chip icon={log.status === 'Granted' ? <CheckCircleIcon /> : <CancelIcon />}
                        label={log.status} size="small" color={log.status === 'Granted' ? 'success' : 'error'}
                        sx={{ fontWeight: 600, height: 26 }} />
                    </TableCell>
                    <TableCell><Chip label={`${(log.confidence_score * 100).toFixed(1)}%`} size="small" color={log.confidence_score >= 0.6 ? 'success' : 'error'} sx={{ fontWeight: 600 }} /></TableCell>
                    <TableCell><Chip icon={<TimerIcon />} label={`${log.verification_duration_ms || 0}ms`} size="small" variant="outlined" sx={{ height: 26 }} /></TableCell>
                  </TableRow>
                ))}
                {paginatedLogs.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No logs found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filteredLogs.length} page={page} onPageChange={(e, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
        </Box>
      </Box>
    </PageTransition>
  );
};

const TimerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default AccessLogs;
