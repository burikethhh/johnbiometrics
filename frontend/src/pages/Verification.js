import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Grid, Alert, CircularProgress, Chip,
  List, ListItem, ListItemText, ListItemIcon, Divider,
  ToggleButton, ToggleButtonGroup, FormControlLabel, Switch,
  FormControl, Select, MenuItem
} from '@mui/material';
import {
  Fingerprint as FingerprintIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, Clear as ClearIcon, Timer as TimerIcon,
  Login as EntryIcon, Logout as ExitIcon, Refresh as RefreshIcon,
  Usb as UsbIcon,
  SettingsInputComponent as BoxIcon, Security as SecurityIcon
} from '@mui/icons-material';
import { fingerprintAPI } from '../services/api';
import fingerprintService from '../services/fingerprintService';
import PageTransition from '../components/PageTransition';

const Verification = () => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [error, setError] = useState(null);
  const [direction, setDirection] = useState('Entry');
  const [isGenuineMode, setIsGenuineMode] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerChecking, setScannerChecking] = useState(true);
  const [realMode, setRealMode] = useState(false);
  const [readerName, setReaderName] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('auto');
  const [connectingSerial, setConnectingSerial] = useState(false);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    checkScanner();
    return () => { if (scanIntervalRef.current) clearTimeout(scanIntervalRef.current); };
  }, []);

  const checkScanner = async () => {
    setScannerChecking(true);
    setError(null);
    try {
      await fingerprintService.initialize();
      const status = await fingerprintService.checkScannerStatus();
      setScannerReady(Boolean(status.connected));
      setRealMode(Boolean(status.connected && status.driverType !== 'demo'));
      setReaderName(status.readerName || '');
    } catch (err) {
      setScannerReady(false);
      setRealMode(false);
      setReaderName('Unknown');
    } finally {
      setScannerChecking(false);
    }
  };

  const handleDriverChange = async (newDriver) => {
    setSelectedDriver(newDriver);
    setScannerChecking(true);
    setError(null);
    try {
      await fingerprintService.setDriver(newDriver);
      const status = await fingerprintService.checkScannerStatus();
      setScannerReady(Boolean(status.connected));
      setRealMode(Boolean(status.connected && status.driverType !== 'demo'));
      setReaderName(status.readerName || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setScannerChecking(false);
    }
  };

  const handleConnectSerialBox = async () => {
    setConnectingSerial(true);
    setError(null);
    try {
      const res = await fingerprintService.connectSerialBox();
      setScannerReady(true);
      setRealMode(true);
      setReaderName(res.deviceName);
    } catch (err) {
      setError(err.message || 'Failed to connect to USB Serial box');
    } finally {
      setConnectingSerial(false);
    }
  };

  const startScanning = async () => {
    setScanning(true);
    setResult(null);
    setError(null);

    if (realMode && scannerReady) {
      try {
        const captureResult = await fingerprintService.captureForVerification({
          residentName: 'Verification'
        });

        if (captureResult.success) {
          await performVerification(captureResult.template, captureResult.deviceName || readerName);
        } else {
          setError(captureResult.error || 'Failed to capture fingerprint');
          setScanning(false);
        }
      } catch (err) {
        setError(err.message || 'Scanner error');
        setScanning(false);
      }
    } else {
      // Demo mode with realistic delay
      scanIntervalRef.current = setTimeout(() => {
        performVerification(null, 'Synthetic Biometric Simulator (Demo)');
      }, 1500);
    }
  };

  const stopScanning = () => {
    setScanning(false);
    if (scanIntervalRef.current) clearTimeout(scanIntervalRef.current);
  };

  const performVerification = async (template, deviceSource = 'Scanner') => {
    try {
      let encoding;
      if (template) {
        encoding = template;
      } else {
        encoding = fingerprintService.constructor.generateMockTemplate();
      }

      const response = await fingerprintAPI.verify({
        encoding,
        device_id: 1,
        direction,
        is_genuine: isGenuineMode ? 1 : null
      });

      const verificationData = {
        ...response.data,
        deviceSource: deviceSource || readerName || 'Biometric Scanner'
      };

      setResult(verificationData);
      setRecentVerifications(prev => [verificationData, ...prev.slice(0, 9)]);
      setScanning(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
      setScanning(false);
    }
  };

  const availableDrivers = fingerprintService.getAvailableDrivers();

  return (
    <PageTransition>
      <Box>
        {/* Header and Scanner Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>
              Fingerprint Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Scan and verify resident fingerprints from any attached biometric box or sensor
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                icon={scannerReady ? <CheckCircleIcon /> : <CancelIcon />}
                label={
                  scannerChecking
                    ? 'Probing hardware...'
                    : scannerReady
                      ? (realMode ? `Scanner Ready: ${readerName}` : 'Demo / Simulator Ready')
                      : 'Scanner Not Ready'
                }
                color={scannerReady ? (realMode ? 'success' : 'info') : 'warning'}
                size="small"
                sx={{ fontWeight: 600, px: 1 }}
              />
              <Button size="small" onClick={checkScanner} startIcon={<RefreshIcon />} disabled={scannerChecking}>
                {scannerChecking ? 'Probing...' : 'Refresh'}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Universal Biometric Device Selector Bar */}
        <Box className="glass-card" sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 260 }}>
            <BoxIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Biometric Hardware Source
              </Typography>
              <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                <Select
                  value={selectedDriver}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  sx={{ borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  {availableDrivers.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Quick Action: Connect USB Serial Box */}
          {selectedDriver === 'serial' && !fingerprintService.serialConnected && (
            <Button
              variant="contained"
              size="small"
              startIcon={connectingSerial ? <CircularProgress size={16} color="inherit" /> : <UsbIcon />}
              onClick={handleConnectSerialBox}
              disabled={connectingSerial}
              className="glass-btn"
              sx={{ py: 1, px: 2 }}
            >
              {connectingSerial ? 'Connecting...' : 'Connect USB Serial Box'}
            </Button>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              variant="outlined"
              color={realMode ? 'success' : 'default'}
              label={realMode ? 'Physical Hardware' : 'Simulation'}
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </Box>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={8}>
            <Box className="glass-card" sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight="700">Checkpoint Controls</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <ToggleButtonGroup
                    value={direction} exclusive
                    onChange={(e, v) => v && setDirection(v)} size="small"
                    sx={{ '& .MuiToggleButton-root': { borderRadius: '10px !important', px: 2 } }}
                  >
                    <ToggleButton value="Entry"><EntryIcon sx={{ mr: 0.5, fontSize: 18 }} /> Entry</ToggleButton>
                    <ToggleButton value="Exit"><ExitIcon sx={{ mr: 0.5, fontSize: 18 }} /> Exit</ToggleButton>
                  </ToggleButtonGroup>
                  <FormControlLabel
                    control={<Switch checked={isGenuineMode} onChange={(e) => setIsGenuineMode(e.target.checked)} size="small" color="secondary" />}
                    label={<Typography variant="caption" fontWeight="600">Label Genuine</Typography>}
                  />
                </Box>
              </Box>

              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ position: 'relative', width: 220, height: 220, mx: 'auto', mb: 4 }}>
                  {scanning && (
                    <>
                      <Box sx={{
                        position: 'absolute', inset: -8, borderRadius: '50%',
                        border: '2px solid rgba(46, 125, 50, 0.2)',
                        animation: 'pulse-ring 1.5s ease-out infinite',
                      }} />
                      <Box sx={{
                        position: 'absolute', inset: -16, borderRadius: '50%',
                        border: '2px solid rgba(46, 125, 50, 0.1)',
                        animation: 'pulse-ring 1.5s ease-out infinite 0.5s',
                      }} />
                    </>
                  )}
                  <Box sx={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: scanning
                      ? 'linear-gradient(135deg, rgba(46,125,50,0.15), rgba(0,137,123,0.08))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))',
                    backdropFilter: 'blur(20px)',
                    border: scanning ? '3px solid rgba(46, 125, 50, 0.4)' : '3px dashed rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: scanning ? '0 0 60px rgba(46, 125, 50, 0.2)' : '0 8px 32px rgba(0,0,0,0.06)',
                  }}>
                    {scanning ? (
                      <CircularProgress size={80} thickness={3} sx={{ color: '#2e7d32' }} />
                    ) : (
                      <FingerprintIcon sx={{ fontSize: 100, color: '#2e7d32', opacity: 0.7 }} className="fingerprint-glow" />
                    )}
                  </Box>
                </Box>

                <Typography variant="h6" fontWeight="700" sx={{ mb: 1 }}>
                  {scanning
                    ? (realMode ? 'Waiting for fingerprint touch...' : 'Processing scan...')
                    : (realMode ? `Place finger on ${readerName}` : 'Place finger on scanner')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 420, mx: 'auto' }}>
                  {scanning
                    ? 'Please hold your finger steady on the biometric sensor...'
                    : realMode
                      ? `Active hardware: ${readerName}. Press "Start Scanning" and touch the sensor.`
                      : 'Running in universal simulation mode. Press "Start Scanning" to simulate.'}
                </Typography>

                {!scanning ? (
                  <Button
                    variant="contained" size="large" startIcon={<FingerprintIcon />}
                    onClick={startScanning}
                    className="glass-btn"
                    sx={{ py: 2, px: 5, fontSize: '1rem' }}
                  >
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    variant="outlined" size="large" onClick={stopScanning}
                    className="glass-btn-outlined"
                    sx={{ py: 2, px: 5, fontSize: '1rem' }}
                  >
                    Cancel
                  </Button>
                )}
              </Box>
            </Box>

            {result && (
              <Box className="glass-card animate-in" sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight="700">Verification Result</Typography>
                  <Button size="small" onClick={() => setResult(null)} sx={{ minWidth: 'auto' }}>
                    <ClearIcon fontSize="small" />
                  </Button>
                </Box>
                <Alert
                  severity={result.status === 'Granted' ? 'success' : 'error'}
                  sx={{ mb: 2, borderRadius: '12px' }}
                  icon={result.status === 'Granted' ? <CheckCircleIcon /> : <CancelIcon />}
                >
                  <Typography variant="h6" fontWeight="700">
                    Access {result.status}
                  </Typography>
                </Alert>
                {result.resident && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="600">Resident</Typography>
                    <Typography variant="h5" fontWeight="700">{result.resident.name}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip label={`${(result.confidence * 100).toFixed(1)}% confidence`} color={result.confidence >= 0.6 ? 'success' : 'error'} sx={{ fontWeight: 600 }} />
                  <Chip icon={<TimerIcon />} label={`${result.duration}ms`} color="primary" variant="outlined" />
                  <Chip icon={direction === 'Exit' ? <ExitIcon /> : <EntryIcon />} label={direction} color={direction === 'Exit' ? 'warning' : 'primary'} variant="outlined" />
                  <Chip icon={<SecurityIcon />} label={result.deviceSource || readerName} color="secondary" size="small" variant="outlined" />
                </Box>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>
            )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Box className="glass-card" sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
                Recent Verifications
              </Typography>
              <List sx={{ p: 0 }}>
                {recentVerifications.length > 0 ? (
                  recentVerifications.map((v, index) => (
                    <React.Fragment key={index}>
                      <ListItem sx={{ px: 1, py: 1, borderRadius: '10px', mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {v.status === 'Granted' ? (
                            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                          ) : (
                            <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight="600">{v.resident?.name || 'Unknown'}</Typography>}
                          secondary={
                            <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Chip label={`${(v.confidence * 100).toFixed(1)}%`} size="small" color={v.confidence >= 0.6 ? 'success' : 'error'} sx={{ height: 20, fontSize: '0.65rem' }} />
                              <Typography variant="caption" color="text.secondary" component="span">{v.duration}ms</Typography>
                              {v.deviceSource && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                  • {v.deviceSource.split(' ')[0]}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentVerifications.length - 1 && <Divider sx={{ opacity: 0.4 }} />}
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary={<Typography variant="body2" color="text.secondary">No recent verifications</Typography>} />
                  </ListItem>
                )}
              </List>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </PageTransition>
  );
};

export default Verification;
