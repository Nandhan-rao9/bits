import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Make sure this is the default export
export const NutritionRiskAssessment = () => {
  const [nutritionData, setNutritionData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [foodSources, setFoodSources] = useState(null);

  // Fetch nutrition data from backend on component mount
  useEffect(() => {
    fetchNutritionData();
  }, []);

  // Fetch user's nutrition data from MongoDB
  const fetchNutritionData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/getnutrition');
      if (response.data && response.data.length > 0) {
        setNutritionData(response.data[0]);
        // Once we have the nutrition data, run the prediction
        await runPrediction(response.data[0]);
      } else {
        setError('No nutrition data available. Please add some food items first.');
      }
    } catch (err) {
      setError(`Error fetching nutrition data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Run ML prediction using the backend predict endpoint
  const runPrediction = async (data) => {
    try {
      setIsLoading(true);
      // Format the data as expected by the backend
      const formattedData = {
        nutrition_data: [formatNutritionData(data)]
      };

      const response = await axios.post('http://localhost:8000/predict', formattedData);
      
      if (response.data) {
        setPredictions(response.data.predictions);
        setRecommendations(response.data.recommendations);
        setFoodSources(response.data.food_sources);
      }
    } catch (err) {
      setError(`Error running prediction: ${err.message}`);
      console.error("Prediction error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Format nutrition data for the prediction API
  const formatNutritionData = (data) => {
    // Convert the total nutrients object to the format expected by the ML model
    const formattedData = {};
    
    // Map the keys from the total nutrients to the format expected by the backend
    Object.entries(data).forEach(([key, value]) => {
      // Handle nested objects like vitamins and minerals
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          formattedData[`${key}_${subKey}`] = subValue;
        });
      } else {
        formattedData[key] = value;
      }
    });
    
    return formattedData;
  };

  // Format risk level based on percentage
  const getRiskLevel = (percentage) => {
    if (percentage >= 70) return { level: 'High', color: '#dc2626' };
    if (percentage >= 30) return { level: 'Moderate', color: '#ca8a04' };
    return { level: 'Low', color: '#16a34a' };
  };

  // Refresh data and predictions
  const handleRefresh = () => {
    fetchNutritionData();
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Nutrition Risk Assessment</h1>
        <div style={{ fontSize: '18px', marginTop: '48px' }}>
          <p>Analyzing your nutrition data and generating risk assessment...</p>
          <div style={{ 
            display: 'inline-block',
            width: '50px',
            height: '50px',
            border: '5px solid #e2e8f0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginTop: '24px'
          }}></div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Nutrition Risk Assessment</h1>
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', borderRadius: '8px', color: '#b91c1c' }}>
          <p>{error}</p>
          <button 
            onClick={handleRefresh}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '16px'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>AI-Powered Nutrition Risk Assessment</h1>
        <button 
          onClick={handleRefresh}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Nutrition Data Overview */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '32px', padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Your Current Nutrition Profile</h2>
          <p style={{ color: '#6b7280' }}>Based on your recent food intake</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {nutritionData && Object.entries(nutritionData)
            .filter(([key, value]) => typeof value !== 'object' && !key.includes('total') && !key.includes('timestamp'))
            .map(([nutrient, value]) => (
              <div key={nutrient} style={{ padding: '12px', backgroundColor: 'black', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', textTransform: 'capitalize', marginBottom: '4px' }}>
                  {nutrient.replace(/_/g, ' ')}
                </h3>
                <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{typeof value === 'number' ? value.toFixed(2) : value}</p>
              </div>
            ))}

          {/* Show vitamins if available */}
          {nutritionData.vitamins && Object.entries(nutritionData.vitamins).map(([vitamin, value]) => (
            <div key={`vitamin_${vitamin}`} style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', textTransform: 'capitalize', marginBottom: '4px' }}>
                Vitamin {vitamin}
              </h3>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{typeof value === 'number' ? value.toFixed(2) : value}</p>
            </div>
          ))}

          {/* Show minerals if available */}
          {nutritionData.minerals && Object.entries(nutritionData.minerals).map(([mineral, value]) => (
            <div key={`mineral_${mineral}`} style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', textTransform: 'capitalize', marginBottom: '4px' }}>
                {mineral}
              </h3>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{typeof value === 'number' ? value.toFixed(2) : value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Disease Risk Assessment */}
      {predictions && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Neural Network Disease Risk Assessment</h2>
            <p style={{ color: '#6b7280' }}>Based on your nutrition profile analyzed with our AI models</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {predictions.map((prediction) => 
              Object.entries(prediction).map(([disease, risk]) => {
                const riskValue = typeof risk === 'string' ? parseFloat(risk) : risk;
                const { level, color } = getRiskLevel(riskValue);
                return (
                  <div key={disease} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {disease.replace(/_/g, ' ')}
                    </h3>
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '10px' }}>
                        <div
                          style={{ 
                            backgroundColor: color, 
                            height: '10px', 
                            borderRadius: '9999px',
                            width: `${Math.min(riskValue, 100)}%` 
                          }}
                        ></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span>{riskValue.toFixed(1)}%</span>
                        <span style={{ color }}>
                          {level} Risk
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Personalized Recommendations */}
      {recommendations && Object.keys(recommendations).length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>AI-Enhanced Personalized Nutrition Recommendations</h2>
            <p style={{ color: '#6b7280' }}>Nutrients to optimize for better health outcomes</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {Object.entries(recommendations)
              .sort((a, b) => b[1].importance - a[1].importance)
              .map(([nutrient, data]) => (
                <div key={nutrient} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '500', textTransform: 'capitalize', marginBottom: '8px' }}>
                    {nutrient.replace(/_/g, ' ')}
                    <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6b7280', marginLeft: '8px' }}>
                      (Impact Score: {data.importance.toFixed(2)})
                    </span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <p><strong>Current intake:</strong> {data.current.toFixed(2)}</p>
                      <p><strong>Target intake:</strong> {data.target.toFixed(2)}</p>
                      <p><strong>Gap:</strong> {(data.target - data.current).toFixed(2)}</p>
                      <p><strong>Related conditions:</strong> {data.diseases.join(', ')}</p>
                    </div>
                    <div>
                      {foodSources && foodSources[nutrient] && (
                        <div>
                          <p style={{ fontWeight: '500' }}>Recommended food sources:</p>
                          <p>{foodSources[nutrient]}</p>
                          <p style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic', color: '#6b7280' }}>
                            Adding 2-3 servings of these foods daily can help reach your target.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress bar showing current vs target */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '10px', position: 'relative' }}>
                        <div
                          style={{ 
                            backgroundColor: '#3b82f6', 
                            height: '10px', 
                            borderRadius: '9999px',
                            width: `${Math.min((data.current / data.target) * 100, 100)}%` 
                          }}
                        ></div>
                        <div 
                          style={{
                            position: 'absolute',
                            top: '-5px',
                            left: `${Math.min((data.current / data.target) * 100, 100)}%`,
                            height: '20px',
                            width: '2px',
                            backgroundColor: '#3b82f6',
                          }}
                        ></div>
                      </div>
                      <span style={{ minWidth: '60px', textAlign: 'right' }}>{Math.round((data.current / data.target) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionRiskAssessment;