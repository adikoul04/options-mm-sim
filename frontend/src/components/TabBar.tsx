import { useSimulationStore, type TabId } from '../store/simulationStore';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'chain', label: 'Chain' },
  { id: 'quotes', label: 'Quotes' },
];

export function TabBar() {
  const activeTab = useSimulationStore((s) => s.activeTab);
  const setActiveTab = useSimulationStore((s) => s.setActiveTab);

  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
