//global variables
var sys;
var allData;
var appData;
var edgeData;
var edgeLabelData;
var serverData;
var applicationConnections={};

//when document starts call this function
$(document).ready(function(){
	graphSetUp();
});

//graphSetUp() initializes arbor's Particle System and fills the applicationConnections object with data from
//MongoDB. applicationConnections will be used in dynamically graphing new nodes upon clicking them.
//Uncomment log statement at bottom in order to see schema of applicationConnections object.
function graphSetUp(){
	//initialize arbor's ParticleSystem
	sys = arbor.ParticleSystem(6000, 700, 1, false, 55, 0.02, 0.7);
	sys.parameters({gravity:true});
	sys.renderer = Renderer("#viewport");

	//jQuery AJAX call for JSON from MongoDB
	$.getJSON('/users/data', function( data ){
		allData = data;
		appData = allData[1];
		edgeData = allData[0];
		edgeLabelData = allData[2];
		serverData = allData[3];
		//console.log(appData);
		//console.log(edgeData);
		//console.log(edgeLabelData);
		//console.log(serverData);

		//graph base nodes and fill applicationConnections json with appropriate node data
		//loop through each node in appData.
		for(key in appData){
			var node = appData[key];
			if(node.hasOwnProperty("label")){
				var label = node.label;//name of node currently being used
				if(node.base){//graph if base node
					sys.addNode(label, node);
				}

				//creates nodes/edges objects in application connections for each node
				applicationConnections[label]={"nodes":{},"edges":{}};
				//loop through node.to array
				for(var i=0; i<node.to.length; i++){
					var concat = node.to[i].concat("_",label);//make appropriate server name in form of node.to[i]_label
					var edge = edgeData[concat];//gets appropriate edge that matches the server from edgeData.					
					applicationConnections[label].nodes[node.to[i]]=appData[node.to[i]];//creates each node object under nodes object
					applicationConnections[label].edges[node.to[i]]={};//create edge starting at node.to[i]
					//if edge isn't found in node.to[i]_label order then it is named in the opposite fashion.
					//ie label_node.to[i].
					if(edge==null){
						concat = label.concat("_", node.to[i]);
						edge = edgeData[concat];
					}
					applicationConnections[label].edges[node.to[i]][label]=edge;//creates target node object
				}
				
				applicationConnections[label].edges[label]={};//creates label node's object for edges
				//loop through node.from array
				for(var i=0; i<node.from.length; i++){
					var concat = label.concat("_",node.from[i]);
					var edge = edgeData[concat];
					applicationConnections[label].nodes[node.from[i]]=appData[node.from[i]];//add to nodes:{} from from array
					if(edge==null){
						concat = node.from[i].concat("_",label);
						edge = edgeData[concat];
					}
					applicationConnections[label].edges[label][node.from[i]]=edge;
				}
			}//end if(hasOwnProperty)
		}
		//console.log(applicationConnections);


	});//end getJSON
};

//expands all the applications that the node is connected to.
function expandApplicationNode(nodeName){
	if(appData.hasOwnProperty(nodeName)){
		sys.addNode(nodeName, appData[nodeName]);
		appData[nodeName].expanded = true;
		sys.graft(applicationConnections[nodeName]);
	}
	else {//case for when entering incorrect input to text box
		alert("Please choose an appropriate node");
	}
	
};

//generates the edge label for edge
function generateEdgeLabel(edgeName){
	for(key in edgeLabelData){
		var edge = edgeLabelData[key];
		if(edge.hasOwnProperty("label")){
			if(key===edgeName){
				return edge.label;
			}
		}
	}
};

//instead of removing node it simply removes all edges and nodes connected to it and keeps the node itself in the system.
//Usefule for not removing base nodes
function clipNode(nName){
	sys.pruneNode(nName);
    var temp = sys.addNode(nName.name, {'color':nName.data.color, 'shape':nName.data.shape, 
    	'label':nName.data.label, 'expanded':nName.data.expanded,
    	'to':nName.data.to, 'from':nName.data.from,
        'parent':nName.data.parent, 'base':nName.data.base, 'description':nName.data.description
    });
};

//holds all the cases for generate button
function generate(){
	var inputText = document.getElementById("input");
	var text = inputText.value;
	//graph appropriate node based on text
	var split = text.replace("_", " ").split(" ");
	if(split.length===1){//generates node upon hitting generate button
		expandApplicationNode(split[0]);
	}
	//removes servers for node upon remove button
	else if((split.length===2) && (split[1]==="production" || split[1]==="non-production")){
		var serverName = split[0].concat("Servers");
		var servers = serverData[serverName];
		if(split[1]==="production"){
			sys.graft(servers.production);
		}
		if(split[1]==="non-production"){
			sys.graft(servers.non_production);
		}
	}
	//shows edge label upon entering into generate button
	else if(split.length===2){
		if(edgeData.hasOwnProperty(text)){
			edgeData[text].label=generateEdgeLabel(text);
		}
		else {
			alert("Please enter correct command");
		}		
	}

	if(text==="generate all applications"){
		for(key in appData){
			var node = appData[key];
			if(node.hasOwnProperty("label")){
				expandApplicationNode(node.label);
			}
		}
	}
	
	if(text==="generate all edge labels"){
		sys.eachEdge(function(edge, pt1, pt1){
			edge.data.label = generateEdgeLabel(edge.data.name);//set label field = to the correct label
		});
	}

	//possible generate all servers functions
	/*
	if(text === "generate all production servers"){
		for(key in serverData){
			var branch = serverData[key];
			if(branch.hasOwnProperty("production")){
				sys.graft(branch.production);
			}
		}
	}

	if(text==="generate all non-production servers"){
		for(key in serverData){
			var branch = serverData[key];
			if(branch.hasOwnProperty("non_production")){
				sys.graft(branch.non_production);
			}
		}
	}
	*/
	

}; 

//holds all cases for remove button
function removed(){
	var inputText = document.getElementById("input");
	var text = inputText.value;
	//divides input text based on "_" and " ".
	var split = text.replace("_", " ").split(" ");

	//removes node upon hitting remove button
	if( split.length===1 ){//removes if split only has 1 word and is not a base node
		var node = sys.getNode(split[0]);
		node.data.expanded = false;
		if(node===undefined){
			alert("Please enter correct command");
		}
		else if(node.data.base){
			alert("Red nodes cannot be removed")
		}
		else{
			sys.pruneNode(split[0]);
		}
	}
	//generates servers for node upon generate button
	else if((split.length===2) && (split[1]==="production" || split[1]==="non-production")){
		var serverName = split[0].concat("Servers");
		var servers = serverData[serverName];
		if(split[1]==="production"){
			for(node in servers.production.nodes){
				sys.pruneNode(node);
			}
		}
		if(split[1]==="non-production"){
			for(node in servers.non_production.nodes){
				sys.pruneNode(node);
			}
		}
	}
	else if(split.length===2){
		alert("Please enter correct command");
	}

	if(text==="remove all applications"){
		for(key in appData){
			var node = appData[key];
			if(node.hasOwnProperty("label")){
				var nodeObj = sys.getNode(node.label);
				if(nodeObj!==undefined){
					nodeObj.data.expanded = false;
					if(!node.base){
						sys.pruneNode(nodeObj);
					}
					else{
						clipNode(nodeObj);
					}
				}	
			}	
		}
	}

	//possible remove all servers methods
	/*
	if(text === "remove all production servers"){
		for(key in serverData){
			var branch = serverData[key];
			if(branch.hasOwnProperty("production")){
				for(node in serverData[key].production.nodes){
					nodeObj= sys.getNode(node);
					if(nodeObj===undefined){
						//this check is here because of occasional error:"Cannot read property '_id' of undefined",
						//still functions properly but throws error after.
					}
					else{
						sys.pruneNode(nodeObj);
					}
					
				}
			}
			
		}
	}

	if(text==="remove all non-production servers"){
		for(key in serverData){
			console.log(key);
			var branch = serverData[key];
			if(branch.hasOwnProperty("non_production")){
				console.log(branch);
				for(node in serverData[key].non_production.nodes){
					nodeObj= sys.getNode(node);
					if(nodeObj===undefined){
						//this check is here because of occasional error:"Cannot read property '_id' of undefined",
						//still functions properly but throws error after.
					}
					else{
						sys.pruneNode(nodeObj);
					}
				}
			}	
		}
	}
	*/
};







