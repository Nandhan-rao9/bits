import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Analysis } from "./pages/Analysis";
import { Profile } from "./pages/Profile";
import { Visualizations } from "./pages/Visualizations";
import { NutritionProvider } from "./context/NutritionContext";
import { NutritionRiskAssessment } from "./components/NutritionRiskAssessment"
import Chatbot from "./components/Chatbot";

function App() {
  return (
    <BrowserRouter>
      <NutritionProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Analysis />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/visualizations" element={<Visualizations />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chatbot" element={<Chatbot />}></Route>
            <Route path="/nutrition-risk" element={<NutritionRiskAssessment />}></Route>
          </Routes>
        </Layout>
      </NutritionProvider>
    </BrowserRouter>
  );
}

export default App;
