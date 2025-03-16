import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { FiTrash2, FiSearch, FiRefreshCw, FiInfo, FiFilter } from 'react-icons/fi';

const PatternRecognition = ({ data }) => {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const resultsRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [patternResults, setPatternResults] = useState([]);
  const [patternType, setPatternType] = useState('trend'); // trend, shape, value
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Set up dimensions when the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries.length) return;
      
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height: Math.min(height, 200) }); // Drawing canvas height limited
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);
  
  // Extract categories from data
  const categories = useMemo(() => {
    if (!data || !data.length) return ['All'];
    
    const uniqueCategories = Array.from(new Set(data.map(item => item.CategoryName))).filter(Boolean);
    return ['All', ...uniqueCategories];
  }, [data]);
  
  // Process time series data
  const timeSeriesData = useMemo(() => {
    if (!data || !data.length) return [];
    
    // Group data by product and time period
    const productMap = {};
    
    data.forEach(item => {
      if (!item.OrderDate || !item.ProductName) return;
      
      const date = new Date(item.OrderDate);
      const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const product = item.ProductName;
      const category = item.CategoryName || 'Unknown';
      
      if (!productMap[product]) {
        productMap[product] = {
          product,
          category,
          months: {},
          totalSales: 0
        };
      }
      
      if (!productMap[product].months[month]) {
        productMap[product].months[month] = 0;
      }
      
      const salesValue = (item.OrderItemQuantity || 0) * (item.PerUnitPrice || 0);
      productMap[product].months[month] += salesValue;
      productMap[product].totalSales += salesValue;
    });
    
    // Get all months in chronological order
    const allMonths = Array.from(
      new Set(
        Object.values(productMap)
          .flatMap(product => Object.keys(product.months))
      )
    ).sort();
    
    // Convert to arrays for time series analysis
    const result = Object.values(productMap).map(product => {
      const values = allMonths.map(month => ({
        month,
        sales: product.months[month] || 0
      }));
      
      return {
        product: product.product,
        category: product.category,
        data: values,
        totalSales: product.totalSales
      };
    });
    
    // Filter out products with insufficient data
    return result.filter(series => 
      series.data.filter(d => d.sales > 0).length >= Math.min(5, allMonths.length / 2)
    );
  }, [data]);
  
  // Set up the drawing canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions.width || !dimensions.height) return;
    
    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // Initialize canvas context
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4f46e5';
    
    // Draw existing points if any
    if (drawingPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
      
      for (let i = 1; i < drawingPoints.length; i++) {
        ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
      }
      
      ctx.stroke();
    }
    
    // Draw a grid background
    ctx.beginPath();
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    
    // Horizontal grid lines
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    
    ctx.stroke();
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    
    // X-axis at the bottom
    ctx.moveTo(0, canvas.height - 20);
    ctx.lineTo(canvas.width, canvas.height - 20);
    
    // Y-axis at the left
    ctx.moveTo(20, 0);
    ctx.lineTo(20, canvas.height);
    
    // Draw small ticks on axes
    for (let x = 20; x <= canvas.width; x += 40) {
      ctx.moveTo(x, canvas.height - 20);
      ctx.lineTo(x, canvas.height - 15);
    }
    
    for (let y = 20; y <= canvas.height - 20; y += 40) {
      ctx.moveTo(20, y);
      ctx.lineTo(15, y);
    }
    
    ctx.stroke();
    
    // Draw axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // X-axis label - Time
    ctx.fillText("Time →", canvas.width / 2, canvas.height - 5);
    
    // Y-axis label - Sales
    ctx.save();
    ctx.translate(10, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText("↑ Sales", 0, 0);
    ctx.restore();
    
  }, [dimensions, drawingPoints]);
  
  // Set up mouse/touch event handlers for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const startDrawing = (e) => {
      const bounds = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - bounds.left;
      const y = (e.clientY || e.touches[0].clientY) - bounds.top;
      
      setIsDrawing(true);
      setDrawingPoints([{ x, y }]);
    };
    
    const draw = (e) => {
      if (!isDrawing) return;
      
      const bounds = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - bounds.left;
      const y = (e.clientY || e.touches[0].clientY) - bounds.top;
      
      setDrawingPoints(prev => [...prev, { x, y }]);
      
      // Draw line on canvas
      const ctx = canvas.getContext('2d');
      const prevPoint = drawingPoints[drawingPoints.length - 1];
      
      ctx.beginPath();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    
    const endDrawing = () => {
      setIsDrawing(false);
      
      // Only search if we have enough points
      if (drawingPoints.length >= 5) {
        searchForMatchingPatterns();
      }
    };
    
    // Add event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDrawing);
    canvas.addEventListener('mouseleave', endDrawing);
    
    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', endDrawing);
    
    return () => {
      // Clean up event listeners
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', endDrawing);
      canvas.removeEventListener('mouseleave', endDrawing);
      
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', endDrawing);
    };
  }, [isDrawing, drawingPoints]);
  
  // Function to find patterns that match the drawing
  const searchForMatchingPatterns = () => {
    if (!drawingPoints.length || !timeSeriesData.length) return;
    
    setSearching(true);
    
    // Normalize the drawn pattern to [0,1] range for both x and y
    const minX = Math.min(...drawingPoints.map(p => p.x));
    const maxX = Math.max(...drawingPoints.map(p => p.x));
    const minY = Math.min(...drawingPoints.map(p => p.y));
    const maxY = Math.max(...drawingPoints.map(p => p.y));
    
    const normalizedDrawing = drawingPoints.map(p => ({
      x: (p.x - minX) / (maxX - minX || 1),
      y: 1 - (p.y - minY) / (maxY - minY || 1) // Invert Y since canvas Y increases downward
    }));
    
    // Resample the drawing to a fixed number of points for comparison
    const numSamplePoints = 20;
    const sampledDrawing = resampleCurve(normalizedDrawing, numSamplePoints);
    
    // Process each time series
    const results = timeSeriesData
      .filter(series => {
        // Filter by category if one is selected
        if (selectedCategory !== 'All') {
          return series.category === selectedCategory;
        }
        return true;
      })
      .map(series => {
        // Normalize the time series data
        const rawValues = series.data.map(d => d.sales);
        const minVal = Math.min(...rawValues);
        const maxVal = Math.max(...rawValues);
        
        const normalizedSeries = series.data.map((d, i) => ({
          x: i / (series.data.length - 1),
          y: (d.sales - minVal) / (maxVal - minVal || 1)
        }));
        
        // Resample the series to the same number of points
        const sampledSeries = resampleCurve(normalizedSeries, numSamplePoints);
        
        // Calculate similarity score using dynamic time warping
        const similarity = calculateDTWSimilarity(sampledDrawing, sampledSeries);
        
        return {
          ...series,
          similarity: similarity,
          normalizedData: normalizedSeries
        };
      });
    
    // Sort by similarity (lower is better for DTW)
    const sortedResults = results
      .sort((a, b) => a.similarity - b.similarity)
      .slice(0, 10); // Top 10 matches
    
    setPatternResults(sortedResults);
    setSearching(false);
    
    // Scroll to results
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Helper function to resample a curve to n points
  const resampleCurve = (points, n) => {
    if (points.length <= 1) return points;
    
    const result = [];
    
    // Calculate total path length
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i-1].x;
      const dy = points[i].y - points[i-1].y;
      pathLength += Math.sqrt(dx*dx + dy*dy);
    }
    
    // Resample evenly
    const stepSize = pathLength / (n - 1);
    result.push(points[0]); // First point
    
    let currentDistance = 0;
    let prevPoint = points[0];
    let pointIndex = 1;
    
    for (let i = 1; i < n - 1; i++) {
      const targetDistance = i * stepSize;
      
      // Move along the path until we reach the target distance
      while (currentDistance < targetDistance && pointIndex < points.length) {
        const nextPoint = points[pointIndex];
        const dx = nextPoint.x - prevPoint.x;
        const dy = nextPoint.y - prevPoint.y;
        const segmentLength = Math.sqrt(dx*dx + dy*dy);
        
        if (currentDistance + segmentLength >= targetDistance) {
          // Interpolate between prevPoint and nextPoint
          const t = (targetDistance - currentDistance) / segmentLength;
          result.push({
            x: prevPoint.x + t * dx,
            y: prevPoint.y + t * dy
          });
          break;
        } else {
          currentDistance += segmentLength;
          prevPoint = nextPoint;
          pointIndex++;
        }
      }
    }
    
    result.push(points[points.length - 1]); // Last point
    return result;
  };
  
  // Calculate similarity using Dynamic Time Warping (DTW)
  const calculateDTWSimilarity = (a, b) => {
    const n = a.length;
    const m = b.length;
    
    // Create cost matrix
    const dtw = Array(n + 1).fill().map(() => Array(m + 1).fill(Infinity));
    dtw[0][0] = 0;
    
    // Calculate DTW matrix
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = Math.sqrt(
          Math.pow(a[i-1].y - b[j-1].y, 2) // We mostly care about Y values (amplitude)
        );
        dtw[i][j] = cost + Math.min(
          dtw[i-1][j],     // insertion
          dtw[i][j-1],     // deletion
          dtw[i-1][j-1]    // match
        );
      }
    }
    
    return dtw[n][m];
  };
  
  // Clear the drawing
  const clearDrawing = () => {
    setDrawingPoints([]);
    setPatternResults([]);
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Redraw the empty canvas with grid
      const event = new Event('redraw');
      canvas.dispatchEvent(event);
    }
  };
  
  // Draw the results
  useEffect(() => {
    if (!patternResults.length || !svgRef.current || !dimensions.width) return;
    
    // Clear previous results
    d3.select(svgRef.current).selectAll("*").remove();
    
    const resultHeight = 80; // Height per result
    const margin = { top: 10, right: 20, bottom: 20, left: 40 };
    const width = dimensions.width;
    const height = patternResults.length * resultHeight;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);
    
    // Create a group for each result
    const resultGroups = svg.selectAll(".result")
      .data(patternResults)
      .enter()
      .append("g")
      .attr("class", "result")
      .attr("transform", (d, i) => `translate(0, ${i * resultHeight})`);
    
    // Add background for each row
    resultGroups.append("rect")
      .attr("width", width)
      .attr("height", resultHeight - 5)
      .attr("fill", (d, i) => i % 2 === 0 ? "#f9fafb" : "#ffffff")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 1);
    
    // Add mini time series chart for each result
    resultGroups.each(function(d, i) {
      const g = d3.select(this);
      
      // Create scales
      const xScale = d3.scaleLinear()
        .domain([0, 1])
        .range([margin.left, width - margin.right]);
      
      const yScale = d3.scaleLinear()
        .domain([0, 1])
        .range([resultHeight - margin.bottom, margin.top]);
      
      // Create line generator
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);
      
      // Add line path
      g.append("path")
        .datum(d.normalizedData)
        .attr("fill", "none")
        .attr("stroke", "#4f46e5")
        .attr("stroke-width", 2)
        .attr("d", line);
      
      // Add product label
      g.append("text")
        .attr("x", 5)
        .attr("y", margin.top + 5)
        .attr("fill", "#111827")
        .attr("font-size", "12px")
        .attr("font-weight", "500")
        .text(`${i+1}. ${d.product.substring(0, 30)}${d.product.length > 30 ? '...' : ''}`);
      
      // Add category and similarity info
      g.append("text")
        .attr("x", 10)
        .attr("y", margin.top + 20)
        .attr("fill", "#6b7280")
        .attr("font-size", "10px")
        .text(`Category: ${d.category} | Match Quality: ${Math.max(0, 100 - d.similarity * 20).toFixed(0)}%`);
      
      // Add sales info
      g.append("text")
        .attr("x", 10)
        .attr("y", margin.top + 35)
        .attr("fill", "#6b7280")
        .attr("font-size", "10px")
        .text(`Total Sales: $${d.totalSales.toLocaleString()}`);
    });
    
    // Add interaction
    resultGroups
      .on("mouseover", function(event, d) {
        d3.select(this).select("rect")
          .attr("fill", "#f3f4f6")
          .attr("stroke", "#d1d5db")
          .attr("stroke-width", 2);
        
        // Show tooltip
        const tooltip = d3.select(tooltipRef.current);
        tooltip.style("opacity", 1)
          .html(`
            <div class="p-3">
              <div class="font-bold">${d.product}</div>
              <div class="text-gray-600">Category: ${d.category}</div>
              <div class="mt-2">
                <div class="text-blue-600">Total Sales: $${d.totalSales.toLocaleString()}</div>
                <div class="text-gray-600">Match Quality: ${Math.max(0, 100 - d.similarity * 20).toFixed(0)}%</div>
              </div>
              <div class="mt-1 text-xs text-gray-500">
                This product's sales trend closely matches your drawn pattern.
              </div>
            </div>
          `)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mousemove", function(event) {
        // Move tooltip with mouse
        d3.select(tooltipRef.current)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function() {
        d3.select(this).select("rect")
          .attr("fill", (d, i) => i % 2 === 0 ? "#f9fafb" : "#ffffff")
          .attr("stroke", "#e5e7eb")
          .attr("stroke-width", 1);
          
        // Hide tooltip
        d3.select(tooltipRef.current).style("opacity", 0);
      });
      
  }, [patternResults, dimensions.width]);
  
  const renderHelpOverlay = () => {
    if (!helpOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-lg w-full">
          <h3 className="text-lg font-medium mb-4">How to Use Pattern Recognition</h3>
          
          <div className="space-y-4">
            <div>
              <div className="font-medium mb-1">Drawing Patterns</div>
              <p className="text-sm text-gray-600">
                Draw a pattern in the canvas to search for products that follow similar sales trends.
                The system will analyze your drawing and find the best matches.
              </p>
            </div>
            
            <div>
              <div className="font-medium mb-1">Pattern Types</div>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                <li>Upward Trend: Draw a line going up</li>
                <li>Downward Trend: Draw a line going down</li>
                <li>Spike: Draw a sharp up and down pattern</li>
                <li>Growth & Plateau: Draw a line that rises then levels off</li>
                <li>Cyclical: Draw a wave pattern</li>
              </ul>
            </div>
            
            <div>
              <div className="font-medium mb-1">Matching Algorithm</div>
              <p className="text-sm text-gray-600">
                The system uses Dynamic Time Warping (DTW) to find patterns that are similar in shape, 
                even if they're stretched or compressed in time.
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              onClick={() => setHelpOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Pattern Recognition</h2>
          <p className="text-sm text-gray-500">Draw a pattern to find products with similar sales trends</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={() => setHelpOpen(true)}
          >
            <FiInfo className="text-gray-500" />
          </button>
          
          <select 
            className="border rounded px-2 py-1 text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          
          <button 
            className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            onClick={clearDrawing}
          >
            <FiTrash2 className="mr-1" />
            Clear
          </button>
        </div>
      </div>
      
      {/* Drawing Canvas */}
      <div ref={containerRef} className="relative border rounded-lg">
        <canvas 
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair"
        />
        
        {/* Instructions overlay */}
        {drawingPoints.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-700">Draw a pattern here</div>
              <div className="text-sm text-gray-500 mt-1">
                Draw a trend line to find products that match the pattern
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Search Button */}
      <div className="flex justify-center">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
          onClick={searchForMatchingPatterns}
          disabled={drawingPoints.length < 5 || searching}
        >
          {searching ? (
            <>
              <FiRefreshCw className="animate-spin mr-2" />
              Searching...
            </>
          ) : (
            <>
              <FiSearch className="mr-2" />
              Find Matching Patterns
            </>
          )}
        </button>
      </div>
      
      {/* Results */}
      {patternResults.length > 0 && (
        <div ref={resultsRef} className="mt-6">
          <h3 className="text-lg font-medium mb-2">Matching Products ({patternResults.length})</h3>
          <p className="text-sm text-gray-500 mb-4">
            These products have sales trends most similar to your drawn pattern
          </p>
          
          <div className="border rounded-lg overflow-hidden">
            <svg ref={svgRef} className="w-full"></svg>
          </div>
          
          <div className="mt-2 text-xs text-gray-500 italic">
            Hover over results to see more details. Higher match quality indicates a closer match to your pattern.
          </div>
        </div>
      )}
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white shadow-md rounded-md text-sm pointer-events-none opacity-0 z-10"
        style={{
          transition: "opacity 0.2s ease-in-out",
          top: 0,
          left: 0
        }}
      ></div>
      
      {/* Help Overlay */}
      {renderHelpOverlay()}
    </div>
  );
};

export default PatternRecognition;