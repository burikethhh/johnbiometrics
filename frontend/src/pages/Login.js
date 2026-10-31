import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Fingerprint as FingerprintIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Lock as LockIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 30%, #00897b 70%, #004d40 100%)',
    }}>
      <Box sx={{
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
        animation: 'float 6s ease-in-out infinite',
      }} />
      <Box sx={{
        position: 'absolute', bottom: -150, left: -150,
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
        animation: 'float 8s ease-in-out infinite reverse',
      }} />
      <Box sx={{
        position: 'absolute', top: '40%', left: '10%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,137,123,0.15) 0%, transparent 70%)',
        animation: 'float 5s ease-in-out infinite 1s',
      }} />

      <Box sx={{
        width: '100%',
        maxWidth: 440,
        mx: 2,
        animation: 'fadeInUp 0.6s ease-out',
      }}>
        <Box sx={{
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '28px',
          p: { xs: 3, sm: 4.5 },
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.25)',
        }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            }}>
              <FingerprintIcon sx={{ fontSize: 44, color: 'white' }} className="fingerprint-glow" />
            </Box>
            <Typography variant="h3" fontWeight="800" sx={{
              color: 'white',
              letterSpacing: '-0.02em',
              mb: 0.5,
            }}>
              FingerGate
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              Web-Based Fingerprint Recognition Access Control
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{
              mb: 2.5,
              borderRadius: '12px',
              background: 'rgba(211, 47, 47, 0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(211, 47, 47, 0.2)',
              color: 'white',
              '& .MuiAlert-icon': { color: 'white' },
            }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  '& fieldset': { border: 'none' },
                  '&:hover': { background: 'rgba(255, 255, 255, 0.15)' },
                  '&.Mui-focused': {
                    background: 'rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.1)',
                  },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
                '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255,255,255,0.9)' },
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  '& fieldset': { border: 'none' },
                  '&:hover': { background: 'rgba(255, 255, 255, 0.15)' },
                  '&.Mui-focused': {
                    background: 'rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.1)',
                  },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
                '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255,255,255,0.9)' },
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? null : <SecurityIcon />}
              sx={{
                mt: 3,
                py: 1.8,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #fff 0%, #e8f5e9 100%)',
                color: '#1b5e20',
                fontWeight: 700,
                fontSize: '1rem',
                letterSpacing: '0.02em',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #f1f8e9 0%, #c8e6c9 100%)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': {
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem' }}>
              Barangay Tamped, Matalam, North Cotabato
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
