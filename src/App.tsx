import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import Home from '@/pages/Home';
import WorkoutActive from '@/pages/WorkoutActive';
import WorkoutHistory from '@/pages/WorkoutHistory';
import ExerciseDetail from '@/pages/ExerciseDetail';
import ExerciseLibrary from '@/pages/ExerciseLibrary';
import BodyStats from '@/pages/BodyStats';
import StyleGuide from '@/pages/StyleGuide';
import TemplateEditor from '@/pages/TemplateEditor';
import CreateExercise from '@/pages/CreateExercise';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';

function StretchEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/exercise/${id}/edit`} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-dvh"
        style={{ background: 'var(--color-bg)' }}
      >
        <span className="font-display tracking-widest" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-faint)' }}>
          REUGYM
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<SignIn />} />
      </Routes>
    );
  }

  const isWorkoutActive =
    location.pathname.startsWith('/workout/') ||
    location.pathname.startsWith('/template/') ||
    location.pathname.startsWith('/exercise/new') ||
    location.pathname.startsWith('/stretch/') ||
    location.pathname.endsWith('/edit');

  return (
    <>
      <Routes>
        <Route path="/"                          element={<Home />} />
        <Route path="/workout/:templateId"       element={<WorkoutActive />} />
        <Route path="/history"                   element={<WorkoutHistory />} />
        <Route path="/exercises"                 element={<ExerciseLibrary />} />
        <Route path="/exercise/:exerciseId"      element={<ExerciseDetail />} />
        <Route path="/stats"                     element={<BodyStats />} />
        <Route path="/style"                     element={<StyleGuide />} />
        <Route path="/template/:id/edit"         element={<TemplateEditor />} />
        <Route path="/exercise/new"              element={<CreateExercise />} />
        <Route path="/exercise/:exerciseId/edit" element={<CreateExercise />} />
        <Route path="/stretch/new"               element={<Navigate to="/exercise/new?isStretch=true" replace />} />
        <Route path="/stretch/:id/edit"          element={<StretchEditRedirect />} />
        <Route path="/signin"                    element={<SignIn />} />
        <Route path="/signup"                    element={<SignUp />} />
      </Routes>
      {!isWorkoutActive && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
