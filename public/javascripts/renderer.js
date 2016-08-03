(function(){
  //
  Renderer = function(canvas){
    var canvas = $(canvas).get(0)
    var ctx = canvas.getContext("2d");
    var gfx = arbor.Graphics(canvas)
    var particleSystem = null

    var that = {
      init:function(system){
        particleSystem = system
        particleSystem.screenSize(canvas.width, canvas.height) 
        particleSystem.screenPadding(40)

        that.initMouseHandling()
      },

      redraw:function(){
        if (!particleSystem) return

        gfx.clear() // convenience ƒ: clears the whole canvas rect

        // draw the nodes & save their bounds for edge drawing
        var nodeBoxes = {}
        particleSystem.eachNode(function(node, pt){
          // node: {mass:#, p:{x,y}, name:"", data:{}}
          // pt:   {x:#, y:#}  node position in screen coords

          // determine the box size and round off the coords if we'll be 
          // drawing a text label (awful alignment jitter otherwise...)
          var label = node.data.label||""
          var w = ctx.measureText(""+label).width + 10
          if (!(""+label).match(/^[ \t]*$/)){
            pt.x = Math.floor(pt.x)
            pt.y = Math.floor(pt.y)
          }else{
            label = null
          }

          // draw a rectangle centered at pt
          if (node.data.color) ctx.fillStyle = node.data.color
          else ctx.fillStyle = "rgba(0,0,0,.2)"
          if (node.data.color=='none') ctx.fillStyle = "white"

          if (node.data.shape=='dot'){
            gfx.oval(pt.x-w/2, pt.y-w/2, w,w, {fill:ctx.fillStyle})
            nodeBoxes[node.name] = [pt.x-w/2, pt.y-w/2, w,w]
          }else{
            gfx.rect(pt.x-w/2, pt.y-10, w,20, 4, {fill:ctx.fillStyle})
            nodeBoxes[node.name] = [pt.x-w/2, pt.y-11, w, 22]
          }
          //add border to node if it is expanded
          if(node.data.expanded){
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'orange';
            ctx.stroke();
          }

          // draw the text
          if (label){
            ctx.font = "12px Helvetica"
            ctx.textAlign = "center"
            ctx.fillStyle = "white"
            if (node.data.color=='none') ctx.fillStyle = '#333333'
            ctx.fillText(label||"", pt.x, pt.y+4)
            ctx.fillText(label||"", pt.x, pt.y+4)
          }
          
          //prepared variables for uses in following if/else checks
          var runTimeTo = particleSystem.getEdgesTo(node);//edges to node(node is targe)
          var runTimeFrom = particleSystem.getEdgesFrom(node);//edges from node(node is source)
          
          //checks the status of node's edges. if there are no edges and node is !base then it will
          //be removed from the system.(Removes lone nodes if not a base node)
          if(!node.data.base && runTimeTo.length === 0 && runTimeFrom.length === 0){
            particleSystem.pruneNode(node);
          }

          if(!node.data.server){
            var edgeCount=runTimeTo.length + runTimeFrom.length;//number of edges connected to a node at run time
            //subtracts edge from servers.
            for(var i=0; i<runTimeTo.length; ++i){
              if(runTimeTo[i].source.data.label==="Production" || runTimeTo[i].source.data.label==="Non-Production"){
                edgeCount--;
              }
            }           
            //if edgeCount === sum of the node's to array.length and node's from array.length
            //then set node.expanded to true
            if(edgeCount===node.data.to.length+node.data.from.length){
              node.data.expanded=true;
            }
            else{
              node.data.expanded=false;
            }
          }//end if !server
          else {//this is responsible for removing server nodes when removing expanded application.
            //if it is a prod/non-prod node
            if(node.data.label==="Production" || node.data.label==="Non-Production"){
              var allWeightTwo = runTimeFrom.every(function(edgeFrom){//.every test the condition on each element in array
                return edgeFrom.data.weight===2;//returns true if all weights are 2
              });
              if(allWeightTwo){//if all weights in runTimeFrom array are two then prune the prod/non-prod node.
                particleSystem.pruneNode(node);//note that you only have to prune the prod/non-prod node because the system prunes lone nodes automatically.
              }
            }
          }//end else(that is node is a server)
        })//end particleSystem.eachNode    			

        // draw the edges
        particleSystem.eachEdge(function(edge, pt1, pt2){
          // edge: {source:Node, target:Node, length:#, data:{}}
          // pt1:  {x:#, y:#}  source position in screen coords
          // pt2:  {x:#, y:#}  target position in screen coords

          var weight = edge.data.weight
          var color = edge.data.color

          if (!color || (""+color).match(/^[ \t]*$/)) color = null

          // find the start point
          var tail = intersect_line_box(pt1, pt2, nodeBoxes[edge.source.name])
          var head = intersect_line_box(tail, pt2, nodeBoxes[edge.target.name])

          ctx.save() 
            ctx.beginPath()
            ctx.lineWidth = (!isNaN(weight)) ? parseFloat(weight) : 1
            ctx.strokeStyle = (color) ? color : "#cccccc"
            ctx.fillStyle = null

            ctx.moveTo(tail.x, tail.y)
            ctx.lineTo(head.x, head.y)
            ctx.stroke()
          ctx.restore()

          // draw an arrowhead if this is a -> style edge
          if (edge.data.directed){
            ctx.save()
              // move to the head position of the edge we just drew
              var wt = !isNaN(weight) ? parseFloat(weight) : 1
              var arrowLength = 8 + wt//was 6
              var arrowWidth = 3 + wt//was 2
              ctx.fillStyle = (color) ? color : "#cccccc"
              ctx.translate(head.x, head.y);
              ctx.rotate(Math.atan2(head.y - tail.y, head.x - tail.x));

              // delete some of the edge that's already there (so the point isn't hidden)
              ctx.clearRect(-arrowLength/2,-wt/2, arrowLength/2,wt)

              // draw the chevron
              ctx.beginPath();
              ctx.moveTo(-arrowLength, arrowWidth);
              ctx.lineTo(0, 0);
              ctx.lineTo(-arrowLength, -arrowWidth);
              ctx.lineTo(-arrowLength * 0.8, -0);
              ctx.closePath();
              ctx.fill();
            ctx.restore()
          }

          //draws double ended arrow if edge.data.directedBoth is true
          if(edge.data.directedBoth){
            ctx.save()
              // move to the head position of the edge we just drew
              var wt = !isNaN(weight) ? parseFloat(weight) : 1
              var arrowLength = 8 + wt//was 6
              var arrowWidth = 3 + wt//was 2
              ctx.fillStyle = (color) ? color : "#cccccc"
              ctx.translate(head.x, head.y);
              ctx.rotate(Math.atan2(head.y - tail.y, head.x - tail.x));

              // delete some of the edge that's already there (so the point isn't hidden)
              ctx.clearRect(-arrowLength/2,-wt/2, arrowLength/2,wt)

              // draw the chevron
              ctx.beginPath();
              ctx.moveTo(-arrowLength, arrowWidth);
              ctx.lineTo(0, 0);
              ctx.lineTo(-arrowLength, -arrowWidth);
              ctx.lineTo(-arrowLength * 0.8, -0);
              ctx.closePath();
              ctx.fill();
            ctx.restore()

            ctx.save()
              // move to the head position of the edge we just drew
              var wt = !isNaN(weight) ? parseFloat(weight) : 1
              var arrowLength = 8 + wt//was 6
              var arrowWidth = 3 + wt//was 2
              ctx.fillStyle = (color) ? color : "#cccccc"
              ctx.translate(tail.x, tail.y);
              ctx.rotate(Math.atan2(tail.y - head.y, tail.x - head.x));

              // delete some of the edge that's already there (so the point isn't hidden)
              ctx.clearRect(-arrowLength/2,-wt/2, arrowLength/2,wt)

              // draw the chevron
              ctx.beginPath();
              ctx.moveTo(-arrowLength, arrowWidth);
              ctx.lineTo(0, 0);
              ctx.lineTo(-arrowLength, -arrowWidth);
              ctx.lineTo(-arrowLength * 0.8, -0);
              ctx.closePath();
              ctx.fill();
            ctx.restore()
          }     

          //add label attribute to edge.data
          var label = edge.data.label ? $.trim(edge.data.label) : '';
          if (label != '' && ctx){
            mid_x = (tail.x+head.x)/2;
            mid_y = (tail.y+head.y)/2;
            ctx.save();
              ctx.font = ".75em Arial";
              ctx.textAlign = "center";
              ctx.lineWidth = 4;
              ctx.strokeStyle = 'rgba(255,255,255,1)';//display text: 'rgba(255,255,255,1)', invis text: 'rgba(255,255,255,0)' 
              ctx.strokeText(label, mid_x, mid_y);
              ctx.fillStyle = 'rgba(0,0,0,1)';//display text: "black" or 'rgba(0,0,0,1)', invis text: 'rgba(0,0,0,0)'
              ctx.fillText(label, mid_x, mid_y);
            ctx.restore();
          }
        })//end eachEdge 
      },
      initMouseHandling:function(){
        // no-nonsense drag and drop (thanks springy.js)
        selected = null;
        nearest = null;
        var dragged = null;
        var oldmass = 1

        // set up a handler object that will initially listen for mousedowns then
        // for moves and mouseups while dragging
        //also listen for a dblclick
        var handler = {

          leftMouseDowned:function(e){
            var pos = $(canvas).offset();
            _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
            selected = nearest = dragged = particleSystem.nearest(_mouseP);
            if (dragged.node !== null) dragged.node.fixed = true

            $(canvas).bind('mousemove', handler.dragged)
            $(window).bind('mouseup', handler.dropped)

            return false
          },

          doubleClicked:function(e){
            var pos = $(canvas).offset();
            _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
            selected = nearest = dragged = particleSystem.nearest(_mouseP);
            if (dragged && dragged.node !== null){

              var clickedNode = dragged.node;

                if(!clickedNode.data.expanded){//if it is not expanded
                  expandApplicationNode(clickedNode.name);//expands the clickedNode
                } 
                else {//expanded = true so remove node

                  //if it is not a base node prune the node
                  if(!clickedNode.data.base){
                    particleSystem.pruneNode(clickedNode);
                  }//end if not base node
                  
                  else{//if it is a base node
                    var toArray= clickedNode.data.to;
                    var fromArray = clickedNode.data.from;

                    //for each node in the system if it is not a base node and it is in clickedNode's to/from array
                    //then prune node. Note particleSystem.prune prunes node when it returns true
                    particleSystem.prune(function(node, from, to){
                      if(!node.data.base){
                        if(jQuery.inArray(node.name, toArray)!==-1){
                          return true;
                        }
                        if(jQuery.inArray(node.name, fromArray)!==-1){
                          return true;
                        }
                      }
                    });//end particleSystem.prune
                    
                    //if clickedNode is base node and if node is in clickedNode's to/from array 
                    //then clipNode(clickedNode)
                    particleSystem.eachNode(function(node, pt){
                      if(node.data.base && clickedNode.data.base){
                        if(jQuery.inArray(node.name, toArray)!==-1){
                          clipNode(clickedNode);
                        }
                        if(jQuery.inArray(node.name, fromArray)!==-1){
                          clipNode(clickedNode);
                        }
                      }
                    });//end particleSystem.eachNode
                    
                  }//is base node

                }//end if clicked is expanded

            } //end if dragged
            return false
          },
          
          detectEdgeLabel:function(e){
            var pos = findPos(this);
            var x = e.pageX - pos.x;
            var y = e.pageY - pos.y;
            _mouseP = arbor.Point(x,y);
            var coord = "x=" + x + ", y=" + y;
            var c = this.getContext('2d');
            var p = c.getImageData(x, y, 1, 1).data; 
            var hex = "#" + ("000000" + rgbToHex(p[0], p[1], p[2])).slice(-6);
            if(hex==="#cccccc"){
              //$('#info').html(coord + "<br>" + hex);//used to output the coordinates and colore
              var node1 = particleSystem.nearest(_mouseP);
              var node2 = particleSystem.nearestNext(_mouseP, node1);
              particleSystem.eachEdge(function(edge, pt1, pt2){
                //if it is the edge between node1 and node2
                if( (edge.source===node1.node && edge.target===node2.node) || (edge.source===node2.node && edge.target===node1.node) ){
                  edge.data.label = generateEdgeLabel(edge.data.name);//set label field = to the correct label
                }//end if( (edge.source===.....))
              });
            }//if hex===#cccccc
            if(hex!=="#cccccc"){
              particleSystem.eachEdge(function(edge, pt1, pt2){
                edge.data.label = '';
              });
            }
                      
          },//end detectEdgeLabel

          dragged:function(e){
            var old_nearest = nearest && nearest.node._id
            var pos = $(canvas).offset();
            var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

            if (!nearest) return
            if (dragged !== null && dragged.node !== null){
              var p = particleSystem.fromScreen(s)
              dragged.node.p = p
            }

            return false
          },

          dropped:function(e){
            if (dragged===null || dragged.node===undefined) return
            if (dragged.node !== null) dragged.node.fixed = false
            dragged.node.tempMass = 50
            dragged = null
            selected = null
            $(canvas).unbind('mousemove', handler.dragged)
            $(window).unbind('mouseup', handler.dropped)
            _mouseP = null
            return false
          }

        }//end handler

        $(canvas).mousedown(handler.leftMouseDowned);//when mousedown start clicked function
        $(canvas).dblclick(handler.doubleClicked);//when doublclick do doublClicked function
        $(canvas).mousemove(handler.detectEdgeLabel);//when mouseover do detectEdgeLabel
        //disable contextmenu from displaying also display info on node on right click
        $(canvas).bind('contextmenu', function(e){
          
          //var content = document.createTextNode("Hello"); possible option if below does not work
          //div.appendChild(content);
          var div = document.getElementById('nodeName1');
          div.innerHTML = "";
          div.innerHTML += nearest.node.name;
          div = document.getElementById('nodeDescription');
          div.innerHTML = "";
          div.innerHTML += nearest.node.data.description;
          return false;
        });

        
        //called functions for detectEdgeLabel
        function findPos(obj) {
          var curleft = 0, curtop = 0;
          if (obj.offsetParent) {
            do {
              curleft += obj.offsetLeft;
              curtop += obj.offsetTop;
            } while (obj = obj.offsetParent);
              return { x: curleft, y: curtop };
          }
          return undefined;
        }

        //called functions for detectEdgeLabel
        //converts rgb color to hex
        function rgbToHex(r, g, b) {
          if (r > 255 || g > 255 || b > 255)
            throw "Invalid color component";
            return ((r << 16) | (g << 8) | b).toString(16);
        }

      }//end initMouseHandling

    }//end redraw

    // helpers for figuring out where to draw arrows (thanks springy.js)
    var intersect_line_line = function(p1, p2, p3, p4)
    {
      var denom = ((p4.y - p3.y)*(p2.x - p1.x) - (p4.x - p3.x)*(p2.y - p1.y));
      if (denom === 0) return false // lines are parallel
      var ua = ((p4.x - p3.x)*(p1.y - p3.y) - (p4.y - p3.y)*(p1.x - p3.x)) / denom;
      var ub = ((p2.x - p1.x)*(p1.y - p3.y) - (p2.y - p1.y)*(p1.x - p3.x)) / denom;

      if (ua < 0 || ua > 1 || ub < 0 || ub > 1)  return false
      return arbor.Point(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
    }

    var intersect_line_box = function(p1, p2, boxTuple)
    {
      var p3 = {x:boxTuple[0], y:boxTuple[1]},
          w = boxTuple[2],
          h = boxTuple[3]

      var tl = {x: p3.x, y: p3.y};
      var tr = {x: p3.x + w, y: p3.y};
      var bl = {x: p3.x, y: p3.y + h};
      var br = {x: p3.x + w, y: p3.y + h};

      return intersect_line_line(p1, p2, tl, tr) ||
            intersect_line_line(p1, p2, tr, br) ||
            intersect_line_line(p1, p2, br, bl) ||
            intersect_line_line(p1, p2, bl, tl) ||
            false
    }



    return that
  }//end Renderer
})()//end outter function class