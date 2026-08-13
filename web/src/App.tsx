import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import TopologyGraph from './components/topology/TopologyGraph';
import LogViewer from './components/logs/LogViewer';
import DiagnosticWizard from './components/diagnostic/DiagnosticWizard';
import EventTimeline from './components/timeline/EventTimeline';
import ResourceList from './components/resources/ResourceList';
import ResourceDetail from './components/resources/ResourceDetail';
import MonitoringView from './components/monitoring/MonitoringView';
import CRDView from './components/crd/CRDView';
import AuditView from './components/audit/AuditView';
import { ClusterProvider } from './context/ClusterContext';

function App() {
  return (
    <ClusterProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/resources" replace />} />
          <Route path="topology" element={<TopologyGraph />} />
          <Route path="resources" element={<ResourceList />} />
          <Route path="resources/:kind/:namespace/:name" element={<ResourceDetail />} />
          <Route path="logs" element={<LogViewer />} />
          <Route path="events" element={<EventTimeline />} />
          <Route path="monitoring" element={<MonitoringView />} />
          <Route path="crds" element={<CRDView />} />
          <Route path="audit" element={<AuditView />} />
          <Route path="diagnostic" element={<DiagnosticWizard />} />
        </Route>
      </Routes>
    </ClusterProvider>
  );
}

export default App;
