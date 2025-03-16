import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { FiZoomIn, FiZoomOut, FiRefreshCw, FiSave, FiBarChart2 } from 'react-icons/fi';

const InteractiveTimeSeries = ({ data, timeFrame = 'monthly', onScenarioChange }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // State for interactive modifications
  const [modifiedData, setModifiedData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [activeScenario, setActiveScenario] = useState(null);
  const [forecastEnabled, setForecastEnabled] = useState(true);
  
  // Configure which months are editable (future months)
  const editableFutureMonths = 6;
  
  // Set up dimensions when the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries.length) return;
      
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);
  
  // Process data for the line chart and add forecast
  const chartData = useMemo(() => {
    if (!data || !data.length) return { timeSeriesData: [], forecast: [] };
    
    // Group data by time period
    const timeSeriesData = {};
    const getTimeKey = (date) => {
      if (timeFrame === 'monthly') {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else {
        // Weekly timeframe
        const weekNumber = d3.timeWeek.count(d3.timeYear(date), date);
        return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
      }
    };
    
    // First, identify the valid date range in the data
    const validDates = data
      .filter(item => item.OrderDate instanceof Date && !isNaN(item.OrderDate))
      .map(item => item.OrderDate);
    
    if (validDates.length === 0) return { timeSeriesData: [], forecast: [] };
    
    // Sort dates and get min/max
    validDates.sort((a, b) => a - b);
    const minDate = validDates[0];
    const maxDate = validDates[validDates.length - 1];
    
    // Process the actual data
    data.forEach(item => {
      if (!item.OrderDate || !(item.OrderDate instanceof Date) || isNaN(item.OrderDate)) return;
      
      const timeKey = getTimeKey(item.OrderDate);
      
      if (!timeSeriesData[timeKey]) {
        timeSeriesData[timeKey] = {
          date: new Date(item.OrderDate.getFullYear(), item.OrderDate.getMonth(), 15), // middle of month
          key: timeKey,
          sales: 0,
          profit: 0,
          editable: false
        };
      }
      
      timeSeriesData[timeKey].sales += (item.OrderItemQuantity || 0) * (item.PerUnitPrice || 0);
      timeSeriesData[timeKey].profit += item.Profit || 0;
    });
    
    // Convert to array and sort by date
    let result = Object.values(timeSeriesData).sort((a, b) => a.date - b.date);
    
    // Create simple forecast for future months (using moving average)
    const forecast = [];
    if (forecastEnabled) {
      const lastDate = result[result.length - 1].date;
      const avgSales = d3.mean(result.slice(-6), d => d.sales);
      const avgProfit = d3.mean(result.slice(-6), d => d.profit);
      const growthRate = 1.02; // 2% monthly growth
      
      for (let i = 1; i <= editableFutureMonths; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setMonth(futureDate.getMonth() + i);
        
        const timeKey = getTimeKey(futureDate);
        const projectedSales = avgSales * Math.pow(growthRate, i);
        const projectedProfit = avgProfit * Math.pow(growthRate, i);
        
        forecast.push({
          date: futureDate,
          key: timeKey,
          sales: projectedSales,
          profit: projectedProfit,
          editable: true,
          isProjection: true
        });
      }
    }
    
    return { 
      timeSeriesData: result,
      forecast 
    };
  }, [data, timeFrame, forecastEnabled]);
  
  // Combine actual data with forecast and handle modifications
  const combinedData = useMemo(() => {
    if (!chartData.timeSeriesData) return [];
    
    // Start with the original data
    let combined = [...chartData.timeSeriesData];
    
    // Add forecast data if we don't have modified data
    if (!modifiedData && chartData.forecast) {
      combined = [...combined, ...chartData.forecast];
    }
    
    // If we have modified data, use that instead
    if (modifiedData) {
      // Find where actual data ends
      const actualDataLength = chartData.timeSeriesData.length;
      
      // Replace forecast with modified data
      combined = [
        ...combined.slice(0, actualDataLength),
        ...modifiedData
      ];
    }
    
    return combined;
  }, [chartData, modifiedData]);
  
  // Draw the chart when data or dimensions change
  useEffect(() => {
    if (!svgRef.current || !tooltipRef.current || !combinedData.length || !dimensions.width || !dimensions.height) return;
    
    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();
    
    const { width, height } = dimensions;
    const margin = { top: 20, right: 80, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Parse dates for x scale
    const dates = combinedData.map(d => d.date);
    
    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(dates))
      .range([0, innerWidth]);
    
    // Find max value for y scale across both sales and profit
    const yMax = d3.max(combinedData, d => Math.max(d.sales, d.profit));
    
    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // Add 10% headroom
      .nice()
      .range([innerHeight, 0]);
    
    // Create line generators
    const lineSales = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.sales))
      .curve(d3.curveMonotoneX);
    
    const lineProfit = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.profit))
      .curve(d3.curveMonotoneX);
    
    // Create area generator for sales
    const areaSales = d3.area()
      .x(d => xScale(d.date))
      .y0(innerHeight)
      .y1(d => yScale(d.sales))
      .curve(d3.curveMonotoneX);
    
    // Create gradient for sales area
    const salesGradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "sales-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    
    salesGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#4f46e5")
      .attr("stop-opacity", 0.3);
    
    salesGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#4f46e5")
      .attr("stop-opacity", 0);
    
    // Add sales area
    svg.append("path")
      .datum(combinedData)
      .attr("fill", "url(#sales-gradient)")
      .attr("d", areaSales);
    
    // Add x-axis with proper date format based on data range
    const xAxis = d3.axisBottom(xScale);
    
    // Customize tick format based on date range
    if (timeFrame === 'monthly') {
      xAxis.ticks(d3.timeMonth.every(1))
        .tickFormat(d3.timeFormat("%b %Y"));
    } else {
      xAxis.ticks(d3.timeWeek.every(2))
        .tickFormat(d3.timeFormat("W%W %Y"));
    }
    
    svg.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em");
    
    // Add y-axis
    svg.append("g")
      .call(d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => d === 0 ? '0' : d >= 1000000 ? `$${d/1000000}M` : d >= 1000 ? `$${d/1000}K` : `$${d}`));
    
    // Add vertical line to separate actual data from projections
    if (chartData.timeSeriesData.length > 0 && chartData.forecast.length > 0) {
      const lastRealDate = chartData.timeSeriesData[chartData.timeSeriesData.length - 1].date;
      
      svg.append("line")
        .attr("x1", xScale(lastRealDate))
        .attr("x2", xScale(lastRealDate))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#9ca3af")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5");
      
      svg.append("text")
        .attr("x", xScale(lastRealDate) + 5)
        .attr("y", 15)
        .attr("fill", "#6b7280")
        .attr("font-size", "10px")
        .text("Projections →");
    }
    
    // Add sales line
    svg.append("path")
      .datum(combinedData)
      .attr("fill", "none")
      .attr("stroke", "#4f46e5")
      .attr("stroke-width", 2)
      .attr("d", lineSales);
    
    // Add profit line
    svg.append("path")
      .datum(combinedData)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2)
      .attr("d", lineProfit);
    
    // Add data points for sales
    const salesCircles = svg.selectAll(".dot-sales")
      .data(combinedData)
      .enter()
      .append("circle")
      .attr("class", d => `dot-sales ${d.editable ? "editable" : ""}`)
      .attr("cx", d => xScale(d.date))
      .attr("cy", d => yScale(d.sales))
      .attr("r", d => d.editable ? 6 : 4)
      .attr("fill", d => d.isProjection ? "#818cf8" : "#4f46e5")
      .attr("stroke", d => d.editable ? "#ffffff" : "none")
      .attr("stroke-width", 2)
      .style("cursor", d => d.editable ? "grab" : "default");
    
    // Add data points for profit
    const profitCircles = svg.selectAll(".dot-profit")
      .data(combinedData)
      .enter()
      .append("circle")
      .attr("class", d => `dot-profit ${d.editable ? "editable" : ""}`)
      .attr("cx", d => xScale(d.date))
      .attr("cy", d => yScale(d.profit))
      .attr("r", d => d.editable ? 6 : 4)
      .attr("fill", d => d.isProjection ? "#34d399" : "#10b981")
      .attr("stroke", d => d.editable ? "#ffffff" : "none")
      .attr("stroke-width", 2)
      .style("cursor", d => d.editable ? "grab" : "default");
    
    // Add drag behavior to editable points
    const dragSales = d3.drag()
      .on("start", function() {
        d3.select(this).raise().attr("stroke", "#000");
        setIsDragging(true);
      })
      .on("drag", function(event, d) {
        if (!d.editable) return;
        
        // Constrain to y-axis only and don't allow negative values
        const newY = Math.max(0, Math.min(innerHeight, event.y));
        const newSalesValue = yScale.invert(newY);
        
        // Update the circle position
        d3.select(this)
          .attr("cy", newY);
        
        // Find index of this point in the data
        const idx = combinedData.findIndex(item => item.key === d.key);
        if (idx === -1) return;
        
        // Update the data
        const updatedData = combinedData
          .filter(item => item.editable)
          .map(item => {
            if (item.key === d.key) {
              return { ...item, sales: newSalesValue };
            }
            return item;
          });
        
        // Update the modified data state
        setModifiedData(updatedData);
        
        // Redraw the sales line with updated data
        const updatedCombined = [
          ...combinedData.filter(item => !item.editable),
          ...updatedData
        ].sort((a, b) => a.date - b.date);
        
        svg.select("path[stroke='#4f46e5']")
          .datum(updatedCombined)
          .attr("d", lineSales);
        
        // Update the area
        svg.select("path[fill='url(#sales-gradient)']")
          .datum(updatedCombined)
          .attr("d", areaSales);
        
        // Show tooltip with value
        const tooltip = d3.select(tooltipRef.current);
        tooltip.style("opacity", 1)
          .html(`
            <div class="p-2">
              <div class="font-bold">${d.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
              <div class="text-indigo-600">Sales: $${newSalesValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div class="text-gray-600">Drag to adjust</div>
            </div>
          `)
          .style("left", `${event.sourceEvent.pageX + 10}px`)
          .style("top", `${event.sourceEvent.pageY - 28}px`);
      })
      .on("end", function() {
        d3.select(this).attr("stroke", "#ffffff");
        setIsDragging(false);
        d3.select(tooltipRef.current).style("opacity", 0);
        
        // Notify parent component of changes
        if (onScenarioChange && modifiedData) {
          onScenarioChange(modifiedData);
        }
      });
    
    const dragProfit = d3.drag()
      .on("start", function() {
        d3.select(this).raise().attr("stroke", "#000");
        setIsDragging(true);
      })
      .on("drag", function(event, d) {
        if (!d.editable) return;
        
        // Constrain to y-axis only and don't allow negative values
        const newY = Math.max(0, Math.min(innerHeight, event.y));
        const newProfitValue = yScale.invert(newY);
        
        // Update the circle position
        d3.select(this)
          .attr("cy", newY);
        
        // Find index of this point in the data
        const idx = combinedData.findIndex(item => item.key === d.key);
        if (idx === -1) return;
        
        // Update the data
        const updatedData = combinedData
          .filter(item => item.editable)
          .map(item => {
            if (item.key === d.key) {
              return { ...item, profit: newProfitValue };
            }
            return item;
          });
        
        // Update the modified data state
        setModifiedData(updatedData);
        
        // Redraw the profit line with updated data
        const updatedCombined = [
          ...combinedData.filter(item => !item.editable),
          ...updatedData
        ].sort((a, b) => a.date - b.date);
        
        svg.select("path[stroke='#10b981']")
          .datum(updatedCombined)
          .attr("d", lineProfit);
        
        // Show tooltip with value
        const tooltip = d3.select(tooltipRef.current);
        tooltip.style("opacity", 1)
          .html(`
            <div class="p-2">
              <div class="font-bold">${d.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
              <div class="text-emerald-600">Profit: $${newProfitValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div class="text-gray-600">Drag to adjust</div>
            </div>
          `)
          .style("left", `${event.sourceEvent.pageX + 10}px`)
          .style("top", `${event.sourceEvent.pageY - 28}px`);
      })
      .on("end", function() {
        d3.select(this).attr("stroke", "#ffffff");
        setIsDragging(false);
        d3.select(tooltipRef.current).style("opacity", 0);
        
        // Notify parent component of changes
        if (onScenarioChange && modifiedData) {
          onScenarioChange(modifiedData);
        }
      });
    
    // Apply drag behavior to editable points
    salesCircles.filter(d => d.editable).call(dragSales);
    profitCircles.filter(d => d.editable).call(dragProfit);
    
    // Add hover effects for non-dragging state
    salesCircles.on("mouseover", function(event, d) {
      if (isDragging) return;
      
      d3.select(this)
        .attr("r", d => d.editable ? 8 : 6);
      
      // Show tooltip
      const tooltip = d3.select(tooltipRef.current);
      tooltip.style("opacity", 1)
        .html(`
          <div class="p-2">
            <div class="font-bold">${d.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
            <div class="text-indigo-600">Sales: $${d.sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            ${d.editable ? '<div class="text-gray-600 italic">Drag to adjust</div>' : ''}
          </div>
        `)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      if (isDragging) return;
      
      // Move tooltip with mouse
      d3.select(tooltipRef.current)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      if (isDragging) return;
      
      d3.select(this)
        .attr("r", d => d.editable ? 6 : 4);
      
      // Hide tooltip
      d3.select(tooltipRef.current).style("opacity", 0);
    });
    
    profitCircles.on("mouseover", function(event, d) {
      if (isDragging) return;
      
      d3.select(this)
        .attr("r", d => d.editable ? 8 : 6);
      
      // Show tooltip
      const tooltip = d3.select(tooltipRef.current);
      tooltip.style("opacity", 1)
        .html(`
          <div class="p-2">
            <div class="font-bold">${d.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
            <div class="text-emerald-600">Profit: $${d.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            ${d.editable ? '<div class="text-gray-600 italic">Drag to adjust</div>' : ''}
          </div>
        `)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      if (isDragging) return;
      
      // Move tooltip with mouse
      d3.select(tooltipRef.current)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      if (isDragging) return;
      
      d3.select(this)
        .attr("r", d => d.editable ? 6 : 4);
      
      // Hide tooltip
      d3.select(tooltipRef.current).style("opacity", 0);
    });
    
    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${innerWidth - 100}, 0)`);
    
    // Sales legend
    legend.append("line")
      .attr("x1", 0)
      .attr("y1", 7)
      .attr("x2", 15)
      .attr("y2", 7)
      .attr("stroke", "#4f46e5")
      .attr("stroke-width", 2);
    
    legend.append("text")
      .attr("x", 20)
      .attr("y", 10)
      .text("Sales")
      .attr("font-size", "12px");
    
    // Profit legend
    legend.append("line")
      .attr("x1", 0)
      .attr("y1", 27)
      .attr("x2", 15)
      .attr("y2", 27)
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2);
    
    legend.append("text")
      .attr("x", 20)
      .attr("y", 30)
      .text("Profit")
      .attr("font-size", "12px");
    
    // Projection legend
    if (combinedData.some(d => d.isProjection)) {
      legend.append("circle")
        .attr("cx", 7)
        .attr("cy", 47)
        .attr("r", 5)
        .attr("fill", "#818cf8");
        
      legend.append("text")
        .attr("x", 20)
        .attr("y", 50)
        .text("Projection")
        .attr("font-size", "12px");
    }
    
  }, [combinedData, dimensions, timeFrame, modifiedData, isDragging, onScenarioChange]);
  
  // Reset to original forecast
  const handleReset = () => {
    setModifiedData(null);
    setActiveScenario(null);
    
    // Notify parent of reset
    if (onScenarioChange) {
      onScenarioChange(null);
    }
  };
  
  // Save current scenario
  const handleSaveScenario = () => {
    if (!modifiedData) return;
    
    const newScenario = {
      id: Date.now().toString(),
      name: scenarioName || `Scenario ${savedScenarios.length + 1}`,
      data: modifiedData,
      created: new Date()
    };
    
    setSavedScenarios([...savedScenarios, newScenario]);
    setActiveScenario(newScenario.id);
    setScenarioModalOpen(false);
    setScenarioName("");
  };
  
  // Load saved scenario
  const handleLoadScenario = (scenarioId) => {
    const scenario = savedScenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    setModifiedData(scenario.data);
    setActiveScenario(scenarioId);
    
    // Notify parent
    if (onScenarioChange) {
      onScenarioChange(scenario.data);
    }
  };
  
  // Toggle forecast visibility
  const toggleForecast = () => {
    setForecastEnabled(!forecastEnabled);
    if (modifiedData) {
      handleReset();
    }
  };
  
  // Calculate impact of modifications
  const calculateImpact = () => {
    if (!modifiedData || !chartData.forecast) return null;
    
    const originalSalesTotal = chartData.forecast.reduce((sum, d) => sum + d.sales, 0);
    const originalProfitTotal = chartData.forecast.reduce((sum, d) => sum + d.profit, 0);
    
    const modifiedSalesTotal = modifiedData.reduce((sum, d) => sum + d.sales, 0);
    const modifiedProfitTotal = modifiedData.reduce((sum, d) => sum + d.profit, 0);
    
    const salesDiff = modifiedSalesTotal - originalSalesTotal;
    const profitDiff = modifiedProfitTotal - originalProfitTotal;
    
    const salesPctChange = (salesDiff / originalSalesTotal) * 100;
    const profitPctChange = (profitDiff / originalProfitTotal) * 100;
    
    return {
      salesDiff,
      profitDiff,
      salesPctChange,
      profitPctChange
    };
  };
  
  const impact = calculateImpact();
  
  return (
    <div className="relative space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm"
            onClick={toggleForecast}
          >
            <FiBarChart2 className="mr-1" />
            {forecastEnabled ? 'Hide Forecast' : 'Show Forecast'}
          </button>
          
          {modifiedData && (
            <button 
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm"
              onClick={handleReset}
            >
              <FiRefreshCw className="mr-1" />
              Reset
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {modifiedData && (
            <button 
              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded flex items-center text-sm"
              onClick={() => setScenarioModalOpen(true)}
            >
              <FiSave className="mr-1" />
              Save Scenario
            </button>
          )}
          
          {savedScenarios.length > 0 && (
            <select 
              className="px-2 py-1 bg-white border rounded text-sm"
              value={activeScenario || ""}
              onChange={(e) => handleLoadScenario(e.target.value)}
            >
              <option value="">Load Scenario</option>
              {savedScenarios.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      {/* Visualization */}
      <div ref={containerRef} className="relative w-full h-64">
        <svg ref={svgRef} className="w-full h-full"></svg>
        <div
          ref={tooltipRef}
          className="absolute bg-white shadow-md rounded-md text-sm pointer-events-none opacity-0 z-10"
          style={{
            transition: "opacity 0.2s ease-in-out",
            top: 0,
            left: 0
          }}
        ></div>
        
        {!forecastEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
            <div className="text-center p-4">
              <div className="text-gray-500 mb-2">Forecast is currently disabled</div>
              <button 
                className="text-indigo-600 border border-indigo-600 px-4 py-2 rounded hover:bg-indigo-50"
                onClick={toggleForecast}
              >
                Enable Forecast
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Impact Analysis */}
      {impact && (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Scenario Impact Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-blue-700">Sales Change</div>
              <div className={`text-sm font-medium ${impact.salesDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {impact.salesDiff >= 0 ? '+' : ''}${impact.salesDiff.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
                ({impact.salesPctChange >= 0 ? '+' : ''}{impact.salesPctChange.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700">Profit Change</div>
              <div className={`text-sm font-medium ${impact.profitDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {impact.profitDiff >= 0 ? '+' : ''}${impact.profitDiff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                ({impact.profitPctChange >= 0 ? '+' : ''}{impact.profitPctChange.toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-xs text-gray-500 italic mt-1">
        {forecastEnabled ? 'Drag the colored dots to adjust future projections and see the impact.' : ''}
      </div>
      
      {/* Save Scenario Modal */}
      {scenarioModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Save Scenario</h3>
            <input
              type="text"
              placeholder="Scenario Name"
              className="w-full border rounded px-3 py-2 mb-4"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                onClick={() => setScenarioModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                onClick={handleSaveScenario}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveTimeSeries;