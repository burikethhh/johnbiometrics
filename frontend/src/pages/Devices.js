import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, Chip, Tooltip, MenuItem, FormControl, Select,
  CircularProgress, Card, CardContent, Grid, Divider, InputAdornment
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  CheckCircle as CheckIcon, AutoFixHigh as AutoIcon,
  CloudDownload as PullIcon, Wifi as WifiIcon,
  Sync as SyncIcon, Fingerprint as FingerprintIcon,
  Router as RouterIcon, CheckCircleOutline as ConnectedIcon,
  ErrorOutline as DisconnectedIcon, SettingsEthernet as PortIcon
} from '@mui/icons-material';
import { deviceAPI, zkAPI, residentAPI } from '../services/api';
import fingerprintService from '../services/fingerprintService';

const SCANNER_PRESETS = [
  { label: 'Auto-Detect Attached Hardware', model: 'Auto-Detect Any Biometric Box', port: 'Auto' },
  { label: 'Windows Hello / Laptop Fingerprint Sensor', model: 'Windows Hello Platform Biometrics', port: 'Built-in / Platform' },
  { label: 'USB Serial Biometric Box (Arduino / R307 / AS608)', model: 'USB Serial Biometric Box (Optical Sensor)', port: 'COM3' },
  { label: 'DigitalPersona U.are.U 4500', model: 'DigitalPersona U.are.U 4500', port: 'USB-01' },
  { label: 'DigitalPersona U.are.U 5100 / 5300', model: 'DigitalPersona U.are.U 5100', port: 'USB-02' },
  { label: 'SecuGen Hamster Pro 20', model: 'SecuGen Hamster Pro 20', port: 'USB-01' },
  { label: 'Mantra MFS100', model: 'Mantra MFS100 Optical Scanner', port: 'USB-01' },
  { label: 'ZKTeco Live20R / SLK20R', model: 'ZKTeco Live20R Biometric', port: 'USB-01' },
  { label: 'ZKTeco Network Terminal (LAN)', model: 'ZKTeco Terminal (LAN)', port: '192.168.254.106:4370' },
  { label: 'Universal Biometric Bridge (Port 9191)', model: 'Universal Local Biometric Bridge', port: 'HTTP/9191' },
  { label: 'Other / Custom Biometric Box', model: '', port: '' }
];

const isZkTerminal = (device) => /^zkteco terminal/i.test(device?.scanner_model || '');

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({ location: '', scanner_model: '', usb_port: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detectedHardware, setDetectedHardware] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [terminalBusy, setTerminalBusy] = useState({});
  const [scanningNet, setScanningNet] = useState(false);
  const [scanResults, setScanResults] = useState([]);

  // Quick Direct IP Terminal Configuration State
  const [quickIp, setQuickIp] = useState('192.168.254.106');
  const [quickPort, setQuickPort] = useState('4370');
  const [connectingZk, setConnectingZk] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState(null);

  // Remote Fingerprint Enrollment Modal State
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [residents, setResidents] = useState([]);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [selectedFinger, setSelectedFinger] = useState(0);

  useEffect(() => {
    fetchDevices();
    probeHardware();
    loadResidents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDevices = async () => {
    try {
      const response = await deviceAPI.getAll();
      const devList = response.data || [];
      setDevices(devList);

      // Auto-extract IP of existing ZKTeco terminal if present
      const zkDev = devList.find(isZkTerminal);
      if (zkDev && zkDev.usb_port) {
        const m = String(zkDev.usb_port).match(/^([\w.-]+):(\d+)$/);
        if (m) {
          setQuickIp(m[1]);
          setQuickPort(m[2]);
        }
      }
    } catch (error) {
      showSnackbar('Failed to fetch devices', 'error');
    }
  };

  const loadResidents = async () => {
    try {
      const res = await residentAPI.getAll();
      setResidents(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedResidentId(String(res.data[0].resident_id));
      }
    } catch (e) {
      console.warn('Could not load residents for enrollment dropdown:', e.message);
    }
  };

  const probeHardware = async () => {
    setDetecting(true);
    try {
      await fingerprintService.initialize();
      const status = await fingerprintService.checkScannerStatus();
      if (status.connected) {
        setDetectedHardware(status);
      } else {
        setDetectedHardware(null);
      }
    } catch (err) {
      setDetectedHardware(null);
    } finally {
      setDetecting(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  // Direct IP Connect & Save
  const handleQuickConnect = async () => {
    if (!quickIp) {
      showSnackbar('Please enter the ZKTeco IP address', 'error');
      return;
    }
    setConnectingZk(true);
    try {
      const res = await zkAPI.connect({
        ip: quickIp.trim(),
        port: Number(quickPort) || 4370,
        location: 'Main Gate'
      });
      const data = res.data;
      setTerminalStatus({
        online: true,
        endpoint: data.endpoint,
        userCounts: data.info?.userCounts,
        logCounts: data.info?.logCounts,
        logCapacity: data.info?.logCapacity
      });
      showSnackbar(`Connected & saved: ${quickIp}:${quickPort} (${data.info?.userCounts || 0} users, ${data.info?.logCounts || 0} logs)`, 'success');
      fetchDevices();
    } catch (error) {
      setTerminalStatus({ online: false, error: error.response?.data?.error || error.message });
      showSnackbar(error.response?.data?.error || 'Failed to connect to ZKTeco terminal at ' + quickIp, 'error');
    } finally {
      setConnectingZk(false);
    }
  };

  // Subnet Scanner: sweeps the router subnet for ZKTeco terminals
  const handleScanNetwork = async () => {
    setScanningNet(true);
    setScanResults([]);
    try {
      const resp = await zkAPI.scan();
      const terminals = resp.data.terminals || [];
      setScanResults(terminals);
      if (terminals.length === 0) {
        showSnackbar('No ZKTeco terminals found on this subnet. Ensure laptop and terminal are connected to the same router.', 'info');
      } else {
        const foundCount = terminals.filter(t => t.isTerminal).length;
        showSnackbar(`Found ${foundCount} terminal(s) on current router subnet! Click a chip to auto-fill IP.`, 'success');
        if (terminals[0]?.ip) {
          setQuickIp(terminals[0].ip);
          setQuickPort(String(terminals[0].port || 4370));
        }
      }
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Network scan failed', 'error');
    } finally {
      setScanningNet(false);
    }
  };

  const handleOpenDialog = (device = null) => {
    setScanResults([]);
    setScanningNet(false);
    if (device) {
      setSelectedDevice(device);
      setFormData({
        location: device.location,
        scanner_model: device.scanner_model || '',
        usb_port: device.usb_port || ''
      });
      const m = String(device.usb_port || '').match(/^([\w.-]+):(\d+)$/);
      if (m) { setQuickIp(m[1]); setQuickPort(m[2]); }
    } else {
      setSelectedDevice(null);
      if (detectedHardware) {
        setFormData({
          location: 'Main Checkpoint',
          scanner_model: detectedHardware.readerName || 'Universal Biometric Box',
          usb_port: detectedHardware.driverType === 'serial' ? 'COM3' : 'USB'
        });
      } else {
        setFormData({ location: '', scanner_model: '', usb_port: '' });
      }
    }
    setOpenDialog(true);
  };

  const handlePresetSelect = (preset) => {
    setFormData(prev => ({
      ...prev,
      scanner_model: preset.model || prev.scanner_model,
      usb_port: preset.port || prev.usb_port
    }));
    if (preset && /zkteco terminal/i.test(preset.model || '')) {
      const m = String(preset.port || '').match(/^([\w.-]+):(\d+)$/);
      if (m) {
        setQuickIp(m[1]);
        setQuickPort(m[2]);
      }
    }
  };

  const isZkForm = /zkteco terminal/i.test(formData.scanner_model || '');

  const handleSubmit = async () => {
    try {
      const payload = { ...formData };
      if (isZkForm) {
        payload.usb_port = `${(quickIp || '').trim()}:${(quickPort || '4370').trim()}`;
      }
      if (selectedDevice) {
        await deviceAPI.update(selectedDevice.device_id, payload);
        showSnackbar('Device updated');
      } else {
        await deviceAPI.create(payload);
        showSnackbar('Device added');
      }
      setOpenDialog(false);
      fetchDevices();
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await deviceAPI.delete(id);
        showSnackbar('Device deleted');
        fetchDevices();
      } catch (error) {
        showSnackbar('Failed to delete device', 'error');
      }
    }
  };

  const handleToggleStatus = async (device) => {
    try {
      const isAvailable = device.device_status === 'Active';
      await deviceAPI.update(device.device_id, { device_status: isAvailable ? 'Inactive' : 'Active' });
      showSnackbar('Device status updated');
      fetchDevices();
    } catch (error) {
      showSnackbar('Failed to update status', 'error');
    }
  };

  const setBusy = (deviceId, key, value) => {
    setTerminalBusy(prev => ({ ...prev, [deviceId]: { ...prev[deviceId], [key]: value } }));
  };

  const handleTestTerminal = async (device) => {
    const devId = device?.device_id;
    setBusy(devId, 'test', true);
    try {
      const response = await zkAPI.status(devId);
      const d = response.data;
      setTerminalStatus({
        online: true,
        userCounts: d.userCounts,
        logCounts: d.logCounts,
        logCapacity: d.logCapacity
      });
      showSnackbar(`Terminal Online: ${d.userCounts} residents registered, ${d.logCounts}/${d.logCapacity} logs stored`, 'success');
    } catch (error) {
      setTerminalStatus({ online: false, error: error.response?.data?.error || 'Unreachable' });
      showSnackbar(error.response?.data?.error || 'Terminal unreachable at current IP', 'error');
    } finally {
      setBusy(devId, 'test', false);
    }
  };

  const handlePullLogs = async (device) => {
    const devId = device?.device_id;
    setBusy(devId, 'pull', true);
    try {
      const response = await zkAPI.pullLogs({ device_id: devId });
      const s = response.data;
      showSnackbar(`Imported ${s.imported || 0} new access events (${s.skippedDuplicate || 0} duplicates skipped)`, (s.imported || 0) > 0 ? 'success' : 'info');
      if (devId) deviceAPI.update(devId, { device_status: 'Active' }).catch(() => {});
      fetchDevices();
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Failed to pull terminal logs', 'error');
    } finally {
      setBusy(devId, 'pull', false);
    }
  };

  const handleSyncResidents = async (device) => {
    if (!window.confirm('Push all GreenValley residents to the terminal? Existing users will be updated.')) return;
    const devId = device?.device_id;
    setBusy(devId, 'sync', true);
    try {
      const response = await zkAPI.syncResidents({ device_id: devId });
      showSnackbar(`Successfully synced ${response.data.synced} residents into the terminal!`, 'success');
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Failed to sync residents', 'error');
    } finally {
      setBusy(devId, 'sync', false);
    }
  };

  // Remote Enrollment trigger on terminal LCD
  const handleTriggerEnroll = async () => {
    if (!selectedResidentId) {
      showSnackbar('Please select a resident to enroll', 'error');
      return;
    }
    setEnrolling(true);
    try {
      const resp = await zkAPI.enroll({
        resident_id: Number(selectedResidentId),
        finger_index: selectedFinger
      });
      showSnackbar(resp.data.message || 'Terminal LCD prompted! Please ask the resident to place finger 3 times on sensor.', 'success');
      setEnrollOpen(false);
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Enrollment trigger failed', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>Devices</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage biometric hardware, USB optical scanners, and network terminals</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<AutoIcon />}
            onClick={probeHardware}
            disabled={detecting}
            className="glass-btn-outlined"
          >
            {detecting ? 'Scanning Ports...' : 'Scan USB Hardware'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} className="glass-btn">
            Add Device
          </Button>
        </Box>
      </Box>

      {/* Hardware Detection Alert Banner for USB / Platform Scanners */}
      {detectedHardware && (
        <Alert
          severity="success"
          icon={<CheckIcon />}
          sx={{ mb: 3, borderRadius: '14px', alignItems: 'center', bgcolor: 'rgba(46, 125, 50, 0.08)' }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => handleOpenDialog()}
              sx={{ fontWeight: 700 }}
            >
              Register This Device
            </Button>
          }
        >
          <Typography variant="body2" fontWeight="600">
            Detected Connected Biometric Hardware: {detectedHardware.readerName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ready to capture fingerprints for access verification and enrollment.
          </Typography>
        </Alert>
      )}

      {/* ========================================================================= */}
      {/* DEDICATED ZKTECO NETWORK DIRECT-CONNECT & IP CONFIGURATION CARD */}
      {/* ========================================================================= */}
      <Card
        sx={{
          mb: 4,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(245,249,248,0.85) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 137, 123, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 137, 123, 0.08)'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  bgcolor: 'rgba(0, 137, 123, 0.12)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RouterIcon />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight="700">
                  ZKTeco Network Biometric Terminal Direct Connect
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Connect to your standalone ZKTeco terminal over any WiFi router or Ethernet LAN
                </Typography>
              </Box>
            </Box>

            {/* Live Status Chip */}
            {terminalStatus && (
              <Chip
                icon={terminalStatus.online ? <ConnectedIcon /> : <DisconnectedIcon />}
                label={terminalStatus.online
                  ? `Online • ${terminalStatus.userCounts || 0} Residents • ${terminalStatus.logCounts || 0} Logs`
                  : `Unreachable: ${terminalStatus.error || 'Check IP / Router'}`
                }
                color={terminalStatus.online ? 'success' : 'error'}
                variant="outlined"
                sx={{ fontWeight: 700, px: 1 }}
              />
            )}
          </Box>

          <Divider sx={{ mb: 2.5, opacity: 0.6 }} />

          {/* IP & Port Configuration Row */}
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Terminal IP Address"
                value={quickIp}
                onChange={(e) => setQuickIp(e.target.value)}
                placeholder="e.g. 192.168.254.106"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <WifiIcon fontSize="small" color="action" />
                    </InputAdornment>
                  )
                }}
                sx={{ bgcolor: '#fff', borderRadius: '10px' }}
                helperText="Enter IP assigned to the terminal by your router"
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Port"
                type="number"
                value={quickPort}
                onChange={(e) => setQuickPort(e.target.value)}
                placeholder="4370"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PortIcon fontSize="small" color="action" />
                    </InputAdornment>
                  )
                }}
                sx={{ bgcolor: '#fff', borderRadius: '10px' }}
                helperText="Default: 4370"
              />
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleQuickConnect}
                  disabled={connectingZk}
                  startIcon={connectingZk ? <CircularProgress size={16} color="inherit" /> : <WifiIcon />}
                  sx={{
                    bgcolor: '#00897b',
                    '&:hover': { bgcolor: '#00695c' },
                    borderRadius: '10px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2.5
                  }}
                >
                  {connectingZk ? 'Connecting...' : 'Connect & Save IP'}
                </Button>

                <Button
                  variant="outlined"
                  onClick={handleScanNetwork}
                  disabled={scanningNet}
                  startIcon={scanningNet ? <CircularProgress size={16} color="inherit" /> : <RouterIcon />}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderColor: 'rgba(0,137,123,0.5)',
                    color: '#00695c'
                  }}
                >
                  {scanningNet ? 'Scanning Subnet...' : 'Auto-Scan Router'}
                </Button>

                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => setEnrollOpen(true)}
                  startIcon={<FingerprintIcon />}
                  sx={{ borderRadius: '10px', fontWeight: 600, textTransform: 'none' }}
                >
                  Enroll Fingerprint
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Discovered Subnet Terminals Chips */}
          {scanResults.length > 0 && (
            <Box sx={{ mt: 2, p: 2, borderRadius: '12px', bgcolor: 'rgba(0,137,123,0.05)', border: '1px dashed rgba(0,137,123,0.3)' }}>
              <Typography variant="caption" fontWeight="700" color="primary.main" sx={{ display: 'block', mb: 1 }}>
                Discovered Devices on Current Router Subnet:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {scanResults.map((t, idx) => (
                  <Chip
                    key={`${t.ip}-${idx}`}
                    clickable
                    color={t.isTerminal ? 'primary' : 'default'}
                    icon={<WifiIcon />}
                    label={t.isTerminal
                      ? `${t.ip} • ZKTeco Terminal (${t.userCounts} Residents, ${t.logCounts} Logs) — Click to Select`
                      : `${t.ip} • Open Port 4370`
                    }
                    onClick={() => {
                      setQuickIp(t.ip);
                      setQuickPort(String(t.port || 4370));
                      showSnackbar(`Selected ${t.ip}! Click "Connect & Save IP" to bind.`, 'info');
                    }}
                    sx={{ fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Quick Terminal Control Actions Bar */}
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase', mr: 1 }}>
              Quick Terminal Actions:
            </Typography>

            <Tooltip title="Test live ping and query terminal status">
              <span>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<WifiIcon fontSize="small" />}
                  onClick={() => handleTestTerminal(devices.find(isZkTerminal) || {})}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Test Connection
                </Button>
              </span>
            </Tooltip>

            <Tooltip title="Sync GreenValley resident roster (IDs & names) to terminal">
              <span>
                <Button
                  size="small"
                  variant="text"
                  color="primary"
                  startIcon={<SyncIcon fontSize="small" />}
                  onClick={() => handleSyncResidents(devices.find(isZkTerminal) || {})}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Sync Residents
                </Button>
              </span>
            </Tooltip>

            <Tooltip title="Pull attendance records from terminal into GreenValley access logs">
              <span>
                <Button
                  size="small"
                  variant="text"
                  color="info"
                  startIcon={<PullIcon fontSize="small" />}
                  onClick={() => handlePullLogs(devices.find(isZkTerminal) || {})}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Pull Logs
                </Button>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Registered Devices Table */}
      <Box className="glass-card" sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Scanner Model / Box</TableCell>
                <TableCell>Port / IP Endpoint</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Calibration</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.device_id}>
                  <TableCell><Typography variant="body2" fontWeight="600">#{device.device_id}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight="500">{device.location}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="600">{device.scanner_model || '-'}</Typography>
                  </TableCell>
                  <TableCell><Chip label={device.usb_port || '-'} size="small" variant="outlined" sx={{ fontWeight: 600 }} /></TableCell>
                  <TableCell>
                    <Chip
                      label={device.device_status}
                      size="small"
                      color={['Active', 'Online'].includes(device.device_status) ? 'success' : 'error'}
                      onClick={() => handleToggleStatus(device)}
                      sx={{ cursor: 'pointer', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {device.calibration_date ? new Date(device.calibration_date).toLocaleDateString() : 'Auto-calibrated'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {isZkTerminal(device) && (
                      <>
                        <Tooltip title="Test terminal connection">
                          <span>
                            <IconButton color="primary" onClick={() => handleTestTerminal(device)} size="small" disabled={terminalBusy[device.device_id]?.test}>
                              <WifiIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Pull terminal attendance logs into FingerGate">
                          <span>
                            <IconButton color="primary" onClick={() => handlePullLogs(device)} size="small" disabled={terminalBusy[device.device_id]?.pull}>
                              <PullIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Sync residents to the terminal">
                          <span>
                            <IconButton color="secondary" onClick={() => handleSyncResidents(device)} size="small" disabled={terminalBusy[device.device_id]?.sync}>
                              <SyncIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title="Edit">
                      <IconButton color="primary" onClick={() => handleOpenDialog(device)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => handleDelete(device.device_id)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {devices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No devices registered yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Add / Edit Device Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)' } }}>
        <DialogTitle fontWeight="700">{selectedDevice ? 'Edit Biometric Device' : 'Register New Biometric Box'}</DialogTitle>
        <DialogContent>
          {/* Preset Selector */}
          <Box sx={{ mt: 1, mb: 2 }}>
            <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Quick Preset (Popular Biometric Hardware)
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                defaultValue=""
                displayEmpty
                onChange={(e) => {
                  const preset = SCANNER_PRESETS.find(p => p.label === e.target.value);
                  if (preset) handlePresetSelect(preset);
                }}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="" disabled>Select a scanner preset or enter custom below</MenuItem>
                {SCANNER_PRESETS.map((p) => (
                  <MenuItem key={p.label} value={p.label}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            fullWidth label="Location" value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            margin="normal" required placeholder="e.g., Main Gate, Purok 4 Checkpoint"
          />
          <TextField
            fullWidth label="Scanner Model / Box Type" value={formData.scanner_model}
            onChange={(e) => setFormData({ ...formData, scanner_model: e.target.value })}
            margin="normal" placeholder="e.g., USB Serial Biometric Box, SecuGen Hamster, Windows Hello"
          />

          {isZkForm && (
            <Box sx={{ mt: 2, mb: 1, p: 2, borderRadius: '12px', bgcolor: 'rgba(0,137,123,0.06)', border: '1px solid rgba(0,137,123,0.25)' }}>
              <Typography variant="caption" fontWeight="700" sx={{ display: 'block', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
                Terminal Network Settings
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Both the terminal and this laptop must be on the same router — enter IP or scan:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  size="small" fullWidth
                  label="Terminal IP address"
                  value={quickIp}
                  onChange={(e) => setQuickIp(e.target.value)}
                  placeholder="e.g., 192.168.254.106"
                  helperText={`Endpoint: ${quickIp || '<ip>'}:${quickPort || '4370'}`}
                />
                <TextField
                  size="small"
                  sx={{ width: 110 }}
                  label="Port"
                  type="number"
                  value={quickPort}
                  onChange={(e) => setQuickPort(e.target.value)}
                  placeholder="4370"
                />
              </Box>
            </Box>
          )}

          {!isZkForm && (
            <TextField
              fullWidth label="USB Port / Interface" value={formData.usb_port}
              onChange={(e) => setFormData({ ...formData, usb_port: e.target.value })}
              margin="normal" placeholder="e.g., COM3, /dev/ttyUSB0, Platform, or USB"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenDialog(false)} className="glass-btn-outlined">Cancel</Button>
          <Button onClick={handleSubmit} className="glass-btn">{selectedDevice ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Remote Fingerprint Enrollment Modal */}
      <Dialog open={enrollOpen} onClose={() => setEnrollOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle fontWeight="700">Enroll Fingerprint on Terminal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a resident and finger index. The terminal screen will prompt the resident to press their finger 3 times.
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ mb: 0.5 }}>
              Select Resident:
            </Typography>
            <Select
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              sx={{ borderRadius: '10px' }}
            >
              {residents.map((r) => (
                <MenuItem key={r.resident_id} value={String(r.resident_id)}>
                  ID #{r.resident_id} — {r.full_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ mb: 0.5 }}>
              Finger Position:
            </Typography>
            <Select
              value={selectedFinger}
              onChange={(e) => setSelectedFinger(Number(e.target.value))}
              sx={{ borderRadius: '10px' }}
            >
              <MenuItem value={0}>Right Thumb (0)</MenuItem>
              <MenuItem value={1}>Right Index (1)</MenuItem>
              <MenuItem value={2}>Right Middle (2)</MenuItem>
              <MenuItem value={5}>Left Thumb (5)</MenuItem>
              <MenuItem value={6}>Left Index (6)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEnrollOpen(false)} className="glass-btn-outlined">Cancel</Button>
          <Button
            onClick={handleTriggerEnroll}
            disabled={enrolling}
            variant="contained"
            className="glass-btn"
            startIcon={enrolling ? <CircularProgress size={16} color="inherit" /> : <FingerprintIcon />}
          >
            {enrolling ? 'Triggering...' : 'Start Enrollment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Devices;
