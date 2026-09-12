import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

/**
 * Berry Page Template - Use this as a starting point for new pages
 * 
 * This template follows the Berry Free React Admin Template design system
 * and uses Material-UI components with the Berry theme.
 */
const BerryPageTemplate: React.FC = () => {
  return (
    <>
      <Box>
        {/* Page Header */}
        <Box mb={3}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Page Title
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Page description or subtitle
          </Typography>
        </Box>

        {/* Page Content */}
        <Card>
          <CardContent>
            <Typography variant="body1">
              Your page content goes here. Use Material-UI components like:
              <ul>
                <li>Box - for layout containers</li>
                <li>Grid - for responsive grid layouts</li>
                <li>Card - for content sections</li>
                <li>TextField - for form inputs</li>
                <li>Button - for actions</li>
                <li>Typography - for text</li>
              </ul>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </>
  );
};

export default BerryPageTemplate;
