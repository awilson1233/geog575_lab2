//begin script when window loads
window.onload = setMap();

//set up cloropleth map
function setMap(){

    var width = window.innerWidth * 0.5,
      height = 460;
    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([33.7783, 119.4179])
        .rotate([-2, 0, 0])
        .parallels([60 , 30])
        .scale(100)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
       .projection(projection);

    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/gradrates_bycounty2.csv") //load attributes from csv
        .defer(d3.json, "data/unitedstates.topojson") //load background spatial data
        .defer(d3.json, "data/CA_counties.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error, csvData, usa, counties){
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
          console.log(usa);
          console.log(usa.objects);
      var unitedStates = topojson.feature(usa, usa.objects.unitedstates),
          caCounties = topojson.feature(counties, counties.objects.CA_counties).features;

       //variables for data join
       var attrArray = ["COUNTY", "HISPANIC", "AM_IND", "ASIAN", "PAC_ISLD", "FILIPINO", "AFRICAN_AM", "WHITE", "TWO_MORE_RACES", "NOT_REPORTED", "TOTAL", "Pop", "PopDens", "PerCap_Inc", "Med_Inc", "MedFam_Inc"];

       //loop through csv to assign each set of csv attribute values to geojson region
       for (var i=0; i<csvData.length; i++){
           var csvCounty = csvData[i]; //the current region
           var csvKey = csvCounty.NAME; //the CSV primary key

           //loop through geojson regions to find correct region
           for (var a=0; a<caCounties.length; a++){

               var geojsonProps = caCounties[a].properties; //the current region geojson properties
               var geojsonKey = geojsonProps.NAME; //the geojson primary key

               //where primary keys match, transfer csv data to geojson properties object
               if (geojsonKey == csvKey){

                   //assign all attributes and values
                   attrArray.forEach(function(attr){
                       var val = parseFloat(csvRegion[attr]); //get csv attribute value
                       geojsonProps[attr] = val; //assign attribute and value to geojson properties
                   });
               };
           };
       };

      //add USA boundary to map
      var states = map.append("path")
          .datum(unitedStates)
          .attr("class", "states")
          .attr("d", path);

      //add counties to map
      var counties = map.selectAll(".counties")
          .data(caCounties)
          .enter()
          .append("path")
          .attr("class", function(d){
              return "counties " + d.properties.NAME;
          })
          .attr("d", path);
  };

};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = 550,
        chartHeight = 460;

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
};
