import React from 'react';
import { Box } from '@mui/material';

const PageTransition = ({ children }) => (
  <Box
    sx={{
      animation: 'pageIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      '@keyframes pageIn': {
        '0%': { opacity: 0, transform: 'translateY(12px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
    }}
  >
    {children}
  </Box>
);

export default PageTransition;
