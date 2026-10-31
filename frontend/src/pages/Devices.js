import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, Chip, Tooltip, MenuItem, FormControl, Select
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  CheckCircle as CheckIcon, AutoFixHigh as AutoIcon
} from '@mui/icons-material';
import { deviceAPI } from '../services/api';
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
  { label: 'Universal Biometric Bridge (Port 9191)', model: 'Universal Local Biometric Bridge', port: 'HTTP/9191' },
  { label: 'Other / Custom Biometric Box', model: '', port: '' }
];

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({ location: '', scanner_model: '', usb_port: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detectedHardware, setDetectedHardware] = useState(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    fetchDevices();
    probeHardware();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDevices = async () => {
    try {
      const response = await deviceAPI.getAll();
      setDevices(response.data);
    } catch (error) {
      showSnackbar('Failed to fetch devices', 'error');
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

  const handleOpenDialog = (device = null) => {
    if (device) {
      setSelectedDevice(device);
      setFormData({
        location: device.location,
        scanner_model: device.scanner_model || '',
        usb_port: device.usb_port || ''
      });
    } else {
      setSelectedDevice(null);
      // Pre-fill with detected hardware if available
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
  };

  const handleSubmit = async () => {
    try {
      if (selectedDevice) {
        await deviceAPI.update(selectedDevice.device_id, formData);
        showSnackbar('Device updated');
      } else {
        await deviceAPI.create(formData);
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
      const isAvailable = ['Active', 'Online'].includes(device.device_status);
      await deviceAPI.update(device.device_id, { device_status: isAvailable ? 'Offline' : 'Online' });
      showSnackbar('Device status updated');
      fetchDevices();
    } catch (error) {
      showSnackbar('Failed to update status', 'error');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>Devices</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage and register biometric boxes and fingerprint scanners</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<AutoIcon />}
            onClick={probeHardware}
            disabled={detecting}
            className="glass-btn-outlined"
          >
            {detecting ? 'Scanning Ports...' : 'Scan Hardware'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} className="glass-btn">
            Add Device
          </Button>
        </Box>
      </Box>

      {/* Hardware Detection Alert Banner */}
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

      <Box className="glass-card" sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Scanner Model / Box</TableCell>
                <TableCell>Port / Interface</TableCell>
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
                  <TableCell><Chip label={device.usb_port || '-'} size="small" variant="outlined" /></TableCell>
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
          <TextField
            fullWidth label="USB Port / Interface" value={formData.usb_port}
            onChange={(e) => setFormData({ ...formData, usb_port: e.target.value })}
            margin="normal" placeholder="e.g., COM3, /dev/ttyUSB0, Platform, or USB"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenDialog(false)} className="glass-btn-outlined">Cancel</Button>
          <Button onClick={handleSubmit} className="glass-btn">{selectedDevice ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Devices;
