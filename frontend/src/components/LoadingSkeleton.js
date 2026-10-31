import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

export const StatCardSkeleton = () => (
  <Box sx={{
    p: 3,
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.5)',
  }}>
    <Stack direction="row" alignItems="center" spacing={2}>
      <Skeleton variant="rounded" width={52} height={52} sx={{ borderRadius: '14px' }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="40%" height={16} sx={{ mt: 0.5 }} />
      </Box>
    </Stack>
  </Box>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <Box sx={{
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.5)',
    overflow: 'hidden',
    p: 2,
  }}>
    {Array.from({ length: rows }).map((_, i) => (
      <Stack key={i} direction="row" spacing={2} sx={{ py: 1.5, px: 1 }}>
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} flex={1} height={20} />
        ))}
      </Stack>
    ))}
  </Box>
);

export const ChartSkeleton = ({ height = 300 }) => (
  <Box sx={{
    p: 3,
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.5)',
  }}>
    <Skeleton width="30%" height={22} sx={{ mb: 2 }} />
    <Skeleton variant="rounded" width="100%" height={height} sx={{ borderRadius: '12px' }} />
  </Box>
);
