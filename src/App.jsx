import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import MainLayout from './components/Layout/MainLayout';
//import DashboardView from './components/DashboardView';
import EnhancedDashboardView from './components/EnhancedDashboardView';
import { DataContext } from './context/DataContext';
import { FilterContext } from './context/FilterContext';

// Initial filter state - set to 2017 data by default
const initialFilters = {
  dateRange: {
    startDate: new Date('2017-01-01'), // Start of 2017
    endDate: new Date('2017-12-31')    // End of 2017
  },
  regions: [],
  countries: [],
  categories: [],
  statuses: []
};

function App() {
  // Main data state
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState(initialFilters);
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Memoized filtered data to prevent unnecessary recalculations
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    return data.filter(row => {
      // Date range filter
      const orderDate = row.OrderDate;
      const inDateRange = !orderDate || 
        (orderDate >= filters.dateRange.startDate && 
         orderDate <= filters.dateRange.endDate);
      
      // Region filter
      const inRegion = !filters.regions.length || 
        filters.regions.includes(row.RegionName);
      
      // Country filter
      const inCountry = !filters.countries.length || 
        filters.countries.includes(row.CountryName);
      
      // Category filter
      const inCategory = !filters.categories.length || 
        filters.categories.includes(row.CategoryName);
      
      // Status filter
      const inStatus = !filters.statuses.length || 
        filters.statuses.includes(row.Status);
      
      return inDateRange && inRegion && inCountry && inCategory && inStatus;
    });
  }, [data, filters]);

  // Memoized filter options to prevent recalculation on every render
  const filterOptions = useMemo(() => {
    if (!data.length) return {};
    
    return {
      regions: [...new Set(data.map(row => row.RegionName))].filter(Boolean),
      countries: [...new Set(data.map(row => row.CountryName))].filter(Boolean),
      categories: [...new Set(data.map(row => row.CategoryName))].filter(Boolean),
      statuses: [...new Set(data.map(row => row.Status))].filter(Boolean)
    };
  }, [data]);

  // Filter update handler
  const updateFilter = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters(initialFilters);
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Load data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Try to fetch real data
        try {
          const response = await fetch('/MLDataset.csv');
          const csvText = await response.text();
          
          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              // Process the data
              const processedData = results.data.map(row => ({
                ...row,
                OrderDate: row.OrderDate ? new Date(row.OrderDate) : null,
                EmployeeHireDate: row.EmployeeHireDate ? new Date(row.EmployeeHireDate) : null,
                // Calculate total amount for convenience
                TotalAmount: (row.OrderItemQuantity || 0) * (row.PerUnitPrice || 0)
              }));
              
              setData(processedData);
              setIsLoading(false);
            },
            error: (error) => {
              console.error("CSV parsing error:", error);
              throw new Error('Failed to parse CSV data');
            }
          });
        } catch (fileError) {
          console.warn('Could not load CSV file, using mock data:', fileError);
          
          // Use mock data as fallback
          setData(getMockData());
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Data fetching error:', error);
        setError("Failed to load data");
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Mock data generator (kept from previous implementation)
  function getMockData() {
    // Generate a series of dates from the historical dataset timeframe
    const generateDates = () => {
      const dates = [];
      for (let year = 2015; year <= 2017; year++) {
        for (let month = 1; month <= 12; month++) {
          dates.push(new Date(year, month - 1, 15)); // 15th of each month
        }
      }
      return dates;
    };
    
    const dates = generateDates();
    const regions = ["North America", "Europe", "Asia", "South America", "Australia"];
    const countries = {
      "North America": ["United States", "Canada", "Mexico"],
      "Europe": ["Germany", "France", "United Kingdom", "Italy"],
      "Asia": ["Japan", "China", "India", "Singapore"],
      "South America": ["Brazil", "Argentina", "Colombia"],
      "Australia": ["Australia", "New Zealand"]
    };
    const categories = ["Electronics", "Furniture", "Office Supplies", "Clothing", "Food"];
    const products = {
      "Electronics": ["Laptop", "Smartphone", "Tablet", "Monitor", "Printer"],
      "Furniture": ["Office Chair", "Desk", "Bookshelf", "Filing Cabinet", "Sofa"],
      "Office Supplies": ["Paper", "Pens", "Stapler", "Notebooks", "Binders"],
      "Clothing": ["T-Shirts", "Pants", "Jackets", "Shoes", "Accessories"],
      "Food": ["Coffee", "Snacks", "Beverages", "Fruit", "Meals"]
    };
    const statuses = ["Shipped", "Pending", "Delivered", "Canceled", "Processing"];
    
    // Generate 100 random sales records
    return Array.from({ length: 100 }, (_, index) => {
      const region = regions[Math.floor(Math.random() * regions.length)];
      const country = countries[region][Math.floor(Math.random() * countries[region].length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const product = products[category][Math.floor(Math.random() * products[category].length)];
      const quantity = Math.floor(Math.random() * 20) + 1;
      const price = Math.floor(Math.random() * 1000) + 50;
      const total = quantity * price;
      const profit = Math.floor(total * (Math.random() * 0.3 + 0.1)); // 10-40% profit margin
      const orderDate = dates[Math.floor(Math.random() * dates.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      return {
        RegionName: region,
        CountryName: country,
        State: `State ${index % 10}`,
        City: `City ${index % 20}`,
        CategoryName: category,
        ProductName: product,
        OrderDate: orderDate,
        OrderItemQuantity: quantity,
        PerUnitPrice: price,
        TotalAmount: total,
        Profit: profit,
        Status: status,
        CustomerName: `Customer ${index % 30}`,
        EmployeeName: `Employee ${index % 15}`
      };
    });
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading dashboard data...</div>
      </div>
    );
  }


  // Render dashboard
  return (
    <DataContext.Provider value={{ data: filteredData, allData: data }}>
      <FilterContext.Provider value={{ 
        filters, 
        updateFilter, 
        resetFilters, 
        filterOptions 
      }}>
        <MainLayout 
          sidebarOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
        >
          <EnhancedDashboardView />
        </MainLayout>
      </FilterContext.Provider>
    </DataContext.Provider>
  );
}

export default App;