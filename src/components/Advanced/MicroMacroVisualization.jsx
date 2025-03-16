import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { FiZoomIn, FiZoomOut, FiHome, FiMaximize2, FiChevronRight } from 'react-icons/fi';

const MicroMacroVisualization = ({ data }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const animationRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Navigation state
  const [navigationPath, setNavigationPath] = useState([]);
  const [currentLevel, setCurrentLevel] = useState('region'); // region -> country -> category -> product
  const [currentData, setCurrentData] = useState(null);
  const [vizType, setVizType] = useState('treemap'); // treemap, sunburst, barchart
  const [transitioningData, setTransitioningData] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [error, setError] = useState(null);
  
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
  
  // Process data into hierarchical structure
  const hierarchicalData = useCallback(() => {
    if (!data || !data.length) return { name: 'All Regions', value: 0, children: [] };
    
    try {
      // Create nested hierarchy: Region > Country > Category > Product
      const root = { name: 'All Regions', value: 0, children: [], type: 'root' };
      const regionMap = {};
      
      data.forEach(item => {
        // Skip items with missing critical data
        if (!item.RegionName || !item.CountryName || !item.CategoryName) return;
        
        const region = item.RegionName;
        const country = item.CountryName;
        const category = item.CategoryName;
        const product = item.ProductName || 'Unknown Product';
        const salesValue = (item.OrderItemQuantity || 0) * (item.PerUnitPrice || 0);
        const profit = item.Profit || 0;
        
        // Add region if it doesn't exist
        if (!regionMap[region]) {
          const regionNode = { name: region, value: 0, children: [], type: 'region' };
          regionMap[region] = { node: regionNode, countries: {} };
          root.children.push(regionNode);
        }
        
        // Add country if it doesn't exist
        if (!regionMap[region].countries[country]) {
          const countryNode = { name: country, value: 0, children: [], type: 'country' };
          regionMap[region].countries[country] = { node: countryNode, categories: {} };
          regionMap[region].node.children.push(countryNode);
        }
        
        // Add category if it doesn't exist
        if (!regionMap[region].countries[country].categories[category]) {
          const categoryNode = { name: category, value: 0, children: [], type: 'category' };
          regionMap[region].countries[country].categories[category] = { 
            node: categoryNode, 
            products: {} 
          };
          regionMap[region].countries[country].node.children.push(categoryNode);
        }
        
        // Add product if it doesn't exist, otherwise update values
        if (!regionMap[region].countries[country].categories[category].products[product]) {
          const productNode = {
            name: product,
            value: salesValue,
            profit: profit,
            count: 1,
            type: 'product'
          };
          regionMap[region].countries[country].categories[category].node.children.push(productNode);
          regionMap[region].countries[country].categories[category].products[product] = productNode;
        } else {
          const productNode = regionMap[region].countries[country].categories[category].products[product];
          productNode.value += salesValue;
          productNode.profit += profit;
          productNode.count += 1;
        }
        
        // Update parent values
        regionMap[region].countries[country].categories[category].node.value += salesValue;
        regionMap[region].countries[country].node.value += salesValue;
        regionMap[region].node.value += salesValue;
        root.value += salesValue;
      });
      
      // Make sure we have data
      if (root.children.length === 0) {
        root.children.push({
          name: 'No Data',
          value: 0,
          children: [],
          type: 'region'
        });
      }
      
      return root;
    } catch (err) {
      console.error("Error processing hierarchical data:", err);
      setError("Error processing data structure");
      return { name: 'Error', value: 0, children: [], type: 'root' };
    }
  }, [data]);
  
  // Get current view data based on navigation path
  const getCurrentViewData = useCallback(() => {
    try {
      const rootData = hierarchicalData();
      if (!rootData) return null;
      
      if (navigationPath.length === 0) {
        return rootData;
      }
      
      // Navigate through the path
      let current = rootData;
      for (const name of navigationPath) {
        const child = current.children?.find(c => c.name === name);
        if (!child) return current; // If path is invalid, return the last valid node
        current = child;
      }
      
      return current;
    } catch (err) {
      console.error("Error getting current view data:", err);
      setError("Error navigating data hierarchy");
      return null;
    }
  }, [hierarchicalData, navigationPath]);
  
  // Handle animation with proper cleanup to prevent infinite loop
  const startTransitionAnimation = useCallback(() => {
    // Clear any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsTransitioning(true);
    setTransitionProgress(0);
    
    let progress = 0;
    const animate = () => {
      progress += 0.05;
      setTransitionProgress(Math.min(1, progress));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsTransitioning(false);
        setTransitioningData(null);
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    // Return cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);
  
  // Update current data when navigation changes
  useEffect(() => {
    try {
      const newData = getCurrentViewData();
      
      if (newData) {
        // Store old data for transition
        setTransitioningData(currentData);
        
        // Set new data
        setCurrentData(newData);
        
        // Determine level based on navigation path length
        const levels = ['region', 'country', 'category', 'product'];
        setCurrentLevel(levels[Math.min(navigationPath.length, levels.length - 1)]);
        
        // Change visualization type based on level
        if (navigationPath.length === 0) {
          setVizType('treemap');
        } else if (navigationPath.length === 1) {
          setVizType('sunburst');
        } else if (navigationPath.length === 2) {
          setVizType('barchart');
        } else {
          setVizType('barchart');
        }
        
        // Start transition animation (safely)
        const cleanup = startTransitionAnimation();
        return cleanup;
      }
    } catch (err) {
      console.error("Error updating view on navigation change:", err);
      setError("Error updating visualization");
    }
  }, [navigationPath, getCurrentViewData, startTransitionAnimation]);
  
  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);
  
  // Draw the visualization
  useEffect(() => {
    if (!svgRef.current || !dimensions.width || !dimensions.height) return;
    if (!currentData) return;
    
    try {
      // Clear previous visualization
      d3.select(svgRef.current).selectAll("*").remove();
      
      const { width, height } = dimensions;
      const margin = { top: 40, right: 10, bottom: 10, left: 10 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      
      // Create SVG
      const svg = d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
      
      // Create tooltip
      const tooltip = d3.select(tooltipRef.current)
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid #ddd")
        .style("border-radius", "4px")
        .style("padding", "10px")
        .style("box-shadow", "0 4px 8px rgba(0,0,0,0.1)")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", 10);
      
      // Create color scales for each level
      const regionColorScale = d3.scaleOrdinal(d3.schemeCategory10);
      const countryColorScale = d3.scaleOrdinal(d3.schemeSet3);
      const categoryColorScale = d3.scaleOrdinal(d3.schemePaired);
      const productColorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, d3.max(currentData.children || [], d => d.value) || 1]);
      
      // Get color based on node type and name
      const getNodeColor = (d) => {
        const type = d.data?.type || d.type;
        const name = d.data?.name || d.name;
        
        if (type === 'region') return regionColorScale(name);
        if (type === 'country') return countryColorScale(name);
        if (type === 'category') return categoryColorScale(name);
        if (type === 'product') return productColorScale(d.value || d.data?.value || 0);
        return "#ccc";
      };
      
      // Draw different visualization types
      if (vizType === 'treemap') {
        // Draw treemap
        const root = d3.hierarchy(currentData)
          .sum(d => d.value)
          .sort((a, b) => b.value - a.value);
        
        const treemap = d3.treemap()
          .size([innerWidth, innerHeight])
          .padding(4)
          .round(true);
        
        const nodes = treemap(root);
        
        // Animated transition for treemap cells
        const cell = svg.selectAll("g")
          .data(nodes.descendants())
          .enter()
          .append("g")
          .attr("transform", d => `translate(${d.x0},${d.y0})`)
          .attr("class", "treemap-cell")
          .style("cursor", d => d.children ? "pointer" : "default")
          .on("click", (event, d) => {
            if (d.children && d.depth > 0) {
              // Navigate to the clicked node
              const newPath = [...navigationPath, d.data.name];
              setNavigationPath(newPath);
            }
          });
        
        // Add rectangle for each cell
        cell.append("rect")
          .attr("id", d => `rect-${d.data.name.replace(/[^a-zA-Z0-9]/g, '')}`)
          .attr("width", d => Math.max(0, d.x1 - d.x0))
          .attr("height", d => Math.max(0, d.y1 - d.y0))
          .attr("fill", getNodeColor)
          .attr("opacity", isTransitioning ? 0 : 1)
          .transition()
          .duration(500)
          .attr("opacity", 1);
        
        // Add text for larger cells
        cell.append("text")
          .attr("x", 4)
          .attr("y", 14)
          .attr("fill", "white")
          .style("font-size", "12px")
          .text(d => d.data.name)
          .filter(d => (d.y1 - d.y0) < 18) // Hide text for small cells
          .style("opacity", 0);
        
        // Add hover effects
        cell.on("mouseover", function(event, d) {
          d3.select(this).select("rect")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
          
          tooltip.transition()
            .duration(200)
            .style("opacity", 1);
            
          tooltip.html(`
            <div>
              <div class="font-bold">${d.data.name}</div>
              <div class="text-gray-600">${d.data.type}</div>
              <div class="mt-1 text-blue-600">Sales: $${d.value ? d.value.toLocaleString() : 0}</div>
              ${d.data.profit ? `<div class="text-green-600">Profit: $${d.data.profit.toLocaleString()}</div>` : ''}
              ${d.children ? `<div class="text-gray-600">Items: ${d.children.length}</div>` : ''}
              ${d.children && d.depth > 0 ? '<div class="mt-1 text-xs font-italic">Click to drill down</div>' : ''}
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).select("rect")
            .attr("stroke", null);
            
          tooltip.transition()
            .duration(500)
            .style("opacity", 0);
        });
        
        // Add title for treemap
        svg.append("text")
          .attr("x", innerWidth / 2)
          .attr("y", -20)
          .attr("text-anchor", "middle")
          .attr("font-size", "18px")
          .attr("font-weight", "bold")
          .text(currentData.name);
        
      } else if (vizType === 'sunburst') {
        // Draw sunburst
        const radius = Math.min(innerWidth, innerHeight) / 2;
        
        // Ensure current data is suitable for hierarchy
        if (!currentData || !currentData.children) {
          console.error("Invalid data for sunburst:", currentData);
          return;
        }
        
        const root = d3.hierarchy(currentData)
          .sum(d => d.value || 0);
        
        // Defensive check for valid data
        if (root.descendants().length <= 1) {
          svg.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .text("No data available for sunburst visualization");
          return;
        }
        
        const partition = d3.partition()
          .size([2 * Math.PI, radius]);
        
        const arc = d3.arc()
          .startAngle(d => d.x0)
          .endAngle(d => d.x1)
          .innerRadius(d => d.y0)
          .outerRadius(d => d.y1);
        
        // Center the sunburst
        svg.attr("transform", `translate(${margin.left + innerWidth / 2},${margin.top + innerHeight / 2})`);
        
        // Create the sunburst
        const nodes = partition(root);
        
        const path = svg.selectAll("path")
          .data(nodes.descendants().filter(d => d.depth))
          .enter()
          .append("path")
          .attr("d", arc)
          .attr("fill", getNodeColor)
          .attr("opacity", isTransitioning ? 0 : 0.8)
          .style("cursor", d => d.children ? "pointer" : "default")
          .style("stroke", "#fff")
          .style("stroke-width", 1)
          .transition()
          .duration(500)
          .attr("opacity", 0.8);
        
        // Add interactivity
        svg.selectAll("path")
          .on("click", (event, d) => {
            if (d.children) {
              // Navigate to the clicked node
              const newPath = [...navigationPath, d.data.name];
              setNavigationPath(newPath);
            }
          })
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("opacity", 1)
              .attr("stroke", "#333")
              .attr("stroke-width", 2);
            
            tooltip.transition()
              .duration(200)
              .style("opacity", 1);
              
            tooltip.html(`
              <div>
                <div class="font-bold">${d.data.name}</div>
                <div class="text-gray-600">${d.data.type}</div>
                <div class="mt-1 text-blue-600">Sales: $${d.value ? d.value.toLocaleString() : 0}</div>
                ${d.data.profit ? `<div class="text-green-600">Profit: $${d.data.profit.toLocaleString()}</div>` : ''}
                ${d.children ? `<div class="text-gray-600">Items: ${d.children.length}</div>` : ''}
                ${d.children ? '<div class="mt-1 text-xs font-italic">Click to drill down</div>' : ''}
              </div>
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("opacity", 0.8)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1);
              
            tooltip.transition()
              .duration(500)
              .style("opacity", 0);
          });
          
        // Add title in the center for sunburst
        svg.append("text")
          .attr("text-anchor", "middle")
          .attr("font-size", "16px")
          .attr("font-weight", "bold")
          .attr("fill", "#333")
          .text(currentData.name);
        
      } else if (vizType === 'barchart') {
        // Draw bar chart
        // Prepare data - use children and sort by value
        const barData = currentData.children ? 
          [...currentData.children].sort((a, b) => b.value - a.value) : 
          [];
        
        // Handle empty data
        if (!barData.length) {
          svg.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .text("No data available for bar chart visualization");
          return;
        }
        
        // Create scales
        const xScale = d3.scaleBand()
          .domain(barData.map(d => d.name))
          .range([0, innerWidth])
          .padding(0.2);
        
        const yScale = d3.scaleLinear()
          .domain([0, d3.max(barData, d => d.value) * 1.1 || 100])
          .range([innerHeight, 0]);
        
        // Add x-axis
        svg.append("g")
          .attr("transform", `translate(0,${innerHeight})`)
          .call(d3.axisBottom(xScale))
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
        
        // Add bars
        svg.selectAll(".bar")
          .data(barData)
          .enter()
          .append("rect")
          .attr("class", "bar")
          .attr("x", d => xScale(d.name))
          .attr("width", xScale.bandwidth())
          .attr("y", innerHeight)
          .attr("height", 0)
          .attr("fill", getNodeColor)
          .style("cursor", d => d.children ? "pointer" : "default")
          .on("click", (event, d) => {
            if (d.children) {
              // Navigate to the clicked node
              const newPath = [...navigationPath, d.name];
              setNavigationPath(newPath);
            }
          })
          .transition()
          .duration(500)
          .attr("y", d => yScale(d.value || 0))
          .attr("height", d => innerHeight - yScale(d.value || 0));
        
        // Add interactivity
        svg.selectAll(".bar")
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("opacity", 0.8)
              .attr("stroke", "#333")
              .attr("stroke-width", 1);
            
            tooltip.transition()
              .duration(200)
              .style("opacity", 1);
              
            tooltip.html(`
              <div>
                <div class="font-bold">${d.name}</div>
                <div class="text-gray-600">${d.type}</div>
                <div class="mt-1 text-blue-600">Sales: $${d.value ? d.value.toLocaleString() : 0}</div>
                ${d.profit ? `<div class="text-green-600">Profit: $${d.profit.toLocaleString()}</div>` : ''}
                ${d.children ? `<div class="text-gray-600">Items: ${d.children.length}</div>` : ''}
                ${d.children ? '<div class="mt-1 text-xs font-italic">Click to drill down</div>' : ''}
              </div>
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("opacity", 1)
              .attr("stroke", null);
              
            tooltip.transition()
              .duration(500)
              .style("opacity", 0);
          });
          
        // Add title for bar chart
        svg.append("text")
          .attr("x", innerWidth / 2)
          .attr("y", -20)
          .attr("text-anchor", "middle")
          .attr("font-size", "16px")
          .attr("font-weight", "bold")
          .attr("fill", "#333")
          .text(`${currentData.name} - ${currentLevel === 'country' ? 'Countries' : currentLevel === 'category' ? 'Categories' : 'Products'}`);
      }
      
      // Clear any previous error
      setError(null);
    } catch (err) {
      console.error("Error drawing visualization:", err);
      setError("Error rendering visualization");
      
      // Show error message on the visualization
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      svg.append("text")
        .attr("x", dimensions.width / 2)
        .attr("y", dimensions.height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "red")
        .text("Error rendering visualization");
    }
    
  }, [dimensions, currentData, navigationPath, vizType, isTransitioning, currentLevel]);
  
  // Initial data loading
  useEffect(() => {
    const initialData = hierarchicalData();
    setCurrentData(initialData);
  }, [hierarchicalData]);
  
  // Handle navigation
  const navigateUp = () => {
    if (navigationPath.length > 0) {
      setNavigationPath(navigationPath.slice(0, -1));
    }
  };
  
  const navigateHome = () => {
    setNavigationPath([]);
  };
  
  // Handle changing visualization type manually
  const changeVizType = (type) => {
    setVizType(type);
  };
  
  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-red-700">
        <h3 className="font-medium mb-2">Visualization Error</h3>
        <p className="text-sm">{error}</p>
        <button 
          className="mt-2 px-3 py-1 bg-red-100 rounded hover:bg-red-200 text-sm"
          onClick={() => {
            setError(null);
            navigateHome();
          }}
        >
          Reset Visualization
        </button>
      </div>
    );
  }
  
  return (
    <div className="relative">
      {/* Navigation */}
      <div className="flex items-center mb-4 bg-gray-50 p-2 rounded">
        <button 
          className="p-2 rounded hover:bg-gray-200"
          onClick={navigateHome}
          title="Home"
        >
          <FiHome />
        </button>
        
        {/* Breadcrumb */}
        <div className="flex items-center ml-2 text-sm">
          <span 
            className="cursor-pointer hover:text-indigo-600"
            onClick={navigateHome}
          >
            All Regions
          </span>
          
          {navigationPath.map((name, index) => (
            <React.Fragment key={index}>
              <FiChevronRight className="mx-2 text-gray-400" />
              <span 
                className={`cursor-pointer ${index === navigationPath.length - 1 ? 'font-semibold' : 'hover:text-indigo-600'}`}
                onClick={() => setNavigationPath(navigationPath.slice(0, index + 1))}
              >
                {name}
              </span>
            </React.Fragment>
          ))}
        </div>
        
        <div className="ml-auto flex space-x-2">
          {/* Viz Type Selector */}
          <select
            className="text-sm border rounded p-1"
            value={vizType}
            onChange={(e) => changeVizType(e.target.value)}
          >
            <option value="treemap">Treemap</option>
            <option value="sunburst">Sunburst</option>
            <option value="barchart">Bar Chart</option>
          </select>
          
          {/* Navigation buttons */}
          {navigationPath.length > 0 && (
            <button 
              className="p-2 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
              onClick={navigateUp}
            >
              Up One Level
            </button>
          )}
        </div>
      </div>
      
      {/* Level description */}
      <div className="mb-4 text-sm text-gray-500">
        {currentLevel === 'region' && 'Viewing sales by region. Click on a region to see countries.'}
        {currentLevel === 'country' && 'Viewing sales by country. Click on a country to see categories.'}
        {currentLevel === 'category' && 'Viewing sales by product category. Click on a category to see products.'}
        {currentLevel === 'product' && 'Viewing individual products.'}
      </div>
      
      {/* Main visualization container */}
      <div ref={containerRef} className="relative w-full h-96 overflow-hidden">
        <svg ref={svgRef} className="w-full h-full"></svg>
        <div
          ref={tooltipRef}
          className="tooltip"
          style={{
            position: 'absolute',
            opacity: 0,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '8px',
            pointerEvents: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 10
          }}
        ></div>
        
        {/* Visualization type transition indicators */}
        {isTransitioning && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60">
            <div className="text-lg font-medium text-indigo-600">
              {`Transitioning to ${vizType}...`}
            </div>
          </div>
        )}
        
        {/* No data message */}
        {(!currentData || !currentData.children || currentData.children.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center p-4">
              <div className="text-gray-500 mb-2">No data available for this view</div>
              <button 
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                onClick={navigateHome}
              >
                Return to Overview
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="mt-4 p-3 border rounded-md">
        <div className="text-sm font-medium mb-2">Visual Hierarchy</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 mr-2 rounded"></div>
            <span className="text-sm">Region (Treemap)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-400 mr-2 rounded"></div>
            <span className="text-sm">Country (Sunburst)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-purple-400 mr-2 rounded"></div>
            <span className="text-sm">Category (Bar Chart)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-indigo-300 mr-2 rounded"></div>
            <span className="text-sm">Product (Details)</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Click on elements to drill down. The visualization type changes automatically at each level for the best context.
        </div>
      </div>
    </div>
  );
};

export default MicroMacroVisualization;