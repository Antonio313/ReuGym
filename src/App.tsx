import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import Home from '@/pages/Home';
import WorkoutActive from '@/pages/WorkoutActive';
import WorkoutHistory from '@/pages/WorkoutHistory';
import ExerciseDetail from '@/pages/ExerciseDetail';
import BodyStats from '@/pages/BodyStats';
import StyleGuide from '@/pages/StyleGuide';
import TemplateEditor from '@/pages/TemplateEditor';

function AppRoutes() {
  const location = useLocation();
  const isWorkoutActive =
    location.pathname.startsWith('/workout/') ||
    location.pathname.startsWith('/template/');

  return (
    <>
      <Routes>
        <Route path="/"                       element={<Home />} />
        <Route path="/workout/:templateId"    element={<WorkoutActive />} />
        <Route path="/history"                element={<WorkoutHistory />} />
        <Route path="/exercise/:exerciseId"   element={<ExerciseDetail />} />
        <Route path="/stats"                  element={<BodyStats />} />
        <Route path="/style"                  element={<StyleGuide />} />
        <Route path="/template/:id/edit"      element={<TemplateEditor />} />
      </Routes>
      {!isWorkoutActive && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
