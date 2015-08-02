var margin = {top: 20, right: 10, bottom:20, left:10};

var width = 960 - margin.left - margin.right,
    height = 400 - margin.left - margin.right;

var svg = d3.select(".map").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .attr("class", "indonesia")
  .attr("viewBox", "0 0 960 400")
  .attr("preserveAspectRatio", "xMinYMin meet")
 .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var colors = d3.scale.linear()
      .range(["#e0f3db","#a8ddb5","#43a2ca"]),
    colorPie = d3.scale.ordinal()
      .range(["#3182bd", "#9ecae1"]),
    colorDuration = d3.scale.ordinal()
      .range([ "#2171b5", "#6baed6", "#bdd7e7", "#eff3ff",  ]);

var projection = d3.geo.albers()
  .center([0, -1.175])
  .rotate([-116.8283, 0])
  //.rotate([-106.8283, 0])
  .parallels([-2, 0])
  .scale(1100)
  .translate([width / 2, height / 2]);

var path = d3.geo.path()
  .projection(projection);

queue()
  .defer(d3.tsv, '/data/muda.tsv')
  .defer(d3.json, '/data/idn.json')
  .await(init);

var selectedProvince = null;

var tempcolor,
    tempdata;

var sumProv,
    idnData,
    provData = {};

var aspectBar,
    aspectPieleft,
    aspectPieright;

// var selectize;

function init(error, muda, idn) {
  var provinces = d3.nest()
    .key(function(d) { return d.origin; }).sortKeys(d3.ascending)
    .map(muda);

  _.each(provinces, function(province, keys) {
    var optimistic = _.countBy(province, function(p) {
      return p.optimistic;
    });

    var eastdev = _.countBy(province, function(p) {
      return p.eastdev;
    });

    var duration = _.countBy(province, function(p) {
      return p.duration;
    });

    var optimistic = { "Yes":0, "Maybe":0, "No":0 },
        eastdev = { "Yes":0, "No":0 },
        duration = { "< 2":0, "2-5":0, "5-7":0, "> 7":0 },
        fears = {},
        problems = {};

    _.each(province, function(d) {
      d.fear = d.fear.replace(/ /g,'').toLowerCase().split(",");
      d.problem = d.problem.replace(/ /g,'').toLowerCase().split(",");

      d.fear.forEach(function(e) {
        if(e != "") fears[e] = fears[e] + 1 || 1;
      });

      d.problem.forEach(function(e) {
        if(e != "") problems[e] = problems[e] + 1 || 1;
      });

      optimistic[d.optimistic] = optimistic[d.optimistic] + 1;
      eastdev[d.eastdev] = eastdev[d.eastdev] + 1;
      if(d.duration != "") duration[d.duration] = duration[d.duration] + 1;

    });

    var total = optimistic["Yes"] + optimistic["Maybe"] + optimistic["No"];

    var optimisticYes = optimistic["Yes"] / total * 100;

    var optimisticNo = 100 - optimisticYes;

    provData[keys] = {'name':keys, 'opstat': optimistic, 'optimistic': optimisticYes, 'pessimistic': optimisticNo, 'eastdev': eastdev, 'duration': duration, 'fear': fears, 'problem': problems };

    provData[keys].opstat['Total'] = total;
  });

  sumProv = sumProvince(provData);

  var maps = topojson.feature(idn, idn.objects.provinces).features;

  _.each(maps, function(d) {
    var name = d.properties.name;
    // Rename province defined in topoJSON data
    d.stat = provData[renameProvince(name)];
  });

  maps = _.filter(maps, function(d) { return d.properties.name != null; });

  drawMap(maps, 'optimistic');

  populateSelection(sumProv);
}

function drawMap(data, param) {
  // Polylinear color scale
  colors.domain([
    d3.min(data, function(d) { return d.stat[param]; }),
    d3.median(data, function(d) { return d.stat[param]; }),
    d3.max(data, function(d) { return d.stat[param]; })]);

  svg.selectAll("append")
    .data(data)
    .enter().append("path")
    .attr("d", path)
    .attr("id", function(d) { return d.stat.name.replace(/ /g,'').toLowerCase(); })
    .attr("class", "provinces")
    .style("fill", function(d) { return colors(d.stat[param]); })
    .style("stroke", "#fff")
    .style("stroke-width", .5)
    .on("mouseover", function(d){
      d3.select(this).style("fill", "#e6550d");
      if(selectedProvince == null) showPopover.call(this,d);
      makePopbar(d.stat);
    })
    .on("mouseout", function(d){
      d3.select(this).style("fill", function(d) { return $(this).attr("id") == selectedProvince || selectedProvince == 'all' ? "#e6550d" : colors(d.stat[param]); });
      removePopover();
    })
    .on("click", function(d) {
      var prov = d.stat.name.replace(/ /g,'').toLowerCase();

      if(selectedProvince != '') d3.select("#"+selectedProvince).style("fill", colors(tempdata));

      tempdata = d.stat[param];
      selectedProvince = prov;
      console.log(d.stat.name);
      showDetails(d.stat, decidePosition(d.stat.name));

      var selectize = $("#select-province")[0].selectize;
      selectize.clear(true);
      selectize.addItem(d.stat.name, true);
    });

  var legend = svg.selectAll(".legend")
    .data([50,65,75,85,90,100])
    .enter().append("g")
    .attr("class", "legend");

  legend.append("rect")
    .attr("x", function(d,i) { return 30 * i; })
    .attr("y", height - 20)
    .attr("width", 30)
    .attr("height", 10)
    .style("fill", function(d) { return colors(d); });

  legend.append("text")
    .attr("x", function(d,i) { return 30 * i; })
    .attr("y", height)
    .text(function(d) { return d == 100 ? d + "%" : d; })
    .style("font-size", "10px")
    .style("fill", "#bdbdbd");

  legend.append("text")
    .attr("x", 0)
    .attr("y", height - 25)
    .text("Optimistic percentage")
    .style("font-size", "10px")
    .style("fill", "#bdbdbd");
}

function paintMap(data) {
  _.each(data, function(v,k) {
    var id = k.replace(/ /g,'').toLowerCase();
    d3.select("#"+id).style("fill", colors(v.optimistic));
  })
}

function showDetails(data, position) {
  var pos = {};

  if(position == "left") { pos.x = 0; pos.x1 = 0; }
  else if(position == "right") { pos.x = width*2/3; pos.x1 = width; }

  svg.datum(data);

  if($(".overlay").length) {
    svg.selectAll("rect.overlay, #detail-info").remove();

    // $("div.overlay").hide();

    svg.append("rect")
      .attr("class", "overlay")
      .attr("width", width/3)
      .attr("height", height)
      // .attr("y", 15)
      .attr("x", pos.x)
      .style("fill", "#FFF")
     .transition().duration(300)
      .attr("width", 0)
      .attr("height", height)
      // .attr("y", 15)
      .attr("x", pos.x1)
      .style("fill", "#FFF")
     .transition().duration(500)
      .attr("width", width/3)
      .attr("height", height)
      // .attr("y", 15)
      .attr("x", pos.x)
      .style("fill", "#FFF")
      .each("end", function() {
        // $("div.overlay").show();
        // populateDetails(data);
        svg.append("foreignObject")
          .attr("id", "detail-info")
          // .attr("class", "overlay")
          .attr("width", width/3)
          // .attr("height", height/2)
          // .attr("y", 15)
          .attr("x", pos.x)
         .append("xhtml:div")
          .html(function(d) { return "<div class='overlay''></div>" })
          .style("height", "385px")
          .style("font-size", "8px")
          .style("overflow-y", "scroll");

          populateDetails(data);
          readjustDetail();
      });

  } else {

    svg.append("rect")
      .attr("class", "overlay")
      .attr("width", 0)
      .attr("x", pos.x1)
      .style("fill", "#FFF")
     .transition().duration(500)
      .attr("width", width/3)
      .attr("height", height)
      // .attr("y", 15)
      .attr("x", pos.x)
      .style("fill", "#FFF")
      .each("end", function() {
        svg.append("foreignObject")
          .attr("id", "detail-info")
          .attr("class", "overlay")
          .attr("width", width/3)
          .attr("height", height)
          // .attr("y", 15)
          .attr("x", pos.x)
         .append("xhtml:div")
          .html(function(d) { return "<div class='detail overlay' style='width:" + width/3 + "px'></div>" })
          // .style("width", width/3)
          // .style("height", "385px")
          .style("height", "285px")
          .style("overflow-y", "scroll");

          populateDetails(data);
          readjustDetail();
      });
  }
}

function populateDetails(data) {
  idnData = data;

  var detail =
  "<div class='page-header'>" +
    "<h3 class='text-center'>" + data.name + "</h3>" +
    "<p class='text-center reduce-space' style='font-size:13px'>Here, <b>" + data.opstat["Yes"] + "</b> of <b>" + data.opstat["Total"] + "</b> youths are optimistic<br> on Indonesia's future, are you?</p>" +
  "</div>" +

  "<div style='padding-right:10px'><h4 class='text-left'>What are the biggest problems in Indonesia that you want to solve on?</h4>" +
  "<div class='detail-bar problem'></div>" +
  "<p class='text-right small-text'>(Note: One person can choose multiple)</p></div><hr>" +

  "<div style='padding-right:10px'><h4 class='text-left'>What are the biggest obstacles that will prevent you to contribute from?</h4>" +
  "<div class='detail-bar fear'></div>" +
  "<p class='text-right small-text'>(Note: One person can choose multiple)</p></div><hr>" +

  "<div style='padding-right:10px'><h4 class='text-left'>If you can overcome all obstacles, are you interested in contributing to development in East Indonesia?</h4>" +
  "<div class='detail-pie'></div>";

  $("div.overlay").empty();
  $("div.overlay").append(detail);

  var rural = _.map(data.eastdev, function(v,k) { return {key:k, value:v} });

  var duration = _.map(data.duration, function(v,k) { return {key:k, value:v} });

  var problems = _.map(data.problem, function(v,k) { return {key:k, value:v} });

  var fears = _.map(data.fear, function(v,k) { return {key:k, value:v} });
  // fears = _.filter(fears, function(d) { return d.key != 'believe'; })

  // console.log(fears);
  drawDetailPieLeft(rural);

  drawDetailPieRight(duration);

  drawDetailBar(problems, 'problem');

  drawDetailBar(fears, 'fear');
}

function drawDetailPieRight(data) {
  var w = width/6.3,
      h = 155,
      r = Math.min(w,h) / 2;

  var arc = d3.svg.arc()
    .outerRadius(r - 25)
    .innerRadius(r - 45);

  var pie = d3.layout.pie()
    .sort(null)
    .value(function(d) { return d.value; });

  var svg1 = d3.select("div.detail-pie").append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("class", "detail pie right")
    .attr("viewBox", "0 0 100 150")
    .attr("preserveAspectRatio", "xMinYMid meet")
   .append("g")
    .attr("transform", "translate(" + w/2 + "," + h/2.5 + ")");

  var g1 = svg1.selectAll(".arc")
    .data(pie(data))
   .enter().append("g")
    .attr("class", "arc");

  g1.append("path")
    .attr("d", arc)
    .attr("class", "donut")
    .style("fill", function(d) { return colorDuration(d.data.key) });

  g1.append("text")
    .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")" })
    .attr("dy", ".35em")
    .style("text-anchor", "middle")
    .text(function(d) { if(d.data.value != 0) return d.data.key; });

  g1.append("text")
    .attr("dy", ".35em")
    .style("text-anchor", "middle")
    .style("font-size", "20px")
    .text(function() {
      var total = idnData.duration["< 2"] + idnData.duration["2-5"]+ idnData.duration["5-7"] + idnData.duration["> 7"];
      var avg = (idnData.duration["< 2"] * 1 + idnData.duration["2-5"] * 3 + idnData.duration["5-7"] * 6 + idnData.duration["> 7"] * 8)/total;

      if(avg > 7) { return "7+" }
      else { return avg.toFixed(1); }
  });

  g1.append("text")
    .attr("dy", "1.45em")
    .style("text-anchor", "middle")
    .text("years");

  g1.append("text")
    .attr("y",h/2)
    .attr("dy", "-1.25em")
    .style("text-anchor", "middle")
    .text("How many years are you");

  g1.append("text")
    .attr("y",h/2)
    .attr("dy", "-.2em")
    .style("text-anchor", "middle")
    .text("willing to stay here?");
}

function drawDetailPieLeft(data) {
  var w = width/6.3,
      h = 155,
      r = Math.min(w,h) / 2;

  var arc = d3.svg.arc()
    .outerRadius(r - 25)
    .innerRadius(r - 45);

  var pie = d3.layout.pie()
    .sort(null)
    .value(function(d) { return d.value; });

  var svg = d3.select("div.detail-pie").append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("class", "detail pie left")
    .attr("viewBox", "0 0 100 150")
    .attr("preserveAspectRatio", "xMinYMid meet")
   .append("g")
    .attr("transform", "translate(" + w/2 + "," + h/2.5 + ")");

  var g = svg.selectAll(".arc")
    .data(pie(data))
   .enter().append("g")
    .attr("class", "arc");

  g.append("path")
    .attr("d", arc)
    .attr("class", "donut")
    .style("fill", function(d) { return colorPie(d.data.key) });

  g.append("text")
    .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")" })
    .attr("dy", ".35em")
    .style("text-anchor", "middle")
    .text(function(d) { if(d.data.value != 0) return d.data.key; });

  g.append("text")
    .attr("dy", ".35em")
    .style("text-anchor", "middle")
    .style("font-size", "20px")
    .text(function() { return (idnData.eastdev["Yes"] * 100 / (idnData.eastdev["Yes"] + idnData.eastdev["No"])).toFixed(0) + "%";  });

  g.append("text")
    .attr("y",h/2)
    .attr("dy", "-1.25em")
    .style("text-anchor", "middle")
    .text("Willing to develop");

  g.append("text")
    .attr("y",h/2)
    .attr("dy", "-.2em")
    .style("text-anchor", "middle")
    .text("East Indonesia?");
}

function drawDetailBar(data, classname) {
  data = _.sortBy(data, 'value').reverse();

  var w = width/5,
      m = { left: 90, right: 30 },
      barH = 20,
      h = barH * data.length,
      offset = 10;

  var x = d3.scale.linear()
    .domain([0,d3.max(data, function(d) { return d.value; })+offset])
    .range([0,w]);

  var svg = d3.select("div.detail-bar."+classname).append("svg")
    .attr("width", w + m.left + m.right)
    .attr("height", h)
    .attr("class", function() { return "detail bar " + classname; })
    .attr("viewBox", function() { return "0 0 " + w + " " + h; })
    .attr("preserveAspectRatio", "xMinYMin meet")
   .append("g")
    .attr("transform", "translate(" + m.left + ",0)");

  var bar = svg.selectAll(".bar")
    .data(data)
   .enter().append("g")
    .attr("transform", function(d,i) { return "translate(0," + i * barH + ")" });

  bar.append("rect")
    .attr("class", "bar")
    .attr("width", function(d) { return x(d.value); })
    .attr("height", barH - 1);

  bar.append("text")
    .attr("x", 0)
    .attr("dx", "-.2em")
    .attr("y", barH/2)
    .attr("dy", ".25em")
    .style("text-anchor", "end")
    .style("font-size", "10px")
    .text(function(d) {
      if(classname == 'problem') { return renameProblems(d.key); }
      else if(classname == 'fear') { return renameFears(d.key); }
    });

  bar.append("text")
    .attr("x", function(d) { return x(d.value) < 10 ? x(d.value) + 15 : x(d.value); })
    .attr("dx", "-.2em")
    .attr("y", barH/2)
    .attr("dy", ".25em")
    .style("text-anchor", "end")
    .style("font-size", "10px")
    .text(function(d) { return d.value; })
    .style("fill", function(d) { return x(d.value) < 10 ? "#000" : "#FFF"; } );
}

function showPopover(data) {
  var selection = this,
      province = renameProvince(data.properties.name),
      left = ["Papua", "Papua Barat"];

  $(selection).popover({
    title: province,
    placement: 'auto right',
    container: 'body',
    html: true
  });

  $(selection).popover('show');
}

function removePopover() {
  $(".popover").each(function() {
    $(this).remove();
  })
}

function makePopbar(data) {
  var stat = [{key:"Optimistic", value:data.optimistic},
              {key:"Pessimistic", value:data.pessimistic}];

  var w = 150,
      m = { left: 30, right:55 },
      barH = 20;

  var x = d3.scale.linear()
    .domain([0,100])
    .range([0,w]);

  var svg = d3.select(".popover-content").append("svg")
    .attr("width",w + m.left + m.right)
    .attr("height",barH * stat.length)
   .append("g")
    .attr("transform", "translate(" + m.left + ", 0)");

  var bar = svg.selectAll(".bar")
    .data(stat)
   .enter().append("g")
    .attr("transform", function(d,i) { return "translate(0," + i * barH + ")" })

  bar.append("rect")
    .attr("class", "bar")
    .attr("width", function(d) { return x(d.value); })
    .attr("height", barH - 1);

  bar.append("text")
    .attr("x", 0)
    .attr("dx", "-.15em")
    .attr("y", barH/2)
    .attr("dy", ".35em")
    .style("text-anchor", "end")
    .text(function(d) { return d.value.toFixed(0) + "%"; });

  bar.append("text")
    .attr("x", function(d) { return x(d.value); })
    .attr("dx", ".15em")
    .attr("y", barH/2)
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d) { return d.key; });
}

function sumProvince(data) {
  var problems = {},
      fears = {},
      opstat = {},
      eastdev = {},
      duration = {};

  _.each(data, function(d) {
    _.each(d.problem, function(v,k) {
      problems[k] = problems[k] + v || v;
    })

    _.each(d.fear, function(v,k) {
      fears[k] = fears[k] + v || v;
    })

    _.each(d.opstat, function(v,k) {
      opstat[k] = opstat[k] + v || v;
    })

    _.each(d.eastdev, function(v,k) {
      eastdev[k] = eastdev[k] + v || v;
    })

    _.each(d.duration, function(v,k) {
      duration[k] = duration[k] + v || v;
    })
  });

  return {'name': 'All Provinces', 'opstat':opstat, 'problem':problems, 'fear':fears, 'duration':duration, 'eastdev':eastdev, 'provinces':_.allKeys(data)};
}

function populateSelection(data) {
  var provinceList = _.map(data.provinces, function(d) { return {text: d, value: d, label: groupProvinces(d)} });

  $("#select-province").selectize({
    plugins: ['remove_button'],
    persist: true,
    sortField: 'text',
    maxItems: '1',
    optgroups: [
      {$order: 2, label: 'West Indonesia', name: 'West Indonesia'},
      {$order: 3, label: 'Central Indonesia', name: 'Central Indonesia'},
      {$order: 4, label: 'East Indonesia', name: 'East Indonesia'},
      {$order: 1, label: 'All Provinces', name: 'All'}],
    optgroupField: 'label',
    optgroupLabelField: 'name',
    optgroupValueField: 'label',
    lockOptgroupOrder: true,
    onChange: function(prov) {
      if(prov == "All Provinces") {

        d3.selectAll(".provinces").style("fill", "#e6550d");
        selectedProvince = 'all';
        showDetails(sumProv, 'right');

      } else {

        if(selectedProvince = 'all') {
          paintMap(provData);
        } else if(selectedProvince != null || selectedProvince != '') {
          d3.select("#"+selectedProvince).style("fill", tempcolor);
        }

        if(prov != '') {

          selectedProvince = prov.replace(/ /g,'').toLowerCase();
          tempcolor = d3.select("#"+selectedProvince).style("fill");
          d3.select("#"+selectedProvince).style("fill", "#e6550d");
          showDetails(provData[prov], decidePosition(prov));
        } else {
          // d3.select("#"+selectedProvince).style("fill", colors(provData[prov].optimistic));
          selectedProvince = null;
          $(".overlay").hide();
        }
      }
    }
  });

  var selectize = $("#select-province")[0].selectize;

  selectize.addOption({ text: 'All Provinces', value: 'All Provinces', label: 'All Provinces' });
  selectize.load(function(callback) {
    callback(provinceList);
  });
}

function renameProvince(name) {
  switch(name) {
    case 'Bangka-Belitung':
      name = 'Bangka Belitung';
      break;
    case 'Jakarta Raya':
      name = 'DKI Jakarta';
      break;
    case 'Yogyakarta':
      name = 'DI Yogyakarta';
      break;
    case 'Irian Jaya Barat':
      name = 'Papua Barat';
      break;
  }
  return name;
}

function renameProblems(problem) {
  switch(problem) {
    case 'creativetourism':
      problem = 'Creative & Tourism';
      break;
    case 'politicslaw':
      problem = 'Law & Politics';
      break;
    case 'genderequality':
      problem = 'Gender Equality';
      break;
    case 'humansociety':
      problem = 'Human & Society';
      break;
    case 'naturalresources':
      problem = 'Natural Resources';
      break;
    case 'limitedjob':
      problem = 'Limited Jobs';
      break;
  }
  return problem.substr(0,1).toUpperCase() + problem.substr(1);;
}

function renameFears(fear) {
  switch(fear) {
    case 'inside':
      fear = 'Self';
      break;
    case 'believe':
      fear = 'None';
      break;
    case 'alone':
      fear = 'Single Fighter';
      break;
    case 'noidea':
      fear = 'Lack of Idea';
      break;
    case 'paper':
      fear = 'No Action';
      break;
    case 'realistic':
      fear = 'Be Realistic';
      break;
  }
  return fear.substr(0,1).toUpperCase() + fear.substr(1);;
}

function decidePosition(province) {
  var prov = ["Sulawesi Utara","Gorontalo","Sulawesi Tengah","Sulawesi Barat","Sulawesi Selatan","Sulawesi Tenggara","Nusa Tenggara Timur","Nusa Tenggara Barat","Maluku Utara","Maluku","Papua Barat","Papua"];

  return prov.indexOf(province) > -1 ? 'left' : 'right';
}

function groupProvinces(province) {
  var regions = {east: ["Papua Barat", "Papua", "Maluku", "Maluku Utara"],
                 central: ["Sulawesi Selatan", "Sulawesi Tengah", "Kalimantan Timur", "Nusa Tenggara Timur", "Bali", "Kalimantan Selatan", "Sulawesi Utara", "Gorontalo", "Nusa Tenggara Barat", "Sulawesi Tenggara", "Sulawesi Barat", "Kalimantan Utara"],
                 west: ["Jawa Barat", "Jawa Tengah", "DKI Jakarta", "Sumatera Barat", "Lampung", "Jawa Timur", "Sumatera Utara", "Banten", "DI Yogyakarta", "Jambi", "Kalimantan Barat", "Riau", "Aceh", "Kalimantan Tengah", "Sumatera Selatan", "Kepulauan Riau", "Bangka Belitung", "Bengkulu"]}

  if(regions.east.indexOf(province) > -1) { return "East Indonesia"; }
  else if(regions.central.indexOf(province) > -1) { return "Central Indonesia"; }
  else if(regions.west.indexOf(province) > -1) { return "West Indonesia"; }
  else { return "Unknown"; }
}

$(document).ready(function() {
  readjustDetail();
})

$(window).on("resize", function() {
  readjustDetail();
});

function readjustDetail() {
  var graph = $(".indonesia"),
      aspect = width/height;

  var targetWidth = graph.parent().width(),
      targetHeight = targetWidth / aspect,
      detailWidth = targetWidth / 3;

  graph.attr("width", targetWidth);
  graph.attr("height", targetHeight);

  if($(".detail.bar").length) {
    var barP = $(".detail.bar.problem"),
        barF = $(".detail.bar.fear"),
        barAspectP = barP.attr("width") / barP.attr("height"),
        barAspectF = barF.attr("width") / barF.attr("height");

    barP.attr("width", detailWidth);
    barP.attr("height", detailWidth / barAspectP);
    barF.attr("width", detailWidth);
    barF.attr("height", detailWidth / barAspectF);
  }
  $("div.overlay").css("width", detailWidth - 5); // 5 for scroll space
  // $("div.overlay").attr("height", targetHeight);
  $('div.overlay').parent().css("height", targetHeight);
  $("foreignObject").attr("width", detailWidth);
  $("foreignObject").attr("height", targetHeight);
}
