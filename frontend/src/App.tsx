import { Sidebar } from './components/Sidebar';
import { SpotPanel } from './components/SpotPanel';
import { StatusBar } from './components/StatusBar';
import { TabBar } from './components/TabBar';
import { useSimulationLoop } from './hooks/useSimulationLoop';
import { useSimulationStore } from './store/simulationStore';
import { ChainTab } from './tabs/ChainTab';
import { QuotesTab } from './tabs/QuotesTab';

function MainContent() {
  const activeTab = useSimulationStore((s) => s.activeTab);

  return (
    <>
      {activeTab === 'chain' && <ChainTab />}
      {activeTab === 'quotes' && <QuotesTab />}
    </>
  );
}

export default function App() {
  useSimulationLoop();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <StatusBar />
        <div className="spot-tab-bar">
          <SpotPanel />
          <TabBar />
        </div>
        <div className="main-content">
          <MainContent />
        </div>
      </main>
    </div>
  );
}
