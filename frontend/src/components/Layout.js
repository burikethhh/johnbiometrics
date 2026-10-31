import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
  Chip,
  Badge
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Fingerprint as FingerprintIcon,
  History as HistoryIcon,
  SettingsInputComponent as DeviceIcon,
  Assessment as EvaluationIcon,
  ExitToApp as LogoutIcon,
  Notifications as BellIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Residents', icon: <PeopleIcon />, path: '/residents' },
  { text: 'Verification', icon: <FingerprintIcon />, path: '/verification' },
  { text: 'Access Logs', icon: <HistoryIcon />, path: '/access-logs' },
  { text: 'Devices', icon: <DeviceIcon />, path: '/devices' },
  { text: 'Evaluation', icon: <EvaluationIcon />, path: '/evaluation' },
];

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const currentPage = menuItems.find(item => item.path === location.pathname);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderBottom: '1px solid rgba(46, 125, 50, 0.08)',
      }}>
        <Box sx={{
          width: 42,
          height: 42,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #2e7d32, #00897b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)',
        }}>
          <FingerprintIcon sx={{ fontSize: 24, color: 'white' }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight="800" sx={{
            background: 'linear-gradient(135deg, #2e7d32, #00897b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1.2,
          }}>
            FingerGate
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            Access Control System
          </Typography>
        </Box>
        {!isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small" sx={{ ml: 'auto' }}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Box sx={{ px: 1.5, py: 2, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{
          px: 1.5, mb: 1, display: 'block', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.6rem',
        }}>
          Navigation
        </Typography>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Box
              key={item.text}
              onClick={() => {
                navigate(item.path);
                if (isMobile) handleDrawerToggle();
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.2,
                mx: 0.5,
                mb: 0.5,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(46, 125, 50, 0.12), rgba(0, 137, 123, 0.08))'
                  : 'transparent',
                border: isActive ? '1px solid rgba(46, 125, 50, 0.15)' : '1px solid transparent',
                '&:hover': {
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(46, 125, 50, 0.15), rgba(0, 137, 123, 0.1))'
                    : 'rgba(46, 125, 50, 0.04)',
                },
              }}
            >
              <Box sx={{
                color: isActive ? '#2e7d32' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
              }}>
                {item.icon}
              </Box>
              <Typography
                sx={{
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#1b5e20' : '#475569',
                  fontSize: '0.875rem',
                  transition: 'color 0.2s',
                }}
              >
                {item.text}
              </Typography>
              {isActive && (
                <Box sx={{
                  ml: 'auto',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2e7d32, #00897b)',
                }} />
              )}
            </Box>
          );
        })}
      </Box>

      <Box sx={{
        p: 2,
        borderTop: '1px solid rgba(46, 125, 50, 0.08)',
        background: 'rgba(46, 125, 50, 0.02)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #2e7d32, #00897b)',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}>
            {admin?.username?.[0]?.toUpperCase() || 'A'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="600" noWrap>
              {admin?.username}
            </Typography>
            <Chip
              label={admin?.role}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 600,
                background: admin?.role === 'Super'
                  ? 'linear-gradient(135deg, #2e7d32, #00897b)'
                  : 'rgba(0,0,0,0.06)',
                color: admin?.role === 'Super' ? 'white' : 'text.secondary',
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: desktopOpen ? DRAWER_WIDTH : 0 }, flexShrink: 0 }}>
        {isMobile ? (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: DRAWER_WIDTH,
              height: '100%',
              zIndex: 1300,
              transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: mobileOpen ? '0 8px 32px rgba(0, 0, 0, 0.12)' : 'none',
            }}
          >
            {drawer}
          </Box>
        ) : (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: desktopOpen ? DRAWER_WIDTH : 0,
              height: '100%',
              zIndex: 1200,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '4px 0 24px rgba(0, 0, 0, 0.04)',
            }}
          >
            {drawer}
          </Box>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: { md: `calc(100% - ${desktopOpen ? DRAWER_WIDTH : 0}px)` } }}>
        <Box
          component="header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, md: 3 },
            py: 1.5,
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              color="inherit"
              onClick={handleDrawerToggle}
              sx={{
                display: { md: desktopOpen ? 'flex' : 'none', xs: 'flex' },
                bgcolor: 'rgba(46, 125, 50, 0.06)',
                '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.12)' },
              }}
            >
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" fontWeight="700" sx={{ lineHeight: 1.2 }}>
                {currentPage?.text || 'FingerGate'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Barangay Tamped, Matalam, North Cotabato
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              sx={{
                bgcolor: 'rgba(46, 125, 50, 0.06)',
                '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.12)' },
              }}
            >
              <Badge badgeContent={0} color="error">
                <BellIcon sx={{ color: '#64748b' }} />
              </Badge>
            </IconButton>

            <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
              <Avatar sx={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, #2e7d32, #00897b)',
                boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}>
                {admin?.username?.[0]?.toUpperCase() || 'A'}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 200,
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  borderRadius: '16px',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12)',
                }
              }}
            >
              <MenuItem disabled sx={{ opacity: 1 }}>
                <Avatar sx={{
                  width: 32, height: 32, mr: 1.5,
                  background: 'linear-gradient(135deg, #2e7d32, #00897b)',
                  fontSize: '0.75rem',
                }}>
                  {admin?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight="600">{admin?.username}</Typography>
                  <Typography variant="caption" color="text.secondary">{admin?.role}</Typography>
                </Box>
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout} sx={{ borderRadius: '8px', mx: 0.5 }}>
                <LogoutIcon sx={{ mr: 1.5, color: '#64748b' }} />
                <Typography variant="body2" fontWeight="500">Logout</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 3 },
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {isMobile && mobileOpen && (
        <Box
          onClick={handleDrawerToggle}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 1299,
          }}
        />
      )}
    </Box>
  );
};

export default Layout;
