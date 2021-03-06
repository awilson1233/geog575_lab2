//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

  var attrArray = ["ID", "State", "Pcode1", "County", "Pcode2", "Mid 2016 Population", "Mid 2017 Population", "CCCM", "EDUCATION", "FSL", "HEALTH", "NUTRITION", "PROTECTION", "SHELTER & NFIs", "WASH", "Total People In Need"];
  var expressed = attrArray[6]; //initial attribute

var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
    .range([chartHeight, 0])
    .domain([0,500])
    .nice();


//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    var width = window.innerWidth * 0.5,
        height = 460;
    //
    // //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);
    //
    // //create Albers equal area conic projection centered on CA
    var projection = d3.geoAlbers()
        .scale(2100)
        .rotate([45, 45, 5])
        .parallels([32.25, 42])
        .center([-119.35, 22.965])
        .translate([width / 25, height / 25]);
    //
    var path = d3.geoPath()
       .projection(projection);

    d3.queue()
        .defer(d3.csv, "data/need.csv") //load attributes from csv
        .defer(d3.json, "data/admin2.topojson") //load background spatial data
        // .defer(d3.json, "data/CA_counties.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error, csvData, admin){

      //place graticule on the map
      setGraticule(map, path);

      //translate usa and counties TopoJSONs
      var admin2 = topojson.feature(admin, admin.objects.admin2)
      // var caCounties = topojson.feature(counties, counties.objects.CA_counties).features;

      //add USA boundary to map
      var states = map.append("path")
          .datum(admin2)
          .attr("class", "states")
          .attr("d", path);

      //join csv data to GeoJSON enumeration units
      admin2 = joinData(admin2, csvData);

      //create the color scale
      var colorScale = makeColorScale(csvData);

      //add enumeration units to the map
      setEnumerationUnits(admin2, map, path, colorScale);

      //add coordinated visualization to the map
      setChart (csvData, colorScale);

      //add dropdown
      createDropdown(csvData)
    };

}; //end of setMap()

function setGraticule(map, path){

      var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

      //create graticule background
      var gratBackground = map.append("path")
          .datum(graticule.outline()) //bind graticule background
          .attr("class", "gratBackground") //assign class for styling
          .attr("d", path) //project graticule

      //create graticule lines
      var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
          .data(graticule.lines()) //bind graticule lines to each element to be created
          .enter() //create an element for each datum
          .append("path") //append each element to the svg as a path element
          .attr("class", "gratLines") //assign class for styling
          .attr("d", path); //project graticule lines

};

function joinData(admin2, csvData){

      //loop through csv to assign each set of csv attribute values to geojson region
      for (var i=0; i<csvData.length; i++){
          var csvState = csvData[i]; //the current state
          var csvKey = csvState.State; //the CSV primary key

          //loop through geojson regions to find correct region
          for (var a=0; a<admin2.length; a++){

              var geojsonProps = admin2[a].properties; //the current region geojson properties
              var geojsonKey = geojsonProps.ADMIN2; //the geojson primary key

              //where primary keys match, transfer csv data to geojson properties object
              if (geojsonKey == csvKey){

                  //assign all attributes and values
                  attrArray.forEach(function(attr){
                      var val = parseFloat(csvState[attr]); //get csv attribute value
                      geojsonProps[attr] = val; //assign attribute and value to geojson properties
                  });
              };
          };
      };


      return admin2;
};
//
function setEnumerationUnits(admin2, map, path, colorScale){

  //add counties to map
  var counties = map.selectAll(".counties")
      .data(admin2)
      .enter()
      .append("path")
      .attr("class", function(d){
          return "State " + d.properties.States;
      })
      .attr("d", path)
      .style("fill", function(d){
          // choropleth is the function needed here
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    var desc = counties.append("desc")
      .text('{"stroke": "#000", "stroke-width": "0.5px"}');


};
//
// //function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#ffffb2",
        "#fecc5c",
        "#fd8d3c",
        "#f03b20",
        "#bd0026"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    ///build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale;
};
//
//
// //function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};

// //function to create coordinated bar chart
function setChart(csvData, colorScale){

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    // //create a scale to size bars proportionally to frame and for axis
    // var yScale = d3.scaleLinear()
    //     .range([chartHeight, 0 ])
    //     .domain([0,104616]);

    //set bars for each province
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.NAME;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

    var desc = bars.append("desc")
           .text('{"stroke": "none", "stroke-width": "0px"}');
        // .attr("x", function(d, i){
        //     return i * (chartInnerWidth / csvData.length) + leftPadding;
        // })
        // .attr("height", function(d, i){
        //     return yScale(parseFloat(d[expressed]));
        // })
        // .attr("y", function(d, i){
        //     return chartHeight - yScale(parseFloat(d[expressed]));
        // })
        // .style("fill", function(d){
        //     return choropleth(d, colorScale);
        // });

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of people in need " + expressed[3]);

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    updateChart(bars, csvData.length, colorScale);

};
//
// //function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};
//
// //dropdown change listener handler
function changeAttribute(attribute, csvData, colorScale){
    //change the expressed attribute
    expressed = attribute;

    // Get the max value for the selected attribute
    var max = d3.max(csvData,function(d){
        return + parseFloat(d[expressed]);});

    yScale = d3.scaleLinear()
    		.range([chartHeight, 0])
    		.domain([0, max])
    		.nice();

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var counties = d3.selectAll(".counties")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);

    updateChart(bars, csvData.length, colorScale);
}; //end of changeAttribute()
//
// //function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars

    // var yAxis = d3.axisLeft()
    // .scale(yScale);

    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        //console.log(expressed); CMS: YOU CAN'T PUT THIS IN THE MIDDLE OF A BLOCK; CAUSES SYNTAX ERROR
        .attr("height", function(d, i){
            return 104616 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
  var yAxis = d3.axisLeft()
  		.scale(yScale);

  var axis = d3.selectAll(".axis")
  	.call(yAxis);

  var chartTitle = d3.select(".chartTitle")
        //CMS: expressed is a string, so expressed[3] is just the fourth letter in the string
        //format with spaces
        //use string methods to format variable name correctly (see list of methods on W3Schools)
        .text("Number of people in need" + expressed )
};
//
// //function to highlight enumeration units and bars
function highlight(props){
    //console.log(props);
    //change stroke
//
//     //CMS: highlighting only works when you hover over the states because the props object for
//     //the bars (the CSV data) uses COUNTY instead of NAME as the key for that field.
//     //I recommend changing the CSV to use NAME for the field name; if you do this, also change
//     //the csv key used in joinData().
//
//     //Another problem is that the counties with two-word names (e.g., "Los Angeles") won't highlight
//     //because the DOM treats those as two separate class names, so the selector below doesn't work
//     //on them. You need to use props.NAME.replace(/ /g, '-') to replace the spaces with - characters
//     //below and everywhere you either assign the class name (look for .attr("class", props.NAME)
//     //in your code) and use it in a selector (as below).
//
    var selected = d3.selectAll("." + props.State)
        .style("stroke", "blue")
        .style("stroke-width", "2");

        setLabel(props);

};
//
// //function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.NAME)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };

    d3.select(".infolabel")
            .remove();
};

//
//
function setLabel(props){
    //label content
//
//     //CMS: For label formatting, give your <h1> element below a class name
//     //(e.g., <h1 class='labelval'>) and access that class name in main.css to assign the element
//     //{margin: 0} as a style. Increase the label height in main.css.
//     //Your label id is currently undefined_label because the csv data uses COUNTY instead of NAME
//     //as the variable name. See my other comments about using .replace() to catch counties with
//     //two-word names.
//
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + props.State + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.State + "_label")
        .html(labelAttribute);

    var stateName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.State);
};
//
// //function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node();
        // .getBoundingClientRect()
        // .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
//
})(); //last line of main.js
