import React, { useContext, useState } from 'react';
import { DataContext } from '../context/DataContext';
import KPISection from './KPIs/KPISection';
import ChartSection from './Charts/ChartSection';
import ImprovedLineChart from './Charts/LineChart';
import DataTable from './Tables/DataTable';
import InteractiveTimeSeries from './Advanced/InteractiveTimeSeries';
import MicroMacroVisualization from './Advanced/MicroMacroVisualization';
import PatternRecognition from './Advanced/PatternRecognition';
import { FiZap, FiTrendingUp, FiLayers, FiEdit3 } from 'react-icons/fi';

const EnhancedDashboardView = () => {
  const { data } = useContext(DataContext);
  const [activeTab1, setActiveTab1] = useState('monthly');
  const [activeTab2, setActiveTab2] = useState('categories');
  const [activeTab3, setActiveTab3] = useState('geo');
  const [activeAdvancedTab, setActiveAdvancedTab] = useState('interactive');
  const [scenarioData, setScenarioData] = useState(null);
  
  // Handle scenario changes from Interactive Time Series
  const handleScenarioChange = (newScenarioData) => {
    setScenarioData(newScenarioData);
    // You could also save scenarios to localStorage or pass to parent components
  };
  
  return (
    <div className="space-y-6">
      {/* First Row: KPI Cards */}
      <div className="w-full">
        <KPISection data={data} />
      </div>
      
      {/* Advanced Features Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
        <div className="flex items-center mb-4">
          <FiZap className="text-indigo-500 mr-2" size={20} />
          <h2 className="text-lg font-medium text-indigo-800">Advanced Analytics Tools</h2>
        </div>
        
        {/* Tabs for Advanced Features */}
        <div className="flex border-b border-indigo-200 mb-4">
          <button
            className={`flex items-center py-2 px-4 ${
              activeAdvancedTab === 'interactive' 
                ? 'border-b-2 border-indigo-500 text-indigo-700' 
                : 'text-gray-600 hover:text-indigo-600'
            }`}
            onClick={() => setActiveAdvancedTab('interactive')}
          >
            <FiTrendingUp className="mr-2" />
            Data Sculpting
          </button>
          <button
            className={`flex items-center py-2 px-4 ${
              activeAdvancedTab === 'micro-macro' 
                ? 'border-b-2 border-indigo-500 text-indigo-700' 
                : 'text-gray-600 hover:text-indigo-600'
            }`}
            onClick={() => setActiveAdvancedTab('micro-macro')}
          >
            <FiLayers className="mr-2" />
            Context Transitions
          </button>
          <button
            className={`flex items-center py-2 px-4 ${
              activeAdvancedTab === 'pattern' 
                ? 'border-b-2 border-indigo-500 text-indigo-700' 
                : 'text-gray-600 hover:text-indigo-600'
            }`}
            onClick={() => setActiveAdvancedTab('pattern')}
          >
            <FiEdit3 className="mr-2" />
            Pattern Recognition
          </button>
        </div>
        
        {/* Interactive Data Sculpting */}
        {activeAdvancedTab === 'interactive' && (
          <div className="bg-white rounded-lg p-4 shadow-inner">
            <h3 className="text-lg font-medium mb-2">Interactive Data Sculpting</h3>
            <p className="text-sm text-gray-600 mb-4">
              Reshape future projections by dragging data points and see the impact in real-time.
              Create and save "what-if" scenarios to compare different business outcomes.
            </p>
            <div className="border rounded-lg p-4 bg-white">
              <InteractiveTimeSeries 
                data={data} 
                timeFrame="monthly" 
                onScenarioChange={handleScenarioChange}
              />
            </div>
          </div>
        )}
        
        {/* Contextual Micro/Macro Transitions */}
        {activeAdvancedTab === 'micro-macro' && (
          <div className="bg-white rounded-lg p-4 shadow-inner">
            <h3 className="text-lg font-medium mb-2">Contextual Micro/Macro Transitions</h3>
            <p className="text-sm text-gray-600 mb-4">
              Seamlessly navigate between high-level overviews and detailed insights with adaptive
              visualization types that provide the right context at each level.
            </p>
            <div className="border rounded-lg p-4 bg-white">
              <MicroMacroVisualization data={data} />
            </div>
          </div>
        )}
        
        {/* Gestural Pattern Recognition */}
        {activeAdvancedTab === 'pattern' && (
          <div className="bg-white rounded-lg p-4 shadow-inner">
            <h3 className="text-lg font-medium mb-2">Gestural Pattern Recognition</h3>
            <p className="text-sm text-gray-600 mb-4">
              Draw a trend pattern with your mouse or finger to instantly discover products
              that match the pattern. Find growth opportunities or identify struggling products.
            </p>
            <div className="border rounded-lg p-4 bg-white">
              <PatternRecognition data={data} />
            </div>
          </div>
        )}
      </div>
      
      {/* Second Row: Line Chart (Full Width) */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b">
          <button
            className={`py-3 px-6 ${activeTab1 === 'monthly' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab1('monthly')}
          >
            Monthly Trends
          </button>
          <button
            className={`py-3 px-6 ${activeTab1 === 'weekly' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab1('weekly')}
          >
            Weekly Details
          </button>
        </div>
        <div className="p-4 h-80">
          <ImprovedLineChart data={data} timeFrame={activeTab1} />
        </div>
      </div>
      
      {/* Third Row: Bar Chart and Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            <button
              className={`py-3 px-6 ${activeTab2 === 'categories' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab2('categories')}
            >
              By Category
            </button>
            <button
              className={`py-3 px-6 ${activeTab2 === 'products' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab2('products')}
            >
              Top Products
            </button>
          </div>
          <div className="p-4 h-80">
            <ChartSection.BarChart data={data} type={activeTab2} />
          </div>
        </div>
        
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-medium mb-4">Category Distribution</h2>
          <div className="h-80">
            <ChartSection.PieChart data={data} />
          </div>
        </div>
      </div>
      
      {/* Fourth Row: Geographic/Network/Hierarchy Visualization (Full Width) */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b">
          <button
            className={`py-3 px-6 ${activeTab3 === 'geo' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab3('geo')}
          >
            Geographic
          </button>
          <button
            className={`py-3 px-6 ${activeTab3 === 'network' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab3('network')}
          >
            Network
          </button>
          <button
            className={`py-3 px-6 ${activeTab3 === 'sunburst' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab3('sunburst')}
          >
            Hierarchy
          </button>
        </div>
        <div className="p-4 h-[420px]"> {/* Taller height for complex visualizations */}
          {activeTab3 === 'geo' && <ChartSection.GeoMap data={data} />}
          {activeTab3 === 'network' && <ChartSection.ForceGraph data={data} />}
          {activeTab3 === 'sunburst' && <ChartSection.SunburstChart data={data} />}
        </div>
      </div>
      
      {/* Fifth Row: Data Table */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-medium mb-4">Recent Orders</h2>
        <DataTable data={data} />
      </div>
    </div>
  );
};

export default EnhancedDashboardView;