import * as Config from './Config.js';
import * as Data from './Data.js';
import * as Tooltip from './Tooltip.js';
import * as Draw from './Draw.js';
import * as Language from './Language.js';
import * as Layout from './Layout.js';

const workerURL = URL.createObjectURL(
  new Blob(
    [
      '(',

      function () {
        // https://bl.ocks.org/mbostock/01ab2e85e8727d6529d20391c0fd9a16
        // https://gist.github.com/fitzoh/5a0edc40cdabd7e3e421
        // https://codepen.io/s8770125/pen/RRravE

        importScripts('https://d3js.org/d3.v5.min.js');

        // Message event
        onmessage = function (msg) {
          postMessage(simulate(msg.data));
        };

        // Force simulation
        const simulate = function (data) {
          let simulation = d3
            .forceSimulation(data.graph.nodes)
            .force(
              'link',
              d3.forceLink(data.graph.links).id((d) => d.name)
            )
            // .force('center', d3.forceCenter(data.width / 2, data.height / 2))
            .force('charge', d3.forceManyBody())
            .force('x', d3.forceX())
            .force('y', d3.forceY())
            .alphaDecay([0.02])
            .stop();

          // simulation.tick(120);

          for (
            var i = 0,
              n = Math.ceil(
                Math.log(simulation.alphaMin()) /
                  Math.log(1 - simulation.alphaDecay())
              );
            i < n;
            ++i
          ) {
            postMessage({ type: 'tick', progress: i / n });
            simulation.tick();
          }

          postMessage({
            type: 'end',
            nodes: data.graph.nodes,
            links: data.graph.links,
          });
        };
      }.toString(),
      ')()',
    ],
    { type: 'application/javascript' }
  )
);

/* Init Worker */
let worker = new Worker(workerURL);

let graph = { nodes: [], links: [] };
let svg, sources, casesData, cases;

let legendStatus = false,
  infoStatus = true,
  searchStatus = true;
let playCasesNow, thisCaseId, thisCaseOrder;

// Switch the language to english/romanian
let language = d3.select('#language').node().value;
let dataPath =
  language === 'en'
    ? '../data/cases_relations_simulated.json'
    : 'data/cases_relations_simulated.json';

(() => {
  // Options for loading spinner
  let opts = {
      lines: 9,
      length: 4,
      width: 5,
      radius: 12,
      scale: 1,
      corners: 1,
      color: '#f40000',
      opacity: 0.25,
      rotate: 0,
      direction: 1,
      speed: 1,
      trail: 30,
      fps: 20,
      zIndex: 2e9,
      className: 'spinner',
      shadow: false,
      hwaccel: false,
      position: 'absolute',
    },
    target = document.getElementById('spinner'),
    spinner;

  spinner = new Spinner(opts).spin(target);

  const meter = d3.select('#progress');

  // Append the svg object to the chart div
  svg = d3
    .select('#chart')
    .append('svg')
    .attr('class', 'chart-group')
    .attr('preserveAspectRatio', 'xMinYMid')
    .attr('width', Config.svg_width)
    .attr('height', Config.svg_height)
    .attr('viewBox', [
      -Config.width / 2,
      -Config.height / 2,
      Config.width,
      Config.height,
    ]);

  // Append zoomable group
  svg
    .append('g')
    .attr('class', 'zoomable-group')
    .attr(
      'transform',
      `translate(${Config.margin.left}, ${Config.margin.top})`
    );
  // .style('transform-origin', '50% 50% 0');

  // Load data
  const promises = [
    // d3.json('https://covid19.geo-spatial.org/api/statistics/getCaseRelations')
    d3.json(dataPath),
  ];

  Promise.all(promises)
    .then((data) => {
      casesData = data[0];

      setupGraph();
      drawGraph();
      setActions();
    })
    .catch((error) => console.log(error));

  const setupGraph = () => {
    // sources = casesData.data.nodes.filter( d => d.properties.country_of_infection !== null && d.properties.country_of_infection !== 'România' && d.properties.country_of_infection !== 'Romania');
    // let counties = casesData.data.nodes.filter( d => d.properties.county);

    graph.nodes = casesData.nodes;
    graph.links = casesData.links;

    cases = Array.from(
      new Set(
        graph.nodes.map((d) => (d.properties ? +d.properties.case_no : ''))
      )
    );

    // // https://observablehq.com/d/cedc594061a988c6
    // graph.nodes = graph.nodes.concat(Array.from(new Set(sources.map(d => d.properties.country_of_infection)), name => ({name})));
    // graph.nodes = graph.nodes.concat(Array.from(new Set(counties.map(d => d.properties.county)), name => ({name})));

    // graph.links = graph.links.concat(sources.map(d => ({target: d.name, source: d.properties.country_of_infection})));
    // graph.links = graph.links.concat(counties.map(d => ({target: d.name, source: d.properties.county})));

    // graph.nodes = Data.formatNodes(graph.nodes);
  };

  const drawGraph = () => {
    // Apply zoom handler and zoom out
    svg.call(Layout.zoom);
    Layout.resetZoom();

    // Draw nodes and links
    Draw.NodesAndLinks(graph, cases);

    // Show counties colors first
    Layout.colorCounties();

    // Hide case labels first
    Layout.hideLabels(1);

    // Zoom to latest case, when loading spinner stops
    spinner.stop();
    d3.select('tooltip_div').classed('tooltip-abs', true);
    d3.select('#CO-' + d3.max(cases))
      .attr('r', (d) => 2 * d.r)
      .dispatch('mouseover');

    // // Create worker and send message to start force graph
    // const ticked = (data) => {
    //     meter.style('width', 100 * data.progress + "%");
    // };

    // const ended = (data) => {
    //     graph.nodes = data.nodes;
    //     graph.links = data.links;

    //     // Apply zoom handler and zoom out
    //     svg.call(Layout.zoom);
    //     Layout.resetZoom();

    //     // Draw nodes and links
    //     Draw.NodesAndLinks(graph, cases);

    //     // Show counties colors first
    //     Layout.colorCounties();

    //     // Hide case labels first
    //     Layout.hideLabels(1);

    //     // Zoom to latest case, when loading spinner stops
    //     spinner.stop();
    //     d3.select('tooltip_div').classed('tooltip-abs', true);
    //     d3.select('#CO-' + d3.max(cases))
    //         .attr('r', d => 2 * d.r)
    //         .dispatch('mouseover');

    //     meter.style('width', 0);
    // };

    // // Post data to web-worker
    // worker.postMessage({ graph: graph, width: Config.width, height: Config.height });

    // // Listen for worker
    // worker.addEventListener( 'message', function( e ) {
    //     if ( e.data !== undefined ) {
    //         console.log(e.data);
    //         switch (e.data.type) {
    //             case "tick": return ticked(e.data);
    //             case "end": return ended(e.data);
    //         }
    //     }
    // }, false );
  };

  const setActions = () => {
    // Add legends
    Layout.createLegend(
      Layout.statusColor(language),
      300,
      300,
      'status-legend',
      Language.status(language)
    );
    Layout.createLegend(
      Layout.countyColor,
      900,
      1100,
      'county-legend',
      Language.county(language)
    );
    Layout.createLegend(
      Layout.genderColor(language),
      200,
      200,
      'gender-legend',
      Language.gender(language)
    );
    Layout.createLegend(
      Layout.ageColor,
      400,
      400,
      'age-legend',
      Language.age(language)
    );

    // Zoom by scroll, pan
    d3.select('#zoom-in').on('click', () =>
      svg.transition().call(Layout.zoom.scaleBy, 2)
    );
    d3.select('#zoom-out').on('click', () =>
      svg.transition().call(Layout.zoom.scaleBy, 0.5)
    );
    d3.select('#reset-zoom').on('click', () => Layout.resetZoom());

    // Change colors from status to counties and vice versa
    d3.select('#color-counties').on('click', () => Layout.colorCounties());
    d3.select('#color-status').on('click', () => Layout.colorStatus());
    d3.select('#color-gender').on('click', () => Layout.colorGender());
    d3.select('#color-age').on('click', () => Layout.colorAge());

    // Toggle the legend
    const toggleLegend = () => {
      if (legendStatus === true) {
        d3.select('#legend-div').classed('hide', true);
        legendStatus = false;
      } else {
        d3.select('#legend-div').classed('hide', false);
        legendStatus = true;
      }
    };
    d3.select('#legend-div').classed('hide', true);
    d3.select('#toggle-legend').on('click', () => toggleLegend());

    // Highlight and pan to searched Id
    d3.select('#search-case').on('click', () => {
      if (searchStatus === true) {
        d3.select('#search-input').classed('hide', false);
        searchStatus = false;
      } else {
        d3.select('#search-input').classed('hide', true);
        searchStatus = true;
      }
    });
    d3.select('#search-input').on('input', function () {
      if (cases.includes(+this.value)) {
        Tooltip.highlightSearchedId(+this.value);
      }
    });

    // General page info
    d3.select('#show-info').on(
      'click',
      () => (infoStatus = Tooltip.toggleInfo(infoStatus, language))
    );

    // Start/stop the animation - highlight the cases ordered by day and case number
    d3.select('#play-cases').on('click', () => {
      d3.select('#play-cases').classed('hide', true);
      d3.select('#pause-cases').classed('hide', false);
      playCases();
    });
    d3.select('#pause-cases').on('click', () => {
      d3.select('#pause-cases').classed('hide', true);
      d3.select('#play-cases').classed('hide', false);
      pauseCases();
    });

    const playCases = () => {
      svg.call(Layout.zoom.scaleTo, 0.5);
      thisCaseOrder = d3.select('#nRadius').node().value;
      if (+thisCaseOrder === +cases.length - 1) thisCaseOrder = 0;

      playCasesNow = setInterval(() => {
        thisCaseId = cases[thisCaseOrder];
        if (thisCaseId !== undefined) {
          Layout.updateRadius(cases, thisCaseOrder);
          thisCaseOrder++;
        } else {
          thisCaseOrder = 0;
        }
      }, 200);
    };
    const pauseCases = () => {
      clearInterval(playCasesNow);
    };

    d3.select('#clear-tooltip').on('click', () => {
      Tooltip.unHighlight();
      Tooltip.hideTooltip();
    });

    // Case slider to highlight nodes by id
    // https://bl.ocks.org/d3noob/c4b31a539304c29767a56c2373eeed79/9d18fc47e580d8c940ffffea1179e77e62647e36

    // When the input range changes highlight the circle
    d3.select('#nRadius').on('input', function () {
      Layout.updateRadius(cases, +this.value);
    });
    d3.select('#nRadius').property('max', cases.length - 1);
    Layout.updateRadius(cases, cases.length - 1);

    d3.select('#show-info').dispatch('click');
  };
}).call(this);
