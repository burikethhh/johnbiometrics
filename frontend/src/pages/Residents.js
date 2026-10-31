import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, Chip, Tooltip, TablePagination, InputAdornment,
  CircularProgress, Stepper, Step, StepLabel, FormControl, Select, MenuItem
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Fingerprint as FingerprintIcon, Search as SearchIcon,
  CheckCircle as CheckIcon, Error as ErrorIcon,
  Usb as UsbIcon, Refresh as RefreshIcon,
  SettingsInputComponent as BoxIcon
} from '@mui/icons-material';
import { residentAPI, fingerprintAPI } from '../services/api';
import fingerprintService from '../services/fingerprintService';

const Residents = () => {
  const [residents, setResidents] = useState([]);
  const [filteredResidents, setFilteredResidents] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openFingerprintDialog, setOpenFingerprintDialog] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);
  const [formData, setFormData] = useState({ full_name: '', address: '', contact_number: '', household_number: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fingerprint scanner state
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerChecking, setScannerChecking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedTemplate, setCapturedTemplate] = useState(null);
  const [captureStep, setCaptureStep] = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [scannerError, setScannerError] = useState(null);
  const [readerName, setReaderName] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('auto');
  const [connectingSerial, setConnectingSerial] = useState(false);

  const steps = ['Connect Scanner', 'Place Finger', 'Capture Template', 'Register'];

  useEffect(() => { fetchResidents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchResidents = async () => {
    try {
      const response = await residentAPI.getAll();
      setResidents(response.data);
      setFilteredResidents(response.data);
    } catch (error) {
      showSnackbar('Failed to fetch residents', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    setFilteredResidents(residents.filter(r =>
      r.full_name?.toLowerCase().includes(query) ||
      r.household_number?.toLowerCase().includes(query) ||
      r.address?.toLowerCase().includes(query)
    ));
    setPage(0);
  };

  const handleOpenDialog = (resident = null) => {
    if (resident) {
      setSelectedResident(resident);
      setFormData({
        full_name: resident.full_name,
        address: resident.address || '',
        contact_number: resident.contact_number || '',
        household_number: resident.household_number || ''
      });
    } else {
      setSelectedResident(null);
      setFormData({ full_name: '', address: '', contact_number: '', household_number: '' });
    }
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    try {
      if (selectedResident) {
        await residentAPI.update(selectedResident.resident_id, formData);
        showSnackbar('Resident updated successfully');
      } else {
        await residentAPI.create(formData);
        showSnackbar('Resident added successfully');
      }
      setOpenDialog(false);
      fetchResidents();
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this resident?')) {
      try { await residentAPI.delete(id); showSnackbar('Resident deleted'); fetchResidents(); }
      catch (error) { showSnackbar('Failed to delete resident', 'error'); }
    }
  };

  const checkScanner = async () => {
    setScannerChecking(true);
    setScannerError(null);
    try {
      await fingerprintService.initialize();
      const status = await fingerprintService.checkScannerStatus();
      setScannerReady(Boolean(status.connected));
      setReaderName(status.readerName || '');
      if (!status.connected) {
        setScannerError(status.error || 'Scanner not connected. Please attach a biometric box.');
      }
    } catch (error) {
      setScannerReady(false);
      setScannerError(error.message || 'Failed to initialize scanner');
    } finally {
      setScannerChecking(false);
    }
  };

  const handleDriverChange = async (newDriver) => {
    setSelectedDriver(newDriver);
    setScannerChecking(true);
    setScannerError(null);
    try {
      await fingerprintService.setDriver(newDriver);
      const status = await fingerprintService.checkScannerStatus();
      setScannerReady(Boolean(status.connected));
      setReaderName(status.readerName || '');
      if (!status.connected) {
        setScannerError(status.error || 'Device not ready');
      }
    } catch (err) {
      setScannerError(err.message);
    } finally {
      setScannerChecking(false);
    }
  };

  const handleConnectSerial = async () => {
    setConnectingSerial(true);
    setScannerError(null);
    try {
      const res = await fingerprintService.connectSerialBox();
      setScannerReady(true);
      setReaderName(res.deviceName);
      showSnackbar(`Connected to ${res.deviceName}`);
    } catch (err) {
      setScannerError(err.message || 'Failed to connect USB Serial Box');
    } finally {
      setConnectingSerial(false);
    }
  };

  const handleOpenFingerprint = (resident) => {
    setSelectedResident(resident);
    setCapturedTemplate(null);
    setCaptureStep(0);
    setCaptureCount(0);
    setScannerError(null);
    setOpenFingerprintDialog(true);
    checkScanner();
  };

  const captureFingerprint = async () => {
    setCapturing(true);
    setScannerError(null);
    try {
      const result = await fingerprintService.captureForEnrollment({
        residentName: selectedResident?.full_name
      });
      if (result.success) {
        setCapturedTemplate(result.template);
        setCaptureCount(prev => prev + 1);
        setCaptureStep(2);
        showSnackbar(`Fingerprint captured successfully from ${result.deviceName || readerName}`, 'success');
      } else {
        setScannerError(result.error || 'Failed to capture fingerprint');
      }
    } catch (error) {
      setScannerError(error.message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  };

  const handleRegisterFingerprint = async () => {
    if (!capturedTemplate) {
      showSnackbar('No fingerprint captured', 'error');
      return;
    }

    try {
      await fingerprintAPI.register({
        resident_id: selectedResident.resident_id,
        encoding: capturedTemplate
      });
      showSnackbar('Fingerprint registered successfully');
      setOpenFingerprintDialog(false);
      setCapturedTemplate(null);
      setCaptureCount(0);
      setCaptureStep(0);
    } catch (error) {
      showSnackbar('Failed to register fingerprint', 'error');
    }
  };

  const useMockFingerprint = () => {
    const mockTemplate = fingerprintService.constructor.generateMockTemplate();
    setCapturedTemplate(mockTemplate);
    setCaptureCount(2);
    setCaptureStep(2);
    showSnackbar('Mock fingerprint generated (demo mode)', 'info');
  };

  const paginatedResidents = filteredResidents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const availableDrivers = fingerprintService.getAvailableDrivers();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.02em' }}>Residents</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage resident records and biometric registration</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} className="glass-btn">
          Add Resident
        </Button>
      </Box>

      {/* Search */}
      <Box className="glass-card" sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth placeholder="Search by name, household number, or address..."
          value={searchQuery} onChange={handleSearch} size="small"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', background: 'rgba(255,255,255,0.7)' } }}
        />
      </Box>

      {/* Table */}
      <Box className="glass-card" sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Household #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedResidents.map((resident) => (
                <TableRow key={resident.resident_id}>
                  <TableCell><Typography variant="body2" fontWeight="600">#{resident.resident_id}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight="600">{resident.full_name}</Typography></TableCell>
                  <TableCell>{resident.address || '-'}</TableCell>
                  <TableCell>{resident.contact_number || '-'}</TableCell>
                  <TableCell><Chip label={resident.household_number || '-'} size="small" variant="outlined" /></TableCell>
                  <TableCell><Chip label={resident.status} size="small" color={resident.status === 'Active' ? 'success' : 'error'} sx={{ fontWeight: 600 }} /></TableCell>
                  <TableCell>
                    <Tooltip title="Register / Update Biometrics">
                      <IconButton color="secondary" onClick={() => handleOpenFingerprint(resident)} size="small">
                        <FingerprintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton color="primary" onClick={() => handleOpenDialog(resident)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => handleDelete(resident.resident_id)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedResidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No residents found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={filteredResidents.length}
          page={page} onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Box>

      {/* Add/Edit Resident Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)' } }}>
        <DialogTitle fontWeight="700">{selectedResident ? 'Edit Resident' : 'Add New Resident'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full Name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} margin="normal" required />
          <TextField fullWidth label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} margin="normal" />
          <TextField fullWidth label="Contact Number" value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} margin="normal" />
          <TextField fullWidth label="Household Number" value={formData.household_number} onChange={(e) => setFormData({ ...formData, household_number: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenDialog(false)} className="glass-btn-outlined">Cancel</Button>
          <Button onClick={handleSubmit} className="glass-btn">{selectedResident ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Universal Fingerprint Registration Dialog */}
      <Dialog
        open={openFingerprintDialog}
        onClose={() => setOpenFingerprintDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight="700">Register Biometric Fingerprint</Typography>
          <Typography variant="body2" color="text.secondary">
            Enrolling resident: <strong>{selectedResident?.full_name}</strong> (ID: #{selectedResident?.resident_id})
          </Typography>
        </DialogTitle>
        <DialogContent>
          {/* Stepper */}
          <Stepper activeStep={captureStep} sx={{ mb: 3, mt: 1 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Biometric Hardware Source Selector */}
          <Box sx={{ mb: 2.5, p: 2, borderRadius: '14px', bgcolor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BoxIcon color="primary" fontSize="small" />
                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Select Biometric Hardware
                </Typography>
              </Box>
              {selectedDriver === 'serial' && !fingerprintService.serialConnected && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={connectingSerial ? <CircularProgress size={14} color="inherit" /> : <UsbIcon />}
                  onClick={handleConnectSerial}
                  disabled={connectingSerial}
                  sx={{ py: 0.5, px: 1.5, fontSize: '0.75rem', borderRadius: '8px' }}
                >
                  {connectingSerial ? 'Connecting...' : 'Connect USB Box'}
                </Button>
              )}
            </Box>
            <FormControl size="small" fullWidth>
              <Select
                value={selectedDriver}
                onChange={(e) => handleDriverChange(e.target.value)}
                sx={{ borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}
              >
                {availableDrivers.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Scanner Status Box */}
          <Box sx={{ mb: 2.5, p: 2, borderRadius: '12px', bgcolor: scannerReady ? 'rgba(46, 125, 50, 0.06)' : 'rgba(211, 47, 47, 0.06)', border: `1px solid ${scannerReady ? 'rgba(46, 125, 50, 0.15)' : 'rgba(211, 47, 47, 0.15)'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {scannerChecking ? (
                <CircularProgress size={20} />
              ) : scannerReady ? (
                <CheckIcon sx={{ color: '#2e7d32' }} />
              ) : (
                <ErrorIcon sx={{ color: '#d32f2f' }} />
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="600">
                  {scannerChecking ? 'Probing biometric hardware...' : scannerReady ? 'Scanner Ready' : 'Scanner Not Connected'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {scannerReady ? `Connected to: ${readerName}` : 'Attach a biometric box or switch hardware source above'}
                </Typography>
              </Box>
              <Button size="small" onClick={checkScanner} startIcon={<RefreshIcon />} disabled={scannerChecking}>
                Refresh
              </Button>
            </Box>
          </Box>

          {/* Scanner Error */}
          {scannerError && (
            <Alert severity="warning" sx={{ mb: 2.5, borderRadius: '12px' }}>
              {scannerError}
            </Alert>
          )}

          {/* Capture Area */}
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{
              width: 170, height: 170, borderRadius: '50%', mx: 'auto', mb: 2.5,
              background: capturing
                ? 'linear-gradient(135deg, rgba(46,125,50,0.15), rgba(0,137,123,0.08))'
                : capturedTemplate
                  ? 'linear-gradient(135deg, rgba(76,175,80,0.15), rgba(76,175,80,0.05))'
                  : 'rgba(255,255,255,0.5)',
              border: capturing ? '3px solid rgba(46, 125, 50, 0.4)' : capturedTemplate ? '3px solid rgba(76, 175, 80, 0.4)' : '3px dashed rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}>
              {capturing ? (
                <CircularProgress size={60} thickness={3} />
              ) : capturedTemplate ? (
                <CheckIcon sx={{ fontSize: 60, color: '#2e7d32' }} />
              ) : (
                <FingerprintIcon sx={{ fontSize: 80, color: '#2e7d32', opacity: 0.5 }} />
              )}
            </Box>

            <Typography variant="h6" fontWeight="700" sx={{ mb: 0.5 }}>
              {capturing ? 'Waiting for finger touch...' : capturedTemplate ? 'Biometric Enrolled' : 'Place finger on sensor'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {capturing
                ? 'Hold your finger steady on the biometric sensor...'
                : capturedTemplate
                  ? `Successfully captured template (${captureCount} scan${captureCount > 1 ? 's' : ''}) from ${readerName}. Click "Register" to save.`
                  : `Active scanner: ${readerName}. Click "Capture Fingerprint" and touch the sensor.`}
            </Typography>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              {!capturedTemplate ? (
                <>
                  <Button
                    variant="contained" onClick={captureFingerprint}
                    disabled={!scannerReady || capturing}
                    className="glass-btn"
                    startIcon={capturing ? <CircularProgress size={18} /> : <FingerprintIcon />}
                    sx={{ px: 4 }}
                  >
                    {capturing ? 'Capturing...' : 'Capture Fingerprint'}
                  </Button>
                  <Button
                    variant="outlined" onClick={useMockFingerprint}
                    className="glass-btn-outlined"
                    sx={{ px: 3 }}
                  >
                    Use Demo Mode
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined" onClick={() => { setCapturedTemplate(null); setCaptureCount(0); setCaptureStep(0); }}
                    className="glass-btn-outlined"
                  >
                    Recapture
                  </Button>
                  <Button
                    variant="contained" onClick={handleRegisterFingerprint}
                    className="glass-btn"
                    startIcon={<CheckIcon />}
                    sx={{ px: 4 }}
                  >
                    Register Fingerprint
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Universal Biometric Compatibility Guidance */}
          <Box sx={{ mt: 2, p: 2, borderRadius: '12px', bgcolor: 'rgba(25, 118, 210, 0.04)', border: '1px solid rgba(25, 118, 210, 0.1)' }}>
            <Typography variant="caption" fontWeight="600" color="info.main" sx={{ display: 'block', mb: 0.5 }}>
              Universal Hardware Support:
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.7 }}>
              • <strong>Laptop Fingerprint Reader / USB Keys:</strong> Select "Windows Hello" and touch your sensor.<br />
              • <strong>USB Serial Biometric Box:</strong> Select "USB Serial Box" & click "Connect USB Box" to pick COM port.<br />
              • <strong>DigitalPersona / SecuGen / Mantra / ZKTeco:</strong> Plug in via USB and install their local client service.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenFingerprintDialog(false)} className="glass-btn-outlined">Close</Button>
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

export default Residents;
