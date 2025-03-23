import React, { useState } from "react";
import { motion } from "framer-motion";
import { Camera, AlertTriangle, Check, Info, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";

export const FoodIngredientAnalyzer = () => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setAnalysisResults(null);
      setError(null);
    }
  };

  const analyzeIngredients = async () => {
    if (!image) {
      setError("Please upload an image first");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const response = await axios.post("http://localhost:8000/analyze-ingredients", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setAnalysisResults(response.data);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const errorMessage = errorData.error || "Error analyzing image. Please try again.";
      const rawResponse = errorData.raw_response ? `\nRaw response: ${errorData.raw_response}` : "";
      setError(`${errorMessage}${rawResponse}`);
      console.error("Analysis error details:", err.response?.data || err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low":
        return "text-green-500";
      case "moderate":
        return "text-orange-500";
      case "high":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const IngredientDetails = ({ ingredient, titlePrefix = "📌" }: { ingredient: any; titlePrefix?: string }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <div className="mb-3 bg-gray-800 rounded-lg p-3">
        <div 
          className="flex justify-between items-center cursor-pointer" 
          onClick={() => setExpanded(!expanded)}
        >
          <h4 className="font-medium text-white">
            {titlePrefix} {ingredient.name}
          </h4>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        {expanded && (
          <div className="mt-2 text-gray-300 text-sm">
            {ingredient.code && (
              <p className="mb-2"><span className="text-gray-400">Code:</span> {ingredient.code}</p>
            )}
            
            <h5 className="font-medium mb-1 text-gray-200">⚕ Health Effects</h5>
            <p className="mb-2">{ingredient.effects || "No effects provided"}</p>
            
            <h5 className="font-medium mb-1 text-gray-200">🚫 Banned in Countries</h5>
            <p className="mb-2">
              {ingredient.banned_countries && ingredient.banned_countries.length > 0 
                ? ingredient.banned_countries.join(", ") 
                : "No known bans reported"}
            </p>
            
            {ingredient.usage_restrictions && (
              <>
                <h5 className="font-medium mb-1 text-gray-200">⚠ Usage Restrictions</h5>
                <p>{ingredient.usage_restrictions}</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 max-w-6xl mx-auto px-4"
    >
      <motion.h1
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold mb-6 flex items-center"
      >
        <span className="mr-2">🔍</span> Food Ingredient Analyzer
      </motion.h1>
      
      <p className="text-gray-300 mb-6">
        Upload an image of food ingredients to analyze harmful chemicals and additives
      </p>

      <div className="mb-8">
        <label className="block mb-2 font-medium">Upload ingredient list image</label>
        <div className="flex items-center space-x-4">
          <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Camera className="w-8 h-8 mb-2 text-gray-400" />
              <p className="mb-2 text-sm text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PNG, JPG or JPEG</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept="image/png, image/jpeg, image/jpg" 
              onChange={handleImageChange} 
            />
          </label>
          
          {imagePreview && (
            <div className="relative w-32 h-32 border border-gray-700 rounded-lg overflow-hidden">
              <img 
                src={imagePreview} 
                alt="Ingredient list preview" 
                className="w-full h-full object-cover" 
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-start mb-8">
        <button
          onClick={analyzeIngredients}
          disabled={isAnalyzing || !image}
          className={`flex items-center justify-center px-6 py-3 font-medium rounded-lg text-white transition-colors ${
            isAnalyzing || !image
              ? "bg-gray-700 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Analyze Ingredients"
          )}
        </button>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 whitespace-pre-wrap">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 mt-0.5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {analysisResults && Object.keys(analysisResults).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Harmful Ingredients */}
            <div className="bg-gray-900 rounded-lg p-5">
              <h2 className="text-xl font-semibold mb-4">⚠ Harmful Ingredients</h2>
              {analysisResults.harmful_ingredients && analysisResults.harmful_ingredients.length > 0 ? (
                analysisResults.harmful_ingredients.map((ingredient: any, index: number) => (
                  <IngredientDetails key={`harmful-${index}`} ingredient={ingredient} />
                ))
              ) : (
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-green-200 flex items-center">
                  <Check className="w-5 h-5 mr-2" />
                  No harmful ingredients detected
                </div>
              )}
            </div>

            {/* Artificial Flavors */}
            <div className="bg-gray-900 rounded-lg p-5">
              <h2 className="text-xl font-semibold mb-4">🌈 Artificial Flavors</h2>
              {analysisResults.artificial_flavors && analysisResults.artificial_flavors.length > 0 ? (
                analysisResults.artificial_flavors.map((flavor: any, index: number) => (
                  <IngredientDetails key={`flavor-${index}`} ingredient={flavor} />
                ))
              ) : (
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-blue-200 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  No artificial flavors detected
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Artificial Additives */}
            <div className="bg-gray-900 rounded-lg p-5">
              <h2 className="text-xl font-semibold mb-4">🧪 Artificial Additives</h2>
              {analysisResults.artificial_additives ? (
                <div className="space-y-4">
                  {/* Emulsifiers */}
                  {analysisResults.artificial_additives.emulsifiers && analysisResults.artificial_additives.emulsifiers.length > 0 && (
                    <div>
                      <h3 className="font-medium text-lg mb-2">Emulsifiers</h3>
                      {analysisResults.artificial_additives.emulsifiers.map((emulsifier: any, index: number) => (
                        <IngredientDetails 
                          key={`emulsifier-${index}`} 
                          ingredient={emulsifier} 
                          titlePrefix="🔹" 
                        />
                      ))}
                    </div>
                  )}

                  {/* Glazing Agents */}
                  {analysisResults.artificial_additives.glazing_agents && analysisResults.artificial_additives.glazing_agents.length > 0 && (
                    <div>
                      <h3 className="font-medium text-lg mb-2">Glazing Agents</h3>
                      {analysisResults.artificial_additives.glazing_agents.map((agent: any, index: number) => (
                        <IngredientDetails 
                          key={`agent-${index}`} 
                          ingredient={agent} 
                          titlePrefix="🔹" 
                        />
                      ))}
                    </div>
                  )}

                  {/* Colors */}
                  {analysisResults.artificial_additives.colors && analysisResults.artificial_additives.colors.length > 0 && (
                    <div>
                      <h3 className="font-medium text-lg mb-2">Colors</h3>
                      {analysisResults.artificial_additives.colors.map((color: any, index: number) => (
                        <IngredientDetails 
                          key={`color-${index}`} 
                          ingredient={color} 
                          titlePrefix="🔹" 
                        />
                      ))}
                    </div>
                  )}

                  {/* Other */}
                  {analysisResults.artificial_additives.other && analysisResults.artificial_additives.other.length > 0 && (
                    <div>
                      <h3 className="font-medium text-lg mb-2">Other Additives</h3>
                      {analysisResults.artificial_additives.other.map((additive: any, index: number) => (
                        <IngredientDetails 
                          key={`other-${index}`} 
                          ingredient={additive} 
                          titlePrefix="🔹" 
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-blue-200 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  No artificial additives detected
                </div>
              )}
            </div>

            {/* Preservatives */}
            <div className="bg-gray-900 rounded-lg p-5">
              <h2 className="text-xl font-semibold mb-4">🔒 Preservatives</h2>
              {analysisResults.preservatives && analysisResults.preservatives.length > 0 ? (
                analysisResults.preservatives.map((preservative: any, index: number) => (
                  <IngredientDetails key={`preservative-${index}`} ingredient={preservative} />
                ))
              ) : (
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-blue-200 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  No preservatives detected
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overall Assessment */}
      {analysisResults && analysisResults.overall_assessment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-gray-900 rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4">📊 Overall Assessment</h2>
          
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <h3 className="font-medium">Risk Level:</h3>
              <span className={`ml-2 font-bold ${getRiskLevelColor(analysisResults.overall_assessment.risk_level)}`}>
                {analysisResults.overall_assessment.risk_level.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">Summary</h3>
            <p className="text-gray-300">{analysisResults.overall_assessment.summary || "No summary provided"}</p>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Recommendations</h3>
            <ul className="list-disc list-inside text-gray-300">
              {analysisResults.overall_assessment.recommendations && analysisResults.overall_assessment.recommendations.length > 0 ? (
                analysisResults.overall_assessment.recommendations.map((rec: string, index: number) => (
                  <li key={`rec-${index}`}>{rec}</li>
                ))
              ) : (
                <li>No specific recommendations provided</li>
              )}
            </ul>
          </div>
        </motion.div>
      )}

      {/* About sidebar content (added as accordion for mobile) */}
      <div className="mt-10 bg-gray-900 rounded-lg p-6">
        <details className="group">
          <summary className="cursor-pointer list-none flex justify-between items-center">
            <h3 className="text-xl font-semibold">About this Analyzer</h3>
            <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-4 text-gray-300 space-y-4">
            <p>
              This app analyzes food ingredient lists to identify:
            </p>
            <ul className="list-disc list-inside">
              <li>Harmful chemicals and their effects</li>
              <li>Detailed analysis of additives and preservatives</li>
              <li>Countries where ingredients are banned</li>
              <li>Usage restrictions in food items</li>
              <li>Overall safety assessment and recommendations</li>
            </ul>
            
            <h4 className="font-medium text-lg">How to Use</h4>
            <ol className="list-decimal list-inside">
              <li>Upload a clear image of the ingredient list</li>
              <li>Click 'Analyze Ingredients'</li>
              <li>Review the detailed analysis</li>
              <li>Check recommendations for safer alternatives</li>
            </ol>
          </div>
        </details>
      </div>
    </motion.div>
  );
};

export default FoodIngredientAnalyzer;