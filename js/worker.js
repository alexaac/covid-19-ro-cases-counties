// https://bl.ocks.org/mbostock/01ab2e85e8727d6529d20391c0fd9a16
// https://gist.github.com/fitzoh/5a0edc40cdabd7e3e421
// https://codepen.io/s8770125/pen/RRravE

importScripts("http://d3js.org/d3.v5.min.js")

var onmessage = function(msg){

    let simulation = d3.forceSimulation(msg.data.graph.nodes)
        .force('link', d3.forceLink(msg.data.graph.links).id( d => d.name))
        // .force('center', d3.forceCenter(msg.data.width / 2, msg.data.height / 2))
        .force('charge', d3.forceManyBody())
        .force('x', d3.forceX())
        .force('y', d3.forceY())
        .alphaDecay([0.02])
        .stop();

    // simulation.tick(120);

    for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
        postMessage({ type: "tick", progress: i / n });
        simulation.tick();
    }

    postMessage({ type: "end", nodes: msg.data.graph.nodes, links: msg.data.graph.links });
}