import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_REPORTS_KEY = 'savedRestaurantReports';

// Save a restaurant analysis report
const saveRestaurantReport = async (reportData) => {
  try {
    const existingReports = await getSavedReports();
    
    const report = {
      id: `${reportData.restaurant.id}_${Date.now()}`, // Unique ID for the saved report
      restaurantId: reportData.restaurant.id,
      restaurant: reportData.restaurant,
      analysis: reportData.analysis,
      vegCriteria: reportData.vegCriteria,
      savedAt: reportData.savedAt || new Date().toISOString(),
      meetsVegCriteria: reportData.analysis ? determineIfMeetsCriteria(reportData.analysis, reportData.vegCriteria) : false
    };
    
    // Remove any existing report for the same restaurant
    const filteredReports = existingReports.filter(r => r.restaurantId !== reportData.restaurant.id);
    
    // Add the new report
    const updatedReports = [report, ...filteredReports];
    
    await AsyncStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(updatedReports));
    return report;
  } catch (error) {
    console.error('Error saving restaurant report:', error);
    throw error;
  }
};

// Get all saved reports
const getSavedReports = async () => {
  try {
    const reportsJson = await AsyncStorage.getItem(SAVED_REPORTS_KEY);
    return reportsJson ? JSON.parse(reportsJson) : [];
  } catch (error) {
    console.error('Error loading saved reports:', error);
    return [];
  }
};

// Remove a saved report
const removeSavedReport = async (reportId) => {
  try {
    const existingReports = await getSavedReports();
    const filteredReports = existingReports.filter(r => r.id !== reportId);
    await AsyncStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(filteredReports));
  } catch (error) {
    console.error('Error removing saved report:', error);
    throw error;
  }
};

// Remove report by restaurant ID
const removeSavedReportByRestaurant = async (restaurantId) => {
  try {
    const existingReports = await getSavedReports();
    const filteredReports = existingReports.filter(r => r.restaurantId !== restaurantId);
    await AsyncStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(filteredReports));
  } catch (error) {
    console.error('Error removing saved report by restaurant:', error);
    throw error;
  }
};

// Check if a restaurant has a saved report
const hasSavedReport = async (restaurantId) => {
  try {
    const reports = await getSavedReports();
    return reports.some(r => r.restaurantId === restaurantId);
  } catch (error) {
    console.error('Error checking saved report:', error);
    return false;
  }
};

// Get a specific saved report by restaurant ID
const getSavedReportByRestaurant = async (restaurantId) => {
  try {
    const reports = await getSavedReports();
    return reports.find(r => r.restaurantId === restaurantId);
  } catch (error) {
    console.error('Error getting saved report by restaurant:', error);
    return null;
  }
};

// Clear all saved reports
const clearAllSavedReports = async () => {
  try {
    await AsyncStorage.removeItem(SAVED_REPORTS_KEY);
  } catch (error) {
    console.error('Error clearing all saved reports:', error);
    throw error;
  }
};

// Helper function to determine if analysis meets criteria
const determineIfMeetsCriteria = (analysis, criteria) => {
  if (!analysis || !analysis.vegFriendliness) return false;
  
  const criteriaMap = {
    poor: ['poor', 'fair', 'good', 'excellent'],
    fair: ['fair', 'good', 'excellent'],
    good: ['good', 'excellent'],
    excellent: ['excellent']
  };
  
  return criteriaMap[criteria]?.includes(analysis.vegFriendliness) || false;
};

// Export as default object with all functions
export default {
  saveRestaurantReport,
  getSavedReports,
  removeSavedReport,
  removeSavedReportByRestaurant,
  hasSavedReport,
  getSavedReportByRestaurant,
  clearAllSavedReports
};
