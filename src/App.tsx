import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SpeakerPage from "./pages/SpeakerPage";
import ListenerPage from "./pages/ListenerPage";
import LanguageDetectionPage from './pages/test'; 
import './assets/styles.css';


function App() {
    return (
        <Router>
            <Routes>
                <Route path="/test" element={<LanguageDetectionPage />} />
                <Route path="/speaker/:sessionId" element={<SpeakerPage />} />
                <Route path="/listen/:sessionId" element={<ListenerPage />} />
            </Routes>
        </Router>
    );
}

export default App;
