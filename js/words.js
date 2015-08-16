var fill = d3.scale.category10();

var layout = d3.layout.cloud()
    .size([900, 700])
    .words([
      "get_area_gsf", "get_generator_gsf", "get_hvdc_gsf", "get_par_gsf",
      "__explode_hvdc_t1__", "__explode_par_t1__", "get_hvdc_dispatch",
      "get_par_base_angle", "get_par_angle",
      "__filter_outage_hours__", "__code_to_hours__", "__get_outage_hours__",
      "get_generator_planned_outage_hours", "get_generatpr_forced_outage_hours",
      "__period_hours__", "get_generator_planned_outage_rates", "get_generator_forced_outage_rates",
      "__validate_peak_def__", "set_peak_definition", "__get_peak_definition__",
      "__on_peaks_in_year__", "__off_peaks_in_year__", "get_generator_peak_spot_prices",
      "get_generator_off_peak_spot_prices", "get_area_peak_spot_prices",
      "get_area_off_peak_spot_prices", "get_pool_peak_spot_prices",
      "get_pool_off_peak_spot_prices", "get_company_peak_spot_prices",
      "get_company_off_peak_spot_prices"].map(function(d) {
      return {text: d, size: 6 + Math.random() * 40};
    }))
    .padding(2)
    .rotate(function() { return (~~(Math.random() * 6) - 3) * 30; })
    .font("Impact")
    .fontSize(function(d) { return d.size; })
    .on("end", draw);

layout.start();

function draw(words) {
  d3.select("#ge-project1-wordcloud").append("svg")
      .attr("width", layout.size()[0])
      .attr("height", layout.size()[1])
    .append("g")
      .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")")
    .selectAll("text")
      .data(words)
    .enter().append("text")
      .style("font-size", function(d) { return d.size + "px"; })
      .style("font-family", "Impact")
      .style("opacity", .3)
      .style("fill", function(d, i) { return fill(i); })
      .attr("text-anchor", "middle")
      .attr("transform", function(d) {
        return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
      })
      .text(function(d) { return d.text; })
      .on("mouseover", function() { d3.select(this).style("opacity", 1) })
      .on("mouseout", function() { d3.select(this).style("opacity", .3) });
}