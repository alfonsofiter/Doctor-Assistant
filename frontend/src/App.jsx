import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Consultation from './pages/Consultation';
import SOAPResult from './pages/SOAPResult';
import History from './pages/History';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/consultation" element={<Consultation />} />
        <Route path="/soap-result" element={<SOAPResult />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
