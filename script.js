let coreCourses = new Set();
let showCoreHighlight = true;
let coursesDataGlobal = [];
let selectedThemes = new Set();
let svg;
let g;

document.addEventListener('DOMContentLoaded', init);

function init() {
    svg = d3.select('svg');
    Promise.all([
        d3.json('data/core_courses.json'),
        d3.json('data/micb_courses_dependancies.json')
    ]).then(([coreList, coursesData]) => {
        coreCourses = new Set(coreList);
        coursesDataGlobal = coursesData;
        setupThemeFilters(coursesDataGlobal);
        g = createGraph();
        updateGraph(coursesDataGlobal);

        document.getElementById('prerequisite-toggle').addEventListener('change', () => {
            d3.select('svg g').remove();
            g = createGraph();
            updateGraph(coursesDataGlobal);
        });

        document.getElementById('core-toggle').addEventListener('change', function () {
            showCoreHighlight = this.checked;
            d3.select('svg g').remove();
            g = createGraph(); // Add this line
            updateGraph(coursesDataGlobal);
        });
    }).catch(err => console.error('Error loading the JSON:', err));
}

function createGraph() {
    return new dagreD3.graphlib.Graph({compound: true}).setGraph({
        rankdir: 'TB',
        nodesep: 30,
        edgesep: 0,
        ranksep: 100,
        marginx: 20,
        marginy: 20
    }).setDefaultEdgeLabel(function() { return {}; });
}

function setupThemeFilters(coursesData) {
    const themesContainer = document.getElementById('themes-container');
    const allThemes = new Set();
    coursesData.forEach(course => {
        if (Array.isArray(course.themes)) {
            course.themes.forEach(t => allThemes.add(t));
        }
    });

    if (allThemes.size === 0) {
        themesContainer.textContent = 'No themes available';
        return;
    }

    [...allThemes].forEach((theme, index) => {
        const themeElement = document.createElement('div');
        themeElement.className = 'theme-option';

        const themeText = document.createElement('span');
        themeText.textContent = theme;
        themeText.className = 'theme-text';

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
            d3.select('svg g').remove();
            updateGraph(coursesDataGlobal);
        });
    });
}

function updateGraph(coursesData) {
    d3.select('svg g').remove();
    g = createGraph();

    const filtered = coursesData.filter(course => course.course_code.startsWith('MICB'));
    const courses = document.getElementById('prerequisite-toggle').checked ? coursesData : filtered;

    buildGraph(courses);
    addCustomFakeEdges();
    renderGraph(courses.map(c => c.course_code), coursesData);
}

function buildGraph(courses) {
    const isSelectedEmpty = selectedThemes.size === 0;
    let themeCourses = [];

    if (!isSelectedEmpty) {
        themeCourses = coursesDataGlobal.filter(course =>
            course.themes.some(theme => selectedThemes.has(theme))
        );
    }

    const addedNodes = new Set();
    courses.forEach(course => {
        addNodeIfNotExists(course.course_code, addedNodes, themeCourses);

        course.prerequisites.forEach(prereq => {
            addNodeIfNotExists(prereq, addedNodes, themeCourses);
            addEdge(prereq, course.course_code, 'prerequisite');
        });

        course.corequisites.forEach(coreq => {
            addNodeIfNotExists(coreq, addedNodes, themeCourses);
            addEdge(coreq, course.course_code, 'corequisite');
        });
    });
}

function renderGraph(courseIds, coursesData) {
    const inner = svg.append('g');
    const zoom = d3.zoom().on('zoom', event => inner.attr('transform', event.transform));
    svg.call(zoom);

    const render = new dagreD3.render();

    // Hexagon shape
    render.shapes().hexagon = function (parent, bbox, node) {
        const w = bbox.width;
        const h = bbox.height;

        const points = [
            { x: w / 4,  y:  0       },  // left-top
            { x: (3 * w) / 4, y:  0  },  // right-top
            { x: w,      y: -h / 2   },  // right-mid
            { x: (3 * w) / 4, y: -h  },  // right-bottom
            { x: w / 4,  y: -h       },  // left-bottom
            { x: 0,      y: -h / 2   }   // left-mid
        ];

        const shapeSvg = parent.insert("polygon", ":first-child")
            .attr("points", points.map(p => `${p.x},${p.y}`).join(" "))
            .attr("transform", `translate(${-w / 2},${h / 2})`);

        node.intersect = point => dagreD3.intersect.polygon(node, points, point);

        return shapeSvg;
    };

    render(inner, g);

    const offsetX = (svg.attr('width') - g.graph().width) / 10 + 350;
    const offsetY = 20;
    const initialScale = 0.45;
    svg.call(zoom.transform, d3.zoomIdentity.translate(offsetX, offsetY).scale(initialScale));

    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    const styleTooltip = (name, description) => `<p>${name}</p><p>${description}</p>`;

    inner.selectAll('g.node')
        .on('mouseover', function (event, d) {
            const course = coursesData.find(c => c.course_code === d);
            tooltip.transition().duration(10).style('opacity', 1);
            tooltip.html(`
                <div class="title">${course.course_code}</div>
                <div class="body">${styleTooltip(course.course_title, course.description)}</div>
                <div class='theme-footer'>Themes: ${course.themes}</div>
            `);

            d3.select(this).select('rect, circle, diamond').style('fill', () => {
                if (selectedThemes.size === 0) {
                    if (showCoreHighlight && coreCourses.has(course.course_code)) {
                        return '#ffcc00';
                    }
                    return d.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
                }

                const currentCourse = coursesData.find(c => c.course_code === d);
                const hasSelected = currentCourse && currentCourse.themes.some(t => selectedThemes.has(t));
                if (hasSelected) {
                    return '#9966cc';
                }
                if (showCoreHighlight && coreCourses.has(d)) {
                    return '#ffcc00';
                }
                return d.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
            });

            d3.select(this).select('text').style('font-weight', 'bold');
            d3.select(this).style('opacity', 1);

            inner.selectAll('g.node').filter(n => n !== d).style('opacity', 0.2);
            inner.selectAll('g.edgePath').style('opacity', 0.2);

            if (course && course.prerequisites.length > 0) {
                course.prerequisites.forEach(prereq => {
                    inner.select(`g.node[id="${prereq}"]`).select('rect, circle, polygon').style('fill', 'cyan');
                    inner.select(`g.node[id="${prereq}"]`).select('text').style('font-weight', 'bold');
                    inner.select(`g.node[id="${prereq}"]`).style('opacity', 1);
                    inner.select(`g.edgePath[id*="${prereq}-${d}"]`).style('opacity', 1)
                        .select('path')
                        .style('stroke-width', '3px')
                        .style('stroke', 'black');
                });
            }

            if (course && course.corequisites.length > 0) {
                course.corequisites.forEach(coreq => {
                    inner.select(`g.node[id="${coreq}"]`).select('rect, circle, polygon').style('fill', 'coral');
                    inner.select(`g.node[id="${coreq}"]`).select('text').style('font-weight', 'bold');
                    inner.select(`g.node[id="${coreq}"]`).style('opacity', 1);
                    inner.select(`g.edgePath[id*="${coreq}-${d}"]`).style('opacity', 1)
                        .select('path')
                        .style('stroke-width', '3px')
                        .style('stroke', 'black')
                        .style('stroke-dasharray', '5, 5');
                });
            }
        })
        .on('mousemove', function (event) {
            const tooltipWidth = tooltip.node().offsetWidth;
            const tooltipHeight = tooltip.node().offsetHeight;
            const x = event.clientX + 10;
            const y = event.clientY + 10;
            const mainRect = document.querySelector('main').getBoundingClientRect();
            const xPos = x + tooltipWidth > mainRect.width ? x - tooltipWidth - 20 : x;
            const yPos = y + tooltipHeight > mainRect.height ? y - tooltipHeight - 20 : y;
            tooltip.style('left', `${xPos}px`).style('top', `${yPos}px`);
        });

    inner.selectAll('g.node')
        .on('mouseout', function (event, d) {
            const course = coursesData.find(c => c.course_code === d);
            tooltip.transition().duration(10).style('opacity', 0);

            d3.select(this).select('rect, circle, diamond').style('fill', function () {
                if (selectedThemes.size === 0) {
                    if (showCoreHighlight && coreCourses.has(course.course_code)) {
                        return '#ffcc00';
                    }
                    return d.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
                }
                return d3.select(this).style('fill');
            });
            d3.select(this).select('text').style('font-weight', null);
            d3.select(this).style('opacity', 1);

            inner.selectAll('g.node').style('opacity', 1);
            inner.selectAll('g.edgePath').style('opacity', 1);

            if (course) {
                course.prerequisites.forEach(prereq => {
                    inner.select(`g.node[id="${prereq}"]`).select('rect, circle, polygon').style('fill', function () {
                        if (selectedThemes.size === 0) {
                            if (showCoreHighlight && coreCourses.has(prereq)) {
                                return '#ffcc00';
                            }
                            return prereq.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
                        }
                        const prereqCourse = coursesData.find(c => c.course_code === prereq);
                        const hasSelected = prereqCourse && prereqCourse.themes.some(t => selectedThemes.has(t));
                        if (hasSelected) {
                            return '#9966cc';
                        }
                        if (showCoreHighlight && coreCourses.has(prereq)) {
                            return '#ffcc00';
                        }
                        return prereq.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
                    });
                    inner.select(`g.node[id="${prereq}"]`).select('text').style('font-weight', null);
                    inner.select(`g.edgePath[id*="${prereq}-${d}"]`).style('opacity', 1)
                        .select('path')
                        .style('stroke-width', '1.5px')
                        .style('stroke', 'black');
                });

                course.corequisites.forEach(coreq => {
                    inner.select(`g.node[id="${coreq}"]`).select('rect, circle, polygon').style('fill', function () {
                        if (selectedThemes.size === 0) {
                            if (showCoreHighlight && coreCourses.has(coreq)) {
                                return '#ffcc00';
                            }
                            return d.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
                        }
                        const coreqCourse = coursesData.find(c => c.course_code === coreq);
                        const hasSelected = coreqCourse && coreqCourse.themes.some(t => selectedThemes.has(t));
                        if (hasSelected) {
                            return '#9966cc';
                        }
                        if (showCoreHighlight && coreCourses.has(coreq)) {
                            return '#ffcc00';
                        }
                        return coreq.startsWith('MICB') ? '#EEDFCC' : '#f0f0f0';
                    });
                    inner.select(`g.node[id="${coreq}"]`).select('text').style('font-weight', null);
                    inner.select(`g.edgePath[id*="${coreq}-${d}"]`).style('opacity', 1)
                        .select('path')
                        .style('stroke-width', '1.5px')
                        .style('stroke', 'black')
                        .style('stroke-dasharray', '5, 5');
                });
            }
        });
}

function addNodeIfNotExists(nodeId, addedNodes, themeCourses) {
    const full_course = coursesDataGlobal.find(course => course.course_code === nodeId);
    if (!addedNodes.has(nodeId) && full_course) {
        const isThemeCourse = themeCourses.some(course => course.course_code === nodeId);
        
        // Add the node first
        g.setNode(nodeId, {
            label: nodeId,
            id: nodeId,
            shape: determineShape(full_course),
            style: isThemeCourse
                ? 'fill: #9966cc'
                : (showCoreHighlight && coreCourses.has(nodeId)
                    ? 'fill: #ffcc00;'
                    : (nodeId.startsWith('MICB') ? 'fill: #EEDFCC;' : 'fill: #f0f0f0;')),
            labelStyle: 'fill: black;',
            width: 100,
            height: 50,
            rx: determineShape(full_course) === 'rect' ? 100 : null,
            ry: determineShape(full_course) === 'rect' ? 100 : null
        });
        
        // Get the level and create cluster if needed
        const lastThreeChars = nodeId.slice(-3);
        const numericValue = parseInt(lastThreeChars, 10);
        let clusterId = null;
        
        if (numericValue >= 100 && numericValue <= 199) {
            clusterId = 'cluster_1xx';
        } else if (numericValue >= 200 && numericValue <= 299) {
            clusterId = 'cluster_2xx';
        } else if (numericValue >= 300 && numericValue <= 399) {
            clusterId = 'cluster_3xx';
        } else if (numericValue >= 400 && numericValue <= 499) {
            clusterId = 'cluster_4xx';
        }
        
        if (clusterId) {
            // Create main cluster if it doesn't exist
            if (!g.hasNode(clusterId)) {
                g.setNode(clusterId, {
                    label: '',
                    shape: 'rect',
                    class: 'cluster'
                });
            }
            
            // Check if this course belongs to a sub-cluster
            const subClusterId = findSubCluster(nodeId, clusterId);
            
            if (subClusterId) {
                const fullSubClusterId = `${clusterId}_${subClusterId}`;
                
                if (!g.hasNode(fullSubClusterId)) {
                    g.setNode(fullSubClusterId, {
                        label: '',
                        shape: 'rect',
                        class: 'cluster'
                    });
                    
                    // Assign sub-cluster to main cluster
                    g.setParent(fullSubClusterId, clusterId);
                }
                
                // Check if this course belongs to a sub-sub-cluster
                const subSubClusterId = findSubSubCluster(nodeId, clusterId, subClusterId);
                
                if (subSubClusterId) {
                    const fullSubSubClusterId = `${clusterId}_${subClusterId}_${subSubClusterId}`;
                    
                    if (!g.hasNode(fullSubSubClusterId)) {
                        g.setNode(fullSubSubClusterId, {
                            label: '',
                            shape: 'rect',
                            class: 'cluster'
                        });
                        
                        // Assign sub-sub-cluster to sub-cluster
                        g.setParent(fullSubSubClusterId, fullSubClusterId);
                    }
                    
                    g.setParent(nodeId, fullSubSubClusterId);
                } else {
                    g.setParent(nodeId, fullSubClusterId);
                }
            } else {
                g.setParent(nodeId, clusterId);
            }
        }
        
        addedNodes.add(nodeId);
    }
}

function addEdge(source, target, type) {
    const edgeClass = type === 'corequisite' ? 'corequisite-edge' : undefined;
    g.setEdge(source, target, {
        label: '',
        id: `${source}-${target}`,
        curve: d3.curveBasis,
        class: edgeClass
    });
}

function determineShape(course) {
    if (course.class_type === 'Lab') return 'diamond';
    if (course.class_type === 'Lecture') return 'rect';
    if (course.course_title.includes('Co-operative')) return 'hexagon';
}

function addCustomFakeEdges() {
    // Array of tuples: [from_course, to_course]
    const fakeEdges = [
        ['DSCI 100', 'BIOL 200'], // To ensure 200 level courses are below 100 level
        ['MICB 211', 'BIOT 380'], // To ensure 300 level courses are below 200 level
    ];

    fakeEdges.forEach(([fromCourse, toCourse]) => {
        if (g.hasNode(fromCourse) && g.hasNode(toCourse)) {
            if (!g.hasEdge(fromCourse, toCourse)) {
                g.setEdge(fromCourse, toCourse, {
                    class: 'fake-edge',
                    weight: 0.5
                });
            }
        }
    });
}

// Creating 'fake' subgroups to force nodes to be beside each other

const courseGroupings = {
    'cluster_4xx': {
        'grouping1': {
            courses: ['MICB 471', 'MICB 430', 'MICB 407', 'MICB 425'],
            subgroups: {
                'grouping2': ['MICB 407', 'MICB 425']
            }
        }
    },

    'cluster_3xx': {
    },

    'cluster_2xx': {
    },

    'cluster_1xx': {
    }
};

// Unified helper function to find which grouping a course belongs to at any level
function findGrouping(courseCode, clusterId, parentGrouping = null) {
    if (!courseGroupings[clusterId]) {
        return null;
    }
    
    // If we're looking for a sub-sub-cluster within a specific parent grouping
    if (parentGrouping && courseGroupings[clusterId][parentGrouping] && courseGroupings[clusterId][parentGrouping].subgroups) {
        for (const [subGroupName, courses] of Object.entries(courseGroupings[clusterId][parentGrouping].subgroups)) {
            if (courses.includes(courseCode)) {
                return subGroupName;
            }
        }
        return null;
    }
    
    // Looking for main sub-cluster
    for (const [groupingName, groupingData] of Object.entries(courseGroupings[clusterId])) {
        if (groupingData.courses && groupingData.courses.includes(courseCode)) {
            return groupingName;
        }
    }
    return null;
}

// Convenience functions for backward compatibility
function findSubCluster(courseCode, clusterId) {
    return findGrouping(courseCode, clusterId);
}

function findSubSubCluster(courseCode, clusterId, subClusterId) {
    return findGrouping(courseCode, clusterId, subClusterId);
}