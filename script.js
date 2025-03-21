document.addEventListener("DOMContentLoaded", function() {   
    d3.json('data/micb_courses_dependancies.json').then(coursesData => {

        // Collect all unique themes from all courses
        const allThemes = new Set();
        coursesData.forEach(course => {
            if (Array.isArray(course.themes)) {
                course.themes.forEach(theme => allThemes.add(theme));
            }
        });

        const uniqueThemes = Array.from(allThemes);
        console.log("Unique themes:", uniqueThemes);

        const themesContainer = document.getElementById('themes-container');

        if (uniqueThemes.length === 0) {
            console.log("No themes found in the data");
            themesContainer.textContent = "No themes available";
            return;
        }

        let selectedThemes = new Set()

        uniqueThemes.forEach((theme, index) => {
            const themeElement = document.createElement('div');
            themeElement.style.display = 'flex';
            themeElement.style.alignItems = 'center';
            themeElement.style.marginBottom = '10px';

            const themeText = document.createElement('span');
            themeText.textContent = theme;
            themeText.style.marginRight = '10px';

            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';

            const switchInput = document.createElement('input');
            switchInput.type = 'checkbox';
            switchInput.id = `theme-toggle-${index}`;

            const switchSlider = document.createElement('span');
            switchSlider.className = 'slider round';

            switchLabel.appendChild(switchInput);
            switchLabel.appendChild(switchSlider);

            themeElement.appendChild(themeText);
            themeElement.appendChild(switchLabel);

            themesContainer.appendChild(themeElement);

            switchInput.addEventListener('change', () => {
                if (switchInput.checked) {
                    selectedThemes.add(theme);
                } else {
                    selectedThemes.delete(theme);
                }
                d3.select("svg g").remove();
                updateGraph(coursesData);
            });
        });
        
        const svg = d3.select("svg");

        var g = new dagreD3.graphlib.Graph().setGraph({
            rankdir: 'TB',
            nodesep: 30,
            edgesep: 0,
            ranksep: 200
        });

        updateGraph(coursesData);

        document.getElementById('prerequisite-toggle').addEventListener('change', () => {
            // Clear the graph manually before updating
            d3.select("svg g").remove(); // Removes the existing graph content
            g = new dagreD3.graphlib.Graph().setGraph({
                rankdir: 'TB',
                nodesep: 30,
                edgesep: 0,
                ranksep: 200
            });

            updateGraph(coursesData); // Call the updateGraph function when the checkbox state changes
        });

        // Function to render the graph
        function renderGraph(filteredCourseIds) {

            // g.nodes().forEach(function(v) {
            //     var node = g.node(v);
            //     node.rx = node.ry = 100;
            // });

            var inner = svg.append("g");
            var zoom = d3.zoom().on("zoom", function(event) {
                inner.attr("transform", event.transform);
            });
            svg.call(zoom);

            var render = new dagreD3.render();
            render(inner, g);

            var graphWidth = g.graph().width || 0;
            var graphHeight = g.graph().height || 0;
            var initialScale = 0.45;
            var offsetX = (svg.attr("width") - g.graph().width) / 10 + 350;
            var offsetY = 20;
            
            svg.call(zoom.transform, d3.zoomIdentity.translate(offsetX, offsetY).scale(initialScale));

            // Create the tooltip div
            var tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

            // Simple function to style the tooltip for the given node.
            var styleTooltip = function(name, description) {
                return "<p>" + name + "</p><p>" + description + "</p>";
            };

            // Mouseover: make edges of prerequisites and corequisites higher opacity, others lower
            inner.selectAll("g.node").on("mouseover", function(event, d) {
                const course = coursesData.find(course => course.course_code === d);
                console.log(course.course_code)

                // Set tooltip content dynamically
                tooltip.transition().duration(10).style("opacity", 1); // Show the tooltip
                tooltip.html(`
                    <div class="title">${course.course_code}</div>
                    <div class="body">${styleTooltip(course.course_title, course.description)}</div>
                    <div class='theme-footer'>Themes: ${course.themes}</div>
                `);

                // Make the hovered node bold and full opacity
                d3.select(this).select("rect, circle, diamond").style("fill", function(d) {
                    if (selectedThemes.size === 0) {
                        return d.startsWith("MICB") ? "#EEDFCC" : "#f0f0f0";
                    } else {
                        // If themes are selected, keep the current fill color
                        return d3.select(this).style("fill");
                    }
                });
                d3.select(this).select("text").style("font-weight", "bold");
                d3.select(this).style("opacity", 1);

                // Reduce opacity of all other nodes and edges
                inner.selectAll("g.node").filter(n => n !== d).style("opacity", 0.2);
                inner.selectAll("g.edgePath").style("opacity", 0.2);

                // Highlight prerequisites and corequisites
                if (course && course.prerequisites.length > 0) {
                    course.prerequisites.forEach(function(prereq) {
                        // Highlight node
                        inner.select(`g.node[id="${prereq}"]`).select("rect, circle, polygon").style("fill", "cyan");
                        inner.select(`g.node[id="${prereq}"]`).select("text").style("font-weight", "bold");
                        inner.select(`g.node[id="${prereq}"]`).style("opacity", 1);

                        // Make edge to prerequisite higher opacity
                        inner.select(`g.edgePath[id*="${prereq}-${d}"]`).style("opacity", 1)
                            .select("path")
                            .style("stroke-width", "3px")
                            .style("stroke", "black");
                    });
                }

                if (course && course.corequisites.length > 0) {
                    course.corequisites.forEach(function(coreq) {
                        // Highlight node
                        inner.select(`g.node[id="${coreq}"]`).select("rect, circle, polygon").style("fill", "coral");
                        inner.select(`g.node[id="${coreq}"]`).select("text").style("font-weight", "bold");
                        inner.select(`g.node[id="${coreq}"]`).style("opacity", 1);

                        inner.select(`g.edgePath[id*="${coreq}-${d}"]`).style("opacity", 1)
                            .select("path")
                            .style("stroke-width", "3px")
                            .style("stroke", "coral")
                            .style("stroke-dasharray", "5, 5");
                    });
                }
            })
            .on("mousemove", function (event) {
                // Position the tooltip relative to the viewport
                const tooltipWidth = tooltip.node().offsetWidth;
                const tooltipHeight = tooltip.node().offsetHeight;
        
                const x = event.clientX + 10; // Offset tooltip slightly from the cursor
                const y = event.clientY + 10;
        
                // Prevent tooltip from going off-screen
                const xPos = x + tooltipWidth > window.innerWidth ? x - tooltipWidth - 20 : x;
                const yPos = y + tooltipHeight > window.innerHeight ? y - tooltipHeight - 20 : y;
        
                tooltip.style("left", xPos + "px").style("top", yPos + "px");
            });

            // Mouseout: reset styles for all nodes and edges
            inner.selectAll("g.node").on("mouseout", function(event, d) {
                const course = coursesData.find(course => course.course_code === d);

                tooltip.transition().duration(10).style("opacity", 0); // Hide the tooltip

                // Reset hovered node style
                d3.select(this).select("rect, circle, diamond").style("fill", function(d) {
                    if (selectedThemes.size === 0) {
                        return d.startsWith("MICB") ? "#EEDFCC" : "#f0f0f0";
                    } else {
                        // If themes are selected, keep the current fill color
                        return d3.select(this).style("fill");
                    }
                });
                d3.select(this).select("text").style("font-weight", null);
                d3.select(this).style("opacity", 1);

                // Reset opacity for all nodes and edges
                inner.selectAll("g.node").style("opacity", 1);
                inner.selectAll("g.edgePath").style("opacity", 1);

                if (course) {
                    // Reset styles for prerequisites
                    course.prerequisites.forEach(function(prereq) {
                        inner.select(`g.node[id="${prereq}"]`).select("rect, circle, polygon").style("fill", function(d) {
                            if (selectedThemes.size === 0) {
                                return d.startsWith("MICB") ? "#EEDFCC" : "#f0f0f0";
                            } else {
                                // Find the full course data for this prerequisite
                                const prereqCourse = coursesData.find(course => course.course_code === prereq);
                                
                                // Check if the prerequisite course has any of the selected themes
                                const hasSelectedTheme = prereqCourse && prereqCourse.themes.some(theme => selectedThemes.has(theme));
                                
                                if (hasSelectedTheme) {
                                    return "red";
                                } else {
                                    return d.startsWith("MICB") ? "#EEDFCC" : "#f0f0f0";
                                }
                            }
                        });                        
                        inner.select(`g.node[id="${prereq}"]`).select("text").style("font-weight", null);
                        inner.select(`g.edgePath[id*="${prereq}-${d}"]`).style("opacity", 1)
                            .select("path")
                            .style("stroke-width", "1.5px")
                            .style("stroke", "black");
                    });

                    // Reset styles for corequisites
                    course.corequisites.forEach(function(coreq) {
                        inner.select(`g.node[id="${coreq}"]`).select("rect, circle, polygon").style("fill", function(d) {
                            if (selectedThemes.size === 0) {
                                return d.startsWith("MICB") ? "#EEDFCC" : "#f0f0f0";
                            } else {
                                // Find the full course data for this prerequisite
                                const coreqCourse = coursesData.find(course => course.course_code === coreq);
                                
                                // Check if the prerequisite course has any of the selected themes
                                const hasSelectedTheme = coreqCourse && coreqCourse.themes.some(theme => selectedThemes.has(theme));
                                
                                if (hasSelectedTheme) {
                                    return "red";
                                } else {
                                    return d.startsWith("MICB") ? "#EEDFCC" : "#f0f0f0";
                                }
                            }
                        });
                        inner.select(`g.node[id="${coreq}"]`).select("text").style("font-weight", null);
                        inner.select(`g.edgePath[id*="${coreq}-${d}"]`).style("opacity", 1)
                            .select("path")
                            .style("stroke-width", "1.5px")
                            .style("stroke", "coral")
                            .style("stroke-dasharray", "5, 5");
                    });
                }
            });
        }

        // Function to update the graph based on selected subjects and themes
        function updateGraph(coursesData) {

            const filteredCourses = coursesData.filter(course => course.course_code.startsWith("MICB"));
            const allCourses = coursesData
        
            if (document.getElementById('prerequisite-toggle').checked) {
                console.log("MICB Courses with all dependancies");
                buildGraph(allCourses)
                // Render the updated graph
                renderGraph(allCourses.map(course => course.course_code));
                
            } else {
                console.log("MICB Courses and their direct dependancies.");
                // Build graph with filtered courses
                buildGraph(filteredCourses);
                // Render the updated graph
                renderGraph(filteredCourses.map(course => course.course_code));
            }
        }
        
        // Helper functions
        
        function buildGraph(courses) {
            const isSelectedThemesEmpty = selectedThemes.size === 0;
            console.log("Are selected themes empty?", isSelectedThemesEmpty);
        
            let coursesWithSelectedThemes = [];
            if (!isSelectedThemesEmpty) {
                coursesWithSelectedThemes = coursesData.filter(course => 
                    course.themes.some(theme => selectedThemes.has(theme))
                );
                console.log("Courses with selected themes:", coursesWithSelectedThemes);
            }
        
            const addedNodes = new Set();
        
            courses.forEach(course => {
                addNodeIfNotExists(course.course_code, addedNodes, coursesWithSelectedThemes);
                
                course.prerequisites.forEach(prereq => {
                    addNodeIfNotExists(prereq, addedNodes, coursesWithSelectedThemes);
                    addEdge(prereq, course.course_code, 'prerequisite');
                });
        
                course.corequisites.forEach(coreq => {
                    addNodeIfNotExists(coreq, addedNodes, coursesWithSelectedThemes);
                    addEdge(coreq, course.course_code, 'corequisite');
                });
            });
        }              
        
        function addNodeIfNotExists(nodeId, addedNodes, coursesWithSelectedThemes) {
            const full_course = coursesData.find(course => course.course_code === nodeId);
            if (!addedNodes.has(nodeId)) {
                const isSelectedThemeCourse = coursesWithSelectedThemes.some(course => course.course_code === nodeId);
                
                g.setNode(nodeId, {
                    label: nodeId,
                    id: nodeId,
                    shape: determineShape(full_course),
                    style: isSelectedThemeCourse 
                        ? 'fill: red;' 
                        : (nodeId.startsWith('MICB') ? 'fill: #EEDFCC;' : 'fill: #f0f0f0;'),
                    labelStyle:'fill: black;',
                    width: 100,
                    height: 50,
                    rx: determineShape(full_course) === 'rect' ? 100 : null,
                    ry: determineShape(full_course) === 'rect' ? 100 : null
                });
                addedNodes.add(nodeId);
            }
        }        

        function determineShape(full_course) {
            if (full_course.class_type === 'Lab') {
            return 'diamond';
            } else if (full_course.class_type === 'Lecture') {
            return 'rect';
            } else {
                if (full_course.course_title.includes('Co-operative'))
                        return 'circle'; // Default shape
            }
        }
        
        function addEdge(source, target, type) {
            const edgeStyle = type === 'corequisite' 
                ? { style: "stroke: coral; stroke-dasharray: 5, 5;", arrowheadStyle: "fill: coral" }
                : { arrowheadStyle: "fill: #000" };
        
            g.setEdge(source, target, {
                label: "",
                id: `${source}-${target}`,
                curve: d3.curveBasis,
                ...edgeStyle
            });
        }  

    }).catch(error => console.error('Error loading the JSON:', error));
});