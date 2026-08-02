import { Routes, Route } from "react-router-dom";
import { SimulatorPage } from "./pages/SimulatorPage";
import { EditorPage } from "./pages/EditorPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LearnPage } from "./pages/LearnPage";
import { AboutPage } from "./pages/AboutPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { VerifiedDipolePage } from "./pages/VerifiedDipolePage";
import { DipoleHeightLabPage } from "./pages/DipoleHeightLabPage";
import { AntennaTemplateStudioPage } from "./pages/AntennaTemplateStudioPage";
import { VerticalAntennasPage } from "./pages/VerticalAntennasPage";
import { YagiBeamModelsPage } from "./pages/YagiBeamModelsPage";
import { LoopAndHexbeamModelsPage } from "./pages/LoopAndHexbeamModelsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SimulatorPage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/verified-dipole" element={<VerifiedDipolePage />} />
      <Route path="/dipole-height-lab" element={<DipoleHeightLabPage />} />
      <Route path="/antenna-templates" element={<AntennaTemplateStudioPage />} />
      <Route path="/vertical-antennas" element={<VerticalAntennasPage />} />
      <Route path="/yagi-beams" element={<YagiBeamModelsPage />} />
      <Route path="/loop-and-hexbeam-models" element={<LoopAndHexbeamModelsPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
